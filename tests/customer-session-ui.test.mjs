import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { build } from 'esbuild'
import { parse, compileScript } from '@vue/compiler-sfc'

test('customer session isolation in real browser components', { skip: !process.env.PDC_REVIEW_PLAYWRIGHT }, async t => {
  const { chromium } = await import(process.env.PDC_REVIEW_PLAYWRIGHT)
  const messages = Object.fromEntries(await Promise.all(['en', 'ar'].map(async locale => [locale, JSON.parse(await readFile('i18n/locales/' + locale + '.json', 'utf8'))])))
  const bundles = {}
  for (const [name, file] of Object.entries({ checkout: 'app/pages/checkout/index.vue', payment: 'app/pages/checkout/payment/[id].vue',
    result: 'app/pages/checkout/payment-result.vue', summary: 'app/pages/checkout/summary/[id].vue', profile: 'app/pages/account/profile.vue',
    order: 'app/pages/account/orders/[id].vue', wallet: 'app/pages/account/wallet.vue', messages: 'app/pages/account/messages.vue' })) {
    const component = compileScript(parse(await readFile(file, 'utf8')).descriptor, { id: 'session-' + name, inlineTemplate: true }).content
    const result = await build({ entryPoints: [resolve('tests/helpers/normalPurchaseBrowser.js')], bundle: true, write: false, platform: 'browser', format: 'iife', alias: { '~': resolve('app') },
      define: { 'import.meta.client': 'true', 'process.env.NODE_ENV': '"test"', __VUE_OPTIONS_API__: 'true', __VUE_PROD_DEVTOOLS__: 'false', __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false' },
      plugins: [{ name: 'actual-session-page', setup(b) {
        b.onResolve({ filter: /^normal-purchase-page$/ }, () => ({ path: name, namespace: 'session-page' }))
        b.onLoad({ filter: /.*/, namespace: 'session-page' }, () => ({ contents: component, resolveDir: resolve('.'), loader: 'js' }))
      } }] })
    bundles[name] = result.outputFiles[0].text
  }
  const base = (locale = 'en') => {
    const actorId = randomUUID(), otherId = randomUUID(), orderId = randomUUID(), productId = randomUUID(), variantId = randomUUID()
    const profile = { full_name: 'ALICE_PRIVATE', phone: '01012345678', email: 'alice@example.invalid', address_line_1: 'ALICE_PRIVATE_STREET', address_line_2: 'ALICE_PRIVATE_FLOOR', city: 'Fixture city', state: 'Cairo', wallet_balance: 123.45 }
    const other = { ...profile, full_name: 'BOB_PRIVATE', address_line_1: 'BOB_PRIVATE_STREET', address_line_2: '', wallet_balance: 678.90 }
    return { locale, messages: messages[locale], actorId, allowedId: actorId, otherId, orderId, productId, variantId, companyId: randomUUID(), quoteId: randomUUID(),
      expiresAt: new Date(Date.now() + 600000).toISOString(), siteUrl: 'https://orchid.example.invalid', profile, profiles: { [actorId]: profile, [otherId]: other },
      ordersByActor: { [actorId]: [{ id: orderId, order_number: 'ALICE_PRIVATE_ORDER', user_id: actorId, first_name: 'ALICE_PRIVATE', street_address: profile.address_line_1,
        status: 'processing', payment_status: 'paid', payment_method: 'card', total_amount: 123.45, currency: 'EGP', created_at: '2026-01-01T00:00:00Z' }], [otherId]: [] },
      messagesByActor: { [actorId]: [{ id: randomUUID(), message: 'ALICE_PRIVATE_MESSAGE', body: 'ALICE_PRIVATE_MESSAGE', sender_type: 'admin', created_at: '2026-01-01T00:00:00Z' }], [otherId]: [] },
      cart: { id: randomUUID(), revision: randomUUID(), coupon: null, items: [{ id: productId, variant_id: variantId, title: 'ALICE_PRIVATE_CART', quantity: 1, price: 100, stock_quantity: 3 }] } }
  }
  let scenario, kind, browser
  const server = createServer((req, res) => {
    res.setHeader('content-type', req.url === '/fixture.js' ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8')
    res.end(req.url === '/fixture.js' ? bundles[kind] : '<!doctype html><html lang="' + scenario.locale + '" dir="' + (scenario.locale === 'ar' ? 'rtl' : 'ltr') + '"><body><div id="app"></div><script>window.__fixture=' + JSON.stringify(scenario) + '</script><script src="/fixture.js"></script></body></html>')
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  const origin = 'http://127.0.0.1:' + server.address().port
  const open = async () => {
    const page = await browser.newPage({ viewport: { width: scenario.locale === 'ar' ? 390 : 1280, height: 1000 } })
    const errors = []; page.on('pageerror', cause => errors.push(cause.message)); page.setDefaultTimeout(6000)
    await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort())
    await page.goto(origin)
    return { page, errors }
  }
  try {
    browser = await chromium.launch({ headless: true, channel: 'chrome' })
    await t.test('checkout switching hides addresses/cart and restores only the original customer recovery', async () => {
      for (const locale of ['en', 'ar']) {
        scenario = { ...base(locale), loseOrderAck: true }; kind = 'checkout'
        const { page, errors } = await open()
        await page.locator('input[autocomplete=address-line1]').waitFor()
        await page.locator('select').nth(1).selectOption(scenario.companyId)
        await page.getByRole('button', { name: messages[locale].common.continueToPayment, exact: true }).click().catch(async cause => {
          cause.message += JSON.stringify(await page.evaluate(() => ({ buttons: [...document.querySelectorAll('button')].map(button => button.textContent), errors: [...document.querySelectorAll('[role=alert]')].map(node => node.textContent), fixtureLocale: window.__fixture.locale })))
          throw cause
        })
        await page.getByRole('button', { name: messages[locale].common.confirmCheckout, exact: true }).click()
        await page.getByRole('button', { name: messages[locale].checkoutRecovery.recover, exact: true }).waitFor()
        const original = await page.evaluate(() => localStorage.getItem('elcomputer-checkout-pending-' + window.__fixture.actorId))
        await page.evaluate(id => window.__switchAccount(id, true), scenario.otherId)
        await page.waitForFunction(() => !document.querySelector('#app').textContent.includes('ALICE_PRIVATE'))
        assert.deepEqual(await page.evaluate(() => window.__cartMemory().items), [])
        assert.equal(await page.getByRole('button', { name: messages[locale].checkoutRecovery.recover, exact: true }).count(), 0)
        assert.equal(await page.evaluate(id => localStorage.getItem('elcomputer-checkout-pending-' + id), scenario.actorId), original)
        await page.evaluate(id => window.__switchAccount(id), scenario.actorId)
        await page.getByRole('button', { name: messages[locale].checkoutRecovery.recover, exact: true }).waitFor()
        await page.getByRole('button', { name: messages[locale].checkoutRecovery.recover, exact: true }).click()
        await page.waitForFunction(() => window.__navigations.length === 1)
        const posts = await page.evaluate(() => window.__requests.filter(item => item.path === '/api/checkout'))
        assert.equal(posts.length, 2); assert.deepEqual(posts[0].body, posts[1].body)
        assert.deepEqual(errors, []); await page.close()
      }
    })
    await t.test('late payment initialization cannot display another customer secure session', async () => {
      scenario = { ...base(), holdPaths: ['/api/payments/intentions'] }; kind = 'payment'
      const { page, errors } = await open()
      await page.getByRole('button', { name: messages.en.paymob.openSecure, exact: true }).click()
      await page.waitForFunction(() => window.__requests.some(item => item.path === '/api/payments/intentions'))
      await page.evaluate(id => window.__switchAccount(id, true), scenario.otherId)
      await page.evaluate(() => window.__release('/api/payments/intentions'))
      await page.waitForTimeout(70)
      assert.equal(await page.locator('[data-fixture-pixel]').count(), 0)
      assert.deepEqual(await page.evaluate(() => window.__navigations), [])
      assert.deepEqual(errors, []); await page.close()
    })
    await t.test('late quotes and coupons cannot replace the next customer cart or coupon', async () => {
      for (const path of ['/api/checkout/quote', '/api/checkout/coupon']) {
        scenario = { ...base(), holdPaths: [path] }; kind = 'checkout'
        const { page, errors } = await open()
        await page.locator('input[autocomplete=address-line1]').waitFor()
        if (path.endsWith('quote')) {
          await page.locator('select').nth(1).selectOption(scenario.companyId)
          await page.getByRole('button', { name: messages.en.common.continueToPayment, exact: true }).click()
        } else {
          await page.getByPlaceholder(messages.en.common.couponCode, { exact: true }).fill('ALICE_PRIVATE_COUPON')
          await page.getByRole('button', { name: messages.en.common.apply, exact: true }).click()
        }
        await page.waitForFunction(path => window.__requests.some(item => item.path === path), path)
        await page.evaluate(() => {
          const f = window.__fixture
          localStorage.setItem(window.__cartKey(f.otherId), JSON.stringify({ ...f.cart, version: 3, owner: 'account:' + f.otherId,
            coupon: { code: 'BOB_PRIVATE_COUPON' }, items: [{ ...f.cart.items[0], title: 'BOB_PRIVATE_CART' }] }))
          window.__switchAccount(f.otherId, true)
        })
        await page.waitForFunction(() => document.querySelector('input[autocomplete=address-line1]')?.value === 'BOB_PRIVATE_STREET')
        await page.evaluate(path => window.__release(path), path)
        await page.waitForTimeout(50)
        assert.equal(await page.evaluate(() => window.__cartMemory().coupon.code), 'BOB_PRIVATE_COUPON')
        assert.equal(await page.locator('#app').textContent().then(text => text.includes('ALICE_PRIVATE')), false)
        assert.deepEqual(errors, []); await page.close()
      }
    })
    await t.test('account changes during order submission preserve the original recovery command', async () => {
      scenario = { ...base(), holdPaths: ['/api/checkout'] }; kind = 'checkout'
      const { page, errors } = await open()
      await page.locator('select').nth(1).selectOption(scenario.companyId)
      await page.getByRole('button', { name: messages.en.common.continueToPayment, exact: true }).click()
      await page.getByRole('button', { name: messages.en.common.confirmCheckout, exact: true }).click()
      await page.waitForFunction(() => window.__requests.some(item => item.path === '/api/checkout'))
      await page.evaluate(id => window.__switchAccount(id, true), scenario.otherId)
      await page.evaluate(() => window.__release('/api/checkout'))
      await page.waitForTimeout(60)
      assert.deepEqual(await page.evaluate(() => window.__navigations), [])
      assert.ok(await page.evaluate(id => localStorage.getItem('elcomputer-checkout-pending-' + id), scenario.actorId))
      await page.evaluate(id => window.__switchAccount(id), scenario.actorId)
      await page.getByRole('button', { name: messages.en.checkoutRecovery.recover, exact: true }).click()
      await page.waitForFunction(() => window.__navigations.length === 1)
      const posts = await page.evaluate(() => window.__requests.filter(item => item.path === '/api/checkout'))
      assert.deepEqual(posts[0].body, posts[1].body)
      assert.deepEqual(errors, []); await page.close()
    })
    await t.test('two browser tabs follow auth changes without sharing anonymous or previous customer baskets', async () => {
      scenario = base(); kind = 'checkout'
      const context = await browser.newContext()
      await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort())
      const one = await context.newPage(), two = await context.newPage()
      await one.goto(origin); await two.goto(origin)
      await two.locator('input[autocomplete=address-line1]').waitFor()
      await one.evaluate(id => window.__switchAccountAcrossTabs(id), scenario.otherId)
      for (const page of [one, two]) await page.waitForFunction(() => window.__cartMemory().owner === 'account:' + window.__fixture.otherId && window.__cartMemory().items.length === 0)
      await two.evaluate(() => window.__switchAccountAcrossTabs(null))
      for (const page of [one, two]) await page.waitForFunction(() => window.__cartMemory().owner.startsWith('guest:'))
      const owners = await Promise.all([one, two].map(page => page.evaluate(() => window.__cartMemory().owner)))
      assert.notEqual(owners[0], owners[1])
      await one.evaluate(() => window.__addCartItem({ id: crypto.randomUUID(), title: 'Anonymous tab one', price: 2, stock_quantity: 1 }))
      assert.equal(await two.evaluate(() => window.__cartMemory().items.length), 0)
      await context.close()
    })
    await t.test('My Account, order summaries and messages clear before the next customer response', async () => {
      for (const view of ['profile', 'order', 'summary', 'messages', 'wallet']) {
        scenario = base(); kind = view
        const { page, errors } = await open()
        if (view === 'profile') await page.waitForFunction(() => document.querySelector('input[autocomplete=address-line1]')?.value === 'ALICE_PRIVATE_STREET')
        else if (view === 'wallet') await page.getByText(/123\.45/).waitFor()
        else await page.getByText(view === 'messages' ? 'ALICE_PRIVATE_MESSAGE' : 'ALICE_PRIVATE_ORDER', { exact: true }).first().waitFor()
        await page.evaluate(() => { window.__holdPath('customer_orders'); window.__holdPath('profile:' + window.__fixture.otherId); window.__holdPath('/api/account/messages') })
        await page.evaluate(id => window.__switchAccount(id, true), scenario.otherId)
        await page.waitForFunction(() => !document.querySelector('#app').textContent.includes('ALICE_PRIVATE') && !document.querySelector('#app').textContent.includes('123.45')
          && ![...document.querySelectorAll('input')].some(input => input.value.includes('ALICE_PRIVATE')))
        await page.evaluate(() => { window.__release('customer_orders'); window.__release('profile:' + window.__fixture.otherId); window.__release('/api/account/messages') })
        await page.waitForTimeout(70)
        assert.equal(await page.locator('#app').textContent().then(text => text.includes('ALICE_PRIVATE')), false)
        if (view === 'summary') {
          const keys = await page.evaluate(() => window.__asyncKeys)
          assert.equal(keys.length, 2); assert.notEqual(keys[0], keys[1])
        }
        assert.deepEqual(errors, []); await page.close()
      }
    })
    await t.test('late profile responses and sign-out cannot restore a former customer address', async () => {
      scenario = base(); scenario.holdPaths = ['profile:' + scenario.actorId]; kind = 'profile'
      const { page, errors } = await open()
      await page.locator('input[autocomplete=address-line1]').waitFor()
      await page.evaluate(id => window.__switchAccount(id, true), scenario.otherId)
      await page.waitForFunction(() => document.querySelector('input[autocomplete=address-line1]')?.value === 'BOB_PRIVATE_STREET')
      await page.evaluate(id => window.__release('profile:' + id), scenario.actorId)
      await page.waitForTimeout(50)
      assert.equal(await page.locator('input[autocomplete=address-line1]').inputValue(), 'BOB_PRIVATE_STREET')
      await page.evaluate(() => window.__switchAccount(null, true))
      await page.waitForFunction(() => ![...document.querySelectorAll('input')].some(input => input.value.includes('PRIVATE')))
      assert.deepEqual(errors, []); await page.close()
    })
  } finally { await browser?.close(); await new Promise(done => server.close(done)) }
})
