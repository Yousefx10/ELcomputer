import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { createServer } from 'node:http'
import { build } from 'esbuild'
import { parse, compileScript } from '@vue/compiler-sfc'

test('actual profile location editor: EN/AR/RTL, themes, responsive and legacy saves', async t => {
  const { chromium } = await import(process.env.COD_REVIEW_PLAYWRIGHT)
  const compiled = await build({ entryPoints: [resolve('tests/helpers/normalPurchaseBrowser.js')], bundle: true, write: false, format: 'iife', platform: 'browser', alias: { '~': resolve('app') },
    define: { 'import.meta.client': 'true', 'process.env.NODE_ENV': '"test"', __VUE_OPTIONS_API__: 'true', __VUE_PROD_DEVTOOLS__: 'false', __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false' },
    plugins: [{ name: 'actual-profile', setup(b) {
      b.onResolve({ filter: /^normal-purchase-page$/ }, () => ({ path: resolve('app/pages/account/profile.vue') }))
      b.onLoad({ filter: /\.vue$/ }, async ({ path }) => ({ contents: compileScript(parse(await readFile(path, 'utf8'), { filename: path }).descriptor, { id: path, inlineTemplate: true }).content, resolveDir: dirname(path), loader: 'js' }))
    } }] })
  const cssDir = process.env.CHECKOUT_REVIEW_CSS_DIR || resolve('.output/public/_nuxt')
  const css = (await Promise.all((await readdir(cssDir)).filter(x => x.endsWith('.css')).map(x => readFile(cssDir + '/' + x, 'utf8')))).join('\n')
  const messages = Object.fromEntries(await Promise.all(['en', 'ar'].map(async lang => [lang, JSON.parse(await readFile('i18n/locales/' + lang + '.json', 'utf8'))])))
  let fixture
  const server = createServer((req, res) => {
    res.setHeader('content-type', req.url === '/fixture.js' ? 'text/javascript' : 'text/html;charset=utf-8')
    res.end(req.url === '/fixture.js' ? compiled.outputFiles[0].text : '<!doctype html><html dir="' + (fixture.locale === 'ar' ? 'rtl' : 'ltr') + '" class="' + (fixture.dark ? 'dark' : '') + '"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css + '</style></head><body class="storefront"><div id="app"></div><script>window.__fixture=' + JSON.stringify(fixture) + '</script><script src="/fixture.js"></script></body></html>')
  })
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  const origin = 'http://127.0.0.1:' + server.address().port
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  try {
    for (const locale of ['en', 'ar']) for (const width of [1440, 320]) for (const dark of [false, true]) await t.test(`${locale}/${width}/${dark ? 'dark' : 'light'}`, async () => {
      fixture = { actorId: randomUUID(), locale, messages: messages[locale], siteUrl: 'https://store.example.invalid', profile: { full_name: 'Synthetic Buyer', phone: '01012345678', address_line_1: 'Synthetic street', address_line_2: 'Unit', city: 'Unmatched legacy locality', state: 'Cairo', country: 'Egypt' }, dark }
      const page = await browser.newPage({ viewport: { width, height: 900 } }), errors = [], blocked = []
      page.on('pageerror', e => errors.push(e.message))
      await page.route('**/*', r => r.request().url().startsWith(origin) && r.request().method() === 'GET' ? r.continue() : (blocked.push(r.request().method()), r.abort()))
      try {
        await page.goto(origin)
        const fields = page.locator('input[role=combobox]')
        await fields.nth(0).waitFor()
        await page.getByText('Unmatched legacy locality', { exact: false }).waitFor()
        await page.locator('input[autocomplete=tel]').fill('01011111111')
        await page.getByRole('button', { name: messages[locale].common.saveProfile, exact: true }).click()
        await page.waitForFunction(() => window.__profileSaves?.length === 1)
        assert.equal(await page.evaluate(() => window.__profileSaves[0].city), 'Unmatched legacy locality')
        await fields.nth(0).fill(locale === 'ar' ? 'جيز' : 'Giza'); await fields.nth(0).press('Enter')
        assert.equal(await fields.nth(1).inputValue(), '')
        await fields.nth(1).fill(locale === 'ar' ? 'الدقي' : 'Dokki'); await fields.nth(1).press('Enter')
        await page.getByRole('button', { name: messages[locale].common.saveProfile, exact: true }).click()
        await page.waitForFunction(() => window.__profileSaves?.length === 2)
        assert.deepEqual(await page.evaluate(() => { const p = window.__profileSaves[1]; return [p.city,p.state,p.address_line_1,p.address_line_2] }), ['Dokki','Giza','Synthetic street','Unit'])
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
        if (dark) assert.notEqual(await fields.nth(0).evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)')
        if (process.env.LOCATION_BROWSER_ARTIFACTS) await page.screenshot({ path: process.env.LOCATION_BROWSER_ARTIFACTS + `/profile-${locale}-${width}-${dark ? 'dark' : 'light'}.png`, fullPage: true })
        assert.deepEqual(errors, []); assert.deepEqual(blocked, [])
      } finally { await page.close() }
    })
  } finally { await browser.close(); await new Promise(r => server.close(r)) }
})
