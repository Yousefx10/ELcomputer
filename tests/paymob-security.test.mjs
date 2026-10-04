import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { randomUUID } from 'node:crypto'
import { createServer, request } from 'node:http'
import { createApp, toNodeListener, createError } from 'h3'
import { ref, computed } from 'vue'
import { paymentHandler } from '../server/utils/payments/index.js'
import { readPaymentCallbackBody } from '../server/utils/payments/body.js'
import { getPaymobConfig } from '../server/utils/payments/paymob.js'
import { createPaymobIntention } from '../server/utils/payments/paymob.js'
import { normalizePaymentMethod } from '../app/utils/paymentMethods.js'
import { paymobPixelOptions } from '../app/utils/paymobPixel.js'

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const runtime = { paymobEnabled: true, paymobMode: 'test', paymobSecretKey: 'egy_sk_test_fixture', paymobPublicKey: 'egy_pk_test_fixture', paymobHmacSecret: 'fixture-hmac', paymobCardIntegrationId: '12345', paymobCardIntegrationMode: 'test', public: { siteUrl: 'https://staging.example.invalid' } }

// Execute the real handler, replacing only Nuxt imports/infrastructure with isolated fixtures.
const checkoutHarness = (body, enabled = false, existing = null) => {
  let handler
  const writes = []
  const user = randomUUID(), id = randomUUID()
  const db = {
    from(table) { return {
      select() { return this }, eq() { return this }, in() { return this },
      async maybeSingle() { return { data: table === 'customer_orders' ? existing : { payment_card_enabled: true } } },
      then(resolve) { resolve({ data: [{ id: body.items[0].id, selling_mode: 'normal' }] }) },
      async upsert() { return {} }
    } },
    async rpc(name, args) { writes.push({ name, args }); return { data: { created: true, order: { id, order_number: 'FIXTURE', total_amount: 112.5, payment_method: 'card' } } } }
  }
  const source = read('server/api/checkout/index.post.js').replace(/import[\s\S]*?from ['"][^'"]+['"]\n/g, '').replace('export default defineEventHandler', 'captureHandler')
  runInNewContext(source, {
    captureHandler: fn => { handler = fn }, defineEventHandler: fn => fn,
    createError, randomUUID, normalizePaymentMethod, getPaymobConfig,
    readBody: async () => body, useRuntimeConfig: () => ({ ...runtime, paymobEnabled: enabled }),
    requireCustomerRequest: async () => ({ authUser: { id: user, email: 'fixture@example.invalid' }, supabaseAdmin: db }),
    isStoreAnalyticsUuid: value => /^[0-9a-f-]{36}$/i.test(value), recordStoreOrderCreated: async () => {}, console
  })
  return { run: () => handler({}), writes }
}
const checkoutBody = () => ({ cart_id: randomUUID(), items: [{ id: randomUUID(), quantity: 1 }], payment_method: 'card', address: { first_name: 'Buyer', phone: '01000000000', street_address: 'Street', city: 'Cairo', governorate: 'Cairo' } })

test('Nuxt defaults stay private/disabled and private environment canaries cannot enter public config', () => {
  let config
  const source = read('nuxt.config.ts').replace(/import[^\n]+\n/g, '').replace('export default defineNuxtConfig', 'captureConfig')
  runInNewContext(source, { captureConfig: value => { config = value }, tailwindcss: () => ({}), DEFAULT_SITE_URL: 'https://fixture.example.invalid', process: { env: { NUXT_PAYMOB_SECRET_KEY: 'PRIVATE_PAYMOB_CANARY', NUXT_PAYMOB_HMAC_SECRET: 'PRIVATE_HMAC_CANARY', NUXT_SUPABASE_SERVICE_ROLE_KEY: 'PRIVATE_SERVICE_CANARY' } } })
  assert.equal(config.runtimeConfig.paymobEnabled, false)
  assert.equal(config.runtimeConfig.paymobMode, 'test')
  assert.equal(config.sourcemap, false); assert.equal(config.vite.build.sourcemap, false)
  assert.equal(JSON.stringify(config.runtimeConfig.public).includes('PRIVATE'), false)
  assert.equal(Object.keys(config.runtimeConfig.public).some(key => /paymob|secret|hmac|serviceRole/i.test(key)), false)
})

test('disabled gateway rejects every normalized card spelling before order/stock writes, preserving cart retries', async () => {
  for (const payment_method of ['card', 'CARD', ' Card ']) {
    const fixture = checkoutHarness({ ...checkoutBody(), payment_method })
    await assert.rejects(fixture.run, error => error.statusCode === 400 && /not available/.test(error.statusMessage))
    assert.equal(fixture.writes.length, 0)
  }
  const saved = { id: randomUUID(), order_number: 'EXISTING', payment_method: 'card', total_amount: 100 }
  const retry = checkoutHarness(checkoutBody(), false, saved)
  assert.equal((await retry.run()).order.id, saved.id)
  assert.equal(retry.writes.length, 0)
})

test('checkout forwards no client financial/currency fields and rejects forged item prices', async () => {
  const body = { ...checkoutBody(), price: 1, subtotal_amount: 1, discount_amount: 1000, payment_fee_amount: 0, shipping_amount: 0, tax_amount: 0, total_amount: 1, currency: 'USD', amount_paid: 1000 }
  const fixture = checkoutHarness(body, true)
  await fixture.run()
  const args = fixture.writes[0].args
  for (const key of ['price','subtotal_amount','discount_amount','payment_fee_amount','shipping_amount','tax_amount','total_amount','currency','amount_paid']) assert.equal(Object.hasOwn(args.p_order, key), false, key)
  assert.deepEqual(Object.keys(args.p_items[0]).sort(), ['product_id','quantity','variant_id'])
  for (const key of ['price','unit_price','line_total','total_amount']) {
    const forged = checkoutHarness({ ...body, items: [{ ...body.items[0], [key]: 1 }] }, true)
    await assert.rejects(forged.run, error => error.statusCode === 400 && /financial/.test(error.statusMessage))
    assert.equal(forged.writes.length, 0)
  }
})

test('callback reader rejects oversized declared/chunked and stalled bodies before their upload finishes', async () => {
  const app = createApp()
  let parsed = 0
  app.use('/callback', paymentHandler(async event => {
    const raw = await readPaymentCallbackBody(event, 64, 40)
    parsed++
    return { bytes: Buffer.byteLength(raw) }
  }))
  const server = createServer(toNodeListener(app))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const send = (headers, bytes, end = false) => new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port: server.address().port, path: '/callback', method: 'POST', headers }, res => {
      let body = ''; res.on('data', chunk => { body += chunk }); res.on('end', () => { req.destroy(); resolve({ status: res.statusCode, body }) })
    })
    req.on('error', reject)
    req.write(bytes)
    if (end) req.end()
  })
  try {
    assert.equal((await send({ 'Content-Length': '1000000' }, 'x')).status, 413)
    assert.equal((await send({ 'Transfer-Encoding': 'chunked' }, 'é'.repeat(33))).status, 413)
    assert.equal((await send({ 'Transfer-Encoding': 'chunked' }, 'x')).status, 408)
    assert.equal(parsed, 0)
    const accepted = await send({ 'Content-Length': '64' }, 'x'.repeat(64), true)
    assert.equal(accepted.status, 200); assert.equal(JSON.parse(accepted.body).bytes, 64)
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
})

test('native provider fetch timeout also covers a stalled JSON body after response headers', async () => {
  let calls = 0
  const server = createServer((_req, res) => { calls++; res.writeHead(201, { 'Content-Type': 'application/json' }); res.flushHeaders(); res.write('{') })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    await assert.rejects(() => createPaymobIntention(getPaymobConfig(runtime), {}, (_url, options) => fetch(`http://127.0.0.1:${server.address().port}`, options), 40), /intention_uncertain/)
    assert.equal(calls, 1)
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
})

const resultHarness = ({ query = { order_id: randomUUID(), success: 'true' }, statuses = ['pending'], fetcher } = {}) => {
  const mounted = [], unmount = [], timers = new Map(), requests = []
  let nextTimer = 0, meta
  const route = { path: '/checkout/payment-result', fullPath: '/checkout/payment-result?' + new URLSearchParams(query), query }
  const script = read('app/pages/checkout/payment-result.vue').split('<script setup>')[1].split('</script>')[0]
  const output = runInNewContext(script + '\n;({ state, mode, orderId })', {
    definePageMeta: value => { meta = value }, useRoute: () => route,
    useRouter: () => ({ replace: async value => { route.query = value.query } }),
    useSupabaseClient: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'fixture' } } }) } }),
    useI18n: () => ({ t: key => key }), ref, computed, useHead() {},
    onMounted: fn => mounted.push(fn), onBeforeUnmount: fn => unmount.push(fn),
    setTimeout: (fn, delay) => { const id = ++nextTimer; timers.set(id, { fn, delay }); return id }, clearTimeout: id => timers.delete(id),
    $fetch: async (url, options) => { requests.push({ url, options }); return fetcher ? fetcher() : { status: statuses[Math.min(requests.length - 1, statuses.length - 1)], mode: 'test', orderId: query.order_id } }
  })
  return { ...output, requests, timers, route, meta, mount: () => mounted[0](), unmount: () => unmount.forEach(fn => fn()),
    tick: async () => { const [id, timer] = timers.entries().next().value; timers.delete(id); await timer.fn() } }
}

test('result page ignores redirect proof, polls at most ten times at three seconds and cleans up', async () => {
  const fixture = resultHarness()
  await fixture.mount()
  assert.equal(fixture.state.value, 'pending')
  assert.deepEqual(Object.keys(fixture.route.query), ['order_id'])
  while (fixture.timers.size) {
    assert.equal([...fixture.timers.values()][0].delay, 3000)
    await fixture.tick()
  }
  assert.equal(fixture.requests.length, 10); assert.equal(fixture.state.value, 'unable')
  assert.equal(fixture.requests[0].options.timeout, 10000)
  assert.equal(Object.hasOwn(fixture.requests[0].options.query, 'success'), false)
  const active = resultHarness(); await active.mount(); active.unmount(); assert.equal(active.timers.size, 0)
  const terminal = resultHarness({ statuses: ['test_succeeded'] }); await terminal.mount(); assert.equal(terminal.timers.size, 0)
  assert.equal(terminal.state.value, 'test_succeeded')
})

test('query navigation keys a new result page; stale in-flight responses cannot restart disposed polling', async () => {
  let release
  const fixture = resultHarness({ fetcher: () => new Promise(resolve => { release = resolve }) })
  const loading = fixture.mount()
  while (!release) await Promise.resolve()
  fixture.unmount()
  release({ status: 'paid', mode: 'live', orderId: 'old-order' })
  await loading
  assert.equal(fixture.state.value, 'processing'); assert.equal(fixture.orderId.value, ''); assert.equal(fixture.timers.size, 0)
  assert.notEqual(fixture.meta.key({ fullPath: '/checkout/payment-result?order_id=A' }), fixture.meta.key({ fullPath: '/checkout/payment-result?order_id=B' }))
})

test('Pixel timeout permits a fresh SDK load and forwards only approved config and payload-free events', async () => {
  const elements = [], timers = new Map(), options = [], events = []
  let nextTimer = 0
  class Element extends EventTarget {
    dataset = {}
    remove() { elements.splice(elements.indexOf(this), 1) }
  }
  const document = {
    querySelector: selector => elements.find(element => selector === 'script[data-paymob-sdk]' ? element.dataset.paymobSdk : element.href && selector.includes(element.href)),
    createElement: () => new Element(), head: { appendChild: element => elements.push(element) }
  }
  const window = {}
  const mount = () => {
    let mounted, unmount
    const source = read('app/components/payment/PaymobPixel.vue').split('<script setup>')[1].split('</script>')[0].replace(/import[^\n]+\n/, '')
    runInNewContext(source, {
      defineProps: () => ({ session: { publicKey: 'egy_pk_test_fixture', clientSecret: 'egy_csk_test_fixture', secretKey: 'PRIVATE_CANARY', hmacSecret: 'PRIVATE_HMAC_CANARY' } }),
      defineEmits: () => (...args) => events.push(args), useI18n: () => ({ locale: ref('en') }), useColorMode: () => ref('light'), useId: () => 'fixture',
      paymobPixelOptions, ref, window, document,
      onMounted: fn => { mounted = fn }, onBeforeUnmount: fn => { unmount = fn },
      setTimeout: fn => { const id = ++nextTimer; timers.set(id, fn); return id }, clearTimeout: id => timers.delete(id)
    })
    return { run: () => mounted(), unmount: () => unmount() }
  }
  const first = mount(), loading = first.run()
  assert.equal(elements.filter(element => element.src).length, 1)
  const timeout = [...timers.values()][0]; timeout(); await loading
  assert.equal(elements.filter(element => element.src).length, 0)
  first.unmount()
  const second = mount(), retry = second.run()
  const script = elements.find(element => element.src)
  assert.match(script.src, /paymob-pixel@1\.2\.8\/main\.js$/)
  window.Pixel = class { constructor(value) { options.push(value) } }
  script.dispatchEvent(new Event('load')); await retry
  assert.equal(timers.size, 0); assert.equal(options.length, 1)
  assert.equal(JSON.stringify(options).includes('PRIVATE'), false)
  options[0].afterPaymentComplete({ card_number: 'RAW_CARD_CANARY', cvv: 'RAW_CVV_CANARY' })
  assert.deepEqual(events, [['complete']])
  second.unmount(); options[0].afterPaymentComplete({ status: 'paid' }); assert.equal(events.length, 1)
})
