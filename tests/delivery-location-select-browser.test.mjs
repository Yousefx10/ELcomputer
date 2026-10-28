import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createServer } from 'node:http'
import { build } from 'esbuild'
import { parse, compileScript } from '@vue/compiler-sfc'

const available = !!process.env.LOCATION_BROWSER_PLAYWRIGHT_MODULE && !!process.env.LOCATION_BROWSER_CHROME
test('actual dependent selectors support bilingual keyboard search, reset, mobile and themes without free-text values', { skip: !available }, async t => {
  const temporary = await mkdtemp(join(tmpdir(), 'location-ui-'))
  t.after(() => rm(temporary, { recursive: true, force: true }))
  const labels = {}
  for (const lang of ['en', 'ar']) {
    const all = JSON.parse(await readFile(new URL('../i18n/locales/' + lang + '.json', import.meta.url)))
    labels[lang] = { common: { governorate: all.common.governorate, cityVariant2: all.common.cityVariant2 }, deliveryLocations: all.deliveryLocations }
  }
  const entry = `import {createApp,h,reactive,ref} from 'vue';import Fields from ${JSON.stringify(resolve('app/components/address/LocationFields.vue'))};
   globalThis.locationLocale=ref('en');globalThis.locationLabels=${JSON.stringify(labels)};
   const state=reactive({governorate_location_id:'',city_location_id:'',governorate:'',city:''});
   const reference={governorates:[{id:'gov-cairo',name_en:'Cairo',name_ar:'القاهرة',checkout_name:'Cairo'},{id:'gov-giza',name_en:'Giza',name_ar:'الجيزة',checkout_name:'Giza'}],cities:[{id:'city-ramses',governorate_id:'gov-cairo',name_en:'Ramses',name_ar:'رمسيس'},{id:'city-dokki',governorate_id:'gov-giza',name_en:'Dokki',name_ar:'الدقي'}]};
   window.locationFixture={state,locale:globalThis.locationLocale};
   const app=createApp({setup(){return()=>h('main',{class:'store-container py-6'},[h('section',{class:'rounded-xl border border-slate-200 bg-white p-5'},[h(Fields,{reference,modelValue:state,'onUpdate:modelValue':v=>Object.assign(state,v)})]),h('button',{id:'reset',onClick:()=>Object.keys(state).forEach(k=>state[k]='')},'Reset')])}});
   import Select from ${JSON.stringify(resolve('app/components/address/LocationSearchSelect.vue'))};app.component('AddressLocationSearchSelect',Select);app.mount('#app');`
  const autoImports = `import {ref,computed,watch,nextTick,useId} from 'vue';const useI18n=()=>({locale:globalThis.locationLocale,t:(key)=>key.split('.').reduce((v,k)=>v?.[k],globalThis.locationLabels[globalThis.locationLocale.value])||key});`
  const bundle = await build({ stdin: { contents: entry, resolveDir: resolve('.'), loader: 'js' }, bundle: true, write: false, format: 'iife', platform: 'browser', alias: { '~': resolve('app') },
    define: { __VUE_OPTIONS_API__: 'true', __VUE_PROD_DEVTOOLS__: 'false', __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false', 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'actual-vue-components', setup(builder) {
      builder.onResolve({ filter: /\.vue$/ }, args => ({ path: args.path }))
      builder.onLoad({ filter: /\.vue$/ }, async args => {
        const descriptor = parse(await readFile(args.path, 'utf8')).descriptor
        const compiled = compileScript(descriptor, { id: 'location-' + args.path, inlineTemplate: true })
        return { contents: autoImports + compiled.content, loader: 'js', resolveDir: resolve('.') }
      })
    } }] })
  const cssDirectory = process.env.CHECKOUT_REVIEW_CSS_DIR || resolve('.output/public/_nuxt')
  const css = (await Promise.all((await readdir(cssDirectory)).filter(name => name.endsWith('.css')).map(name => readFile(join(cssDirectory, name), 'utf8')))).join('\n')
  const server = createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    if (req.url === '/app.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle.outputFiles[0].text) }
    else if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); res.end(css) }
    else res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body class="storefront"><div id="app"></div><script src="/app.js"></script></body></html>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve) }))
  const { chromium } = await import(pathToFileURL(process.env.LOCATION_BROWSER_PLAYWRIGHT_MODULE).href)
  const browser = await chromium.launch({ executablePath: process.env.LOCATION_BROWSER_CHROME, headless: true, args: ['--disable-background-networking'] })
  t.after(() => browser.close())
  for (const [locale, theme, width] of [['en','light',1280],['ar','dark',1280],['en','dark',320],['ar','light',320]]) {
    await t.test(locale + '/' + theme + '/' + width, async () => {
      const page = await browser.newPage({ viewport: { width, height: 800 } })
      const errors = []; page.on('pageerror', e => errors.push(e.message))
      await page.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:') ? route.continue() : route.abort())
      await page.goto('http://127.0.0.1:' + server.address().port)
      await page.evaluate(({ locale, theme }) => { locationFixture.locale.value = locale; document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'; document.documentElement.className = theme === 'dark' ? 'dark' : '' }, { locale, theme })
      const inputs = page.getByRole('combobox'); await inputs.nth(0).fill(locale === 'ar' ? 'قاهر' : 'cai'); await inputs.nth(0).press('Enter')
      await inputs.nth(1).fill(locale === 'ar' ? 'رمس' : 'ram'); await inputs.nth(1).press('Enter')
      assert.equal(await page.evaluate(() => locationFixture.state.city), 'Ramses')
      await inputs.nth(1).fill('NOT-A-LOCATION'); await inputs.nth(1).press('Tab')
      assert.equal(await page.evaluate(() => locationFixture.state.city), 'Ramses')
      await inputs.nth(0).fill(locale === 'ar' ? 'جيز' : 'giz'); await inputs.nth(0).press('Enter')
      assert.equal(await page.evaluate(() => locationFixture.state.city), '')
      await inputs.nth(1).fill(locale === 'ar' ? 'دقي' : 'dok'); await inputs.nth(1).press('Enter')
      assert.equal(await page.evaluate(() => locationFixture.state.city), 'Dokki')
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      if (theme === 'dark') assert.notEqual(await inputs.nth(0).evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)')
      if (process.env.LOCATION_BROWSER_ARTIFACTS) await page.screenshot({ path: join(process.env.LOCATION_BROWSER_ARTIFACTS, `locations-${locale}-${theme}-${width}.png`) })
      await page.locator('#reset').click(); assert.equal(await inputs.nth(0).inputValue(), ''); assert.equal(await inputs.nth(1).inputValue(), '')
      assert.deepEqual(errors, [])
      await page.close()
    })
  }
})
