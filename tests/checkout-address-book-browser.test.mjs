import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { createServer } from 'node:http'
import { build } from 'esbuild'
import { parse, compileScript } from '@vue/compiler-sfc'

const addressSelector = page => {
 const cards=page.locator('#checkout-saved-addresses')
 return { waitFor:()=>cards.waitFor(),count:()=>cards.count(),inputValue:async()=>await cards.locator('[aria-pressed=true]').count()?cards.locator('[aria-pressed=true]').getAttribute('data-address-id'):'new',textContent:()=>cards.textContent(),selectOption:async value=>{
  if(value==='new')await page.getByRole('button',{name:/^New address$|^عنوان جديد$/i}).click()
  else await cards.locator('[data-address-id="'+value+'"]').click()
 }}
}
const deliverySelector = page => ({ selectOption: value => page.locator('input[name="delivery-method"][value="'+value+'"]').check(), inputValue: async () => await page.locator('input[name="delivery-method"]:checked').count() ? page.locator('input[name="delivery-method"]:checked').inputValue() : '' })

test('actual checkout address selection, explicit saves and private drafts', async t => {
  const engine=process.env.CHECKOUT_REVIEW_ENGINE||'chromium',pw=await import(process.env.COD_REVIEW_PLAYWRIGHT)
  let helper = await readFile('tests/helpers/normalPurchaseBrowser.js', 'utf8')
  helper = helper.replaceAll('value => value', 'value => fixture.uiKeys[value] ? translate(fixture.uiKeys[value]) : value')
    .replace('payment_cash_enabled: true', 'payment_cash_enabled: false')
    .replace('payment_bank_transfer_enabled: true, payment_instapay_enabled: true', 'payment_bank_transfer_enabled: false, payment_instapay_enabled: false')
    .replace("name: 'Synthetic PDC', price: 10", "name: 'Synthetic manual delivery', price: 50")
    .replace('totalAmount: 110', 'totalAmount: 150').replace('shippingFee: 10', 'shippingFee: 50')
  helper=helper.replace("options: [{ id: fixture.companyId","options: fixture.deliveryOptions || [{ id: fixture.companyId")
    .replace('totalAmount: 150','totalAmount: 100 - (options.body?.coupon_code ? 1 : 0) + (fixture.deliveryOptions?.find(o=>o.id===options.body?.shipping_company_id)?.price ?? 50)')
    .replace('discountAmount: 0','discountAmount: options.body?.coupon_code ? 1 : 0')
    .replace('shippingFee: 50','shippingFee: fixture.deliveryOptions?.find(o=>o.id===options.body?.shipping_company_id)?.price ?? 50')
  const compiled = await build({ entryPoints: [resolve('tests/helpers/normalPurchaseBrowser.js')], bundle: true, write: false, format: 'iife', platform: 'browser', alias: { '~': resolve('app') },
    define: { 'import.meta.client': 'true', 'process.env.NODE_ENV': '"test"', __VUE_OPTIONS_API__: 'true', __VUE_PROD_DEVTOOLS__: 'false', __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false' },
    plugins: [{ name: 'address-book-browser', setup(b) {
      b.onResolve({ filter: /^normal-purchase-page$/ }, () => ({ path: resolve('app/pages/checkout/index.vue') }))
      b.onLoad({ filter: /normalPurchaseBrowser\.js$/ }, () => ({ contents: helper, resolveDir: resolve('tests/helpers'), loader: 'js' }))
      b.onLoad({ filter: /\.vue$/ }, async ({ path }) => ({ contents: compileScript(parse(await readFile(path, 'utf8'), { filename: path }).descriptor, { id: path, inlineTemplate: true }).content, resolveDir: dirname(path), loader: 'js' }))
    } }] })
  const cssDir = process.env.CHECKOUT_REVIEW_CSS_DIR || resolve('.output/public/_nuxt')
  const css = (await Promise.all((await readdir(cssDir)).filter(x => x.endsWith('.css')).map(x => readFile(cssDir + '/' + x, 'utf8')))).join('\n')
  const messages = Object.fromEntries(await Promise.all(['en', 'ar'].map(async lang => [lang, JSON.parse(await readFile('i18n/locales/' + lang + '.json', 'utf8'))])))
  const uiKeys = JSON.parse(await readFile('app/utils/uiMessageKeys.json', 'utf8'))
  let scenario
  const fixture = locale => {
    const actorId = randomUUID(), productId = randomUUID(), variantId = randomUUID()
    const saved = (label, phone) => ({ id: randomUUID(), revision: 1, label, first_name: label, last_name: 'Buyer', street_address: label + ' owned street', address_line_2: label + ' unit', city: 'Ramses', governorate: 'Cairo', phone, created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z' })
    const home = saved('Home', '01011111111'), work = saved('Work', '01022222222')
    return { locale, messages: messages[locale], uiKeys, publicAccess: true, actorId, allowedId: actorId, productId, variantId, orderId: randomUUID(), companyId: randomUUID(), quoteId: randomUUID(), siteUrl: 'https://store.example.invalid', home, work,
      profile: { full_name: 'Synthetic Buyer', phone: '01012345678', email: 'fixture@example.invalid', address_line_1: 'Profile owned street', address_line_2: 'Profile unit', city: 'Ramses', state: 'Cairo' },
      addressesByActor: { [actorId]: [home, work] }, ordersByActor: {}, orderItems: [],
      cart: { version: 3, id: randomUUID(), revision: randomUUID(), coupon: null, items: [{ id: productId, variant_id: variantId, quantity: 1, price: 100, stock_quantity: 5, allow_out_of_stock_purchases: true, is_serialized: true, selling_mode: 'normal', title: 'Synthetic item' }] } }
  }
  const server = createServer((req, res) => {
    res.setHeader('content-type', req.url === '/fixture.js' ? 'text/javascript' : 'text/html;charset=utf-8')
    res.end(req.url === '/fixture.js' ? compiled.outputFiles[0].text : '<!doctype html><html lang="' + scenario.locale + '" dir="' + (scenario.locale === 'ar' ? 'rtl' : 'ltr') + '" class="' + (scenario.dark ? 'dark' : '') + '"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css + '</style></head><body><div id="app"></div><script>window.__fixture=' + JSON.stringify(scenario) + '</script><script src="/fixture.js"></script></body></html>')
  })
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  const origin = 'http://127.0.0.1:' + server.address().port, browser = await pw[engine].launch(engine==='chromium'?{headless:true,channel:'chrome'}:{headless:true,executablePath:process.env.REVIEW_WEBKIT_EXECUTABLE})
  const open = async width => {
    const page = await browser.newPage({ viewport: { width, height: 900 } }), errors = [], blocked = []
    page.setDefaultTimeout(8000); page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', r => r.request().url().startsWith(origin) && r.request().method() === 'GET' ? r.continue() : (blocked.push(r.request().method()), r.abort()))
    await page.goto(origin); return { page, errors, blocked }
  }
  const button = (page, key) => page.getByRole('button', { name: key.split('.').reduce((v, p) => v[p], scenario.messages), exact: true })
  const check = async ({ page, errors, blocked }) => {
    assert.deepEqual(errors, []); assert.deepEqual(blocked, [])
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    const requests = await page.evaluate(() => window.__requests)
    assert.equal(requests.filter(x => x.path === '/api/checkout' || x.path === '/api/payments/intentions').length, 0)
    assert.equal(await page.evaluate(() => Object.values(localStorage).some(value => /Home owned street|Work owned street|Profile owned street/.test(value))), false)
  }
  const newDraft = async page => {
    await addressSelector(page).waitFor()
    await addressSelector(page).selectOption('new')
    await page.locator('input[autocomplete=address-line1]').fill('New owned street')
    await page.getByRole('combobox').filter({ hasNot: page.locator('option') }).nth(0).fill('Cairo')
    await page.getByRole('combobox').filter({ hasNot: page.locator('option') }).nth(0).press('Enter')
    await page.getByRole('combobox').filter({ hasNot: page.locator('option') }).nth(1).fill('Ramses')
    await page.getByRole('combobox').filter({ hasNot: page.locator('option') }).nth(1).press('Enter')
    await page.getByTestId('saved-address-label').fill('New owned address')
  }
  try {
    for (const locale of ['en', 'ar']) for (const width of [1440, 390]) for (const dark of [false, true]) await t.test(`${locale} ${width} ${dark ? 'dark' : 'light'} owned selection, draft, save and removal preserve CARD/Manual50`, async () => {
      scenario = { ...fixture(locale), dark }; const context = await open(width), { page } = context
      try {
        const select = addressSelector(page), summary = page.getByTestId('saved-address-summary')
        await select.waitFor(); assert.match(await summary.textContent(), /Profile owned street/)
        await select.selectOption(scenario.home.id); assert.match(await summary.textContent(), /Home owned street/)
        assert.match(await summary.textContent(), /01011111111/)
        await button(page, 'common.edit').click(); await page.locator('input[autocomplete=address-line1]').fill('Home revised draft')
        await page.getByTestId('saved-address-label').fill('Revised home')
        await select.selectOption(scenario.work.id); assert.match(await summary.textContent(), /Work owned street/)
        await select.selectOption(scenario.home.id)
        assert.equal(await page.locator('input[autocomplete=address-line1]').inputValue(), 'Home revised draft')
        assert.equal(await page.getByTestId('saved-address-label').inputValue(), 'Revised home')
        await deliverySelector(page).selectOption(scenario.companyId)
        await button(page, 'checkoutAddressBook.save').click(); await page.getByText(scenario.messages.checkoutAddressBook.saved, { exact: true }).waitFor()
        assert.match(await summary.textContent(), /Home revised draft/)
        assert.equal(await select.inputValue(), scenario.home.id)
        assert.equal(await deliverySelector(page).inputValue(), scenario.companyId)
        await button(page, 'common.edit').click(); await button(page, 'checkoutAddressBook.remove').click()
        assert.equal(await page.evaluate(() => window.__requests.filter(x => x.method === 'DELETE').length), 0)
        await button(page, 'common.cancel').click(); await button(page, 'checkoutAddressBook.remove').click()
        await button(page, 'checkoutAddressBook.confirmRemoveButton').click()
        await page.getByText(scenario.messages.checkoutAddressBook.removedKept, { exact: true }).waitFor()
        assert.equal(await page.locator('input[autocomplete=address-line1]').inputValue(), 'Home revised draft')
        assert.equal(await select.inputValue(), 'new')
        await button(page, 'common.continueToPayment').click()
        await page.getByRole('heading', { name: scenario.messages.common.paymentMethod, exact: true }).waitFor()
        assert.equal(await page.locator('input[name=payment-method]').count(), 1)
        assert.equal(await page.locator('input[value=card]').count(), 1)
        const requests = await page.evaluate(() => window.__requests)
        const quote = requests.filter(x => x.path === '/api/checkout/quote').at(-1)
        assert.equal(quote.body.shipping_company_id, scenario.companyId)
        assert.equal(quote.body.address.street_address, 'Home revised draft')
        assert.equal(quote.body.payment_method, 'card')
        assert.equal(await page.locator('html').getAttribute('dir'), locale === 'ar' ? 'rtl' : 'ltr')
        await check(context)
      } finally { await page.close() }
    })
    for (const locale of ['en', 'ar']) await t.test(`${locale} incomplete profile stays expanded and can select a complete owned address`, async () => {
      scenario = fixture(locale); scenario.profile.phone = ''; scenario.profile.address_line_1 = ''
      const context = await open(390), { page } = context
      try {
        await addressSelector(page).waitFor(); assert.equal(await page.locator('#checkout-address-fields').isVisible(), true)
        assert.equal(await page.getByTestId('saved-address-summary').count(), 0)
        await button(page, 'checkoutAddressBook.save').click()
        await page.getByText(scenario.messages.checkoutAddressBook.completeAddress, { exact: true }).waitFor()
        assert.equal(await page.evaluate(() => window.__requests.some(x => ['POST', 'PUT'].includes(x.method) && x.path.includes('/addresses'))), false)
        await addressSelector(page).selectOption(scenario.home.id)
        assert.match(await page.getByTestId('saved-address-summary').textContent(), /Home owned street/)
        await check(context)
      } finally { await page.close() }
    })
    for (const mode of ['single', 'none', 'legacy']) await t.test(`${mode} saved-address compatibility and dependent selection`, async () => {
      scenario = fixture('en')
      if (mode === 'single') scenario.addressesByActor[scenario.actorId] = [scenario.home]
      if (mode === 'none') { scenario.addressesByActor[scenario.actorId] = []; scenario.profile = { full_name: 'New Buyer', email: 'fixture@example.invalid', phone: '01012345678' } }
      if (mode === 'legacy') scenario.profile.city = 'Unmatched preserved locality'
      const context = await open(390), { page } = context
      try {
        if (mode !== 'none') { await page.getByTestId('saved-address-summary').waitFor(); await button(page, 'common.edit').click() }
        const fields = page.locator('input[role=combobox]')
        await fields.nth(0).waitFor()
        if (mode === 'legacy') { await page.locator('#checkout-address-fields bdi').filter({hasText:'Unmatched preserved locality'}).waitFor(); await page.locator('input[autocomplete=tel]').fill('01011111111'); assert.equal(await fields.nth(1).inputValue(), '') }
        await fields.nth(0).fill('Giza'); await fields.nth(0).press('Enter')
        assert.equal(await fields.nth(1).inputValue(), '')
        await fields.nth(1).fill('Ramses'); assert.equal(await page.getByRole('listbox').getByRole('option').filter({hasText:'Ramses'}).count(), 0)
        await fields.nth(1).press('Escape'); await fields.nth(1).fill('Dokki'); await fields.nth(1).press('Enter')
        assert.equal(await fields.nth(1).inputValue(), 'Dokki')
        await fields.nth(0).fill('Cairo 2'); await fields.nth(0).press('Enter')
        assert.equal(await fields.nth(1).inputValue(), '')
        await fields.nth(1).fill('رمسيس'); await fields.nth(1).press('Enter')
        assert.equal(await fields.nth(1).inputValue(), 'Ramses')
        await check(context)
      } finally { await page.close() }
    })
    await t.test('failed list remains an error; retry restores owned choices', async () => {
      scenario = fixture('en'); scenario.holdPaths = ['/api/account/addresses']
      const context = await open(390), { page } = context
      try {
        await page.getByText(scenario.messages.checkoutAddressBook.loading, { exact: true }).waitFor()
        await page.evaluate(() => { window.__addressControls.listFailure = true; window.__release('/api/account/addresses') })
        await page.getByText(scenario.messages.checkoutAddressBook.loadFailed, { exact: true }).waitFor()
        assert.match(await page.getByTestId('saved-address-summary').textContent(), /Profile owned street/)
        await page.evaluate(() => { window.__addressControls.listFailure = false })
        await button(page, 'checkoutAddressBook.reload').click(); await addressSelector(page).waitFor()
        await check(context)
      } finally { await page.close() }
    })
    await t.test('lost save acknowledgement retains drafts and retries the same creation ID explicitly', async () => {
      scenario = fixture('en'); const context = await open(390), { page } = context
      try {
        await newDraft(page); await page.evaluate(() => { window.__addressControls.loseSaveOnce = true })
        await button(page, 'checkoutAddressBook.save').click(); await page.getByText(scenario.messages.checkoutAddressBook.saveFailed, { exact: true }).waitFor()
        assert.equal(await page.locator('input[autocomplete=address-line1]').inputValue(), 'New owned street')
        await page.waitForTimeout(100)
        assert.equal(await page.evaluate(() => window.__requests.filter(x => x.path === '/api/account/addresses' && x.method === 'POST').length), 1)
        await button(page, 'checkoutAddressBook.save').click(); await page.getByText(scenario.messages.checkoutAddressBook.saved, { exact: true }).waitFor()
        const creates = await page.evaluate(() => window.__requests.filter(x => x.method === 'POST' && x.path === '/api/account/addresses'))
        assert.equal(creates.length, 2); assert.equal(creates[0].body.id, creates[1].body.id)
        assert.equal(await page.evaluate(id => window.__savedAddresses[id].filter(x => x.street_address === 'New owned street').length, scenario.actorId), 1)
        await check(context)
      } finally { await page.close() }
    })
    await t.test('revision conflict retains edits; explicit saved-version review loads the current revision', async () => {
      scenario = fixture('en'); const context = await open(390), { page } = context
      try {
        await addressSelector(page).selectOption(scenario.home.id); await button(page, 'common.edit').click()
        await page.locator('input[autocomplete=address-line1]').fill('Unsaved retained edit')
        await page.evaluate(() => { window.__addressControls.conflictOnce = true })
        await button(page, 'checkoutAddressBook.save').click(); await page.getByText(scenario.messages.checkoutAddressBook.conflict, { exact: true }).waitFor()
        assert.equal(await page.locator('input[autocomplete=address-line1]').inputValue(), 'Unsaved retained edit')
        await button(page, 'checkoutAddressBook.reload').click()
        assert.equal(await page.locator('input[autocomplete=address-line1]').inputValue(), 'Unsaved retained edit')
        await button(page, 'checkoutAddressBook.useSavedVersion').click()
        await page.waitForFunction(() => document.querySelector('input[autocomplete=address-line1]').value === 'Remotely updated owned street')
        await page.locator('input[autocomplete=address-line1]').fill('Reviewed owned edit')
        await button(page, 'checkoutAddressBook.save').click(); await page.getByText(scenario.messages.checkoutAddressBook.saved, { exact: true }).waitFor()
        const puts = await page.evaluate(() => window.__requests.filter(x => x.method === 'PUT'))
        assert.equal(puts.length, 2); assert.equal(puts[0].body.revision, 1); assert.equal(puts[1].body.revision, 2)
        await check(context)
      } finally { await page.close() }
    })
    await t.test('uncertain removal reload keeps the current checkout draft', async () => {
      scenario = fixture('en'); const context = await open(390), { page } = context
      try {
        await addressSelector(page).selectOption(scenario.work.id); await button(page, 'common.edit').click()
        await button(page, 'checkoutAddressBook.remove').click(); await page.evaluate(() => { window.__addressControls.loseRemoveOnce = true })
        await button(page, 'checkoutAddressBook.confirmRemoveButton').click(); await page.getByText(scenario.messages.checkoutAddressBook.removeFailed, { exact: true }).waitFor()
        await button(page, 'checkoutAddressBook.reload').click()
        await page.getByText(scenario.messages.checkoutAddressBook.unavailableKept, { exact: true }).waitFor()
        assert.equal(await addressSelector(page).inputValue(), 'new')
        assert.equal(await page.locator('input[autocomplete=address-line1]').inputValue(), 'Work owned street')
        await check(context)
      } finally { await page.close() }
    })
    await t.test('a different governorate invalidates the old delivery selection', async () => {
      scenario = fixture('en'); scenario.work.governorate = 'Giza'; scenario.work.city = 'Dokki'
      const context = await open(390), { page } = context
      try {
        await addressSelector(page).waitFor(); await deliverySelector(page).selectOption(scenario.companyId)
        await addressSelector(page).selectOption(scenario.work.id)
        assert.equal(await deliverySelector(page).inputValue(), '')
        await button(page, 'common.continueToPayment').click()
        assert.equal(await page.getByRole('heading', { name: scenario.messages.common.paymentMethod, exact: true }).count(), 0)
        await check(context)
      } finally { await page.close() }
    })
    await t.test('cheapest eligible delivery is selected and changing it refreshes the authoritative total',async()=>{
      scenario=fixture('en');const expensive=randomUUID();scenario.deliveryOptions=[{id:expensive,name:'Configured express delivery',price:100,governorates:['Cairo']},{id:scenario.companyId,name:'Configured standard delivery',price:50,governorates:['Cairo']},{id:randomUUID(),name:'Different governorate',price:1,governorates:['Giza']}]
      const context=await open(390),{page}=context;const money=n=>new Intl.NumberFormat('en-EG',{style:'currency',currency:'EGP',maximumFractionDigits:2}).format(n)
      try{await addressSelector(page).waitFor();await page.getByText(money(150),{exact:true}).waitFor();assert.equal(await deliverySelector(page).inputValue(),scenario.companyId);assert.equal(await page.locator('input[name=delivery-method]').count(),2)
       await deliverySelector(page).selectOption(expensive);await page.getByText(money(200),{exact:true}).waitFor();const quote=(await page.evaluate(()=>window.__requests)).filter(r=>r.path==='/api/checkout/quote').at(-1);assert.equal(quote.body.shipping_company_id,expensive);await check(context)
      }finally{await page.close()}
    })
    await t.test('coupon starts collapsed and keeps its code and exact discount when collapsed again',async()=>{
      scenario=fixture('en');const context=await open(390),{page}=context,money=n=>new Intl.NumberFormat('en-EG',{style:'currency',currency:'EGP',maximumFractionDigits:2}).format(n)
      try{await addressSelector(page).waitFor();const disclosure=page.locator('details[aria-labelledby=coupon-title]');assert.equal(await disclosure.getAttribute('open'),null);await disclosure.locator('summary').click()
       await page.getByPlaceholder(scenario.messages.common.couponCode,{exact:true}).fill('ALICE_PRIVATE_COUPON');await button(page,'common.apply').click();await page.getByText(money(149),{exact:true}).waitFor();await disclosure.locator('summary').click();assert.equal(await disclosure.getAttribute('open'),null)
       await page.getByText('ALICE_PRIVATE_COUPON',{exact:true}).waitFor();assert.ok((await page.locator('body').innerText()).includes(money(1)));await disclosure.locator('summary').click();await button(page,'common.remove').click();await page.getByText(money(150),{exact:true}).waitFor();assert.equal((await page.evaluate(()=>window.__requests)).filter(r=>r.path==='/api/checkout/quote').at(-1).body.coupon_code,'');await check(context)
      }finally{await page.close()}
    })
    for (const pending of ['list', 'save']) await t.test(`account switch clears private rows and drafts during a pending ${pending}`, async () => {
      scenario = fixture('en'); const second = randomUUID()
      scenario.profiles = { [scenario.actorId]: scenario.profile, [second]: { ...scenario.profile, full_name: 'Second Buyer', address_line_1: 'Second owned street' } }
      scenario.addressesByActor[second] = [{ ...scenario.work, id: randomUUID(), label: 'Second private address', street_address: 'Second private street' }]
      scenario.holdPaths = ['profile:' + second, ...(pending === 'list' ? ['/api/account/addresses'] : [])]
      const context = await open(390), { page } = context
      try {
        if (pending === 'list') await page.getByText(scenario.messages.checkoutAddressBook.loading, { exact: true }).waitFor()
        else {
          await newDraft(page); await page.evaluate(() => window.__holdPath('/api/account/addresses'))
          await button(page, 'checkoutAddressBook.save').click()
          await page.waitForFunction(() => window.__requests.some(x => x.path === '/api/account/addresses' && x.method === 'POST'))
        }
        await page.evaluate(({ id, cart }) => {
          localStorage.setItem(window.__cartKey(id), JSON.stringify({ ...cart, id: crypto.randomUUID(), revision: crypto.randomUUID(), owner: 'account:' + id }))
          window.__switchAccount(id)
        }, { id: second, cart: scenario.cart })
        await page.getByText(scenario.messages.common.loadingAccount, { exact: true }).waitFor()
        assert.equal(await addressSelector(page).count(), 0)
        assert.equal(await page.getByText('Home owned street', { exact: true }).count(), 0)
        await page.evaluate(id => { window.__release('/api/account/addresses'); window.__release('profile:' + id) }, second)
        await addressSelector(page).waitFor()
        const options = await addressSelector(page).textContent()
        assert.match(options, /Second private address/); assert.doesNotMatch(options, /Home owned street|New owned address/)
        assert.match(await page.getByTestId('saved-address-summary').textContent(), /Second owned street/)
        await check(context)
      } finally { await page.close() }
    })
  } finally { await browser.close(); await new Promise(r => server.close(r)) }
})
