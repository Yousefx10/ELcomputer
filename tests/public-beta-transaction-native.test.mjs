import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'
import { createCodCheckoutFixture } from './helpers/codCheckoutFixture.mjs'
import { emailNativeAvailable } from './helpers/emailNativeDatabase.mjs'
import { hmacMessage } from '../server/utils/payments/paymob.js'

// One additional public-mode transaction case, not another Auth or gateway audit.
// Native schema95 and actual HTTP handlers; identities, payment and delivery are
// disposable fixtures. No external network, real payment or shipment is allowed.
test('public Beta binds a new customer purchase, paid confirmation and manual reimbursement to its owner', { skip: !emailNativeAvailable }, async t => {
  const runtime = {
    paymobEnabled: true, paymobLiveRequestsEnabled: true, paymobMode: 'live',
    paymobCardIntegrationMode: 'live', paymobCardIntegrationId: '12345',
    paymobSecretKey: 'sk_live_fixture_only', paymobPublicKey: 'pk_live_fixture_only',
    paymobHmacSecret: 'fixture-only-not-a-credential',
    public: { purchasingEnabled: true, betaPurchasingEnabled: true, siteUrl: 'https://birch.example.invalid' }
  }
  const f = await createCodCheckoutFixture({ runtime, routes: [
    ['get', '/api/account/orders/:id', 'server/api/account/orders/[id].get.js'],
    ['get', '/api/payments/status', 'server/api/payments/status.get.js'],
    ['post', '/api/admin-orders/packing/:sessionId/scan', 'server/api/admin-orders/packing/[sessionId]/scan.post.js'],
    ['post', '/api/payments/intentions', 'server/api/payments/intentions.post.js'],
    ['post', '/api/payments/paymob/webhook', 'server/api/payments/paymob/webhook.post.js']
  ] })
  t.after(f.close)
  f.actors.secondBuyer = randomUUID()
  await f.db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'second@fixture.invalid',now())", [f.actors.secondBuyer])
  f.client.auth.getUser = async actor => ({ data: { user: f.actors[actor] ? {
    id: f.actors[actor], email: actor + '@fixture.invalid', is_anonymous: false,
    email_confirmed_at: '2026-01-01T00:00:00Z'
  } : null }, error: null })
  assert.equal((await f.db.query("select inventory_tracking_required from public.site_settings where key='default'")).rows[0].inventory_tracking_required, true)
  await f.db.exec("update public.site_settings set payment_card_enabled=true,payment_card_fee=0,payment_cash_enabled=false,allow_out_of_stock_purchases=false,inventory_tracking_required=false,backorder_fulfillment_message='Fixture delivery time confirmed before dispatch.',backorder_fulfillment_message_ar='يتم تأكيد موعد التوصيل قبل الشحن.'")
  const company = (await f.db.query("insert into public.commerce_shipping_companies(name,provider,client_shipping_price,checkout_enabled,checkout_governorates) values('Fixture owner delivery','manual',50,true,array['Cairo']) returning id")).rows[0].id
  runtime.betaPurchasePolicy = { shipping_company_id: company, excluded_product_ids: [] }
  const products = []
  for (const price of [100, 200]) {
    const product = (await f.db.query("insert into public.products(title,slug,price,is_serialized,is_published,primary_warehouse_id) values('Fixture ordinary product',$1,$2,true,true,$3) returning id", [randomUUID(), price, f.warehouse])).rows[0].id
    products.push({ id: product, variant_id: (await f.db.query('select id from public.product_variants where product_id=$1', [product])).rows[0].id, quantity: 1 })
  }
  const input = (actor, index) => ({ cart_id: randomUUID(), items: [products[index]],
    address: { first_name: actor, last_name: 'Fixture', email: actor + '@fixture.invalid', phone: '01012345678', street_address: actor + ' delivery street', city: 'Fixture city', governorate: 'Cairo' },
    shipping_method: 'shipping', shipping_company_id: company, payment_method: 'card', locale: 'en', backorder_accepted: true })
  const post = (path, body, actor = 'customer') => f.call(path, { method: 'POST', body, actor })
  const orders = []
  let dispatches = 0, paymentPayload
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, options) => {
    if (String(url) === 'https://accept.paymob.com/v1/intention/') {
      dispatches++; paymentPayload = JSON.parse(options.body)
      return { ok: true, json: async () => ({ id: 'pi_live_fixture_public_beta', intention_order_id: 970001,
        client_secret: 'egy_csk_live_fixture_public_beta', special_reference: paymentPayload.special_reference,
        intention_detail: { amount: paymentPayload.amount, currency: paymentPayload.currency } }) }
    }
    assert.ok(String(url).startsWith('http://127.0.0.1:'), 'External requests are forbidden')
    return originalFetch(url, options)
  }
  t.after(() => { globalThis.fetch = originalFetch })
  await t.test('the QA address marker and unaccepted payment/delivery choices cannot create orders', async () => {
    const body = input('customer', 0)
    for (const address of [{ ...body.address, street_address: 'Signup isolation A' },
      { ...body.address, address_line_2: '  SIGNUP   isolation A  ' }]) {
      const invalid = { ...body, address }
      assert.equal((await post('/api/checkout/quote', invalid)).response.status, 400)
      assert.equal((await post('/api/checkout', invalid)).response.status, 400)
    }
    for (const changed of [{ payment_method: 'cash' }, { shipping_company_id: randomUUID() }, { coupon_code: 'UNACCEPTED' }])
      assert.ok((await post('/api/checkout/quote', { ...body, ...changed })).response.status >= 400)
    assert.equal((await f.db.query('select count(*)::int n from public.customer_orders')).rows[0].n, 0)
  })
  await t.test('two independent ordinary buyers get authoritative totals and one durable order per command', async () => {
    for (const [index, actor] of ['customer', 'secondBuyer'].entries()) {
      const body = input(actor, index), q = await post('/api/checkout/quote', body, actor)
      assert.equal(q.response.status, 200, JSON.stringify(q.body))
      assert.equal(q.body.totalAmount, [150, 250][index]); assert.equal(q.body.shippingFee, 50)
      const command = { ...body, quote_id: q.body.quoteId }
      const result = await post('/api/checkout', command, actor)
      assert.equal(result.response.status, 200, JSON.stringify(result.body))
      assert.equal((await post('/api/checkout', command, actor)).body.order.id, result.body.order.id)
      orders.push(result.body.order.id)
      const stored = (await f.db.query('select user_id,total_amount,stock_fulfillment_state from public.customer_orders where id=$1', [orders[index]])).rows[0]
      assert.equal(stored.user_id, f.actors[actor]); assert.equal(Number(stored.total_amount), [150, 250][index])
      assert.equal(stored.stock_fulfillment_state, 'untracked')
    }
    assert.equal((await f.db.query('select count(*)::int n from public.customer_orders')).rows[0].n, 2)
    assert.equal((await f.db.query('select count(*)::int n from public.commerce_serialized_units')).rows[0].n, 0)
  })
  await t.test('foreign order details, payment status and payment initiation reveal no other customer data', async () => {
    for (const [actor, owned, foreign] of [['customer', orders[0], orders[1]], ['secondBuyer', orders[1], orders[0]]]) {
      assert.equal((await f.call('/api/account/orders/' + owned, { actor })).response.status, 200)
      assert.equal((await f.call('/api/account/orders/' + foreign, { actor })).response.status, 404)
      assert.equal((await f.call('/api/payments/status?order_id=' + foreign, { actor })).response.status, 404)
      assert.equal((await post('/api/payments/intentions', { order_id: foreign }, actor)).response.status, 404)
    }
    assert.equal(dispatches, 0)
  })
  let callback, signature
  await t.test('one intention and replayed signed confirmation pay only the original order without inventing stock', async () => {
    for (let i = 0; i < 2; i++) assert.equal((await post('/api/payments/intentions', { order_id: orders[0] })).response.status, 200)
    assert.equal(dispatches, 1); assert.equal(paymentPayload.amount, 15000); assert.equal(paymentPayload.currency, 'EGP')
    assert.deepEqual(paymentPayload.payment_methods, [12345])
    callback = { amount_cents: 15000, created_at: '2026-10-26T00:00:00', currency: 'EGP', error_occured: false,
      has_parent_transaction: false, id: 970002, integration_id: 12345, is_3d_secure: true,
      is_auth: false, is_capture: false, is_refunded: false, is_standalone_payment: true,
      is_voided: false, order: { id: 970001 }, owner: 123, pending: false,
      source_data: { pan: '0000', sub_type: 'MasterCard', type: 'card' }, success: true }
    signature = createHmac('sha512', runtime.paymobHmacSecret).update(hmacMessage(callback)).digest('hex')
    for (let i = 0; i < 2; i++) assert.equal((await post('/api/payments/paymob/webhook?hmac=' + signature, { type: 'TRANSACTION', obj: callback }, null)).response.status, 200)
    const paid = (await f.db.query('select status,payment_status,amount_paid,stock_fulfillment_state from public.customer_orders where id=$1', [orders[0]])).rows[0]
    assert.equal(paid.payment_status, 'paid'); assert.equal(Number(paid.amount_paid), 150)
    assert.equal(paid.status, 'processing'); assert.equal(paid.stock_fulfillment_state, 'untracked')
    assert.equal((await f.call('/api/payments/status?order_id=' + orders[0])).body.status, 'paid')
    assert.equal((await f.call('/api/payments/status?provider_order_id=970001', { actor: 'secondBuyer' })).response.status, 404)
    assert.equal((await f.db.query('select count(*)::int n from public.payment_transactions')).rows[0].n, 1)
    assert.equal((await f.db.query('select count(*)::int n from public.commerce_serialized_units')).rows[0].n, 0)
    assert.equal((await f.db.query('select count(*)::int n from public.shipping_order_jobs')).rows[0].n, 0)
    assert.equal((await f.call('/api/admin-orders/' + orders[0], { actor: 'owner' })).response.status, 200)
  })
  await t.test('paid untracked packing checks product codes, quantity, actor and video without inventory records', async () => {
    const work = randomUUID(), session = randomUUID(), owner = f.actors.owner
    await f.db.query("insert into public.order_packing_work_sessions(id,admin_user_id,operator_name) values($1,$2,'Fixture packer')", [work, owner])
    await assert.rejects(() => f.db.query('insert into public.order_packing_sessions(order_id,admin_user_id,work_session_id) values($1,$2,$3)', [orders[1], owner, work]), /verified live card payment/)
    await f.db.query('insert into public.order_packing_sessions(id,order_id,admin_user_id,work_session_id) values($1,$2,$3,$4)', [session, orders[0], owner, work])
    // Changing the shop default cannot rewrite an accepted order's stock policy.
    await f.db.exec('update public.site_settings set inventory_tracking_required=true')
    await assert.rejects(() => f.db.query("update public.customer_orders set stock_fulfillment_state='ready' where id=$1", [orders[0]]), /Allocate physical stock/)
    assert.equal((await post('/api/admin-orders/packing/' + session + '/scan', { code: 'WRONG-PRODUCT' }, 'owner')).response.status, 404)
    const item = (await f.db.query('select * from public.customer_order_items where order_id=$1', [orders[0]])).rows[0]
    const code = item.variant_sku || item.product_sku || item.variant_code
    assert.ok(code)
    assert.equal((await post('/api/admin-orders/packing/' + session + '/scan', { code }, 'secondBuyer')).response.status, 403)
    const scan = await post('/api/admin-orders/packing/' + session + '/scan', { code }, 'owner')
    assert.equal(scan.response.status, 200, JSON.stringify(scan.body))
    assert.equal((await post('/api/admin-orders/packing/' + session + '/scan', { code }, 'owner')).response.status, 409)
    await assert.rejects(() => f.db.query("select public.complete_order_packing_session($1,$2,'ready_to_deliver',null,null,'Fixture packer')", [session, owner]), /packing video|private VPS video/)
    // Disposable metadata only: private video transport is already accepted and
    // is not retested or represented as an actual recording in this fixture.
    await f.db.query("insert into public.order_packing_videos(packing_session_id,work_session_id,order_id,recorded_by,storage_path,file_name,mime_type,size_bytes,duration_seconds,status,recording_started_at,recording_ended_at,uploaded_at,storage_backend,upload_id,sha256,validated_at) values($1::uuid,$2::uuid,$3::uuid,$4::uuid,'vps-v1/'||$4::text||'/'||$3::text||'/'||$1::text||'/'||$5::text||'.webm','fixture.webm','video/webm',100,120,'ready',now()-interval '1 minute',now()+interval '1 minute',now(),'vps',$5::uuid,repeat('a',64),now())", [session, work, orders[0], owner, randomUUID()])
    const completed = (await f.db.query("select public.complete_order_packing_session($1,$2,'ready_to_deliver',null,null,'Fixture packer') value", [session, owner])).rows[0].value
    assert.equal(completed.order_status, 'ready_to_deliver')
    assert.equal((await f.db.query('select count(*)::int n from public.commerce_serialized_units')).rows[0].n, 0)
    assert.equal((await f.db.query('select stock_quantity from public.products where id=$1', [products[0].id])).rows[0].stock_quantity, 0)
  })
  await t.test('manual commercial closure preserves captured-payment evidence and returns no nonexistent units', async () => {
    // This represents an independently confirmed, privately journaled customer
    // reimbursement. PATCH does not send money or create a Paymob refund.
    const captured = (await f.db.query('select * from public.payment_transactions')).rows
    for (let i = 0; i < 2; i++) assert.equal((await f.call('/api/admin-orders/' + orders[0], { method: 'PATCH', actor: 'owner', body: { status: 'refunded' } })).response.status, 200)
    assert.equal((await post('/api/payments/paymob/webhook?hmac=' + signature, { type: 'TRANSACTION', obj: callback }, null)).response.status, 200)
    const closed = (await f.call('/api/account/orders/' + orders[0])).body.order
    assert.equal(closed.status, 'refunded')
    assert.equal(closed.payment_status, 'paid') // original card capture, not an asserted card refund
    assert.deepEqual((await f.db.query('select * from public.payment_transactions')).rows, captured)
    assert.equal((await f.db.query('select count(*)::int n from public.commerce_serialized_units')).rows[0].n, 0)
    assert.equal((await f.db.query('select count(*)::int n from public.shipping_order_jobs')).rows[0].n, 0)
    assert.equal(dispatches, 1)
  })
})
