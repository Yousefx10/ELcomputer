import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createResetDatabase } from './helpers/resetDatabase.mjs'
import { getPaymobConfig, toMinorUnits, buildIntentionRequest, createPaymobIntention, verifyPaymobHmac, hmacMessage, normalizePaymobCallback } from '../server/utils/payments/paymob.js'
import { createServer } from 'node:http'
import { createApp, toNodeListener, createError } from 'h3'
import { initiateOrderPayment, paymentHandler } from '../server/utils/payments/index.js'
import { configuredPaymobMethods } from '../server/utils/payments/methods.js'
import { pixelPaymentMethods, paymobPixelOptions } from '../app/utils/paymobPixel.js'
const runtime = { paymobEnabled: true, paymobMode: 'test', paymobSecretKey: 'egy_sk_test_fixture', paymobPublicKey: 'egy_pk_test_fixture', paymobHmacSecret: 'fixture-hmac-secret', paymobCardIntegrationId: '12345', paymobCardIntegrationMode: 'test', public: { siteUrl: 'https://new.elcomputer.net' } }
const config = getPaymobConfig(runtime)
const order = { id: randomUUID(), user_id: randomUUID(), order_number: 'ORD-TEST', currency: 'EGP', payment_method: 'card', is_preorder: false, total_amount: '112.50', first_name: 'Buyer', last_name: 'Test', email: 'fixture@example.invalid', phone: '01000000000', street_address: 'Street', city: 'Cairo', governorate: 'Cairo' }
const attempt = { id: randomUUID(), amount_minor: 11250, mode: 'test', integration_id: 12345 }
const payload = buildIntentionRequest(config, order, attempt)
const response = { id: 'pi_test_fixture', intention_order_id: 9876, client_secret: 'egy_csk_test_fixture', intention_detail: { amount: 11250, currency: 'EGP' }, special_reference: attempt.id }
const tx = { amount_cents: 11250, created_at: '2026-10-04T10:00:00', currency: 'EGP', error_occured: false, has_parent_transaction: false, id: 7777, integration_id: 12345, is_3d_secure: true, is_auth: false, is_capture: false, is_refunded: false, is_standalone_payment: true, is_voided: false, order: { id: 9876 }, owner: 333, pending: false, source_data: { pan: '2346', sub_type: 'MasterCard', type: 'card' }, success: true }
const sign = obj => createHmac('sha512', runtime.paymobHmacSecret).update(hmacMessage(obj)).digest('hex')

test('actual H3 payment errors retain no-store and never echo private error text or query data', async () => {
  const app = createApp()
  app.use('/payment', paymentHandler(event => {
    if (event.path.includes('unknown')) throw createError({ statusCode: 404, statusMessage: 'PRIVATE_PROVIDER_ERROR' })
    throw Error('PRIVATE_UNEXPECTED_ERROR')
  }))
  const server = createServer(toNodeListener(app))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    for (const [path, status] of [['unknown',404],['unexpected',503]]) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/payment/${path}?hmac=PRIVATE_SIGNATURE`)
      assert.equal(response.status,status);assert.match(response.headers.get('cache-control'),/private, no-store/)
      const body = await response.text();assert.equal(body.includes('PRIVATE'),false);assert.equal(body.includes('hmac'),false)
    }
  } finally { await new Promise(resolve => server.close(resolve)) }
})
test('Paymob is disabled by default and validates mode, keys, integration mode and fixed origin', () => {
  assert.throws(() => getPaymobConfig({}), /gateway_disabled/)
  for (const change of [{ paymobMode: 'live' }, { paymobMode: 'unknown' }, { paymobSecretKey: 'egy_sk_live_fixture' }, { paymobPublicKey: 'egy_pk_live_fixture' }, { paymobHmacSecret: '' }, { paymobCardIntegrationId: '0' }, { paymobCardIntegrationId: '1.5' }, { paymobCardIntegrationMode: 'live' }, { public: { siteUrl: 'http://unsafe.example' } }, { public: { siteUrl: 'https://unsafe.example/path' } }]) assert.throws(() => getPaymobConfig({ ...runtime, ...change }))
  assert.equal(config.mode, 'test')
})
test('future integrations are configurable but require implemented flows and device capability', () => {
  const methods = configuredPaymobMethods({ ...runtime, paymobIntegrationIds: JSON.stringify({ apple_pay: { id: 12346, mode: 'test', enabled: true }, google_pay: { id: 12347, mode: 'test', enabled: true }, mobile_wallet: { id: 12348, mode: 'test', enabled: true } }) }, 'test')
  assert.deepEqual(methods.filter(method => method.available).map(method => method.method), ['card'])
  assert.equal(methods.find(method => method.method === 'apple_pay').integrationId, 12346)
  assert.throws(() => configuredPaymobMethods({ ...runtime, paymobIntegrationIds: '{bad}' }, 'test'))
  assert.throws(() => configuredPaymobMethods({ ...runtime, paymobIntegrationIds: '{"google_pay":{"id":2,"mode":"live","enabled":true}}' }, 'test'))
})
test('EGP minor units preserve exact decimal values and reject rounding/invalid amounts', () => {
  for (const [value, expected] of [['0.01', 1], ['112.50', 11250], ['100', 10000], [0.29, 29], ['9999999999.99', 999999999999]]) assert.equal(toMinorUnits(value), expected)
  for (const value of ['0', '-1', '1.005', 'NaN', '1e3', null, undefined, ' 1']) assert.throws(() => toMinorUnits(value))
})
test('Intention request derives saved payable amount including fees and supplies separate new callback URLs', () => {
  assert.equal(payload.amount, 11250); assert.equal(payload.currency, 'EGP')
  assert.deepEqual(payload.payment_methods, [12345]); assert.equal(payload.special_reference, attempt.id)
  assert.equal(payload.items[0].amount, payload.amount)
  assert.equal(payload.notification_url, 'https://new.elcomputer.net/api/payments/paymob/webhook')
  assert.equal(payload.redirection_url, `https://new.elcomputer.net/checkout/payment-result?order_id=${order.id}`)
  assert.match(buildIntentionRequest(config, order, attempt, 'ar').redirection_url, /\/ar\/checkout\/payment-result/)
  assert.throws(() => buildIntentionRequest(config, { ...order, total_amount: '1' }, attempt), /order_changed/)
  assert.throws(() => buildIntentionRequest(config, { ...order, currency: 'USD' }, attempt), /order_changed/)
})
test('mock successful Intention uses Token secret on server and returns a minimal session', async () => {
  const result = await createPaymobIntention(config, payload, async (url, options) => {
    assert.equal(url, 'https://accept.paymob.com/v1/intention/')
    assert.equal(options.headers.Authorization, 'Token egy_sk_test_fixture')
    assert.deepEqual(JSON.parse(options.body), payload)
    return { ok: true, json: async () => response }
  })
  assert.deepEqual(result, { intentionId: response.id, providerOrderId: '9876', clientSecret: response.client_secret })
})
test('provider failures, timeouts and malformed responses never retry an uncertain POST', async () => {
  for (const status of [400, 401, 404, 500, 503]) {
    let calls = 0
    await assert.rejects(() => createPaymobIntention(config, payload, async () => { calls++; return { ok: false, status } }), /provider_rejected|intention_uncertain/)
    assert.equal(calls, 1)
  }
  await assert.rejects(() => createPaymobIntention(config, payload, async (_url, options) => {
    await new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true }))
  }, 10), /intention_uncertain/)
})
test('malformed Intention amount/currency/reference/mode/IDs are rejected', async () => {
  for (const change of [{ id: 'pi_live_other' }, { intention_order_id: null }, { client_secret: 'egy_csk_live_other' }, { intention_detail: { amount: 1, currency: 'EGP' } }, { intention_detail: { amount: 11250, currency: 'USD' } }, { special_reference: 'wrong-order' }, { client_secret: {} }]) {
    await assert.rejects(() => createPaymobIntention(config, payload, async () => ({ ok: true, json: async () => ({ ...response, ...change }) })), /intention_uncertain/)
  }
  await assert.rejects(() => createPaymobIntention(config, payload, async () => ({ ok: true, json: async () => { throw Error('private response') } })), /intention_uncertain/)
})
test('HMAC uses official independent known field concatenation and timing-safe SHA512 comparison', () => {
  const expected = '112502026-10-04T10:00:00EGPfalsefalse777712345truefalsefalsefalsetruefalse9876333false2346MasterCardcardtrue'
  assert.equal(hmacMessage(tx), expected)
  const signature = createHmac('sha512', runtime.paymobHmacSecret).update(expected).digest('hex')
  assert.equal(verifyPaymobHmac(tx, signature, runtime.paymobHmacSecret), true)
  for (const signature of ['bad', '0'.repeat(128), ['0'.repeat(128)], null]) assert.equal(verifyPaymobHmac(tx, signature, runtime.paymobHmacSecret), false)
  assert.equal(verifyPaymobHmac({ ...tx, amount_cents: 1 }, sign(tx), runtime.paymobHmacSecret), false)
  assert.equal(verifyPaymobHmac({ ...tx, success: undefined }, sign(tx), runtime.paymobHmacSecret), false)
})
test('verified callback is normalized without card data, unsigned reference or provider body', () => {
  const value = normalizePaymobCallback({ ...tx, data: { card_num: 'must-not-persist' }, is_live: true, merchant_order_id: 'wrong-order' }, config)
  assert.deepEqual(value, { provider_order_id: '9876', transaction_id: '7777', integration_id: 12345, mode: 'test', currency: 'EGP', amount_minor: 11250, status: 'succeeded' })
  assert.equal(normalizePaymobCallback({ ...tx, pending: true }, config).status, 'pending')
  assert.equal(normalizePaymobCallback({ ...tx, success: false }, config).status, 'failed')
  for (const change of [{ integration_id: 12 }, { currency: 'USD' }, { success: 'true' }, { is_auth: true }, { is_capture: true }, { is_refunded: true }, { is_voided: true }, { has_parent_transaction: true }, { is_standalone_payment: false }, { id: '7777' }]) assert.throws(() => normalizePaymobCallback({ ...tx, ...change }, config))
})
const dbMock = ({ owned = true, created = true, attemptChange = {}, rpcError = false } = {}) => {
  const calls = [], filters = []
  return { calls, filters, from(table) { return {
    select() { return this }, eq(key, value) { filters.push([table, key, value]); return this },
    async maybeSingle() { return { data: owned ? order : null } },
    update(data) { calls.push(['update', data]); return this }, then(resolve) { resolve({}) }
  } }, async rpc(name, args) {
    calls.push([name, args]); if (rpcError) return { error: { code: 'P0001' } }
    return { data: name === 'commerce_claim_payment_attempt' ? { created, attempt: { ...attempt, status: 'pending', client_secret: response.client_secret, expires_at: new Date(Date.now() + 300000).toISOString(), ...attemptChange } } : null }
  } }
}
test('initiation checks customer ownership before any provider request', async () => {
  const db = dbMock({ owned: false }); let network = 0
  await assert.rejects(() => initiateOrderPayment({ db, userId: 'other-user', orderId: order.id, runtime, fetcher: async () => { network++ } }), /order_not_found/)
  assert.equal(network, 0); assert.equal(db.calls.length, 0)
  assert.ok(db.filters.some(([, field, value]) => field === 'user_id' && value === 'other-user'))
})
test('initiation stores identifiers then returns public key/client secret, never private credentials', async () => {
  const db = dbMock()
  const result = await initiateOrderPayment({ db, userId: order.user_id, orderId: order.id, runtime, fetcher: async () => ({ ok: true, json: async () => response }) })
  assert.deepEqual(result.methods, ['card']); assert.equal(result.clientSecret, response.client_secret)
  assert.equal(db.calls[1][0], 'commerce_store_payment_intention')
  assert.equal(JSON.stringify(result).includes(runtime.paymobSecretKey), false)
  assert.equal(JSON.stringify(result).includes(runtime.paymobHmacSecret), false)
})
test('existing intention reuse and uncertain/expired/mode-changed attempts never send another POST', async () => {
  let network = 0
  const fetcher = async () => { network++; throw Error('must not call') }
  const result = await initiateOrderPayment({ db: dbMock({ created: false }), userId: order.user_id, orderId: order.id, runtime, fetcher })
  assert.equal(result.clientSecret, response.client_secret)
  for (const change of [{ client_secret: null }, { status: 'succeeded' }, { expires_at: '2020-01-01' }, { mode: 'live' }, { integration_id: 2 }]) await assert.rejects(() => initiateOrderPayment({ db: dbMock({ created: false, attemptChange: change }), userId: order.user_id, orderId: order.id, runtime, fetcher }))
  assert.equal(network, 0)
})
test('uncertain initiation persists only a safe error code and blocks automatic retries', async () => {
  const db = dbMock()
  await assert.rejects(() => initiateOrderPayment({ db, userId: order.user_id, orderId: order.id, runtime, fetcher: async () => { throw Error('PRIVATE secret/card/body') } }), /intention_uncertain/)
  const stored = db.calls.find(([name]) => name === 'update')[1]
  assert.equal(stored.error_code, 'intention_uncertain'); assert.equal(JSON.stringify(stored).includes('PRIVATE'), false)
})
test('Pixel accepts card only, no saved cards; express availability stays empty until implemented', () => {
  assert.deepEqual(pixelPaymentMethods({ card: { available: true } }), ['card'])
  assert.deepEqual(pixelPaymentMethods({}), [])
  const options = paymobPixelOptions({ publicKey: 'public', clientSecret: 'client', elementId: 'pixel', locale: 'ar', dark: true })
  assert.equal(options.forceSaveCard, false); assert.equal(options.showSaveCard, false)
  assert.equal(options.customStyle.Direction, 'rtl'); assert.equal(options.customStyle.Color_Container, '#0f172a')
  assert.deepEqual(options.paymentMethods, ['card'])
})

test('real PostgreSQL ledger preserves authoritative checkout, idempotency, RLS and test fulfillment isolation', async t => {
  const db = await createResetDatabase({ stopBefore: '20261004120000' })
  const customer = randomUUID(), other = randomUUID(), product = randomUUID(), cart = randomUUID()
  const readOrder = async id => (await db.query('select * from public.customer_orders where id=$1', [id])).rows[0]
  const claim = async (id, owner = customer, mode = 'test', integration = 12345) => (await db.query('select public.commerce_claim_payment_attempt($1,$2,$3,$4) as result', [id, owner, mode, integration])).rows[0].result
  const store = async (a, providerOrder = '9876') => db.query('select public.commerce_store_payment_intention($1,$2,$3,$4)', [a.id, 'pi_test_' + a.id, providerOrder, 'egy_csk_test_' + a.id])
  const reconcile = async change => db.query('select public.commerce_reconcile_payment_transaction($1::jsonb)', [JSON.stringify({ ...normalizePaymobCallback(tx, config), ...change })])
  try {
    await db.exec("select set_config('request.jwt.claim.role','service_role',false)")
    await db.query("insert into auth.users(id,email) values($1,'buyer@example.invalid'),($2,'other@example.invalid')", [customer, other])
    await db.exec("insert into public.site_settings(key,payment_card_enabled,payment_card_fee) values('default',true,12.50) on conflict(key) do update set payment_card_enabled=true,payment_card_fee=12.50")
    await db.exec("select set_config('app.serialized_inventory_write','on',false)")
    await db.query("insert into public.products(id,title,slug,price,stock_quantity,is_serialized) values($1,'Fixture',($1::uuid)::text,100,5,false)", [product])
    await db.exec("select set_config('app.serialized_inventory_write','off',false)")
    const args = [customer, JSON.stringify({ order_number: 'PAY-TEST', first_name: 'Buyer', phone: '01000000000', street_address: 'Street', city: 'Cairo', governorate: 'Cairo', payment_method: 'card', total_amount: 1 }), JSON.stringify([{ product_id: product, quantity: 1, price: 1 }]), cart]
    const checkout = async () => (await db.query('select public.commerce_create_customer_order($1,$2::jsonb,$3::jsonb,false,$4) as result', args)).rows[0].result
    const first = await checkout(), original = await readOrder(first.order.id)
    // Apply additive migration with an existing unpaid order: no historical rewrite.
    await db.exec(readFileSync(new URL('../supabase/migrations/20261004120000_paymob_foundation.sql', import.meta.url), 'utf8'))
    assert.deepEqual(await readOrder(first.order.id), original)
    await t.test('RPC ignores forged prices, preserves one stock reduction and cart idempotency', async () => {
      assert.equal(Number(first.order.total_amount), 112.5); assert.equal((await checkout()).created, false)
      assert.equal((await db.query('select stock_quantity from public.products where id=$1', [product])).rows[0].stock_quantity, 4)
    })
    await t.test('wrong customer, mode, method and disabled settings cannot claim', async () => {
      await assert.rejects(() => claim(first.order.id, other), /Order not found/)
      await assert.rejects(() => claim(first.order.id, customer, 'live'), /Gateway unavailable/)
      await db.exec("update public.site_settings set payment_card_enabled=false where key='default'")
      await assert.rejects(() => claim(first.order.id), /Card unavailable/)
      await db.exec("update public.site_settings set payment_card_enabled=true where key='default'")
    })
    let a
    await t.test('simultaneous claims serialize to exactly one attempt', async () => {
      const values = await Promise.all([claim(first.order.id), claim(first.order.id), claim(first.order.id)])
      assert.equal(values.filter(x => x.created).length, 1); a = values[0].attempt
      assert.equal(new Set(values.map(x => x.attempt.id)).size, 1); assert.equal(Number(a.amount_minor), 11250)
      await store(a)
      await assert.rejects(() => store(a), /already recorded/)
    })
    await t.test('wrong amount/currency/integration/mode and unknown provider order reject', async () => {
      for (const change of [{ amount_minor: 1 }, { currency: 'USD' }, { integration_id: 2 }, { mode: 'live' }, { provider_order_id: 'unknown' }]) await assert.rejects(() => reconcile(change), /mismatch|Invalid transaction|not persisted/)
      assert.equal((await db.query('select count(*)::int n from public.payment_transactions')).rows[0].n, 0)
    })
    await t.test('pending and failure are tracked; stale pending cannot downgrade failure', async () => {
      await reconcile({ status: 'pending' }); await reconcile({ status: 'failed' }); await reconcile({ status: 'pending' })
      assert.equal((await db.query('select status from public.payment_attempts where id=$1', [a.id])).rows[0].status, 'failed')
    })
    await t.test('success after failure, duplicates and later failures preserve one success and paid timestamp', async () => {
      await reconcile({ status: 'succeeded' })
      const before = (await db.query('select * from public.payment_attempts where id=$1', [a.id])).rows[0]
      await reconcile({ status: 'succeeded' }); await reconcile({ status: 'failed' }); await reconcile({ status: 'pending', transaction_id: '7778' })
      const after = (await db.query('select * from public.payment_attempts where id=$1', [a.id])).rows[0]
      assert.equal(after.status, 'succeeded'); assert.deepEqual(after.paid_at, before.paid_at); assert.deepEqual(after.updated_at, before.updated_at); assert.equal(after.client_secret, null)
      assert.equal((await db.query("select count(*)::int n from public.payment_transactions where transaction_id='7777'")).rows[0].n, 1)
      assert.equal((await readOrder(first.order.id)).payment_status, 'pending')
      assert.equal((await db.query('select count(*)::int n from public.shipping_order_jobs where order_id=$1', [first.order.id])).rows[0].n, 0)
    })
    await t.test('test success cannot progress orders, pack inventory or fake live paid state', async () => {
      await assert.rejects(() => db.query("update public.customer_orders set status='processing' where id=$1", [first.order.id]), /Test gateway/)
      await assert.rejects(() => db.query("update public.customer_orders set payment_status='paid' where id=$1", [first.order.id]), /Test gateway/)
      await assert.rejects(() => db.query('insert into public.order_packing_sessions(order_id) values($1)', [first.order.id]), /verified live card payment/)
      assert.equal((await db.query('select stock_quantity from public.products where id=$1', [product])).rows[0].stock_quantity, 4)
    })
    await t.test('transaction ID cannot be rebound to another known intention', async () => {
      const second = (await db.query("insert into public.customer_orders(user_id,first_name,phone,street_address,city,governorate,payment_method,total_amount) values($1,'Other','01000000000','Street','Cairo','Cairo','card',100) returning id", [customer])).rows[0]
      const claimed = await claim(second.id); await store(claimed.attempt, '9877')
      await assert.rejects(() => reconcile({ provider_order_id: '9877' }), /another payment/)
    })
    await t.test('dormant live reconciliation succeeds once, while stale failures and cancellation cannot fulfill', async () => {
      const makeLive = async (providerOrder, cancelled = false) => {
        const id = (await db.query("insert into public.customer_orders(user_id,first_name,phone,street_address,city,governorate,payment_method,total_amount,status) values($1,'Live fixture','01000000000','Street','Cairo','Cairo','card',100,$2) returning id", [customer, cancelled ? 'cancelled' : 'pending_payment'])).rows[0].id
        await db.query("insert into public.payment_attempts(order_id,mode,integration_id,amount_minor,currency,status,provider_order_id) values($1,'live',12345,11250,'EGP','pending',$2)", [id,providerOrder])
        return id
      }
      const live = await makeLive('9880')
      await reconcile({ provider_order_id: '9880', transaction_id: '7780', mode: 'live', status: 'failed' })
      assert.equal((await readOrder(live)).payment_status, 'failed')
      await reconcile({ provider_order_id: '9880', transaction_id: '7780', mode: 'live', status: 'succeeded' })
      const paid = await readOrder(live)
      assert.equal(paid.payment_status,'paid'); assert.equal(paid.status,'processing'); assert.equal(Number(paid.amount_paid),112.5)
      await reconcile({ provider_order_id: '9880', transaction_id: '7780', mode: 'live', status: 'succeeded' })
      await reconcile({ provider_order_id: '9880', transaction_id: '7780', mode: 'live', status: 'failed' })
      assert.deepEqual(await readOrder(live), paid)
      const cancelled = await makeLive('9881',true)
      await reconcile({ provider_order_id: '9881', transaction_id: '7781', mode: 'live', status: 'succeeded' })
      assert.equal((await readOrder(cancelled)).status,'cancelled');assert.equal((await readOrder(cancelled)).payment_status,'pending')
      assert.equal((await db.query("select error_code from public.payment_attempts where order_id=$1",[cancelled])).rows[0].error_code,'order_requires_review')
    })
    await t.test('browser roles have neither ledger access nor reconciliation RPC execution', async () => {
      for (const role of ['anon','authenticated']) {
        await db.exec(`set role ${role}`)
        await assert.rejects(() => db.query('select * from public.payment_attempts'), /permission denied/)
        await assert.rejects(() => db.query('select * from public.payment_transactions'), /permission denied/)
        await assert.rejects(() => reconcile({}), /permission denied/)
        await db.exec('reset role')
      }
      const tables = (await db.query("select public.system_reset_tables('orders') t")).rows[0].t
      assert.ok(tables.includes('payment_attempts')); assert.ok(tables.includes('payment_transactions'))
    })
  } finally { await db.close() }
})
