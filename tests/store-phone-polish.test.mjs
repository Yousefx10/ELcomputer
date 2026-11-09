import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { sendOrderSmsNow } from '../server/utils/sms/instant.js'

const runtime = { smsTransactionalEnabled: true, public: { siteUrl: 'https://store.example.invalid' } }
const stub = (over = {}) => {
  const calls = []
  return { calls, rpc: async name => { calls.push(name); if (over[name]) return over[name](); return { data: name === 'sms_channel_state' ? { transactionalEnabled: true } : null, error: null } } }
}

test('an order SMS goes out straight away through the normal capture and send steps', async () => {
  const db = stub()
  await sendOrderSmsNow(db, runtime)
  assert.deepEqual(db.calls, ['sms_channel_state', 'sms_capture_transactional', 'sms_claim_transactional', 'sms_claim_for_channels'])
})
test('nothing runs when SMS is off on the server or in the Dashboard', async () => {
  const off = stub(); await sendOrderSmsNow(off, { ...runtime, smsTransactionalEnabled: false }); assert.deepEqual(off.calls, [])
  const closed = stub({ sms_channel_state: () => ({ data: { transactionalEnabled: false }, error: null }) }); await sendOrderSmsNow(closed, runtime); assert.deepEqual(closed.calls, ['sms_channel_state'])
})
test('orders placed together share one run and one follow-up', async () => {
  let release, entered
  const gate = new Promise(r => { release = r }), started = new Promise(r => { entered = r })
  let runs = 0
  const db = stub({ sms_channel_state: async () => { runs++; if (runs === 1) { entered(); await gate } return { data: { transactionalEnabled: true }, error: null } } })
  const first = sendOrderSmsNow(db, runtime)
  await started
  await sendOrderSmsNow(db, runtime); await sendOrderSmsNow(db, runtime)
  release(); await first
  assert.equal(runs, 2)
})
test('a failed send never reaches the customer order', async () => {
  const db = stub({ sms_capture_transactional: () => { throw Error('Provider down') } })
  const original = console.error; console.error = () => {}
  try { await assert.doesNotReject(sendOrderSmsNow(db, runtime)) } finally { console.error = original }
})
test('cash orders and confirmed payments trigger the instant send', async () => {
  const checkout = await readFile('server/api/checkout/index.post.js', 'utf8')
  assert.match(checkout, /if \(orderRecord\.payment_method === 'cash'\) void sendOrderSmsNow\(supabaseAdmin, runtime\)/)
  assert.ok(checkout.indexOf('if (wasCreated) {\n    try {\n      await recordStoreOrderCreated') < checkout.indexOf('void sendOrderSmsNow'), 'Only a newly created order sends')
  const webhook = await readFile('server/api/payments/paymob/webhook.post.js', 'utf8')
  assert.ok(webhook.indexOf("if (result.error) throw") < webhook.indexOf('void sendOrderSmsNow'), 'A rejected callback sends nothing')
})
test('phone layouts keep related facts together', async () => {
  const product = await readFile('app/components/product/Modern.vue', 'utf8'), css = await readFile('app/assets/css/product-modern.css', 'utf8')
  assert.ok(product.indexOf('pm-single-option') > product.indexOf('pm-price-row') && product.indexOf('pm-single-option') < product.indexOf('pm-stock'), 'The option sits on the price line')
  const assurance = product.slice(product.indexOf('class="pm-assurance"'), product.indexOf('ProductBuyWithIt'))
  assert.match(assurance, /mode="share"/, 'Share joins warranty and help')
  assert.match(css, /\.pm-buy \{ flex-wrap: nowrap;/, 'Quantity, Add to Cart and favourite share one row')
  const search = await readFile('app/pages/search.vue', 'utf8'), mobile = await readFile('app/assets/css/mobile.css', 'utf8')
  assert.match(search, /store-listing-sort-chevron/); assert.match(mobile, /-webkit-appearance: none; appearance: none;/)
})
test('the order summary has no floating badge and a failed price check offers a way out', async () => {
  const checkout = await readFile('app/components/checkout/Modern.vue', 'utf8'), css = await readFile('app/assets/css/modern-checkout.css', 'utf8')
  assert.doesNotMatch(checkout, /cm-qty/); assert.doesNotMatch(css, /cm-qty/)
  assert.match(checkout, /lineMeta\(item\)/); assert.match(checkout, /cm-summary-alert/)
  for (const locale of ['en', 'ar']) assert.ok(JSON.parse(await readFile(`i18n/locales/${locale}.json`, 'utf8')).checkoutModern.quantity.includes('{value0}'))
})
test('payment logos share a row on phones and the unavailable newsletter card is hidden there', async () => {
  const css = await readFile('app/assets/css/modern-footer.css', 'utf8')
  assert.match(css, /repeat\(auto-fill, minmax\(50px, 1fr\)\)/); assert.doesNotMatch(css, /repeat\(2, minmax\(64px, 96px\)\)/)
  assert.match(css, /\.store-footer-modern-newsletter \{ display: none; \}/)
})
