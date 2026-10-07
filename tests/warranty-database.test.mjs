import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createOrderSmsFixture } from './helpers/orderSmsFixture.mjs'
import { warrantyEntitlement } from '../app/utils/warranty.js'

const migration = '20261007120000_warranty_entitlements.sql'
const columns = ['warranty_status', 'warranty_duration_value', 'warranty_duration_unit', 'warranty_start_basis', 'warranty_snapshot_at']
const terms = item => Object.fromEntries(columns.map(key => [key, item[key]]))

test('real migration and authoritative normal/preorder transactions preserve immutable entitlements', async t => {
  const f = await createOrderSmsFixture({ stopBefore: migration })
  const { db } = f
  const sql = (text, args = []) => db.query(text, args)
  const items = async order => (await sql('select * from public.customer_order_items where order_id=$1 order by product_title', [order.id || order])).rows
  const historical = await f.checkout()
  const historicalItems = await items(historical)
  const beforeOrder = await f.order(historical.id)
  const originalFunctions = (await sql("select proname,prosrc from pg_proc join pg_namespace n on n.oid=pronamespace where n.nspname='public'")).rows
  const boundaryTables = ['shipping_provider_settings', 'shipping_status_mappings', 'shipping_order_jobs', 'shipping_webhook_events', 'sms_provider_settings', 'sms_templates', 'sms_order_event_settings', 'sms_order_events', 'sms_batches', 'sms_messages', 'sms_attempts', 'site_settings']
  const before = Object.fromEntries(await Promise.all(boundaryTables.map(async table => [table, (await sql('select to_jsonb(t) row from public.' + table + ' t order by to_jsonb(t)::text')).rows])))
  await db.exec(await readFile(new URL('../supabase/migrations/' + migration, import.meta.url), 'utf8'))
  const checkout = async (lines, { preorder = false, cart = randomUUID(), customer = f.customer } = {}) => {
    const order = { order_number: 'WARRANTY-' + cart, first_name: 'Buyer', phone: '01012345678', street_address: 'Street', city: 'Cairo', governorate: 'Cairo', payment_method: preorder ? 'bank_transfer' : 'cash', locale: 'ar', warranty_status: 'none' }
    const call = preorder ? 'public.commerce_create_preorder($1,$2::jsonb,$3::jsonb,$4)' : 'public.commerce_create_customer_order($1,$2::jsonb,$3::jsonb,false,$4)'
    return (await sql('select ' + call + ' as result', [customer, JSON.stringify(order), JSON.stringify(lines), cart])).rows[0].result
  }
  const configure = (id, status, value = null, unit = null) => sql('update public.products set warranty_status=$2,warranty_duration_value=$3,warranty_duration_unit=$4 where id=$1', [id, status, value, unit])
  try {
    await t.test('migration preserves historical order/item fields, provider settings/ledgers and every existing function body', async () => {
      assert.deepEqual(await f.order(historical.id), beforeOrder)
      const [after] = await items(historical)
      assert.deepEqual(Object.fromEntries(Object.entries(after).filter(([key]) => !columns.includes(key))), historicalItems[0])
      assert.deepEqual(terms(after), Object.fromEntries(columns.map(key => [key, null])))
      assert.equal(warrantyEntitlement(after).status, 'unknown')
      for (const table of boundaryTables) assert.deepEqual((await sql('select to_jsonb(t) row from public.' + table + ' t order by to_jsonb(t)::text')).rows, before[table], table)
      for (const original of originalFunctions) {
        const name = ['commerce_create_customer_order', 'commerce_create_preorder'].includes(original.proname) ? original.proname + '_before_warranty' : original.proname
        assert.ok((await sql('select prosrc from pg_proc where proname=$1', [name])).rows.some(row => row.prosrc === original.prosrc), name)
      }
    })
    await t.test('database rejects invalid/null structured terms including SQL CHECK null bypasses', async () => {
      for (const [status, value, unit] of [['included', null, 'months'], ['included', 12, null], ['included', 0, 'months'], ['included', -1, 'years'], ['included', 121, 'months'], ['included', 11, 'years'], ['included', 1, 'days'], ['none', 12, 'months'], ['unknown', 1, 'years'], ['active', null, null]]) {
        await assert.rejects(() => configure(f.product, status, value, unit), /products_warranty_terms_check/)
      }
    })
    const originalCart = randomUUID()
    let first, firstItem
    await t.test('normal purchase ignores browser-forged terms and captures months from the locked product', async () => {
      await configure(f.product, 'included', 12, 'months')
      first = (await checkout([{ product_id: f.product, quantity: 1, warranty_status: 'none', warranty_duration_value: 99, warranty_duration_unit: 'years', warranty_start_basis: 'order_date', warranty_snapshot_at: '2000-01-01' }], { cart: originalCart })).order
      ;[firstItem] = await items(first)
      assert.equal(firstItem.warranty_status, 'included')
      assert.equal(firstItem.warranty_duration_value, 12)
      assert.equal(firstItem.warranty_duration_unit, 'months')
      assert.equal(firstItem.warranty_start_basis, 'unresolved')
      assert.ok(firstItem.warranty_snapshot_at)
      assert.equal(Number(firstItem.unit_price), 125.5)
      assert.equal(first.payment_status, 'pending')
      assert.equal(first.status, 'pending_payment')
      assert.equal(first.sms_locale, 'ar')
      assert.equal(Number(first.total_amount), 130.5)
      assert.equal((await f.events(first.id))[0].event_type, 'order_confirmed')
      assert.equal((await f.events(first.id))[0].reason, 'provider_disabled')
    })
    await t.test('editing 12 to 24 months leaves Order A unchanged; Order B receives 24; retries retain Order A', async () => {
      await configure(f.product, 'included', 24, 'months')
      const second = (await checkout([{ product_id: f.product, quantity: 1 }])).order
      assert.equal((await items(second))[0].warranty_duration_value, 24)
      assert.deepEqual(terms((await items(first))[0]), terms(firstItem))
      const retry = await checkout([{ product_id: f.product, quantity: 1 }], { cart: originalCart })
      assert.equal(retry.created, false)
      assert.equal(retry.order.id, first.id)
      assert.deepEqual(terms((await items(first))[0]), terms(firstItem))
    })
    await t.test('removing warranty does not erase existing snapshots; new orders record explicit no warranty', async () => {
      await configure(f.product, 'none')
      const newOrder = (await checkout([{ product_id: f.product, quantity: 1 }])).order
      assert.equal(warrantyEntitlement((await items(newOrder))[0]).status, 'not_applicable')
      assert.deepEqual(terms((await items(first))[0]), terms(firstItem))
    })
    await t.test('unconfigured new product and historical purchases are unknown, never no warranty', async () => {
      await configure(f.product, 'unknown')
      const unknown = (await checkout([{ product_id: f.product, quantity: 1 }])).order
      assert.equal((await items(unknown))[0].warranty_status, 'unknown')
      assert.ok((await items(unknown))[0].warranty_snapshot_at)
      assert.equal(warrantyEntitlement((await items(unknown))[0]).hasWarranty, null)
      await configure(f.product, 'included', 3, 'years')
      assert.equal((await items(historical))[0].warranty_status, null)
      // Imports/appends cannot copy today's terms or inject a backfill.
      const appended = (await sql("insert into public.customer_order_items(order_id,product_id,product_title,quantity,warranty_status,warranty_duration_value,warranty_duration_unit,warranty_start_basis,warranty_snapshot_at) values($1,$2,'Historical appended',1,'included',10,'years','unresolved',now()) returning *", [historical.id, f.product])).rows[0]
      assert.equal(appended.warranty_status, null)
      assert.equal(appended.warranty_snapshot_at, null)
      await assert.rejects(() => sql("update public.customer_order_items set warranty_status='none',warranty_snapshot_at=now() where id=$1", [historicalItems[0].id]), /immutable/)
    })
    const secondProduct = randomUUID(), thirdProduct = randomUUID()
    await t.test('multiple normal items capture different month/year/none terms independently', async () => {
      await sql("select set_config('app.serialized_inventory_write','on',false)")
      await sql("insert into public.products(id,title,slug,price,stock_quantity,is_serialized,warranty_status,warranty_duration_value,warranty_duration_unit) values($1,'Months',($1::uuid)::text,50,10,false,'included',18,'months'),($2,'None',($2::uuid)::text,50,10,false,'none',null,null)", [secondProduct, thirdProduct])
      await sql("select set_config('app.serialized_inventory_write','off',false)")
      const mixed = (await checkout([f.product, secondProduct, thirdProduct].map(product_id => ({ product_id, quantity: 1 })))).order
      const list = await items(mixed)
      assert.equal(list.length, 3)
      assert.deepEqual(list.map(item => [item.warranty_status, item.warranty_duration_value, item.warranty_duration_unit]).sort(), [['included', 18, 'months'], ['included', 3, 'years'], ['none', null, null]].sort())
    })
    await t.test('preorder snapshots at reservation with unchanged payment and stock rules', async () => {
      const product = (await sql("select id from public.products where selling_mode='preorder'")).rows[0].id
      await configure(product, 'included', 2, 'years')
      const stock = (await sql('select stock_quantity from public.products where id=$1', [product])).rows[0].stock_quantity
      const pre = (await checkout([{ product_id: product, quantity: 1, warranty_duration_value: 9 }], { preorder: true })).order
      assert.equal((await items(pre))[0].warranty_duration_value, 2)
      assert.equal((await items(pre))[0].warranty_duration_unit, 'years')
      assert.equal(pre.status, 'on_hold')
      assert.equal(pre.payment_status, 'pending')
      assert.equal(pre.preorder_fulfillment_state, 'awaiting_stock')
      assert.equal((await sql('select stock_quantity from public.products where id=$1', [product])).rows[0].stock_quantity, stock)
    })
    await t.test('serialized model/SKU identity and stock assignment retain product-level warranty', async () => {
      const product = randomUUID(), variant = randomUUID(), warehouse = randomUUID(), unit = randomUUID()
      await sql("insert into public.commerce_warehouses(id,name) values($1,'Serialized warranty fixture')", [warehouse])
      await sql("select set_config('app.serialized_inventory_write','on',false)")
      await sql("insert into public.products(id,title,slug,price,stock_quantity,is_serialized,primary_warehouse_id,warranty_status,warranty_duration_value,warranty_duration_unit) values($1,'Serialized warranty',($1::uuid)::text,100,1,true,$2,'included',18,'months')", [product, warehouse])
      await sql("insert into public.product_variants(id,product_id,name,code,sku,price,stock_quantity) values($1,$2,'Blue','BLUE','WARRANTY-BLUE',999,1)", [variant, product])
      await sql("insert into public.commerce_serialized_units(id,unit_code,product_id,variant_id,warehouse_id) values($1,'WARRANTY-UNIT',$2,$3,$4)", [unit, product, variant, warehouse])
      await sql('insert into public.commerce_warehouse_inventory(warehouse_id,product_id,quantity) values($1,$2,1)', [warehouse, product])
      await sql("select set_config('app.serialized_inventory_write','off',false)")
      const order = (await checkout([{ product_id: product, variant_id: variant, quantity: 1, warranty_duration_value: 99 }])).order
      const [item] = await items(order)
      assert.equal(item.variant_id, variant)
      assert.equal(item.variant_sku, 'WARRANTY-BLUE')
      assert.equal(item.variant_code, 'BLUE')
      assert.equal(Number(item.unit_price), 100)
      assert.equal(item.warranty_duration_value, 18)
      assert.equal((await sql('select status from public.commerce_serialized_units where id=$1', [unit])).rows[0].status, 'sold')
    })
    await t.test('failed/rolled-back checkout leaves no snapshot/order/stock/SMS side effect and capture scope does not leak', async () => {
      const stock = (await sql('select stock_quantity from public.products where id=$1', [f.product])).rows[0].stock_quantity
      const counts = (await sql('select (select count(*) from public.customer_orders) orders,(select count(*) from public.customer_order_items) items,(select count(*) from public.sms_order_events) sms')).rows[0]
      await assert.rejects(() => checkout([{ product_id: f.product, quantity: 1 }, { product_id: randomUUID(), quantity: 1 }]))
      await db.exec('begin')
      await checkout([{ product_id: f.product, quantity: 1 }])
      await db.exec('rollback')
      assert.deepEqual((await sql('select (select count(*) from public.customer_orders) orders,(select count(*) from public.customer_order_items) items,(select count(*) from public.sms_order_events) sms')).rows[0], counts)
      assert.equal((await sql('select stock_quantity from public.products where id=$1', [f.product])).rows[0].stock_quantity, stock)
      assert.notEqual((await sql("select current_setting('app.warranty_purchase_capture',true) value")).rows[0].value, 'on')
    })
    await t.test('even trusted service writes cannot mutate captured warranty or rebind its purchase', async () => {
      for (const set of ["warranty_duration_value=24", "warranty_status='none'", "warranty_start_basis='order_date'", "warranty_snapshot_at=null", "warranty_duration_unit='years'"]) await assert.rejects(() => sql('update public.customer_order_items set ' + set + ' where id=$1', [firstItem.id]), /immutable/)
      for (const [key, value] of [['order_id', historical.id], ['product_id', secondProduct], ['variant_id', randomUUID()]]) await assert.rejects(() => sql('update public.customer_order_items set ' + key + '=$2 where id=$1', [firstItem.id, value]), /cannot be reassigned/)
    })
    await t.test('owner reads snapshots under RLS; another customer/anonymous cannot read or mutate; checkout internals are private', async () => {
      const bob = randomUUID()
      await sql("insert into auth.users(id,email) values($1,'warranty-bob@example.invalid')", [bob])
      await db.exec('grant select on public.products to authenticated; grant select,insert,update on public.customer_order_items to authenticated; grant select on public.customer_orders to authenticated,anon; grant select on public.customer_order_items to anon')
      for (const [role, user, expected] of [['authenticated', f.customer, 1], ['authenticated', bob, 0], ['anon', bob, 0]]) {
        await sql("select set_config('request.jwt.claim.sub',$1,false)", [user])
        await sql("select set_config('request.jwt.claim.role',$1,false)", [role])
        await db.exec('set role ' + role)
        const owned = (await sql('select warranty_duration_value from public.customer_order_items where id=$1', [firstItem.id])).rows
        assert.equal(owned.length, expected)
        if (expected) assert.equal(owned[0].warranty_duration_value, 12)
        if (role === 'authenticated') {
          assert.equal((await sql('update public.customer_order_items set warranty_duration_value=24 where id=$1 returning id', [firstItem.id])).rows.length, 0)
          await assert.rejects(() => sql("insert into public.customer_order_items(order_id,product_id,product_title,quantity) values($1,$2,'Forge',1)", [first.id, f.product]), /row-level security/)
        }
        for (const signature of ['commerce_create_customer_order(null,null,null,false,null)', 'commerce_create_preorder(null,null,null,null)', 'commerce_create_customer_order_before_warranty(null,null,null,false,null)', 'commerce_create_preorder_before_warranty(null,null,null,null)']) await assert.rejects(() => sql('select public.' + signature), /permission denied/)
        await db.exec('reset role')
      }
      await sql("select set_config('request.jwt.claim.role','service_role',false)")
    })
    await t.test('existing product RBAC requires products.edit, including direct browser updates', async () => {
      const editor = randomUUID(), viewer = randomUUID()
      await sql("insert into auth.users(id,email) values($1,'warranty-editor@example.invalid'),($2,'warranty-viewer@example.invalid')", [editor, viewer])
      await sql("insert into public.admin_users(id,email,role,permissions) values($1,'warranty-editor@example.invalid','admin','{\"products.edit\":true,\"products.view\":true}'),($2,'warranty-viewer@example.invalid','admin','{\"products.view\":true}')", [editor, viewer])
      await db.exec('grant select on public.admin_users to authenticated; grant select,update on public.products to authenticated')
      for (const [user, count] of [[viewer, 0], [editor, 1]]) {
        await sql("select set_config('request.jwt.claim.sub',$1,false)", [user])
        await sql("select set_config('request.jwt.claim.role','authenticated',false)")
        await db.exec('set role authenticated')
        assert.equal((await sql("update public.products set warranty_duration_value=4 where id=$1 returning id", [f.product])).rows.length, count)
        await db.exec('reset role')
      }
      await sql("select set_config('request.jwt.claim.role','service_role',false)")
      assert.deepEqual(terms((await items(first))[0]), terms(firstItem))
    })
    await t.test('catalog deletion keeps purchased snapshots and existing SET NULL foreign-key behavior', async () => {
      const order = (await checkout([{ product_id: thirdProduct, quantity: 1 }])).order
      const [item] = await items(order)
      await sql('delete from public.products where id=$1', [thirdProduct])
      const [detached] = await items(order)
      assert.equal(detached.product_id, null)
      assert.deepEqual(terms(detached), terms(item))
    })
    await t.test('service-role checkout grant remains usable while bypass implementations stay private', async () => {
      await db.exec('set role service_role')
      try {
        const result = await checkout([{ product_id: f.product, quantity: 1 }])
        assert.equal(result.created, true)
        await assert.rejects(() => sql('select public.commerce_create_customer_order_before_warranty(null,null,null,false,null)'), /permission denied/)
      } finally { await db.exec('reset role') }
    })
  } finally { await db.close() }
})
