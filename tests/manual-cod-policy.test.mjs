import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { build } from 'esbuild'
import { resolve } from 'node:path'
import { authorizeBetaCheckout, betaPurchaseCapability, betaPurchasePolicy } from '../server/utils/betaPurchase.js'
import { formatCustomerOrderStatus } from '../app/utils/orderStatus.js'

const built = await build({ entryPoints: [resolve('app/utils/codCheckout.js')], bundle: true, write: false, format: 'esm', platform: 'node' })
const { checkoutPaymentMethods, checkoutDeliveryOptions, codPaymentState } = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'))

test('COD opt-in stays deployment-specific and defaults to CARD only', () => {
  for (const siteUrl of ['https://orchard.example.invalid', 'https://cedar.example.invalid']) {
    const company = randomUUID(), excluded = randomUUID(), buyer = randomUUID()
    const runtime = { public: { betaPurchasingEnabled: true, purchasingEnabled: true, siteUrl },
      betaPurchasePolicy: { shipping_company_id: company, excluded_product_ids: [excluded], customer_ids: [buyer] } }
    const order = { payment_method: 'cash', shipping_method: 'shipping', shipping_company_id: company }
    const items = [{ product_id: randomUUID(), quantity: 1 }]
    assert.throws(() => authorizeBetaCheckout(runtime, order, items, { id: buyer }))
    runtime.betaPurchasePolicy.payment_methods = ['card', 'cash']
    authorizeBetaCheckout(runtime, order, items, { id: buyer })
    assert.deepEqual(betaPurchaseCapability(runtime).paymentMethods, ['card', 'cash'])
    assert.throws(() => authorizeBetaCheckout(runtime, order, items, { id: randomUUID() }))
    for (const change of [{ shipping_company_id: randomUUID() }, { coupon_code: 'UNAPPROVED' }, { payment_method: 'bank_transfer' }]) {
      assert.throws(() => authorizeBetaCheckout(runtime, { ...order, ...change }, items, { id: buyer }))
    }
    assert.throws(() => authorizeBetaCheckout(runtime, order, [{ product_id: excluded }], { id: buyer }))
    for (const payment_methods of [null, [], 'cash', ['cash', 'cash'], ['card', 'paypal'], ['CASH'], [true]]) {
      assert.throws(() => betaPurchasePolicy({ ...runtime, betaPurchasePolicy: { ...runtime.betaPurchasePolicy, payment_methods } }))
    }
  }
})

test('checkout combines Dashboard enablement, Beta methods, preorder and delivery capability', () => {
  const settings = { payment_card_enabled: true, payment_cash_enabled: true, payment_bank_transfer_enabled: true }
  const capabilities = { purchase: { beta: true, paymentMethods: ['card', 'cash'] }, card: { available: true } }
  const methods = options => checkoutPaymentMethods(settings, capabilities, options).map(m => m.value)
  assert.deepEqual(methods(), ['card', 'cash'])
  assert.deepEqual(methods({ restricted: true }), ['card'])
  assert.deepEqual(methods({ preorder: true }), [])
  assert.deepEqual(checkoutPaymentMethods({ ...settings, payment_cash_enabled: false }, capabilities).map(m => m.value), ['card'])
  assert.deepEqual(checkoutPaymentMethods(settings, { purchase: { beta: true }, card: { available: true } }), [])
  const delivery = [{ id: 'manual', governorates: ['Cairo'], cashAvailable: true },
    { id: 'other', governorates: ['Cairo'], cashAvailable: false }, { id: 'elsewhere', governorates: ['Giza'], cashAvailable: true }]
  assert.deepEqual(checkoutDeliveryOptions(delivery, ' cairo ', 'cash').map(o => o.id), ['manual'])
  assert.deepEqual(checkoutDeliveryOptions(delivery, 'Cairo', 'card').map(o => o.id), ['manual', 'other'])
})

test('cash labels distinguish placement, fulfillment and actual collection', () => {
  const order = { status: 'pending_payment', payment_status: 'pending', amount_paid: 0, total_amount: 150 }
  assert.equal(formatCustomerOrderStatus(order.status, 'cash'), 'Placed')
  assert.equal(formatCustomerOrderStatus(order.status, 'card'), 'Pending Payment')
  for (const status of ['pending_payment', 'processing', 'out_for_delivery', 'delivered', 'completed']) {
    assert.equal(codPaymentState({ ...order, status }), 'awaiting')
  }
  assert.equal(codPaymentState({ ...order, payment_status: 'partially_paid', amount_paid: 50 }), 'partial')
  assert.equal(codPaymentState({ ...order, payment_status: 'paid', amount_paid: 150 }), 'collected')
  assert.equal(codPaymentState({ ...order, payment_status: 'paid' }), 'review')
  assert.equal(codPaymentState({ ...order, status: 'cancelled' }), 'closed')
})
