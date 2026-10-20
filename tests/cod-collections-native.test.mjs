import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createPrivatePackingFixture } from './helpers/privatePackingFixture.mjs'
import { emailNativeAvailable, nativeWaitFor } from './helpers/emailNativeDatabase.mjs'

const migration = '20261020200000_normal_cod_collections.sql'
const extraRoutes = [
  ['post', '/api/admin-orders/:id/cod-cash', resolve('server/api/admin-orders/[id]/cod-cash.post.js')],
  ['get', '/api/admin-orders/:id', resolve('server/api/admin-orders/[id].get.js')],
  ['patch', '/api/admin-orders/:id', resolve('server/api/admin-orders/[id].patch.js')],
  ['post', '/api/admin-logs', resolve('server/api/admin-logs/index.post.js')]
]
const input = (changes = {}) => ({ command_id: randomUUID(), action: 'receive', collection_id: null, amount: '40.25',
  reference: 'CASH-' + randomUUID(), received_on: new Date().toISOString().slice(0, 10), confirmed: true, ...changes })
const send = (f, order, body, actor = 'editor') => f.call('/api/admin-orders/' + order + '/cod-cash', { method: 'POST', body, actor })
const counts = async f => (await f.db.query(`select (select count(*)::int from public.order_cod_collections) receipts,
 (select count(*)::int from public.order_cod_reconciliations) reconciliations,
 (select count(*)::int from public.treasury_transactions where customer_order_id is not null) treasury,
 (select count(*)::int from private.cod_collection_commands) commands,
 (select count(*)::int from public.admin_activity_logs where action_key like 'orders.cod.%') audits`)).rows[0]
const orderRow = async (f, id) => (await f.db.query('select * from public.customer_orders where id=$1', [id])).rows[0]
const details = (f, id, actor = 'editor') => f.call('/api/admin-orders/' + id, { actor })
const makeOrder = async (f, status = 'delivered') => {
  const pack = await f.newPack(1)
  const release = await f.call(pack.path + '/release', { method: 'POST', body: {} })
  assert.equal(release.response.status, 200, JSON.stringify(release.body))
  if (status !== 'processing') {
    const r = await f.call('/api/admin-orders/' + pack.order, { method: 'PATCH', body: { status } })
    assert.equal(r.response.status, 200, JSON.stringify(r.body))
  }
  return pack.order
}
const args = (f, order, body, actor = 'editor') => ({ p_actor_id: f.actors[actor], p_command_id: body.command_id,
  p_order_id: order, p_action: body.action, p_collection_id: body.collection_id, p_amount: body.amount,
  p_reference: body.reference, p_received_on: body.received_on, p_confirmed: body.confirmed })
const snapshot = async (f, id) => (await f.db.query(`select
 jsonb_build_array(subtotal_amount,discount_amount,shipping_fee_amount,payment_fee_amount,total_amount) totals,
 (select jsonb_agg(jsonb_build_array(id,quantity,unit_price,line_total) order by id) from public.customer_order_items where order_id=o.id) items,
 (select jsonb_agg(jsonb_build_array(id,status,customer_order_item_id) order by id) from public.commerce_serialized_units where customer_order_id=o.id) units,
 (select sum(quantity)::int from public.commerce_warehouse_inventory) stock from public.customer_orders o where id=$1`, [id])).rows[0]

test('normal COD: actual SQL transactions and compiled authorized APIs', { skip: !emailNativeAvailable, timeout: 180000 }, async t => {
  const f = await createPrivatePackingFixture({ extraRoutes })
  try {
    const order = await makeOrder(f, 'processing'), body = input(), before = await snapshot(f, order)
    let collection, firstResult, reconciliation, reconciliationResult
    await t.test('checkout, dispatch and delivery never mark cash paid or post treasury', async () => {
      for (const status of ['processing', 'being_shipped', 'out_for_delivery', 'delivered']) {
        const r = await f.call('/api/admin-orders/' + order, { method: 'PATCH', body: { status } })
        assert.equal(r.response.status, 200, JSON.stringify(r.body))
        const row = await orderRow(f, order)
        assert.equal(row.payment_status, 'pending'); assert.equal(row.amount_paid, '0.00'); assert.equal(row.paid_at, null)
        if (status !== 'delivered') assert.equal((await send(f, order, body)).response.status, 409)
        assert.deepEqual(await counts(f), { receipts: 0, reconciliations: 0, treasury: 0, commands: 0, audits: 0 })
      }
      assert.deepEqual(await snapshot(f, order), before)
    })
    await t.test('missing, wrong, unconfirmed and forged inputs leave no financial writes', async () => {
      for (const change of [{ amount: null }, { amount: '' }, { amount: true }, { amount: 0 }, { amount: -1 }, { amount: 0.001 },
        { amount: 'NaN' }, { amount: 'Infinity' }, { amount: '1e2' }, { amount: '10000000000' }, { amount: '108' },
        { reference: '' }, { reference: 'x'.repeat(121) }, { confirmed: false }, { confirmed: null },
        { received_on: '2026-02-30' }, { received_on: '2999-01-01' }, { received_on: '2020-01-01' },
        { actor_id: f.actors.owner }, { order_id: order }, { payment_status: 'paid' }, { treasury_transaction_id: randomUUID() }, { amount_paid: 1 }]) {
        const r = await send(f, order, { ...body, ...change })
        assert.ok([400, 409].includes(r.response.status), JSON.stringify({ change, result: r.body }))
      }
      assert.deepEqual(await counts(f), { receipts: 0, reconciliations: 0, treasury: 0, commands: 0, audits: 0 })
    })
    await t.test('anonymous/customer/disabled/viewer cannot read or confirm receipts', async () => {
      for (const [actor, expected] of [[null, 401], ['invalid', 401], ['customer', 403], ['disabled', 403], ['viewer', 403]]) {
        assert.equal((await send(f, order, body, actor)).response.status, expected)
        assert.equal((await details(f, order, actor)).response.status, expected)
      }
    })
    await t.test('partial cash updates customer balance with an immutable actor audit, no treasury income', async () => {
      const r = await send(f, order, body); assert.equal(r.response.status, 200, JSON.stringify(r.body)); firstResult = r.body; collection = r.body.collection_id
      assert.equal(r.response.headers.get('cache-control'), 'private, no-store')
      const row = await orderRow(f, order)
      assert.equal(row.status, 'delivered'); assert.equal(row.payment_status, 'partially_paid'); assert.equal(row.amount_paid, '40.25'); assert.equal(row.paid_at, null)
      const view = await details(f, order); assert.equal(view.response.status, 200, JSON.stringify(view.body))
      assert.equal(view.response.headers.get('cache-control'), 'private, no-store')
      assert.equal(view.body.codCash.outstanding, 66.75); assert.equal(view.body.codCash.received, 40.25)
      assert.equal(view.body.codCash.reconciled, 0); assert.equal(view.body.codCash.awaiting_reconciliation, 40.25)
      assert.equal(view.body.codCash.collections[0].confirmed_by, f.actors.editor)
      assert.equal(view.body.codCash.history_consistent, true)
      assert.deepEqual(await snapshot(f, order), before)
      assert.deepEqual(await counts(f), { receipts: 1, reconciliations: 0, treasury: 0, commands: 1, audits: 1 })
    })
    await t.test('same-command retry returns the original result; conflicting command or reference cannot duplicate', async () => {
      const n = await counts(f)
      assert.deepEqual((await send(f, order, body)).body, firstResult)
      for (const change of [{ amount: '40.26' }, { reference: 'different' }, { received_on: '2020-01-01' }]) {
        assert.equal((await send(f, order, { ...body, ...change })).response.status, 409)
      }
      assert.equal((await send(f, order, { ...body, command_id: randomUUID(), reference: body.reference.toLowerCase() })).response.status, 409)
      assert.equal((await send(f, order, body, 'owner')).response.status, 403)
      assert.deepEqual(await counts(f), n)
    })
    await t.test('reconciliation requires Orders plus treasury view/edit; missing or incorrect remittances do not post', async () => {
      reconciliation = input({ action: 'reconcile', collection_id: collection, reference: 'REMIT-' + randomUUID() })
      assert.equal((await send(f, order, reconciliation)).response.status, 403)
      for (const permissions of [{ 'dashboard.orders': true, 'treasury.view': true }, { 'dashboard.orders': true, 'treasury.edit': true }, { 'treasury.view': true, 'treasury.edit': true }]) {
        await f.db.query('update public.admin_users set permissions=$2 where id=$1', [f.actors.editor, JSON.stringify({ 'dashboard.view': true, ...permissions })])
        assert.equal((await send(f, order, reconciliation)).response.status, 403)
      }
      await f.db.query("update public.admin_users set permissions=permissions||'{\"dashboard.view\":true,\"dashboard.orders\":true,\"treasury.view\":true,\"treasury.edit\":true}' where id=$1", [f.actors.editor])
      const n = await counts(f)
      for (const change of [{ amount: '40' }, { amount: '40.26' }, { collection_id: randomUUID() }, { confirmed: false }, { collection_id: null }]) {
        assert.ok([400, 404, 409].includes((await send(f, order, { ...reconciliation, ...change })).response.status))
      }
      const another = await makeOrder(f)
      assert.equal((await send(f, another, reconciliation)).response.status, 404)
      assert.deepEqual(await counts(f), n)
    })
    await t.test('exact reconciliation posts one existing customer_receipt and audit without changing order payment or totals', async () => {
      const row = await orderRow(f, order)
      const r = await send(f, order, reconciliation); assert.equal(r.response.status, 200, JSON.stringify(r.body)); reconciliationResult = r.body
      const transaction = (await f.db.query('select * from public.treasury_transactions where id=$1', [r.body.treasury_transaction_id])).rows[0]
      assert.equal(transaction.transaction_type, 'customer_receipt'); assert.equal(transaction.amount, '40.25')
      assert.equal(transaction.customer_order_id, order); assert.equal(transaction.sales_order_id, null); assert.equal(transaction.created_by, f.actors.editor)
      assert.deepEqual(await orderRow(f, order), row)
      assert.deepEqual((await send(f, order, reconciliation)).body, reconciliationResult)
      assert.equal((await send(f, order, { ...reconciliation, command_id: randomUUID() })).response.status, 409)
      const view = await details(f, order); assert.equal(view.body.codCash.reconciled, 40.25); assert.equal(view.body.codCash.awaiting_reconciliation, 0)
      assert.equal(view.body.codCash.outstanding, 66.75)
    })
    await t.test('overcollection is rejected; full receipt alone marks customer paid and leaves reconciliation outstanding', async () => {
      const currentSnapshot = await snapshot(f, order)
      assert.equal((await send(f, order, input({ amount: '66.76' }))).response.status, 409)
      const r = await send(f, order, input({ amount: '66.75' })); assert.equal(r.response.status, 200, JSON.stringify(r.body))
      const row = await orderRow(f, order)
      assert.equal(row.amount_paid, '107.00'); assert.equal(row.payment_status, 'paid'); assert.ok(row.paid_at); assert.equal(row.status, 'delivered')
      assert.equal((await send(f, order, input({ amount: '0.01' }))).response.status, 409)
      assert.equal((await details(f, order)).body.codCash.awaiting_reconciliation, 66.75)
      const rec = input({ action: 'reconcile', collection_id: r.body.collection_id, amount: '66.75', reference: 'REMIT-' + randomUUID() })
      const settled = await send(f, order, rec); assert.equal(settled.response.status, 200, JSON.stringify(settled.body))
      const view = (await details(f, order)).body.codCash
      assert.equal(view.outstanding, 0); assert.equal(view.awaiting_reconciliation, 0); assert.equal(view.reconciled, 107)
      assert.deepEqual(await snapshot(f, order), currentSnapshot)
    })
    await t.test('routine log retention preserves receipt and reconciliation audits; direct audit deletion is blocked', async () => {
      const n = await counts(f)
      for (let i = 0; i < 55; i++) {
        const r = await f.call('/api/admin-logs', { method: 'POST', body: { actionKey: 'owned.routine', description: 'Owned isolated activity ' + i } })
        assert.equal(r.response.status, 200, JSON.stringify(r.body))
      }
      assert.deepEqual(await counts(f), n)
      for (const id of [firstResult.audit_id, reconciliationResult.audit_id]) {
        await assert.rejects(f.db.query('delete from public.admin_activity_logs where id=$1', [id]), /foreign key/)
      }
    })
    await t.test('delivery/completion and direct balance edits cannot manufacture payment; collected totals are immutable', async () => {
      const fresh = await makeOrder(f)
      for (const sql of ["payment_status='paid'", "amount_paid=total_amount,payment_status='paid',paid_at=now()", 'amount_paid=1']) {
        await assert.rejects(f.db.query('update public.customer_orders set ' + sql + ' where id=$1', [fresh]), /cod:history/)
      }
      for (const sql of ['total_amount=total_amount+1', 'shipping_fee_amount=0', "payment_method='bank_transfer'", 'is_preorder=true', "paid_at=paid_at+interval '1 day'"]) {
        await assert.rejects(f.db.query('update public.customer_orders set ' + sql + ' where id=$1', [order]))
      }
      const r = await f.call('/api/admin-orders/' + fresh, { method: 'PATCH', body: { status: 'completed', payment_status: 'paid', amount_paid: 107 } })
      assert.equal(r.response.status, 200); assert.equal((await orderRow(f, fresh)).amount_paid, '0.00')
    })
    await t.test('concurrent identical confirmations and competing balance receipts serialize without duplication', async () => {
      const fresh = await makeOrder(f), b = input({ amount: '60' }), n = await counts(f)
      const rs = await Promise.all(Array.from({ length: 6 }, () => send(f, fresh, b)))
      for (const r of rs) { assert.equal(r.response.status, 200, JSON.stringify(r.body)); assert.deepEqual(r.body, rs[0].body) }
      assert.equal((await counts(f)).receipts, n.receipts + 1)
      const competition = await Promise.all([send(f, fresh, input({ amount: '40' })), send(f, fresh, input({ amount: '40' }))])
      assert.deepEqual(competition.map(r => r.response.status).sort(), [200, 409])
      assert.equal((await orderRow(f, fresh)).amount_paid, '100.00')
      const rec = input({ action: 'reconcile', collection_id: rs[0].body.collection_id, amount: '60', reference: 'REMIT-' + randomUUID() })
      const posts = await Promise.all([send(f, fresh, rec), send(f, fresh, { ...rec, command_id: randomUUID(), reference: 'REMIT-' + randomUUID() })])
      assert.deepEqual(posts.map(r => r.response.status).sort(), [200, 409])
    })
    await t.test('lost HTTP acknowledgement recovers the committed cash receipt and treasury post', async () => {
      const fresh = await makeOrder(f), b = input({ amount: '5' })
      f.controls.dropResponseFor = '/api/admin-orders/:id/cod-cash'
      await assert.rejects(send(f, fresh, b)); const n = await counts(f)
      const recovered = await send(f, fresh, b); assert.equal(recovered.response.status, 200); assert.deepEqual(await counts(f), n)
      const rec = input({ action: 'reconcile', collection_id: recovered.body.collection_id, amount: '5', reference: 'REMIT-' + randomUUID() })
      f.controls.dropResponseFor = '/api/admin-orders/:id/cod-cash'
      await assert.rejects(send(f, fresh, rec)); const after = await counts(f)
      assert.equal((await send(f, fresh, rec)).response.status, 200); assert.deepEqual(await counts(f), after)
      const reuse = await send(f, order, { ...rec, command_id: randomUUID() }); assert.equal(reuse.response.status, 404)
    })
    await t.test('lost SQL acknowledgement reports uncertainty and recovers one committed receipt or treasury post', async () => {
      const fresh = await makeOrder(f), receipt = input({ amount: '4' })
      let collectionId
      for (const b of [receipt, null]) {
        const command = b || input({ action: 'reconcile', collection_id: collectionId, amount: '4' })
        const rpc = f.client.rpc
        let lost = false
        f.client.rpc = async (...args) => {
          const result = await rpc(...args)
          if (args[0] === 'commerce_cod_cash_command' && !result.error && !lost) { lost = true; throw Error('Owned lost SQL acknowledgement') }
          return result
        }
        try {
          const r = await send(f, fresh, command)
          assert.equal(r.response.status, 503); assert.equal(r.body.data.codCashError, 'unknown')
        } finally { f.client.rpc = rpc }
        const n = await counts(f), recovered = await send(f, fresh, command)
        assert.equal(recovered.response.status, 200, JSON.stringify(recovered.body))
        collectionId = recovered.body.collection_id
        assert.deepEqual(await counts(f), n)
      }
    })
    await t.test('audit or command receipt failure atomically rolls back collection and reconciliation', async () => {
      const fresh = await makeOrder(f)
      const r = await send(f, fresh, input({ amount: '10' })); assert.equal(r.response.status, 200)
      await f.db.query("create function private.fail_cod_acceptance() returns trigger language plpgsql as $$begin raise exception 'Owned injected failure';end$$")
      for (const table of ['public.admin_activity_logs', 'private.cod_collection_commands']) {
        await f.db.query('create trigger fail_cod_acceptance before insert on ' + table + ' for each row execute function private.fail_cod_acceptance()')
        const n = await counts(f), row = await orderRow(f, fresh)
        for (const b of [input({ amount: '1' }), input({ action: 'reconcile', collection_id: r.body.collection_id, amount: '10' })]) {
          assert.equal((await send(f, fresh, b)).response.status, 503)
          assert.deepEqual(await counts(f), n); assert.deepEqual(await orderRow(f, fresh), row)
        }
        await f.db.query('drop trigger fail_cod_acceptance on ' + table)
      }
      await f.db.query('drop function private.fail_cod_acceptance()')
    })
    await t.test('database permissions prevent browser RPC calls and direct ledger forgery or edits', async () => {
      for (const actionKey of ['orders.cod.receive', ' orders.cod.reconcile ']) {
        assert.equal((await f.call('/api/admin-logs', { method: 'POST', body: { actionKey, description: 'Forged cash audit' } })).response.status, 400)
      }
      for (const role of ['anon', 'authenticated', 'service_role']) {
        const c = await f.db.connect(role)
        try {
          for (const table of ['public.order_cod_collections', 'public.order_cod_reconciliations', 'private.cod_collection_commands']) {
            for (const privilege of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) {
              assert.equal((await f.db.query('select has_table_privilege($1,$2,$3) value', [role, table, privilege])).rows[0].value, false, role + ' ' + table + ' ' + privilege)
            }
          }
          if (role !== 'service_role') {
            const a = args(f, order, body)
            await assert.rejects(c.query('select public.commerce_cod_cash_command(' + Object.keys(a).map((key, i) => key + '=>$' + (i + 1)).join(',') + ')', Object.values(a)), /permission denied/)
            await assert.rejects(c.query('select * from public.order_cod_collections'), /permission denied/)
          }
        } finally { await c.end() }
      }
    })
    await t.test('revoked authority cannot replay and revocation during authentication is rechecked under a lock', async () => {
      const n = await counts(f), c = await f.db.connect()
      await c.query('begin')
      try {
        await c.query("update public.admin_users set permissions='{}' where id=$1", [f.actors.editor])
        const request = send(f, order, body)
        await nativeWaitFor(async () => (await f.db.query("select exists(select 1 from pg_stat_activity where wait_event_type='Lock' and query like '%commerce_cod_cash_command%') value")).rows[0].value)
        await c.query('commit'); assert.equal((await request).response.status, 403)
        const direct = await f.client.rpc('commerce_cod_cash_command', args(f, order, body)); assert.equal(direct.error.code, '42501')
        assert.deepEqual(await counts(f), n)
      } finally { await c.query('rollback'); await c.end(); await f.db.query("update public.admin_users set permissions='{\"dashboard.view\":true,\"dashboard.orders\":true,\"treasury.view\":true,\"treasury.edit\":true}' where id=$1", [f.actors.editor]) }
    })
    await t.test('cancelled, refunded, noncash, preorder and external-owned orders fail closed', async () => {
      for (const status of ['cancelled', 'refunded', 'on_hold']) {
        const fresh = await makeOrder(f, status); assert.equal((await send(f, fresh, input())).response.status, 409)
      }
      for (const sql of ["payment_method='bank_transfer'", "is_preorder=true,preorder_fulfillment_state='ready'", "erp_owner='daftra'"]) {
        const fresh = await makeOrder(f)
        if (sql.startsWith('erp_owner')) await f.db.query('alter table public.customer_orders disable trigger a_erp_order_owner')
        try { await f.db.query('update public.customer_orders set ' + sql + ' where id=$1', [fresh]) }
        finally { if (sql.startsWith('erp_owner')) await f.db.query('alter table public.customer_orders enable trigger a_erp_order_owner') }
        assert.equal((await send(f, fresh, input())).response.status, 409)
      }
    })
    await t.test('active external accounting blocks fresh receipts and reconciliation without losing prior command results', async () => {
      const fresh = await makeOrder(f), b = input({ amount: '1' }), r = await send(f, fresh, b)
      assert.equal(r.response.status, 200)
      const n = await counts(f)
      await f.db.query("update public.site_settings set erp_mode='daftra' where key='default'")
      try {
        assert.equal((await send(f, fresh, input({ amount: '1' }))).response.status, 403)
        assert.equal((await send(f, fresh, input({ action: 'reconcile', collection_id: r.body.collection_id, amount: '1' }))).response.status, 403)
        assert.deepEqual((await send(f, fresh, b)).body, r.body)
        assert.deepEqual(await counts(f), n)
      } finally { await f.db.query("update public.site_settings set erp_mode='built_in' where key='default'") }
    })
    await t.test('SQL rejects invalid precision, unconfirmed cash and missing parent permission independently of HTTP checks', async () => {
      const fresh = await makeOrder(f), n = await counts(f)
      for (const change of [{ amount: '0.001' }, { amount: 'NaN' }, { amount: 'Infinity' }, { confirmed: false }]) {
        const r = await f.client.rpc('commerce_cod_cash_command', args(f, fresh, input(change)))
        assert.equal(r.error?.code, '22023')
      }
      await f.db.query("update public.admin_users set permissions=jsonb_set(permissions,'{dashboard.view}','false') where id=$1", [f.actors.editor])
      try {
        const r = await f.client.rpc('commerce_cod_cash_command', args(f, fresh, input()))
        assert.equal(r.error?.code, '42501')
      } finally { await f.db.query("update public.admin_users set permissions=jsonb_set(permissions,'{dashboard.view}','true') where id=$1", [f.actors.editor]) }
      assert.deepEqual(await counts(f), n)
    })
    await t.test('reconciliation reference cannot silently identify a second cash receipt', async () => {
      const fresh = await makeOrder(f), r = await send(f, fresh, input({ amount: '10' }))
      const rec = input({ action: 'reconcile', collection_id: r.body.collection_id, amount: '10', reference: reconciliation.reference.toLowerCase() })
      const n = await counts(f); assert.equal((await send(f, fresh, rec)).response.status, 409); assert.deepEqual(await counts(f), n)
    })
    await t.test('history, audit links and outstanding amounts agree without changing checkout settings', async () => {
      assert.equal((await f.db.query(`select count(*)::int n from public.order_cod_collections c
       where not exists(select 1 from public.admin_activity_logs a where a.action_key='orders.cod.receive' and a.metadata->>'collection_id'=c.id::text)`)).rows[0].n, 0)
      assert.equal((await f.db.query(`select count(*)::int n from public.order_cod_reconciliations r join public.order_cod_collections c on c.id=r.collection_id
       join public.treasury_transactions t on t.id=r.treasury_transaction_id where t.amount<>c.amount or t.customer_order_id<>c.order_id`)).rows[0].n, 0)
      assert.equal(f.controls.storageCalls, 0)
    })
    await t.test('Orders Reset blocks financial history; Commerce Reset retires commands without permitting reposts', async () => {
      const plan = await f.client.rpc('system_reset_plan', { p_owner: f.actors.owner, p_scope: 'orders' })
      assert.ifError(plan.error); assert.ok(plan.data.blockers.some(b => b.table === 'order_cod_collections'))
      const c = await f.db.connect()
      await c.query('begin')
      try {
        const a = args(f, order, body)
        await c.query('select public.commerce_cod_cash_command(' + Object.keys(a).map((key, i) => key + '=>$' + (i + 1)).join(',') + ')', Object.values(a))
        const reset = await f.client.rpc('system_reset_begin', { p_owner: f.actors.owner, p_scope: 'commerce', p_id: randomUUID(), p_media_files: [] })
        assert.match(reset.error.message, /Another reset/)
      } finally { await c.query('rollback'); await c.end() }
      // Fixture-only: remove serialized business dependencies through the real
      // explicitly authorized Commerce Reset; public production data never exists here.
      const r = await f.client.rpc('system_reset_begin', { p_owner: f.actors.owner, p_scope: 'commerce', p_id: randomUUID(), p_media_files: [] })
      assert.ifError(r.error)
      assert.equal((await counts(f)).receipts, 0); assert.equal((await counts(f)).treasury, 0)
      assert.ok((await f.db.query('select bool_and(retired_by_reset) value from private.cod_collection_commands')).rows[0].value)
      const replay = await send(f, order, body); assert.equal(replay.response.status, 409); assert.equal(replay.body.data.codCashError, 'reset')
    })
  } finally { await f.close() }
})

test('Full Reset keeps non-reposting cash command tombstones and the current owner', { skip: !emailNativeAvailable, timeout: 90000 }, async () => {
  const f = await createPrivatePackingFixture({ extraRoutes })
  try {
    const id = await makeOrder(f), b = input({ amount: '5' }), r = await send(f, id, b, 'owner')
    assert.equal(r.response.status, 200, JSON.stringify(r.body))
    const rec = input({ action: 'reconcile', collection_id: r.body.collection_id, amount: '5' })
    assert.equal((await send(f, id, rec, 'owner')).response.status, 200)
    const reset = await f.client.rpc('system_reset_begin', { p_owner: f.actors.owner, p_scope: 'full', p_id: randomUUID(), p_media_files: [] })
    assert.ifError(reset.error)
    assert.deepEqual(await counts(f), { receipts: 0, reconciliations: 0, treasury: 0, commands: 2, audits: 0 })
    assert.equal((await f.db.query('select bool_and(retired_by_reset) value from private.cod_collection_commands')).rows[0].value, true)
    assert.equal((await f.db.query('select count(*)::int n from public.admin_users where id=$1', [f.actors.owner])).rows[0].n, 1)
    const replay = await send(f, id, b, 'owner'); assert.equal(replay.response.status, 409); assert.equal(replay.body.data.codCashError, 'reset')
  } finally { await f.close() }
})

test('migration85 preserves existing payment and treasury history without backfill', { skip: !emailNativeAvailable, timeout: 90000 }, async () => {
  const f = await createPrivatePackingFixture({ stopBefore: migration, extraRoutes })
  try {
    const id = await makeOrder(f)
    await f.db.query("update public.customer_orders set amount_paid=12.34,payment_status='partially_paid' where id=$1", [id])
    const historical = await orderRow(f, id)
    const employee = (await f.db.query("insert into public.hr_employees(first_name,position) values('Owned employee','Fixture') returning id")).rows[0].id
    await f.db.query("insert into public.treasury_transactions(transaction_type,amount,party_name,employee_id,salary_period) values('salary_payment',5,'Owned employee',$1,current_date)", [employee])
    const ledger = (await f.db.query('select * from public.treasury_transactions order by id')).rows
    await f.db.exec(await readFile(new URL('../supabase/migrations/' + migration, import.meta.url), 'utf8'))
    assert.deepEqual(await orderRow(f, id), historical)
    assert.deepEqual((await f.db.query('select * from public.treasury_transactions order by id')).rows.map(({ customer_order_id, ...row }) => row), ledger)
    const n = await counts(f), r = await send(f, id, input())
    assert.equal(r.response.status, 409); assert.equal(r.body.data.codCashError, 'history'); assert.deepEqual(await counts(f), n)
    assert.equal((await details(f, id)).body.codCash.history_consistent, false)
    await assert.rejects(f.db.query("update public.customer_orders set amount_paid=0,payment_status='pending',paid_at=null where id=$1", [id]), /cod:history/)
    assert.deepEqual(await orderRow(f, id), historical)
  } finally { await f.close() }
})
