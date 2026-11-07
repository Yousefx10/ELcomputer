import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { syncOrderToDaftra, COD_METHOD_REQUIRED, PAYMENT_REFUSED, PAYMENT_SETTING_ERRORS, PAYMENT_METHOD_REQUIRED } from '../server/utils/daftraSync.js'

// Owner request 7 Nov 2026 (phase 2C): when PDC delivers a COD parcel, its Daftra bill is paid automatically.
function database(seed = {}) {
  const tables = structuredClone(seed)
  return { tables, from(table) {
    tables[table] ||= []
    let operation = 'select', payload, filters = [], one = false
    const query = {
      select() { return query }, eq(key, value) { filters.push(row => row[key] === value); return query }, order() { return query },
      maybeSingle() { one = true; return query }, single() { one = true; return query },
      insert(value) { operation = 'insert'; payload = value; return query }, update(value) { operation = 'update'; payload = value; return query },
      upsert(value) { operation = 'upsert'; payload = value; return query }, delete() { operation = 'delete'; return query },
      then(resolve, reject) { return Promise.resolve().then(() => {
        let rows = tables[table].filter(row => filters.every(filter => filter(row)))
        if (operation === 'insert') {
          if (table === 'erp_remote_writes' && tables[table].some(row => row.operation === payload.operation && row.local_id === payload.local_id)) return { error: { code: '23505' }, data: null }
          rows = [{ ...structuredClone(payload) }]; tables[table].push(...rows)
        }
        if (operation === 'update') rows.forEach(row => Object.assign(row, structuredClone(payload)))
        if (operation === 'delete') tables[table] = tables[table].filter(row => !rows.includes(row))
        if (operation === 'upsert') {
          let row = tables[table].find(row => row.provider === payload.provider && row.local_entity_type === payload.local_entity_type && row.local_id === payload.local_id)
          if (row) Object.assign(row, structuredClone(payload)); else { row = { id: `${table}-${tables[table].length}`, ...structuredClone(payload) }; tables[table].push(row) }
          rows = [row]
        }
        rows = structuredClone(rows)
        return { data: one ? rows[0] || null : rows, error: null }
      }).then(resolve, reject) }
    }
    return query
  }, async rpc() { return { data: null, error: null } } }
}

const settings = (patch = {}) => ({ id: 'daftra', online_payment_method: 'Paymob', online_treasury_id: 2, cod_payment_method: 'cash_on_delivery', cod_treasury_id: 3, ...patch })
const fixture = ({ order = {}, shipment = 'delivered', erp = {} } = {}) => database({
  site_settings: [{ key: 'default', erp_mode: 'daftra' }],
  customer_orders: [{ id: 'order-1', user_id: 'buyer-1', erp_owner: 'daftra', order_number: 'ORD-1', status: 'processing', currency: 'EGP', created_at: '2026-11-07T10:00:00Z',
    payment_method: 'cash', payment_status: 'pending', amount_paid: 0, total_amount: 1259, discount_amount: 0, shipping_fee_amount: 60, payment_fee_amount: 0, ...order }],
  customer_order_items: [{ id: 'item-1', order_id: 'order-1', product_id: 'p1', variant_id: 'v1', product_title: 'Keyboard', unit_price: 1199, quantity: 1 }],
  products: [{ id: 'p1', sku: null }], product_variants: [{ id: 'v1', product_id: 'p1', sku: null, code: 'DEFAULT', is_active: true }],
  erp_entity_links: [
    { id: 'client', provider: 'daftra', local_entity_type: 'customer_profile', local_id: 'buyer-1', external_id: '8' },
    { id: 'option', provider: 'daftra', local_entity_type: 'product_variant', local_id: 'v1', external_entity_type: 'product', external_id: '399' }],
  shipping_order_jobs: shipment ? [{ order_id: 'order-1', awb: 'EDC17244218EG', normalized_state: shipment }] : [],
  erp_remote_writes: [], erp_provider_settings: [settings(erp)]
})

// A Daftra double whose bill balance follows recorded payments.
const daftra = ({ refusePayment = false } = {}) => {
  const state = { invoice: null, posts: 0, payments: [] }
  const request = async (path, options = {}) => {
    if (path === '/invoices.json' && options.method === 'POST') { state.posts++; state.invoice = { id: 42, po_number: 'ORD-1', client_id: 8, currency_code: 'EGP', draft: '1', summary_total: '1259.00', summary_paid: '0' }; return { id: 42 } }
    if (path === '/invoices.json') return { result: 'successful', code: 200, data: state.invoice ? [{ Invoice: state.invoice }] : [], pagination: { page_count: 1 } }
    if (path === '/invoices/42.json') return { data: { Invoice: state.invoice } }
    if (path === '/invoices/update_draft/42/0.json') { state.invoice.draft = '0'; return { result: 'successful', code: 200 } }
    if (path === '/invoice_payments.json' && options.method === 'POST') {
      if (refusePayment) throw Object.assign(new Error('Invalid payment method'), { statusCode: 422 })
      state.payments.push(options.body.InvoicePayment); state.invoice.summary_paid = String(options.body.InvoicePayment.amount)
      return { id: 77 }
    }
    throw new Error('Unexpected endpoint ' + path)
  }
  return { state, request }
}

test('a delivered COD parcel pays its Daftra bill once, referenced by the AWB', async () => {
  const db = fixture(), remote = daftra()
  const result = await syncOrderToDaftra(db, 'order-1', { request: remote.request })
  assert.equal(result.payment.recorded, true)
  assert.deepEqual(remote.state.payments, [{ invoice_id: 42, amount: 1259, payment_method: 'cash_on_delivery', transaction_id: 'EDC17244218EG', treasury_id: 3 }])
  assert.ok(db.tables.erp_entity_links.find(link => link.local_entity_type === 'customer_order').metadata.codRecordedAt)
  db.tables.customer_orders[0].status = 'delivered'
  assert.deepEqual((await syncOrderToDaftra(db, 'order-1', { request: remote.request })).payment, { paid: true, recorded: false })
  assert.equal(remote.state.payments.length, 1); assert.equal(remote.state.posts, 1)
})

test('a COD bill stays unpaid until PDC reports the parcel delivered', async () => {
  for (const shipment of [null, 'picked_up', 'out_for_delivery', 'partial_delivery', 'returned']) {
    const remote = daftra()
    const result = await syncOrderToDaftra(fixture({ shipment }), 'order-1', { request: remote.request })
    assert.equal(result.payment, undefined, String(shipment)); assert.equal(remote.state.payments.length, 0)
    assert.equal(remote.state.invoice.draft, '0', 'the bill itself is still issued')
  }
  const transfer = daftra()
  await syncOrderToDaftra(fixture({ order: { payment_method: 'instapay', payment_status: 'paid', amount_paid: 1259 } }), 'order-1', { request: transfer.request })
  assert.equal(transfer.state.payments.length, 0, 'InstaPay stays unpaid even after delivery')
})

test('without a COD method the bill waits with a clear message; a refused method can be corrected', async () => {
  const unset = fixture({ erp: { cod_payment_method: null } }), remote = daftra()
  await assert.rejects(() => syncOrderToDaftra(unset, 'order-1', { request: remote.request }), error => error.statusMessage === COD_METHOD_REQUIRED)
  assert.equal(remote.state.invoice.draft, '0'); assert.equal(remote.state.payments.length, 0)

  const db = fixture(), refused = daftra({ refusePayment: true })
  await assert.rejects(() => syncOrderToDaftra(db, 'order-1', { request: refused.request }), error => error.statusMessage === PAYMENT_REFUSED)
  assert.equal(db.tables.erp_remote_writes.some(row => row.operation === 'invoice.payment'), false, 'a refusal created nothing, so no reconciliation is needed')
  const fixed = daftra(); fixed.state.invoice = refused.state.invoice
  assert.equal((await syncOrderToDaftra(db, 'order-1', { request: fixed.request })).payment.recorded, true)
  assert.deepEqual([...PAYMENT_SETTING_ERRORS].sort(), [COD_METHOD_REQUIRED, PAYMENT_METHOD_REQUIRED, PAYMENT_REFUSED].sort())
})

test('migration queues one bill update when a COD parcel becomes delivered without blocking tracking', async () => {
  const sql = await readFile('supabase/migrations/20261107235000_daftra_cod_delivered.sql', 'utf8')
  assert.match(sql, /add column cod_payment_method text/); assert.match(sql, /cod_treasury_id is null or cod_treasury_id>0/)
  assert.match(sql, /after update of normalized_state on public\.shipping_order_jobs/)
  assert.match(sql, /':cod_delivered'/); assert.match(sql, /on conflict\(dedupe_key\) do nothing/)
  assert.match(sql, /exception when query_canceled or others then\s+raise log/)
  const patch = await readFile('server/api/admin-erp/payment-settings.patch.js', 'utf8')
  assert.match(patch, /\.in\('last_error', PAYMENT_SETTING_ERRORS\)/)
})

test('native: PDC delivery of a Daftra COD order queues its bill once; older orders are left alone', { timeout: 240000 }, async t => {
  const { emailNativeAvailable } = await import('./helpers/emailNativeDatabase.mjs')
  if (!emailNativeAvailable) return t.skip('native PostgreSQL is not configured')
  const { createPrivatePackingFixture } = await import('./helpers/privatePackingFixture.mjs')
  const { encryptShippingSecret } = await import('../server/utils/shippingSecrets.js')
  const { processPdcTracking, defaultTrackingPolicy } = await import('../server/utils/pdcTrackingPolling.js')
  const f = await createPrivatePackingFixture({ extraRoutes: [['post', '/api/admin-shipping/orders/:id/manual-awb', resolve('server/api/admin-shipping/orders/[id]/manual-awb.post.js')]] })
  const previous = globalThis.useRuntimeConfig; globalThis.useRuntimeConfig = () => f.config
  Object.assign(f.config, { shippingCredentialsEncryptionKey: 'owned-local-only-shipping-encryption-key-32-characters', pdcTrackingRequestsEnabled: true, pdcTrackingWorkerEnabled: true })
  const originalRpc = f.client.rpc; f.client.rpc = (...args) => { const promise = originalRpc(...args); promise.abortSignal = () => promise; return promise }
  const q = (sql, args) => f.db.query(sql, args)
  const newOrder = async () => {
    const id = randomUUID()
    await q("insert into public.customer_orders(id,user_id,order_number,status,payment_method,first_name,phone,street_address,city,governorate,created_at) values($1,$2,$3,'processing','cash','Owned fixture','01000000000','Owned street','Cairo','Cairo',now()-interval '3 days')", [id, f.actors.customer, 'ORD-' + id.slice(0, 8)])
    return id
  }
  const attach = async (order, awb) => {
    const r = await f.call(`/api/admin-shipping/orders/${order}/manual-awb`, { actor: 'owner', method: 'POST', body: { awb, confirmed: true } })
    assert.equal(r.response.status, 200, JSON.stringify(r.body))
    await q("update public.shipping_order_jobs set awb_verified_at=now()-interval '10 minutes' where order_id=$1", [order])
  }
  const track = (order, awb, Status, StatusID) => processPdcTracking({ db: f.client, orderId: order, fetcher: async () => Response.json([{ AWB: awb, Ref: 'PORTAL-REF', Status, StatusID }]) })
  const codJobs = order => q("select count(*)::int n from public.erp_sync_jobs where local_id=$1 and dedupe_key like '%:cod_delivered'", [order]).then(r => r.rows[0].n)
  try {
    await q("update public.shipping_provider_settings set is_enabled=true,api_mode='production',company_id='123456',access_token_encrypted=$1,auto_create_labels=false,tracking_policy=$2,tracking_request_times='{}' where id='pdc'",
      [encryptShippingSecret('OWNED-LOCAL-TOKEN'), JSON.stringify({ ...defaultTrackingPolicy, enabled: true })])
    const older = await newOrder()
    await q("update public.site_settings set erp_mode='daftra',daftra_connection_status='error' where key='default'")
    const daftraOrder = await newOrder()
    assert.equal((await q('select erp_owner from public.customer_orders where id=$1', [daftraOrder])).rows[0].erp_owner, 'daftra')
    await attach(older, 'PORTAL-OLD-1'); await attach(daftraOrder, 'PORTAL-NEW-1')

    await t.test('out for delivery queues nothing; delivered queues the bill once', async () => {
      assert.equal((await track(daftraOrder, 'PORTAL-NEW-1', 'Out For Delivery', 4)).checked, 1)
      assert.equal(await codJobs(daftraOrder), 0)
      // Let the next check run now: the tracker waits 5 minutes per parcel and 2 checks per minute.
      await q("update public.shipping_order_jobs set tracking_next_at=null,tracking_checked_at=now()-interval '10 minutes' where order_id=$1", [daftraOrder])
      await q("update public.shipping_provider_settings set tracking_request_times='{}' where id='pdc'")
      assert.equal((await track(daftraOrder, 'PORTAL-NEW-1', 'Delivered', 5)).checked, 1)
      assert.equal((await q('select normalized_state from public.shipping_order_jobs where order_id=$1', [daftraOrder])).rows[0].normalized_state, 'delivered')
      assert.equal(await codJobs(daftraOrder), 1)
      const job = (await q("select operation,status,payload from public.erp_sync_jobs where local_id=$1 and dedupe_key like '%:cod_delivered'", [daftraOrder])).rows[0]
      assert.deepEqual([job.operation, job.status, job.payload.reason], ['order.export', 'pending', 'cod_delivered'])
      await q("update public.shipping_order_jobs set normalized_state='delivered',updated_at=now() where order_id=$1", [daftraOrder])
      assert.equal(await codJobs(daftraOrder), 1, 'never queued twice')
    })

    await t.test('an order from before Daftra mode is never sent', async () => {
      await q("update public.shipping_provider_settings set tracking_request_times='{}' where id='pdc'")
      assert.equal((await track(older, 'PORTAL-OLD-1', 'Delivered', 5)).checked, 1)
      assert.equal((await q('select normalized_state from public.shipping_order_jobs where order_id=$1', [older])).rows[0].normalized_state, 'delivered')
      assert.equal(await codJobs(older), 0)
    })
  } finally { globalThis.useRuntimeConfig = previous; await f.close() }
})
