import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { build } from 'esbuild'
import { parse, compileScript } from '@vue/compiler-sfc'

test('real customer payment pages show truthful EN/AR outcomes without provider traffic', { skip: !process.env.PDC_REVIEW_PLAYWRIGHT }, async t => {
  const { chromium } = await import(process.env.PDC_REVIEW_PLAYWRIGHT)
  const messages = Object.fromEntries(await Promise.all(['en','ar'].map(async locale => [locale, JSON.parse(await readFile(`i18n/locales/${locale}.json`, 'utf8'))])))
  const files = { payment: 'app/pages/checkout/payment/[id].vue', result: 'app/pages/checkout/payment-result.vue', status: 'app/components/payment/OrderStatus.vue' }
  const components = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([name,file]) => [name, compileScript(parse(await readFile(file,'utf8')).descriptor, { id: 'customer-'+name, inlineTemplate: true }).content])))
  const helper = await readFile('tests/helpers/normalPurchaseBrowser.js','utf8')
  const bundles = {}
  for (const name of ['payment','result','status']) {
    const built = await build({ entryPoints: [resolve('tests/helpers/normalPurchaseBrowser.js')], bundle: true, write: false, format: 'iife', platform: 'browser',
      alias: { '~': resolve('app') }, define: { 'import.meta.client': 'true', 'process.env.NODE_ENV': '"test"', __VUE_OPTIONS_API__: 'true', __VUE_PROD_DEVTOOLS__: 'false', __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false' },
      plugins: [{ name: 'actual-payment-components', setup(b) {
        b.onResolve({ filter: /^normal-purchase-page$/ }, () => ({ path: name, namespace: 'customer-page' }))
        b.onResolve({ filter: /^customer-status-component$/ }, () => ({ path: 'status', namespace: 'customer-page' }))
        b.onLoad({ filter: /.*/, namespace: 'customer-page' }, args => ({ contents: components[args.path], resolveDir: resolve('.'), loader: 'js' }))
        b.onLoad({ filter: /normalPurchaseBrowser\.js$/ }, () => ({ contents: "import PaymentOrderStatus from 'customer-status-component'\n" + helper.replace("app.component('Icon'", "app.component('PaymentOrderStatus', PaymentOrderStatus)\napp.component('Icon'"), resolveDir: resolve('tests/helpers'), loader: 'js' }))
      } }] })
    bundles[name] = built.outputFiles[0].text
  }
  const base = locale => { const owner = randomUUID(); return { locale, messages: messages[locale], actorId: owner, allowedId: owner, orderId: randomUUID(), publicAccess: true,
    siteUrl: locale === 'ar' ? 'https://cedar.example.invalid' : 'https://orchid.example.invalid', profile: {}, expiresAt: new Date(Date.now()+600000).toISOString() } }
  let scenario, kind, browser
  const server = createServer((req,res) => {
    res.setHeader('content-type', req.url === '/fixture.js' ? 'text/javascript' : 'text/html; charset=utf-8')
    res.end(req.url === '/fixture.js' ? bundles[kind] : `<!doctype html><html lang="${scenario.locale}" dir="${scenario.locale === 'ar' ? 'rtl' : 'ltr'}"><div id="app"></div><script>window.__fixture=${JSON.stringify(scenario)}</script><script src="/fixture.js"></script></html>`)
  })
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  const open = async () => {
    const page = await browser.newPage({ viewport: { width: scenario.locale === 'ar' ? 390 : 1100, height: 900 } })
    page.setDefaultTimeout(7000)
    const errors = []; page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort())
    await page.goto(origin)
    return { page, errors }
  }
  const finish = async ({ page, errors }) => { assert.deepEqual(errors, []); await page.close() }
  try {
    browser = await chromium.launch({ headless: true, channel: 'chrome' })
    await t.test('order placed, abandoned, cancelled and failed remain distinct in both languages', async () => {
      for (const locale of ['en','ar']) for (const status of ['awaiting_payment','pending','provider_uncertain','failed']) {
        scenario = { ...base(locale), paymentStatus: { status, verified: false, recovery: 'review', orderStatus: status === 'provider_uncertain' ? 'cancelled' : 'pending_payment' } }; kind = 'result'
        const view = await open()
        await view.page.getByRole('heading', { name: messages[locale].paymentStatus.title[status], exact: true }).waitFor()
        assert.equal(await view.page.getByRole('heading', { name: messages[locale].paymentStatus.title.paid, exact: true }).count(), 0)
        if (status === 'provider_uncertain') await view.page.getByText(messages[locale].paymentStatus.orderCancelled, { exact: true }).waitFor()
        assert.equal(await view.page.evaluate(() => window.__requests.filter(x => x.method === 'POST').length), 0)
        await finish(view)
      }
    })
    await t.test('unverified Paid cannot render confirmation; real verified success can', async () => {
      for (const verified of [false, true]) {
        scenario = { ...base('en'), paymentStatus: { status: 'paid', verified, recovery: 'none' } }; kind = 'result'
        const view = await open()
        await view.page.getByRole('heading', { name: messages.en.paymentStatus.title[verified ? 'paid' : 'provider_uncertain'], exact: true }).waitFor()
        await finish(view)
      }
    })
    await t.test('late verified callback updates the waiting return page', async () => {
      scenario = { ...base('en'), paymentStatus: { status: 'provider_uncertain', verified: false } }; kind = 'result'
      const view = await open()
      await view.page.getByRole('heading', { name: messages.en.paymentStatus.title.provider_uncertain, exact: true }).waitFor()
      await view.page.evaluate(() => { window.__fixture.paymentStatus = { status: 'paid', verified: true } })
      await view.page.getByRole('heading', { name: messages.en.paymentStatus.title.paid, exact: true }).waitFor()
      await finish(view)
    })
    await t.test('uncertain existing order and unavailable provider never expose a Pay Again action', async () => {
      for (const change of [{ paymentStatus: { status: 'provider_uncertain', recovery: 'review' } }, { statusUnavailable: true }]) {
        scenario = { ...base('en'), ...change }; kind = 'payment'
        const view = await open()
        await view.page.getByText(messages.en.paymentStatus.title[change.statusUnavailable ? 'unable' : 'provider_uncertain'], { exact: true }).waitFor()
        assert.equal(await view.page.getByRole('button', { name: messages.en.paymob.openSecure, exact: true }).count(), 0)
        assert.equal(await view.page.evaluate(() => window.__requests.filter(x => x.method === 'POST').length), 0)
        await finish(view)
      }
    })
    await t.test('double-click initializes once, lost acknowledgement holds recovery', async () => {
      scenario = { ...base('en'), loseIntention: true }; kind = 'payment'
      const view = await open()
      const button = view.page.getByRole('button', { name: messages.en.paymob.openSecure, exact: true })
      await button.waitFor(); await button.evaluate(button => { button.click(); button.click() })
      await view.page.getByText(messages.en.paymentStatus.title.provider_uncertain, { exact: true }).waitFor()
      assert.equal(await view.page.evaluate(() => window.__requests.filter(x => x.path === '/api/payments/intentions').length), 1)
      assert.equal(await button.count(), 0)
      await finish(view)
    })
    await t.test('My Account card consumes verified projection instead of raw Paid', async () => {
      for (const locale of ['en','ar']) {
        scenario = { ...base(locale), pageProps: { order: { id: randomUUID(), payment_status: 'paid', customer_payment: { status: 'provider_uncertain', verified: false, recovery: 'review' } } } }; kind = 'status'
        const view = await open()
        await view.page.getByText(messages[locale].paymentStatus.title.provider_uncertain, { exact: true }).waitFor()
        assert.equal(await view.page.getByText(messages[locale].paymentStatus.title.paid, { exact: true }).count(), 0)
        await finish(view)
      }
    })
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)) }
})
