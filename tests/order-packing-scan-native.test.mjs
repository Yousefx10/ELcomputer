import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createStorageNativeDatabase, storageNativeAvailable } from './helpers/storageNativeDatabase.mjs'
import { createProductSaveFixture } from './helpers/productSaveFixture.mjs'
import { nativeWaitFor } from './helpers/emailNativeDatabase.mjs'

const migration = '20261014220000_packing_scan_authorization.sql'

// Real PostgreSQL, actual non-superuser migration owner and service_role scans.
// Auth/Storage here are schema fixtures; full HTTP/platform/browser acceptance
// is documented separately. This never connects to a supplied database.
test('H1 native serialized packing: permission correction, authorization and transaction races', {
  skip: !storageNativeAvailable, timeout: 120000
}, async t => {
  const db = await createStorageNativeDatabase({ stopBefore: migration })
  try {
    const f = await createProductSaveFixture({ database: db })
    const owner = f.actors.owner
    await db.query("update public.site_settings set payment_cash_enabled=true where key='default'")
    const product = await f.save(f.body({ is_published: false }))
    let snapshot = await f.snapshot(product.id)
    const variant = snapshot.variants[0].id
    await db.query('select public.commerce_create_procurement_order($1,$2,$3,null,0,$4::jsonb)', [
      f.supplier, f.warehouse, 'H1-' + randomUUID(),
      JSON.stringify([{ product_id: product.id, variant_id: variant, quantity: 12, unit_cost: 40 }])
    ])
    snapshot = await f.snapshot(product.id)
    await f.save({ ...f.body(), title: snapshot.product.title, slug: snapshot.product.slug,
      expected_revision: snapshot.revision, is_published: true, variants: snapshot.variants },
    { operation: 'update', id: product.id })

    const createOrder = async (quantity, actor = owner) => {
      const result = (await db.query('select public.commerce_create_customer_order($1,$2::jsonb,$3::jsonb,false,$4) result', [
        f.actors.customer,
        JSON.stringify({ first_name: 'Native buyer', phone: '01012345678', street_address: 'Fixture street', city: 'Cairo', governorate: 'Cairo', payment_method: 'cash' }),
        JSON.stringify([{ product_id: product.id, variant_id: variant, quantity }]), randomUUID()
      ])).rows[0].result
      const order = result.order.id, work = randomUUID(), session = randomUUID()
      await db.query('insert into public.order_packing_work_sessions(id,admin_user_id,operator_name) values($1,$2,\'Native packer\')', [work, actor])
      await db.query('insert into public.order_packing_sessions(id,order_id,admin_user_id,work_session_id) values($1,$2,$3,$4)', [session, order, actor, work])
      const units = (await db.query('select * from public.commerce_serialized_units where customer_order_id=$1 order by unit_code', [order])).rows
      return { order, work, session, units, actor }
    }
    const pack = await createOrder(4)
    // Release this first work/session before creating another owner claim.
    await db.query("update public.order_packing_sessions set status='cancelled' where id=$1", [pack.session])
    await db.query("update public.order_packing_work_sessions set status='closed',closed_at=now() where id=$1", [pack.work])
    const other = await createOrder(1)
    await db.query("update public.order_packing_sessions set status='cancelled' where id=$1", [other.session])
    await db.query("update public.order_packing_work_sessions set status='closed',closed_at=now() where id=$1", [other.work])
    const work = randomUUID(), session = randomUUID()
    await db.query('insert into public.order_packing_work_sessions(id,admin_user_id,operator_name) values($1,$2,\'Native packer\')', [work, owner])
    await db.query('insert into public.order_packing_sessions(id,order_id,admin_user_id,work_session_id) values($1,$2,$3,$4)', [session, pack.order, owner, work])
    pack.session = session; pack.work = work
    const service = await db.connect('service_role')
    const insert = (client, unit, overrides = {}) => {
      const row = { session: pack.session, item: unit.customer_order_item_id, unit: unit.id, code: unit.unit_code, actor: owner, ...overrides }
      return client.query('insert into public.order_packing_scans(session_id,order_item_id,serialized_unit_id,scanned_code,scanned_by) values($1,$2,$3,$4,$5) returning id', [row.session, row.item, row.unit, row.code, row.actor])
    }
    const aclSql = "select n.nspname,c.relname,c.relacl::text,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','catalog_private','storage') and c.relkind='r' order by 1,2"
    const acl = (await db.query(aclSql)).rows
    await t.test('original service role can SELECT but its locking scan fails', async () => {
      assert.equal((await service.query('select id from public.commerce_serialized_units where id=$1', [pack.units[0].id])).rowCount, 1)
      await assert.rejects(() => service.query('select id from public.commerce_serialized_units where id=$1 for share', [pack.units[0].id]), e => e.code === '42501' && /commerce_serialized_units/.test(e.message))
      // This older schema fixture also lacks managed default read grants.
      // The exact HTTP failure under release79 grants is recorded separately.
      await assert.rejects(() => insert(service, pack.units[0]), e => e.code === '42501')
    })
    await db.query(await readFile(new URL('../supabase/migrations/' + migration, import.meta.url), 'utf8'))
    await t.test('migration changes no table ACL or RLS and exposes no callable function', async () => {
      assert.deepEqual((await db.query(aclSql)).rows, acl)
      for (const role of ['anon', 'authenticated', 'service_role']) {
        const privileges = (await db.query("select has_function_privilege($1,'public.validate_order_packing_scan()','EXECUTE') execute,has_any_column_privilege($1,'public.commerce_serialized_units','UPDATE') update", [role])).rows[0]
        assert.deepEqual(privileges, { execute: false, update: false })
      }
      const fn = (await db.query("select prosecdef,proconfig from pg_proc where oid='public.validate_order_packing_scan()'::regprocedure")).rows[0]
      assert.equal(fn.prosecdef, true)
      assert.deepEqual(fn.proconfig, ['search_path=pg_catalog, public, pg_temp'])
      assert.equal((await db.query('select rolsuper from pg_roles where rolname=current_user')).rows[0].rolsuper, false)
    })
    await t.test('the privileged trigger refuses attachment to a generic relation', async () => {
      await db.query('create temporary table forged_packing_scan (scanned_by uuid)')
      await db.query('create trigger forged_scan before insert on forged_packing_scan for each row execute function public.validate_order_packing_scan()')
      await assert.rejects(() => db.query('insert into forged_packing_scan values($1)', [owner]), e => e.code === '42501' && /Invalid packing scan operation/.test(e.message))
    })
    await t.test('browser roles cannot insert scans, invoke the trigger or update physical stock', async () => {
      for (const role of ['anon', 'authenticated']) {
        const c = await db.connect(role)
        await assert.rejects(() => insert(c, pack.units[0]), e => e.code === '42501')
        await assert.rejects(() => c.query('select public.validate_order_packing_scan()'), e => e.code === '42501')
        await assert.rejects(() => c.query("update public.commerce_serialized_units set status='in_stock' where id=$1", [pack.units[0].id]), e => e.code === '42501')
      }
      await assert.rejects(() => service.query('select public.validate_order_packing_scan()'), e => e.code === '42501')
      await assert.rejects(() => service.query('select id from public.commerce_serialized_units for share'), e => e.code === '42501')
    })
    await t.test('rejects wrong order/item, unassigned unit, wrong code, SKU, blank and forged actor', async () => {
      const stock = (await db.query("select * from public.commerce_serialized_units where status='in_stock' limit 1")).rows[0]
      for (const [unit, overrides, pattern] of [
        [other.units[0], { item: pack.units[0].customer_order_item_id }, /not assigned/],
        [stock, { item: pack.units[0].customer_order_item_id }, /not assigned/],
        [pack.units[0], { item: other.units[0].customer_order_item_id }, /does not belong/],
        [pack.units[0], { code: 'WRONG' }, /does not match/],
        [pack.units[0], { unit: null, code: snapshot.product.sku }, /exact assigned/],
        [pack.units[0], { code: ' ' }, /valid item code/],
        [pack.units[0], { actor: f.actors.customer }, /cannot process/],
        [pack.units[0], { actor: f.actors.viewer }, /cannot process/]
      ]) await assert.rejects(() => insert(service, unit, overrides), pattern)
    })
    await t.test('revoked staff authorization is checked inside the transaction', async () => {
      await db.query('update public.admin_users set is_active=false where id=$1', [owner])
      await assert.rejects(() => insert(service, pack.units[0]), /cannot process/)
      await db.query('update public.admin_users set is_active=true where id=$1', [owner])
      await db.query("update public.admin_users set permissions='{}',role='admin' where id=$1", [owner])
      await assert.rejects(() => insert(service, pack.units[0]), /cannot process/)
      await db.query("update public.admin_users set permissions='{\"dashboard.view\":true,\"dashboard.orders\":true}' where id=$1", [owner])
    })
    const inventorySql = "select to_jsonb(u) row from public.commerce_serialized_units u order by id"
    const inventoryBefore = (await db.query(inventorySql)).rows
    await t.test('assigned QR succeeds for named staff without inventory or financial writes', async () => {
      assert.equal((await insert(service, pack.units[0], { code: pack.units[0].qr_token })).rowCount, 1)
      assert.deepEqual((await db.query(inventorySql)).rows, inventoryBefore)
      await db.query("update public.admin_users set role='owner' where id=$1", [owner])
    })
    const a = await db.connect('service_role'), b = await db.connect('service_role')
    await t.test('simultaneous duplicate scans have exactly one winner', async () => {
      const results = await Promise.allSettled([insert(a, pack.units[1]), insert(b, pack.units[1])])
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
      assert.equal(results.filter(r => r.status === 'rejected' && r.reason.code === '23505').length, 1)
    })
    await t.test('two distinct simultaneous scans both commit within the required quantity', async () => {
      const results = await Promise.allSettled([insert(a, pack.units[2]), insert(b, pack.units[3])])
      assert.ok(results.every(r => r.status === 'fulfilled'))
      assert.equal((await db.query('select count(*)::int n from public.order_packing_scans where session_id=$1', [pack.session])).rows[0].n, 4)
    })
    await t.test('lost-acknowledgement retries cannot add another scan', async () => {
      await assert.rejects(() => insert(service, pack.units[2]), /already complete|duplicate key/)
      assert.equal((await db.query('select count(*)::int n from public.order_packing_scans where session_id=$1', [pack.session])).rows[0].n, 4)
      assert.deepEqual((await db.query(inventorySql)).rows, inventoryBefore)
    })
    await t.test('scan holds actor and assigned unit locks until commit', async () => {
      // Use a new empty session after release; retained scan history is immutable.
      await db.query("update public.order_packing_sessions set status='cancelled' where id=$1", [pack.session])
      pack.session = randomUUID()
      await db.query('insert into public.order_packing_sessions(id,order_id,admin_user_id,work_session_id) values($1,$2,$3,$4)', [pack.session, pack.order, owner, pack.work])
      const writer = await db.connect('postgres')
      await a.query('begin')
      await insert(a, pack.units[0])
      const waiting = writer.query('update public.admin_users set is_active=false where id=$1', [owner])
      await nativeWaitFor(async () => (await db.query("select wait_event_type from pg_stat_activity where pid=$1", [writer.processID])).rows[0]?.wait_event_type === 'Lock')
      await a.query('rollback'); await waiting
      await assert.rejects(() => insert(service, pack.units[0]), /cannot process/)
      await db.query('update public.admin_users set is_active=true where id=$1', [owner])
      await a.query('begin'); await insert(a, pack.units[0])
      const unitWrite = writer.query("update public.commerce_serialized_units set updated_at=updated_at where id=$1", [pack.units[0].id])
      await nativeWaitFor(async () => (await db.query("select wait_event_type from pg_stat_activity where pid=$1", [writer.processID])).rows[0]?.wait_event_type === 'Lock')
      await a.query('rollback'); assert.equal((await unitWrite).rowCount, 1)
    })
    await t.test('a return committed while a scan waits invalidates its assigned unit', async () => {
      const writer = await db.connect('postgres')
      await writer.query('begin')
      await writer.query('select public.commerce_return_serialized_unit($1,$2,\'H1 native return\',null,$3)', [pack.units[0].id, f.warehouse, owner])
      const pending = Promise.allSettled([insert(a, pack.units[0])])
      // A non-superuser can inspect activity for its own role, not other roles.
      await nativeWaitFor(async () => (await b.query("select wait_event_type from pg_stat_activity where pid=$1", [a.processID])).rows[0]?.wait_event_type === 'Lock')
      await writer.query('commit')
      const [result] = await pending
      assert.equal(result.status, 'rejected')
      assert.match(result.reason.message, /not assigned|not available/)
      assert.equal((await db.query('select count(*)::int n from public.order_packing_scans where session_id=$1', [pack.session])).rows[0].n, 0)
    })
    await t.test('returned units and stale closed sessions fail without recording a scan', async () => {
      await assert.rejects(() => insert(service, pack.units[0]), /not assigned|not available/)
      await db.query('select public.close_order_packing_work_session($1,$2,\'Native packer\',null,\'owner\')', [pack.work, owner])
      await assert.rejects(() => insert(service, pack.units[1]), /no longer active/)
    })
  } finally { await db.close() }
})
