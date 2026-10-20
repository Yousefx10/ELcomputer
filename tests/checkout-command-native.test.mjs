import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createResetPlatform, resetPlatformAvailable } from './helpers/systemResetPlatform.mjs'

// Actual PostgreSQL/Auth/PostgREST/Storage; the esbuild HTTP shell is a fixture.
// Separate acceptance uses the compiled Nuxt application and two Chrome tabs.
test('purchase-bound checkout preserves retries, commercial integrity and reset exclusion', { skip: !resetPlatformAvailable }, async t => {
  const f = await createResetPlatform()
  try {
    await f.db.query("update public.site_settings set payment_cash_enabled=true,payment_cash_fee=2,payment_bank_transfer_enabled=true,payment_bank_transfer_fee=1 where key='default'")
    const shipping = (await f.db.query("insert into public.commerce_shipping_companies(name,checkout_enabled,checkout_governorates,client_shipping_price) values('Native configured delivery',true,array['Cairo'],0) returning id")).rows[0].id
    const warehouse = (await f.db.query("insert into public.commerce_warehouses(name,code) values('Native H3','NATIVE-H3') returning id")).rows[0].id
    const supplier = (await f.db.query("insert into public.commerce_crm_accounts(name,account_type) values('Native H3 supplier','supplier') returning id")).rows[0].id
    const product = (await f.db.query("insert into public.products(title,slug,price,is_serialized,primary_warehouse_id,is_published) values('Native H3 product','native-h3',20,true,$1,true) returning id", [warehouse])).rows[0].id
    const variants = (await f.db.query("select id from public.product_variants where product_id=$1", [product])).rows
    const variant = variants[0].id
    const otherVariant = (await f.db.query("insert into public.product_variants(product_id,name,code,sku) values($1,'Second','SECOND','NATIVE-H3-SECOND') returning id", [product])).rows[0].id
    const receipt = await f.browser.rpc('commerce_create_procurement_order', { p_supplier_id: supplier, p_warehouse_id: warehouse, p_invoice_number: 'NATIVE-H3-RECEIPT', p_notes: '', p_paid_amount: 0, p_items: [variant, otherVariant].map(id => ({ product_id: product, variant_id: id, quantity: 30, unit_cost: 10 })) })
    assert.equal(receipt.error, null)
    await f.db.query("insert into public.site_coupons(code,discount_type,discount_value,minimum_order_amount,is_active,usage_limit) values('H3', 'percentage',10,0,true,100)")
    const input = () => ({ cart_id: randomUUID(), items: [{ id: product, variant_id: variant, quantity: 1 }], coupon_code: 'H3', address: { first_name: 'Native', last_name: 'Customer', street_address: 'Owned street', city: 'Cairo', governorate: 'Cairo', phone: '01012345678', email: 'customer@native.invalid' }, shipping_method: 'shipping', shipping_company_id: shipping, payment_method: 'cash', locale: 'en' })
    const quote = async (body, actor = 'customer') => {
      if (body.payment_method !== 'cash') delete body.shipping_company_id
      const r = await f.call('/api/checkout/quote', { method: 'POST', actor, body })
      assert.equal(r.response.status, 200, JSON.stringify(r.body))
      return { ...body, quote_id: r.body.quoteId }
    }
    const send = (body, actor = 'customer') => f.call('/api/checkout', { method: 'POST', actor, body })
    const counts = async () => (await f.db.query("select (select count(*)::int from public.customer_orders) orders,(select count(*)::int from private.checkout_commands where intent_hash is not null) commands,(select count(*)::int from public.commerce_serialized_units where customer_order_id is not null) allocated,(select usage_count from public.site_coupons where code='H3') coupons,(select count(*)::int from public.treasury_transactions) financial")).rows[0]
    let command, committed
    await t.test('native quote and normal checkout use trusted prices, discount and payment fee', async () => {
      command = await quote(input()); const r = await send(command)
      assert.equal(r.response.status, 200, JSON.stringify(r.body)); committed = r.body.order
      assert.equal(committed.totalAmount, 20); assert.equal(committed.subtotalAmount, 20); assert.equal(committed.discountAmount, 2); assert.equal(committed.paymentFeeAmount, 2)
      assert.equal(r.response.headers.get('cache-control'), 'private, no-store')
      assert.deepEqual(await counts(), { orders: 1, commands: 1, allocated: 1, coupons: 1, financial: 0 })
    })
    await t.test('identical retry succeeds after quote expiration and price or stock changes', async () => {
      await f.db.query('update private.checkout_quotes set expires_at=clock_timestamp()-interval \'1 second\' where id=$1', [command.quote_id])
      await f.db.query('update public.products set price=21 where id=$1', [product])
      assert.equal((await send(command)).body.order.id, committed.id)
      await f.db.query('update public.products set price=20 where id=$1', [product])
      assert.deepEqual(await counts(), { orders: 1, commands: 1, allocated: 1, coupons: 1, financial: 0 })
    })
    await t.test('changed products, variants, quantities, account and all delivery/financial inputs conflict', async () => {
      const before = await counts()
      for (const changed of [{ items: [{ ...command.items[0], quantity: 2 }] }, { items: [{ ...command.items[0], variant_id: otherVariant }] }, { items: [{ ...command.items[0], id: randomUUID() }] }, { payment_method: 'bank_transfer' }, { shipping_method: 'pickup' }, { coupon_code: '' }, ...Object.keys(command.address).map(key => ({ address: { ...command.address, [key]: key === 'phone' ? '01012345679' : 'Changed' } }))]) {
        const r = await send({ ...command, ...changed }); assert.ok([400, 409].includes(r.response.status), JSON.stringify(r.body)); assert.equal(r.body.order, undefined)
      }
      await f.createActor('other-customer')
      assert.equal((await send(command, 'other-customer')).response.status, 409)
      assert.deepEqual(await counts(), before)
    })
    await t.test('normalization aggregates and sorts lines while forged financial values are rejected', async () => {
      const body = input(); body.items = [{ ...body.items[0], quantity: 1 }, { ...body.items[0], quantity: 1 }]
      const keyed = await quote(body), first = await send(keyed)
      assert.equal(first.response.status, 200)
      assert.equal((await send({ ...keyed, items: [{ ...body.items[0], quantity: 2 }] })).body.order.id, first.body.order.id)
      assert.equal((await send({ ...keyed, items: [{ ...body.items[0], price: 0.01 }] })).response.status, 400)
      assert.equal((await send({ ...keyed, items: [{ ...body.items[0], quantity: 0 }] })).response.status, 400)
    })
    await t.test('eight simultaneous identical commands commit one order, allocation and coupon use', async () => {
      const body = await quote(input()), before = await counts(), rs = await Promise.all(Array.from({ length: 8 }, () => send(body)))
      assert.ok(rs.every(r => r.response.status === 200), JSON.stringify(rs.map(r => r.body)))
      assert.ok(rs.every(r => r.body.order.id === rs[0].body.order.id))
      const after = await counts(); for (const key of ['orders', 'commands', 'allocated', 'coupons']) assert.equal(after[key], before[key] + 1)
      assert.equal(after.financial, 0)
    })
    await t.test('competing changed commands and account conversion serialize without two orders', async () => {
      const body = await quote(input()), changed = { ...body, items: [{ ...body.items[0], quantity: 2 }] }, before = await counts()
      const otherQuote = await quote({ ...body, address: { ...body.address, email: 'other@native.invalid' } }, 'other-customer')
      const rs = await Promise.all([send(body), send(changed), send(otherQuote, 'other-customer')])
      assert.equal(rs.filter(r => r.response.status === 200).length, 1)
      assert.equal((await counts()).orders, before.orders + 1)
    })
    await t.test('lost native commit response recovers the original outcome', async () => {
      const body = await quote(input()), before = await counts()
      f.lab.loseResponse('POST', '/rest/v1/rpc/commerce_checkout_command')
      assert.equal((await send(body)).response.status, 500)
      const retry = await send(body); assert.equal(retry.response.status, 200); assert.equal((await send(body)).body.order.id, retry.body.order.id)
      assert.equal((await counts()).orders, before.orders + 1)
    })
    await t.test('expired or tampered reviews require a fresh quote without writes', async () => {
      const body = await quote(input()), before = await counts()
      await f.db.query('update private.checkout_quotes set expires_at=clock_timestamp()-interval \'1 second\' where id=$1', [body.quote_id])
      assert.equal((await send(body)).response.status, 409)
      assert.equal((await send({ ...body, quote_id: randomUUID() })).response.status, 409)
      assert.equal((await send({ ...body, quote_id: undefined })).response.status, 409)
      assert.deepEqual(await counts(), before)
    })
    await t.test('price, fee, publication and stock changes after review fail without allocation', async () => {
      const before = await counts()
      for (const [sql, restore] of [
        ["update public.products set price=21 where id=$1", "update public.products set price=20 where id=$1"],
        ["update public.products set is_published=false where id=$1", "update public.products set is_published=true where id=$1"],
        ["update public.site_settings set payment_cash_fee=3 where key='default'", "update public.site_settings set payment_cash_fee=2 where key='default'"]
      ]) {
        const body = await quote(input()); await f.db.query(sql, sql.includes('$1') ? [product] : [])
        assert.equal((await send(body)).response.status, 409); await f.db.query(restore, restore.includes('$1') ? [product] : [])
      }
      const body = await quote(input())
      await f.db.query("update public.commerce_serialized_units set status='damaged' where product_id=$1 and status='in_stock'", [product])
      assert.equal((await send(body)).response.status, 409)
      await f.db.query("update public.commerce_serialized_units set status='in_stock' where product_id=$1 and status='damaged'", [product])
      assert.deepEqual(await counts(), before)
    })
    await t.test('invalid coupons, disabled gateways and unavailable items cannot quote or order', async () => {
      for (const changed of [{ coupon_code: 'INVALID' }, { payment_method: 'card' }, { items: [{ ...input().items[0], id: randomUUID() }] }]) assert.ok([400, 409].includes((await f.call('/api/checkout/quote', { method: 'POST', actor: 'customer', body: { ...input(), ...changed } })).response.status))
      const body = await quote(input()); await f.db.query("update public.site_coupons set is_active=false where code='H3'")
      assert.equal((await send(body)).response.status, 409); await f.db.query("update public.site_coupons set is_active=true where code='H3'")
    })
    await t.test('receipt insert failure rolls back order, stock, coupon and side effects', async () => {
      const body = await quote(input()), before = await counts()
      await f.db.query("create function private.fail_checkout_test() returns trigger language plpgsql as $$begin raise exception 'Owned receipt failure';end$$;create trigger fail_checkout_test before insert on private.checkout_commands for each row execute function private.fail_checkout_test()")
      assert.equal((await send(body)).response.status, 409); assert.deepEqual(await counts(), before)
      await f.db.query('drop trigger fail_checkout_test on private.checkout_commands;drop function private.fail_checkout_test()')
    })
    await t.test('current customer authority, direct RLS and browser/service RPC bypass boundaries hold', async () => {
      assert.equal((await send(command, null)).response.status, 401)
      await f.db.query('update public.customer_profiles set is_active=false where id=$1', [f.actors.customer])
      assert.equal((await send(command)).response.status, 403)
      await f.db.query('update public.customer_profiles set is_active=true where id=$1', [f.actors.customer])
      for (const role of ['anon', 'authenticated', 'service_role']) {
        for (const table of ['checkout_commands', 'checkout_quotes']) assert.equal((await f.db.query('select has_table_privilege($1,$2,\'SELECT\') allowed', [role, 'private.' + table])).rows[0].allowed, false)
        for (const name of ['commerce_create_customer_order', 'commerce_create_preorder', 'commerce_create_normal_customer_order', 'erp_create_external_customer_order']) assert.equal((await f.db.query("select bool_or(has_function_privilege($1,p.oid,'EXECUTE')) allowed from pg_proc p where p.pronamespace='public'::regnamespace and proname=$2", [role, name])).rows[0].allowed, false)
      }
      const other = f.authClient(); await other.auth.signInWithPassword({ email: 'other-customer@' + f.lab.target.project_ref + '.example.invalid', password: f.lab.owner.password })
      assert.deepEqual((await other.from('customer_orders').select('id').eq('id', committed.id)).data, [])
      assert.ok((await other.rpc('commerce_checkout_command', { p_user_id: f.actors.customer, p_cart_id: command.cart_id, p_quote_id: command.quote_id, p_order: {}, p_items: [] })).error)
    })
    await t.test('guarded manual preorder retry preserves its deposit and allocation boundary', async () => {
      const preorder = (await f.db.query("insert into public.products(title,slug,price,is_published,selling_mode,preorder_payment_mode,preorder_deposit_percent,primary_warehouse_id) values('Native preorder','native-h3-preorder',100,true,'preorder','deposit',25,$1) returning id", [warehouse])).rows[0].id
      const preorderVariant = (await f.db.query('select id from public.product_variants where product_id=$1', [preorder])).rows[0].id
      const body = await quote({ ...input(), items: [{ id: preorder, variant_id: preorderVariant, quantity: 2 }], coupon_code: '', payment_method: 'bank_transfer' })
      const before = await counts(), r = await send(body)
      assert.equal(r.response.status, 200, JSON.stringify(r.body)); assert.equal(r.body.order.isPreorder, true)
      assert.equal(r.body.order.totalAmount, 201); assert.equal(r.body.order.initialAmountDue, 51); assert.equal(r.body.order.amountPaid, 0)
      assert.equal((await send(body)).body.order.id, r.body.order.id)
      assert.equal((await counts()).allocated, before.allocated); assert.equal((await counts()).financial, 0)
      assert.equal((await send({ ...body, items: [{ id: preorder, variant_id: preorderVariant, quantity: 3 }] })).response.status, 409)
      await f.db.query('update public.products set preorder_customer_limit=2 where id=$1', [preorder])
      const capped = await quote({ ...input(), items: [{ id: preorder, variant_id: preorderVariant, quantity: 1 }], coupon_code: '', payment_method: 'bank_transfer' })
      const rejection = await send(capped)
      assert.equal(rejection.response.status, 409); assert.equal(rejection.body.data.code, 'checkout:quote')
    })
    await t.test('guarded Daftra checkout retains one reservation/job and no local inventory or accounting writes', async () => {
      const external = product
      const retainedStock = (await f.db.query('select stock_quantity from public.products where id=$1', [external])).rows[0].stock_quantity
      await f.db.query("insert into public.erp_inventory_cache(local_entity_type,local_id,product_id,external_id,quantity,cost,fetched_at) values('product_variant',$1,$2,'NATIVE-H3-REMOTE',5,10,clock_timestamp())", [otherVariant, product])
      await f.db.query("update public.site_settings set erp_mode='daftra',daftra_connection_status='error' where key='default'")
      const body = await quote({ ...input(), items: [{ id: external, variant_id: otherVariant, quantity: 2 }], payment_method: 'bank_transfer', coupon_code: '' }), r = await send(body)
      assert.equal(r.response.status, 200, JSON.stringify(r.body)); assert.equal((await send(body)).body.order.id, r.body.order.id)
      assert.equal((await f.db.query('select erp_owner from public.customer_orders where id=$1', [r.body.order.id])).rows[0].erp_owner, 'daftra')
      assert.equal((await f.db.query('select count(*)::int n from public.erp_sync_jobs where local_id=$1', [r.body.order.id])).rows[0].n, 1)
      assert.equal((await f.db.query('select count(*)::int n from public.erp_stock_reservations where local_id=$1', [otherVariant])).rows[0].n, 1)
      assert.equal((await f.db.query('select stock_quantity from public.products where id=$1', [external])).rows[0].stock_quantity, retainedStock)
      assert.equal((await counts()).financial, 0)
      await f.db.query("update public.site_settings set erp_mode='built_in' where key='default'")
    })
    await t.test('Full Reset retires committed and uncommitted checkout authority while owner survives', async () => {
      const uncommitted = await quote(input()), reset = await f.reset('full')
      assert.equal(reset.response.status, 200, JSON.stringify(reset.body))
      assert.equal((await f.db.query('select count(*)::int n from public.customer_orders')).rows[0].n, 0)
      assert.equal((await f.db.query('select count(*)::int n from private.checkout_commands where not retired_by_reset')).rows[0].n, 0)
      assert.equal((await f.db.query('select count(*)::int n from private.checkout_quotes where not retired_by_reset')).rows[0].n, 0)
      assert.equal((await f.call('/api/admin-system-reset')).response.status, 200)
      assert.equal((await send(command)).response.status, 401) // Full deletes captured customer Auth accounts.
      assert.equal((await send(uncommitted)).response.status, 401)
      const ownerReplay = await f.service.rpc('commerce_checkout_command', { p_user_id: f.actors.owner, p_cart_id: command.cart_id, p_quote_id: command.quote_id, p_order: {}, p_items: [{ product_id: product, variant_id: variant, quantity: 1 }] })
      assert.ok(ownerReplay.error)
    })
  } finally { await f.close() }
})
