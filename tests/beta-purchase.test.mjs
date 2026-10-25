import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { betaPurchasePolicy, authorizeBetaCheckout, betaPurchaseCapability, authorizeBetaCustomer } from '../server/utils/betaPurchase.js'
import { build } from 'esbuild'
import { resolve } from 'node:path'
import { initiateOrderPayment } from '../server/utils/payments/index.js'

const bundled = await build({ entryPoints: [resolve('server/utils/normalPurchase.js')], bundle: true, write: false, format: 'esm', platform: 'node', alias: { '~': resolve('app') }, plugins: [{ name: 'h3', setup(b) { b.onResolve({ filter: /^h3$/ }, () => ({ path: import.meta.resolve('h3'), external: true })) } }] })
const { authorizeNormalCheckout, normalPaymentAuthorization, normalPurchaseScope } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'))

test('beta policy stays closed on absent, malformed or ambiguous configuration', () => {
  assert.equal(betaPurchasePolicy({}), null)
  for (const value of ['{}', '{', '[]', null, { shipping_company_id: randomUUID() }, { shipping_company_id: randomUUID(), excluded_product_ids: ['invalid'] }, { shipping_company_id: randomUUID(), excluded_product_ids: [], extra: true }]) {
    assert.throws(() => betaPurchasePolicy({ public: { betaPurchasingEnabled: true }, betaPurchasePolicy: value }))
  }
  assert.throws(() => normalPurchaseScope({ public: { betaPurchasingEnabled: true, purchasingEnabled: false }, betaPurchasePolicy: '{}' }, null))
})

test('normal acceptance can bind the existing two customers and a single hour', () => {
  const ids = [randomUUID(), randomUUID()]
  const runtime = { public: { betaPurchasingEnabled: true }, betaPurchasePolicy: {
    shipping_company_id: randomUUID(), excluded_product_ids: [], customer_ids: ids,
    starts_at: new Date(Date.now() - 1000).toISOString(), expires_at: new Date(Date.now() + 600000).toISOString()
  } }
  for (const id of ids) authorizeBetaCustomer(runtime, { id })
  for (const user of [null, {}, { id: randomUUID() }]) assert.throws(() => authorizeBetaCustomer(runtime, user))
  assert.equal(JSON.stringify(betaPurchaseCapability(runtime)).includes(ids[0]), false)
  assert.throws(() => betaPurchasePolicy({ ...runtime, betaPurchasePolicy: { ...runtime.betaPurchasePolicy, expires_at: new Date(Date.now() - 1).toISOString() } }))
})

test('two independent deployments restrict methods, excluded products and delivery identities', async () => {
  for (const domain of ['orchard.example.invalid', 'cedar.example.invalid']) {
    const company = randomUUID(), excluded = randomUUID(), product = randomUUID()
    const runtime = { public: { purchasingEnabled: true, betaPurchasingEnabled: true, siteUrl: 'https://' + domain }, betaPurchasePolicy: JSON.stringify({ shipping_company_id: company, excluded_product_ids: [excluded] }) }
    const order = { id: randomUUID(), payment_method: 'card', shipping_method: 'shipping', shipping_company_id: company }
    const items = [{ product_id: product, variant_id: randomUUID(), quantity: 1 }]
    authorizeBetaCheckout(runtime, order, items)
    assert.equal(authorizeNormalCheckout({ runtime, user: {}, cartId: randomUUID(), order, items }).runtime, runtime)
    for (const method of ['cash', 'bank_transfer', 'instapay', 'paypal', 'apple_pay']) assert.throws(() => authorizeBetaCheckout(runtime, { ...order, payment_method: method }, items))
    for (const changed of [{ shipping_company_id: randomUUID() }, { shipping_method: 'pickup' }, { coupon_code: 'UNAPPROVED' }]) assert.throws(() => authorizeBetaCheckout(runtime, { ...order, ...changed }, items))
    assert.throws(() => authorizeBetaCheckout(runtime, order, [{ ...items[0], product_id: excluded }]))
    const db = { from() { return { select() { return this }, eq() { return this }, limit: async () => ({ data: items, error: null }) } } }
    await normalPaymentAuthorization({ runtime, user: {}, db }).authorizeOrder(order)
    items[0].product_id = excluded
    await assert.rejects(() => normalPaymentAuthorization({ runtime, user: {}, db }).authorizeOrder(order))
    assert.deepEqual(betaPurchaseCapability(runtime), { beta: true, paymentMethods: ['card'], excludedProductIds: [excluded] })
    const upper = { ...runtime, betaPurchasePolicy: { shipping_company_id: company.toUpperCase(), excluded_product_ids: [excluded.toUpperCase()] } }
    assert.throws(() => authorizeBetaCheckout(upper, order, items))
  }
})

test('normal beta initiation projects the persisted delivery context before its single synthetic request', async () => {
  const user = { id: randomUUID() }, product = randomUUID(), company = randomUUID(), attemptId = randomUUID()
  const order = { id: randomUUID(), user_id: user.id, checkout_cart_id: randomUUID(), shipping_method: 'shipping', shipping_company_id: company,
    coupon_code: null, order_number: 'FIXTURE', status: 'pending_payment', payment_status: 'pending', payment_method: 'card', is_preorder: false,
    total_amount: '150.00', currency: 'EGP', first_name: 'Fixture', last_name: 'Buyer', email: 'buyer@fixture.invalid', phone: '01000000000', street_address: 'Fixture', city: 'Fixture', governorate: 'Cairo' }
  const runtime = { paymobEnabled: true, paymobMode: 'test', paymobSecretKey: 'egy_sk_test_fixture', paymobPublicKey: 'egy_pk_test_fixture', paymobHmacSecret: 'fixture-only', paymobCardIntegrationId: '12345', paymobCardIntegrationMode: 'test',
    public: { purchasingEnabled: true, betaPurchasingEnabled: true, siteUrl: 'https://store.example.invalid' }, betaPurchasePolicy: { shipping_company_id: company, excluded_product_ids: [] } }
  const db = { from(table) {
    let fields
    return { select(value) { fields = value; return this }, eq() { return this },
      limit: async () => ({ data: [{ product_id: product, variant_id: null, quantity: 1 }], error: null }),
      maybeSingle: async () => { assert.equal(table, 'customer_orders'); return { data: Object.fromEntries(fields.split(',').map(k => k.trim()).map(k => [k, order[k]])), error: null } } }
  }, async rpc(name) {
    if (name === 'commerce_claim_payment_attempt') return { data: { created: true, attempt: { id: attemptId, mode: 'test', integration_id: 12345, amount_minor: 15000, currency: 'EGP' } }, error: null }
    assert.equal(name, 'commerce_store_payment_intention'); return { data: null, error: null }
  } }
  let calls = 0
  const authorization = normalPaymentAuthorization({ runtime, user, db })
  const session = await initiateOrderPayment({ db, userId: user.id, orderId: order.id, locale: 'en', ...authorization,
    fetcher: async (_url, options) => { calls++; const payload = JSON.parse(options.body); assert.equal(payload.amount, 15000)
      return { ok: true, json: async () => ({ id: 'pi_test_beta_projection', intention_order_id: 990001, client_secret: 'egy_csk_test_beta_projection', special_reference: attemptId, intention_detail: { amount: 15000, currency: 'EGP' } }) } } })
  assert.equal(calls, 1); assert.deepEqual(session.methods, ['card'])
})
