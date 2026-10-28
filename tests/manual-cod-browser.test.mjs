import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { createServer } from 'node:http'
import { build } from 'esbuild'
import { parse, compileScript } from '@vue/compiler-sfc'

test('actual COD checkout and saved confirmation in EN/AR desktop/mobile', async t => {
  assert.ok(process.env.COD_REVIEW_PLAYWRIGHT, 'Set COD_REVIEW_PLAYWRIGHT for actual browser validation')
  const { chromium } = await import(process.env.COD_REVIEW_PLAYWRIGHT)
  let helper = await readFile('tests/helpers/normalPurchaseBrowser.js', 'utf8')
  helper = "import CodStatus from '../../app/components/payment/CodStatus.vue';\n" + helper
  helper = helper.replace('settings: {}', 'settings: { inventory_tracking_required: false }')
    .replace('payment_card_enabled: true, payment_card_fee: 0', 'inventory_tracking_required: false, payment_card_enabled: true, payment_card_fee: 0')
    .replace('isPreorder: false,', "isPreorder: false, stockFulfillmentState: 'untracked', fulfillmentMessage: 'Delivery timing depends on your address.',")
  helper = helper.replace('available: true, restricted: false }', "available: true, restricted: false, beta: true, paymentMethods: fixture.paymentMethods || ['card', 'cash'] }")
    .replace("name: 'Synthetic PDC', price: 10, governorates: ['Cairo']", "name: 'Synthetic manual delivery', price: 50, governorates: ['Cairo'], cashAvailable: fixture.cashAvailable !== false")
    .replace('totalAmount: 110', 'totalAmount: 150').replace('shippingFee: 10', 'shippingFee: 50')
    .replace("paymentMethod: 'card'", 'paymentMethod: options.body.payment_method')
    .replaceAll('value => value', 'value => fixture.uiKeys[value] ? translate(fixture.uiKeys[value]) : value')
    .replace("app.mount('#app')", "app.component('PaymentCodStatus',CodStatus);app.mount('#app')")
  const bundles = {}
  for (const [name, file] of [['checkout', 'app/pages/checkout/index.vue'], ['summary', 'app/pages/checkout/summary/[id].vue']]) {
    const result = await build({ entryPoints: [resolve('tests/helpers/normalPurchaseBrowser.js')], bundle: true, write: false, format: 'iife', platform: 'browser', alias: { '~': resolve('app') },
      define: { 'import.meta.client': 'true', 'process.env.NODE_ENV': '"test"', __VUE_OPTIONS_API__: 'true', __VUE_PROD_DEVTOOLS__: 'false', __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false' },
      plugins: [{ name: 'cod-browser', setup(b) {
        b.onResolve({ filter: /^normal-purchase-page$/ }, () => ({ path: resolve(file) }))
        b.onLoad({ filter: /normalPurchaseBrowser\.js$/ }, () => ({ contents: helper, resolveDir: resolve('tests/helpers'), loader: 'js' }))
        b.onLoad({ filter: /\.vue$/ }, async ({ path }) => ({ contents: compileScript(parse(await readFile(path, 'utf8'), { filename: path }).descriptor, { id: path, inlineTemplate: true }).content, resolveDir: dirname(path), loader: 'js' }))
      } }] })
    bundles[name] = result.outputFiles[0].text
  }
  const cssDirectory = resolve('.output/public/_nuxt')
  const css = (await Promise.all((await readdir(cssDirectory)).filter(x => x.endsWith('.css')).map(x => readFile(cssDirectory + '/' + x, 'utf8')))).join('\n')
  const uiKeys = JSON.parse(await readFile('app/utils/uiMessageKeys.json', 'utf8'))
  const messages = Object.fromEntries(await Promise.all(['en', 'ar'].map(async lang => [lang, JSON.parse(await readFile('i18n/locales/' + lang + '.json', 'utf8'))])))
  let scenario, kind
  const fixture = locale => {
    const actorId = randomUUID(), productId = randomUUID(), variantId = randomUUID(), orderId = randomUUID()
    const order = { id: orderId, order_number: 'SYNTHETIC-COD', user_id: actorId, status: 'pending_payment', payment_status: 'pending', payment_method: 'cash', amount_paid: 0, total_amount: 150, subtotal_amount: 100, shipping_fee_amount: 50, shipping_company_name: 'Synthetic manual delivery', created_at: new Date().toISOString(), is_preorder: false, currency: 'EGP', first_name: 'Synthetic', street_address: 'Fixture street', city: 'Fixture city', governorate: 'Cairo', phone: '01012345678', email: 'fixture@example.invalid' }
    return { locale, messages: messages[locale], uiKeys, publicAccess: true, actorId, allowedId: actorId, productId, variantId, orderId, companyId: randomUUID(), quoteId: randomUUID(), siteUrl: 'https://store.example.invalid',
      profile: { full_name: 'Synthetic Buyer', phone: '01012345678', email: 'fixture@example.invalid', address_line_1: 'Fixture street', city: 'Fixture city', state: 'Cairo' },
      ordersByActor: { [actorId]: [order] }, orderItems: [],
      cart: { version: 3, id: randomUUID(), revision: randomUUID(), coupon: null, items: [{ id: productId, variant_id: variantId, quantity: 1, price: 100, stock_quantity: 0, allow_out_of_stock_purchases: true, is_serialized: true, selling_mode: 'normal', title: 'Synthetic item' }] } }
  }
  const server = createServer((req, res) => {
    res.setHeader('content-type', req.url === '/fixture.js' ? 'text/javascript' : 'text/html; charset=utf-8')
    res.end(req.url === '/fixture.js' ? bundles[kind] : '<!doctype html><html lang="' + scenario.locale + '" dir="' + (scenario.locale === 'ar' ? 'rtl' : 'ltr') + '" class="' + (scenario.dark ? 'dark' : '') + '"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>' + css + '</style></head><body><div id="app"></div><script>window.__fixture=' + JSON.stringify(scenario) + '</script><script src="/fixture.js"></script></body></html>')
  })
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  const origin = 'http://127.0.0.1:' + server.address().port, browser = await chromium.launch({ headless: true, channel: 'chrome' })
  const open = async width => {
    const page = await browser.newPage({ viewport: { width, height: 900 } }), errors = [], blocked = []
    page.setDefaultTimeout(7000); page.on('pageerror', e => errors.push(e.message))
    await page.route('**/*', r => r.request().url().startsWith(origin) && r.request().method() === 'GET' ? r.continue() : (blocked.push(r.request().method()), r.abort()))
    await page.goto(origin)
    return { page, errors, blocked }
  }
  try {
    for (const locale of ['en', 'ar']) for (const width of [1440, 390]) for (const dark of [false, true]) {
      await t.test(`${locale} ${width} ${dark ? 'dark' : 'light'} COD selection and double confirmation`, async () => {
        scenario = { ...fixture(locale), dark }; kind = 'checkout'
        const { page, errors, blocked } = await open(width)
        try {
          await page.locator('select').nth(1).selectOption(scenario.companyId)
          await page.getByRole('button', { name: scenario.messages.common.continueToPayment, exact: true }).click()
          await page.locator('input[value=cash]').check()
          await page.getByText(scenario.messages.common.payWithCash, { exact: true }).waitFor()
          assert.equal(await page.locator('input[name=payment-method]').count(), 2)
          assert.equal(await page.locator('html').getAttribute('dir'), locale === 'ar' ? 'rtl' : 'ltr')
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
          const button = page.getByRole('button', { name: scenario.messages.common.confirmCheckout, exact: true })
          await button.evaluate(b => { b.click(); b.click() })
          await page.waitForFunction(() => window.__navigations.some(path => path.startsWith('/checkout/summary/')))
          const requests = await page.evaluate(() => window.__requests)
          const commands = requests.filter(r => r.path === '/api/checkout')
          assert.equal(commands.length, 1); assert.equal(commands[0].body.payment_method, 'cash')
          assert.equal(commands[0].body.shipping_company_id, scenario.companyId)
          assert.equal(requests.filter(r => r.path.includes('/api/payments/intentions')).length, 0)
          assert.deepEqual(errors, []); assert.deepEqual(blocked, [])
        } finally { await page.close() }
      })
      await t.test(`${locale} ${width} ${dark ? 'dark' : 'light'} saved COD confirmation remains unpaid`, async () => {
        scenario = { ...fixture(locale), dark }; kind = 'summary'
        const { page, errors, blocked } = await open(width)
        try {
          await page.getByText(scenario.messages.codCheckout.status.awaiting, { exact: true }).waitFor()
          await page.getByText(scenario.messages.common.placed, { exact: true }).waitFor()
          assert.equal(await page.getByText(scenario.messages.codCheckout.status.collected, { exact: true }).count(), 0)
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
          assert.deepEqual(errors, []); assert.deepEqual(blocked, [])
        } finally { await page.close() }
      })
    }
    await t.test('unchanged CARD-only Beta does not display COD', async () => {
      scenario = { ...fixture('en'), paymentMethods: ['card'] }; kind = 'checkout'
      const { page, errors } = await open(390)
      try {
        await page.locator('select').nth(1).selectOption(scenario.companyId)
        await page.getByRole('button', { name: scenario.messages.common.continueToPayment, exact: true }).click()
        assert.equal(await page.locator('input[value=cash]').count(), 0)
        assert.deepEqual(errors, [])
      } finally { await page.close() }
    })
  } finally { await browser.close(); await new Promise(r => server.close(r)) }
})
