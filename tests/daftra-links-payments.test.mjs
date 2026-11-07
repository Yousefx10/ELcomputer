import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { suggestDaftraLinks, nameScore, optionCode } from '../server/utils/daftraLinks.js'
import { buildDaftraInvoice, syncOrderToDaftra, resolveProduct, paidOnline, LINK_REQUIRED } from '../server/utils/daftraSync.js'

// Owner request 7 Nov 2026: bills use real Daftra products; online payments are marked paid.
function database(seed = {}) {
  const tables = structuredClone(seed)
  return { tables, from(table) {
    tables[table] ||= []
    let operation = 'select', payload, filters = [], one = false
    const query = {
      select() { return query }, eq(key, value) { filters.push(row => row[key] === value); return query }, order() { return query },
      maybeSingle() { one = true; return query }, single() { one = true; return query },
      insert(value) { operation = 'insert'; payload = value; return query }, update(value) { operation = 'update'; payload = value; return query },
      upsert(value) { operation = 'upsert'; payload = value; return query },
      then(resolve, reject) { return Promise.resolve().then(() => {
        let rows = tables[table].filter(row => filters.every(filter => filter(row)))
        if (operation === 'insert') {
          if (table === 'erp_remote_writes' && tables[table].some(row => row.operation === payload.operation && row.local_id === payload.local_id)) return { error: { code: '23505' }, data: null }
          rows = [{ ...structuredClone(payload) }]; tables[table].push(...rows)
        }
        if (operation === 'update') rows.forEach(row => Object.assign(row, structuredClone(payload)))
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

const order = (patch = {}) => ({ id: 'order-1', user_id: 'buyer-1', erp_owner: 'daftra', order_number: 'ORD-1', status: 'processing', currency: 'EGP', created_at: '2026-11-07T10:00:00Z',
  payment_method: 'card', payment_status: 'paid', amount_paid: 1259, total_amount: 1259, discount_amount: 0, shipping_fee_amount: 50, payment_fee_amount: 10, ...patch })
const fixture = (orderPatch = {}, extra = {}) => database({
  site_settings: [{ key: 'default', erp_mode: 'daftra' }],
  customer_orders: [order(orderPatch)],
  customer_order_items: [{ id: 'item-1', order_id: 'order-1', product_id: 'p1', variant_id: 'v1', product_title: 'Keyboard', unit_price: 1199, quantity: 1 }],
  products: [{ id: 'p1', sku: null }], product_variants: [{ id: 'v1', product_id: 'p1', sku: null, code: 'WP_8537', is_active: true }],
  erp_entity_links: [
    { id: 'client', provider: 'daftra', local_entity_type: 'customer_profile', local_id: 'buyer-1', external_id: '8' },
    { id: 'option', provider: 'daftra', local_entity_type: 'product_variant', local_id: 'v1', external_entity_type: 'product', external_id: '399' }],
  erp_remote_writes: [], erp_provider_settings: [{ id: 'daftra', online_payment_method: 'paymob', online_treasury_id: 2 }], ...extra
})

// A Daftra double: invoice creation, issuance and payments change the bill balance.
const daftra = ({ failPaymentAfterCommit = false } = {}) => {
  const state = { invoice: null, posts: 0, issues: 0, payments: [] }
  const request = async (path, options = {}) => {
    if (path === '/invoices.json' && options.method === 'POST') { state.posts++; state.invoice = { id: 42, po_number: 'ORD-1', client_id: 8, currency_code: 'EGP', draft: '1', summary_total: '1259.00', summary_paid: '0' }; return { id: 42 } }
    if (path === '/invoices.json') return { result: 'successful', code: 200, data: state.invoice ? [{ Invoice: state.invoice }] : [], pagination: { page_count: 1 } }
    if (path === '/invoices/42.json') return { data: { Invoice: state.invoice } }
    if (path === '/invoices/update_draft/42/0.json') { state.issues++; state.invoice.draft = '0'; return { result: 'successful', code: 200 } }
    if (path === '/invoice_payments.json' && options.method === 'POST') {
      state.payments.push(options.body.InvoicePayment); state.invoice.summary_paid = String(options.body.InvoicePayment.amount)
      if (failPaymentAfterCommit) throw new Error('timeout after remote commit')
      return { id: 77 }
    }
    throw new Error('Unexpected endpoint ' + path)
  }
  return { state, request }
}

test('only an exact unique code is the same product; names are suggestions without colour or model conflicts', () => {
  const daftraProducts = [{ id: 399, name: 'AULA WIN60HE Keyboard – Greywood (Magnetic Switch, Black)', code: '7779346546731' },
    { id: 12, name: 'Rapoo M300 Multi-Mode Wireless Mouse', code: 'B07KW325RY' }, { id: 575, name: 'Rapoo M300L Grey Silent Wireless Mouse', code: '7779346546892' },
    { id: 9, name: 'Mouse X (Black)', code: 'SKU-X' }]
  const row = (variant, product, optionCount = 1) => ({ variant: { name: 'Default', code: 'DEFAULT', sku: null, ...variant }, product: { title: '', sku: null, ...product }, optionCount })
  const [bySku, byProductSku, multiOption, byName, wrongColour, wrongModel] = suggestDaftraLinks([
    row({ sku: '7779346546731' }, { title: 'Anything' }),
    row({}, { title: 'Mouse X', sku: 'sku-x' }),
    row({}, { title: 'Mouse X', sku: 'SKU-X' }, 2),
    row({}, { title: 'AULA WIN60HE Magnetic Keyboard Greywood' }),
    row({}, { title: 'Rapoo M300L White Silent Wireless Mouse' }),
    row({}, { title: 'Rapoo M500 Multi-Mode Wireless Mouse' })], daftraProducts)
  assert.deepEqual(bySku, { daftraId: '399', reason: 'code', score: 1 })
  assert.equal(byProductSku.daftraId, '9')
  assert.notEqual(multiOption?.reason, 'code', 'a shared product SKU cannot identify one of several options')
  assert.equal(byName.reason, 'name'); assert.equal(byName.daftraId, '399')
  assert.equal(wrongColour, null); assert.equal(wrongModel, null)
  assert.equal(nameScore('Mouse Black', 'Mouse (White)'), 0)
  assert.equal(optionCode({ code: 'DEFAULT' }), ''); assert.equal(optionCode({ code: 'WP_8537' }), ''); assert.equal(optionCode({ code: 'K515-BLK' }), 'K515-BLK')
})

test('the owner link wins; unlinked items stop before any Daftra write', async () => {
  const db = fixture()
  assert.equal((await resolveProduct(db, db.tables.customer_order_items[0], async () => { throw new Error('no remote search') })).external_id, '399')
  db.tables.erp_entity_links = db.tables.erp_entity_links.filter(link => link.id !== 'option')
  const calls = []
  const request = async (path, options) => { calls.push([path, options?.method || 'GET']); return { result: 'successful', code: 200, data: [], pagination: { page_count: 1 } } }
  await assert.rejects(() => syncOrderToDaftra(db, 'order-1', { request }), error => error.statusMessage === LINK_REQUIRED)
  assert.ok(calls.every(([, method]) => method === 'GET'), 'no client or invoice is created for an unlinked item')
  assert.equal(calls.some(([, , code]) => code === 'WP_8537'), false)
})

test('unpaid card attempts and cancelled orders without a bill never reach Daftra', async () => {
  const never = async () => { throw new Error('no Daftra request expected') }
  assert.equal((await syncOrderToDaftra(fixture({ status: 'pending_payment', payment_status: 'pending', amount_paid: 0 }), 'order-1', { request: never })).skipped, 'awaiting_payment')
  assert.equal((await syncOrderToDaftra(fixture({ status: 'cancelled' }), 'order-1', { request: never })).skipped, 'no_bill')
  const billed = fixture({ status: 'cancelled' }); billed.tables.erp_entity_links.push({ provider: 'daftra', local_entity_type: 'customer_order', local_id: 'order-1', external_id: '42' })
  await assert.rejects(() => syncOrderToDaftra(billed, 'order-1', { request: never }), /manually in Daftra/)
})

test('the bill carries delivery and fees so its total matches the order', () => {
  const invoice = buildDaftraInvoice(order(), [{ product_title: 'Keyboard', unit_price: 1199, quantity: 1 }], { external_id: '8' }, [{ external_id: '399' }])
  const lines = invoice.InvoiceItem
  assert.deepEqual(lines.map(line => [line.item, line.unit_price, line.product_id ?? null]), [['Keyboard', 1199, 399], ['Delivery', 50, null], ['Website payment fee', 10, null]])
  assert.equal(lines.reduce((total, line) => total + line.unit_price * line.quantity, 0) - invoice.Invoice.discount_amount, 1259)
  assert.doesNotMatch(invoice.Invoice.notes, /reconciliation/)
})

test('a card or Apple Pay order gets an issued bill with its payment recorded once', async () => {
  const db = fixture(), remote = daftra()
  const result = await syncOrderToDaftra(db, 'order-1', { request: remote.request })
  assert.equal(result.payment.recorded, true); assert.equal(remote.state.issues, 1)
  assert.deepEqual(remote.state.payments, [{ invoice_id: 42, amount: 1259, payment_method: 'paymob', transaction_id: 'ORD-1', treasury_id: 2 }])
  await syncOrderToDaftra(db, 'order-1', { request: remote.request })
  db.tables.customer_orders[0].status = 'ready_to_deliver'
  await syncOrderToDaftra(db, 'order-1', { request: remote.request })
  assert.equal(remote.state.posts, 1); assert.equal(remote.state.issues, 1); assert.equal(remote.state.payments.length, 1)
})

test('cash on delivery, InstaPay and bank transfer bills are issued but stay unpaid', async () => {
  for (const payment_method of ['cash', 'instapay', 'bank_transfer']) {
    const remote = daftra()
    const result = await syncOrderToDaftra(fixture({ payment_method, payment_status: payment_method === 'cash' ? 'pending' : 'paid', amount_paid: payment_method === 'cash' ? 0 : 1259 }), 'order-1', { request: remote.request })
    assert.equal(result.payment, undefined, payment_method); assert.equal(remote.state.issues, 1); assert.equal(remote.state.payments.length, 0)
  }
  assert.equal(paidOnline(order({ payment_method: 'wallet' })), true, 'future online methods count as paid')
  assert.equal(paidOnline(order({ amount_paid: 100 })), false, 'a partial amount is never marked paid')
})

test('a missing payment method or an uncertain payment never posts twice', async () => {
  const unset = fixture({}, { erp_provider_settings: [{ id: 'daftra', online_payment_method: null }] }), remote = daftra()
  await assert.rejects(() => syncOrderToDaftra(unset, 'order-1', { request: remote.request }), /payment method in Settings/)
  assert.equal(remote.state.issues, 1, 'the bill is still issued'); assert.equal(remote.state.payments.length, 0)

  const db = fixture(), lost = daftra({ failPaymentAfterCommit: true })
  await assert.rejects(() => syncOrderToDaftra(db, 'order-1', { request: lost.request }))
  assert.equal(db.tables.erp_remote_writes.find(row => row.operation === 'invoice.payment').state, 'submitted')
  const retry = await syncOrderToDaftra(db, 'order-1', { request: lost.request })
  assert.deepEqual(retry.payment, { paid: true, recorded: false }); assert.equal(lost.state.payments.length, 1)
  assert.equal(db.tables.erp_remote_writes.find(row => row.operation === 'invoice.payment').state, 'confirmed')

  const unsure = fixture(), unpaid = daftra()
  unsure.tables.erp_remote_writes.push({ operation: 'invoice.payment', local_id: 'order-1', state: 'submitted' })
  await assert.rejects(() => syncOrderToDaftra(unsure, 'order-1', { request: unpaid.request }), /reconciliation/)
  assert.equal(unpaid.state.payments.length, 0)
})

test('migration keeps one bill per order and one client per customer while products may be shared', async () => {
  const sql = await readFile('supabase/migrations/20261107230000_daftra_product_links.sql', 'utf8')
  assert.match(sql, /create unique index erp_entity_links_external_uidx[^;]*where external_entity_type<>'product'/)
  assert.match(sql, /last_error like 'Link this product%'/)
  assert.ok(LINK_REQUIRED.startsWith('Link this product'))
  assert.match(sql, /grant execute on function public\.erp_save_product_links\(uuid,jsonb\) to service_role/)
})

test('native schema saves owner links, shares a Daftra product and retries waiting bills', { timeout: 240000 }, async t => {
  const { createEmailNativeDatabase, emailNativeAvailable } = await import('./helpers/emailNativeDatabase.mjs')
  if (!emailNativeAvailable) return t.skip('native PostgreSQL is not configured')
  const { createProductSaveFixture } = await import('./helpers/productSaveFixture.mjs')
  const db = await createEmailNativeDatabase()
  try {
    const { actors, warehouse } = await createProductSaveFixture({ database: db })
    const product = (await db.query("insert into public.products(title,price,slug,primary_warehouse_id) values('Keyboard',1199,'kb-'||gen_random_uuid(),$1) returning id", [warehouse])).rows[0].id
    const [blue, red] = (await db.query("insert into public.product_variants(product_id,name,code) values($1,'Blue switch','BLUE'),($1,'Red switch','RED') returning id", [product])).rows.map(r => r.id)
    const save = links => db.query("select public.erp_save_product_links($1,$2::jsonb) r", [actors.owner, JSON.stringify(links)]).then(r => r.rows[0].r)
    await db.query("insert into public.erp_sync_jobs(operation,local_entity_type,local_id,dedupe_key,status,attempts,last_error) values('order.export','customer_order',gen_random_uuid(),'t1','failed',5,$1)", [LINK_REQUIRED])
    const first = await save([{ variant_id: blue, daftra_id: '399', source: 'code' }, { variant_id: red, daftra_id: '399' }])
    assert.deepEqual([first.saved, first.requeued], [2, 1])
    assert.equal((await db.query("select count(*)::int n from public.erp_entity_links where external_id='399'")).rows[0].n, 2)
    assert.equal((await db.query("select status from public.erp_sync_jobs where dedupe_key='t1'")).rows[0].status, 'pending')
    assert.equal((await save([{ variant_id: red, daftra_id: null }])).removed, 1)
    await assert.rejects(() => save([{ variant_id: blue, daftra_id: 'abc' }]), /valid Daftra product/)
    await assert.rejects(() => db.query("insert into public.erp_entity_links(provider,local_entity_type,local_id,external_entity_type,external_id) values('daftra','customer_order',gen_random_uuid(),'invoice','5'),('daftra','customer_order',gen_random_uuid(),'invoice','5')"), /duplicate key/)
    await assert.rejects(() => db.query("select public.erp_save_product_links($1,'[]'::jsonb)", [actors.customer]), /permission/i)
  } finally { await db.close() }
})
