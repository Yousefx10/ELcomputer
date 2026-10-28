import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { createApp, toNodeListener } from 'h3'
import { projectCustomerPayment, readOwnedPaymentStatus } from '../server/utils/payments/customerStatus.js'
import { initiateOrderPayment, paymentHandler } from '../server/utils/payments/index.js'
import { prepareCustomerPaymentNotification } from '../server/utils/payments/customerNotification.js'

const now = Date.parse('2026-10-28T01:00:00Z')
const order = { id: randomUUID(), user_id: randomUUID(), order_number: 'ORD-SYNTHETIC',
  email: 'buyer@example.invalid', status: 'pending_payment', payment_status: 'pending',
  payment_method: 'card', is_preorder: false, total_amount: '2649.00', amount_paid: '0.00', currency: 'EGP' }
const attempt = { id: randomUUID(), order_id: order.id, provider: 'paymob', method: 'card', mode: 'live',
  integration_id: 12345, amount_minor: 264900, currency: 'EGP', status: 'pending', expires_at: '2026-10-28T01:30:00Z' }
const transaction = status => ({ attempt_id: attempt.id, provider: 'paymob', status })
const project = (o = order, a = attempt, rows = []) => projectCustomerPayment(o, a, rows, now)
const paidOrder = { ...order, status: 'processing', payment_status: 'paid', amount_paid: '2649.00', paid_at: '2026-10-28T01:01:00Z' }
const paidAttempt = { ...attempt, status: 'succeeded', paid_at: paidOrder.paid_at }

test('abandonment and unsigned cancellation cannot become Paid or provider-confirmed nonpayment', () => {
  assert.deepEqual(project(order, null), { status: 'awaiting_payment', verified: false, mode: null, recovery: 'start', changeMethodAvailable: false })
  assert.equal(project().status, 'pending')
  assert.equal(project({ ...order, status: 'cancelled' }).status, 'provider_uncertain')
  for (const change of [{ expires_at: '2020-01-01' }, { expires_at: null }, { status: 'cancelled' }, { status: 'expired' }, { error_code: 'intention_uncertain' }]) {
    assert.equal(project(order, { ...attempt, ...change }).status, 'provider_uncertain')
  }
})
test('failed card transaction is truthful and does not authorize a new charge', () => {
  assert.equal(project(order, { ...attempt, status: 'failed' }).status, 'provider_uncertain')
  const payment = project(order, { ...attempt, status: 'failed' }, [transaction('failed')])
  assert.equal(payment.status, 'failed'); assert.equal(payment.recovery, 'review'); assert.equal(payment.verified, false)
  assert.equal(project(order, { ...attempt, status: 'failed' }, [transaction('pending'), transaction('failed')]).status, 'provider_uncertain')
})
test('only matching live signed ledger and settled order yield verified payment', () => {
  assert.equal(project(paidOrder, paidAttempt, [transaction('succeeded')]).verified, true)
  for (const [o, a, rows] of [
    [paidOrder, attempt, []], [order, paidAttempt, [transaction('succeeded')]],
    [paidOrder, paidAttempt, []], [paidOrder, paidAttempt, [transaction('succeeded'), transaction('succeeded')]],
    [{ ...paidOrder, amount_paid: '1.00' }, paidAttempt, [transaction('succeeded')]],
    [paidOrder, { ...paidAttempt, amount_minor: 1 }, [transaction('succeeded')]],
    [paidOrder, { ...paidAttempt, order_id: randomUUID() }, [transaction('succeeded')]],
    [paidOrder, { ...paidAttempt, mode: 'test' }, [transaction('succeeded')]],
    [{ ...paidOrder, status: 'cancelled' }, paidAttempt, [transaction('succeeded')]]
  ]) assert.equal(project(o, a, rows).verified, false)
  assert.equal(project(order, { ...paidAttempt, mode: 'test' }, [transaction('succeeded')]).status, 'test_succeeded')
})
test('late callback moves uncertainty to verified only when settlement becomes coherent', () => {
  assert.equal(project(order, { ...attempt, expires_at: '2020-01-01' }).status, 'provider_uncertain')
  assert.equal(project(order, paidAttempt, [transaction('succeeded')]).status, 'provider_uncertain')
  assert.equal(project(paidOrder, paidAttempt, [transaction('succeeded')]).status, 'paid')
})

const dbFixture = ({ owned = true, failed = false } = {}) => {
  const reads = []
  return { reads, from(table) {
    const filters = {}; reads.push({ table, filters })
    const result = () => ({ error: failed ? { code: 'PRIVATE_DATABASE_ERROR' } : null,
      data: table === 'customer_orders' ? owned && filters.user_id === order.user_id && filters.id === order.id ? order : null
        : table === 'payment_attempts' ? { ...attempt, expires_at: '2020-01-01' } : [] })
    const query = { select: () => query, eq: (key, value) => { filters[key] = value; return query },
      order: () => query, limit: () => query, maybeSingle: async () => result(), then: done => Promise.resolve(result()).then(done) }
    return query
  } }
}
test('real H3 responses retain privacy on foreign ownership and database failure', async () => {
  let db = dbFixture(), actor = order.user_id
  const app = createApp(); app.use('/status', paymentHandler(() => readOwnedPaymentStatus(db, actor, order.id)))
  const server = createServer(toNodeListener(app)); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const url = `http://127.0.0.1:${server.address().port}/status?success=true`
    let response = await fetch(url); let body = await response.json()
    assert.equal(response.status, 200); assert.equal(body.status, 'provider_uncertain') // expired, not failed
    assert.equal(JSON.stringify(body).includes('client_secret'), false)
    actor = randomUUID(); db = dbFixture()
    response = await fetch(url); assert.equal(response.status, 404)
    assert.match(response.headers.get('cache-control'), /private, no-store/)
    assert.deepEqual(db.reads.map(row => row.table), ['customer_orders'])
    actor = order.user_id; db = dbFixture({ failed: true })
    response = await fetch(url); assert.equal(response.status, 503)
    assert.equal((await response.text()).includes('PRIVATE'), false)
  } finally { await new Promise(resolve => server.close(resolve)) }
})

test('double-click and provider-unavailable retries cannot mint another intention', async () => {
  const runtime = { paymobEnabled: true, paymobMode: 'test', paymobSecretKey: 'egy_sk_test_fixture',
    paymobPublicKey: 'egy_pk_test_fixture', paymobHmacSecret: 'fixture', paymobCardIntegrationId: 12345,
    paymobCardIntegrationMode: 'test', public: { siteUrl: 'https://orchid.example.invalid' } }
  let claimed = false, providerWrites = 0
  const db = dbFixture()
  db.rpc = async name => name === 'commerce_claim_payment_attempt'
    ? { data: { created: claimed ? false : (claimed = true), attempt: { ...attempt, mode: 'test' } } } : { data: null }
  const options = { db, userId: order.user_id, orderId: order.id, runtime,
    fetcher: async () => { providerWrites++; return { ok: true, json: async () => ({ id: 'pi_test_fixture', intention_order_id: 123,
      client_secret: 'egy_csk_test_fixture', intention_detail: { amount: 264900, currency: 'EGP' }, special_reference: attempt.id }) } } }
  const results = await Promise.allSettled([initiateOrderPayment(options), initiateOrderPayment(options)])
  assert.equal(results.filter(row => row.status === 'fulfilled').length, 1)
  assert.equal(providerWrites, 1)
  for (let i = 0; i < 2; i++) await assert.rejects(() => initiateOrderPayment({ ...options, fetcher: async () => { throw Error('Provider unavailable') } }), /payment_reconciliation_required/)
  assert.equal(providerWrites, 1)
})
test('truthful EN/AR notification preparation is dormant and stable without claiming delivery', () => {
  const input = { event: 'created', order }
  const first = prepareCustomerPaymentNotification(input)
  assert.match(first.subject, /awaiting payment/)
  assert.equal(first.idempotency_key, prepareCustomerPaymentNotification({ ...input, locale: 'ar' }).idempotency_key)
  assert.throws(() => prepareCustomerPaymentNotification({ ...input, event: 'paid' }))
  for (const locale of ['en', 'ar']) {
    const paid = prepareCustomerPaymentNotification({ event: 'paid', order: paidOrder, attempt: paidAttempt, transactions: [transaction('succeeded')], locale })
    assert.equal(paid.body_format, 'text'); assert.equal('sent' in paid, false)
    assert.doesNotMatch(JSON.stringify(paid), /client_secret|provider_order_id|integration_id/)
  }
})
