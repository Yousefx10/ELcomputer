// Real Vue forms, shared save composable, HTTP routes and native SQL. Only
// hosted Auth verification, Nuxt shell and unrelated media controls are fixtures.
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { createServer } from 'node:http'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parse, compileScript, compileStyle } from '@vue/compiler-sfc'
import { build } from 'esbuild'
import { createEmailNativeDatabase, emailNativeAvailable } from '../tests/helpers/emailNativeDatabase.mjs'
import { createProductSaveHttpFixture } from '../tests/helpers/productSaveHttpFixture.mjs'

assert.ok(emailNativeAvailable, 'Native disposable PostgreSQL tools are required')
const { chromium } = await import(pathToFileURL(process.env.PRODUCT_SAVE_REVIEW_PLAYWRIGHT || '/private/tmp/elcomputer-final-browser-tools/node_modules/playwright/index.mjs').href)
const base = resolve(new URL('..', import.meta.url).pathname)
const dir = process.env.PRODUCT_SAVE_REVIEW_ARTIFACTS || '/private/tmp/elcomputer-product-save-browser'
await mkdir(dir, { recursive: true })
const f = await createProductSaveHttpFixture({ database: await createEmailNativeDatabase() })
let browser, server
try {
  const seed = await f.save(f.body({ title: 'Product editor fixture', price: '125.50', is_published: true }))
  const components = {
    Add: 'app/pages/dashboard/products/add.vue', Edit: 'app/pages/dashboard/products/edit/[id].vue',
    Variants: 'app/components/dashboard/products/VariantsEditor.vue',
    SellingMode: 'app/components/dashboard/products/SellingModeFields.vue',
    Warranty: 'app/components/dashboard/products/WarrantyFields.vue', PageIntro: 'app/components/dashboard/PageIntro.vue'
  }
  let componentCss = ''
  for (const [name, file] of Object.entries(components)) {
    const { descriptor } = parse(await readFile(join(base, file), 'utf8'))
    await writeFile(join(dir, name + '.js'), compileScript(descriptor, { id: 'save-' + name, inlineTemplate: true }).content)
    for (const style of descriptor.styles) componentCss += compileStyle({ source: style.content, filename: file, id: 'data-v-save-' + name, scoped: style.scoped }).code
  }
  await writeFile(join(dir, 'entry.js'), `
import {createApp,h,ref,shallowRef,reactive,computed,onMounted,onBeforeUnmount,watch,watchEffect,nextTick,Suspense,resolveComponent} from '${base}/node_modules/vue/dist/vue.esm-bundler.js'
import {createI18n} from '${base}/node_modules/vue-i18n/dist/vue-i18n.mjs'
import {ofetch} from '${base}/node_modules/ofetch/dist/index.mjs'
import {useUiLocale} from '${base}/app/composables/useUiLocale.js'
import {useProductSave} from '${base}/app/composables/useProductSave.js'
import en from '${base}/i18n/locales/en.json'
import ar from '${base}/i18n/locales/ar.json'
${Object.keys(components).map(name => `import ${name} from './${name}.js'`).join('\n')}
const config=${JSON.stringify({ url: f.url, actors: f.actors, warehouse: f.warehouse, supplier: f.supplier, category: f.category, brand: f.brand, product: seed.id })}
const i18n=createI18n({legacy:false,locale:'en',fallbackLocale:'en',messages:{en,ar}})
const view=ref('add'),generation=ref(0),theme=ref('light'),actor=ref('owner'),navigation=ref(''),invalidations=[]
const adminUser=computed(()=>({id:config.actors[actor.value]}))
const route=reactive({params:{id:config.product},query:{},path:'/dashboard/products/add'})
const lookups={categories:[{id:config.category,name:'Category fixture'}],brands:[{id:config.brand,name:'Brand fixture'}],commerce_warehouses:[{id:config.warehouse,name:'Warehouse fixture',is_active:true}],commerce_crm_accounts:[{id:config.supplier,name:'Supplier fixture',is_active:true,account_type:'supplier'}],product_images:[]}
const supabase={from(table){const q={select(){return q},eq(){return q},in(){return q},order(){return q},then(done){done({data:lookups[table]||[],error:null})}};return q}}
const appearance=()=>{document.documentElement.lang=i18n.global.locale.value;document.documentElement.dir=i18n.global.locale.value==='ar'?'rtl':'ltr';document.documentElement.classList.toggle('dark',theme.value==='dark'||theme.value==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)}
watch([theme,i18n.global.locale],appearance);matchMedia('(prefers-color-scheme: dark)').addEventListener('change',appearance)
Object.assign(globalThis,{ref,shallowRef,reactive,computed,onMounted,onBeforeUnmount,watch,watchEffect,nextTick,resolveComponent,useUiLocale,useProductSave,definePageMeta(){},useI18n:()=>i18n.global,useNuxtApp:()=>({$i18n:i18n.global}),useUiRoute:()=>route,useSupabaseClient:()=>supabase,
 useAdminAccess:()=>({adminUser,hasPermission:key=>actor.value==='owner'||actor.value==='editor'||key==='products.view'}),
 useAdminLogs:()=>({getAdminAuthHeaders:async()=>({authorization:'Bearer '+actor.value}),recordAdminLog:async()=>{throw Error('Product save must not write a browser audit')}}),
 useDashboardCache:()=>({getSnapshot:()=>null,invalidate:prefix=>invalidations.push(prefix),isFresh:()=>false,setSnapshot(){}}),useNuxtData:()=>({data:ref({mode:'built_in'})}),useDashboardLayout:()=>({dashboardLayout:ref('standard')}),
 useAsyncData:async(_key,loader)=>{const data=ref(null),error=ref(null),pending=ref(false);const refresh=async()=>{pending.value=true;try{data.value=await loader();error.value=null}catch(e){error.value=e}finally{pending.value=false}};await refresh();return {data,error,pending,refresh}},
 useUiNavigation:()=>({uiNavigateTo:async path=>{navigation.value=path}}),$fetch:(path,options)=>ofetch(config.url+path,{...options,retry:0})})
const app=createApp({render:()=>h('div',{class:'dashboard-modern p-4'},h(Suspense,null,{default:()=>h(view.value==='add'?Add:Edit,{key:generation.value})}))})
app.use(i18n);const ui=useUiLocale();app.config.globalProperties.$uiLabel=ui.uiLabel;app.config.globalProperties.$uiMessage=ui.uiMessage
for(const [name,component]of Object.entries({DashboardProductsVariantsEditor:Variants,DashboardProductsSellingModeFields:SellingMode,DashboardProductsWarrantyFields:Warranty,DashboardPageIntro:PageIntro}))app.component(name,component)
for(const name of ['DashboardSeoFields','DashboardMediaUploadField','DashboardProductsSpecificationEditor','LayoutPageLoading'])app.component(name,{render(){return null}})
app.component('Icon',{render(){return h('span',{'aria-hidden':'true'})}})
app.component('NuxtLinkLocale',{props:['to'],setup(props,{slots}){return()=>h('a',{href:props.to,onClick:e=>e.preventDefault()},slots.default?.())}})
app.mount('#app');appearance()
window.productSaveTest={config,actor,navigation,theme,invalidations,locale:i18n.global.locale,appearance,async show(name){view.value=name;route.path=name==='add'?'/dashboard/products/add':'/dashboard/products/edit/'+config.product;navigation.value='';generation.value++;await nextTick()}}
`)
  await build({ entryPoints: [join(dir, 'entry.js')], bundle: true, outfile: join(dir, 'bundle.js'), alias: { '~': join(base, 'app') }, nodePaths: [join(base, 'node_modules')], define: { 'process.env.NODE_ENV': '"test"', 'import.meta.client': 'true', '__VUE_OPTIONS_API__': 'true', '__VUE_PROD_DEVTOOLS__': 'false', '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': 'false' } })
  const css = (await Promise.all((await readdir(join(base, '.output/public/_nuxt'))).filter(file => file.endsWith('.css')).map(file => readFile(join(base, '.output/public/_nuxt', file), 'utf8')))).join('\n') + componentCss
  server = createServer(async (request, response) => {
    response.setHeader('content-type', request.url === '/bundle.js' ? 'text/javascript' : 'text/html')
    response.end(request.url === '/bundle.js' ? await readFile(join(dir, 'bundle.js')) : `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body class="bg-slate-100"><div id="app"></div><script src="/bundle.js"></script></body></html>`)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${server.address().port}`
  browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage(), errors = [], external = [], expectedNetworkErrors = []
  let assertions = 0, screens = 0
  const check = (condition, message) => { assert.ok(condition, message); assertions++ }
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') {
    if (message.text().includes('net::ERR_FAILED')) expectedNetworkErrors.push(message.text())
    else if (!/server responded with a status of (400|401|409)\b/.test(message.text())) errors.push(message.text())
  } })
  let loseBrowserResponse = false
  await page.route('**/*', async route => {
    if (![url, f.url].some(origin => route.request().url().startsWith(origin + '/'))) {
      external.push(route.request().url()); await route.abort(); return
    }
    if (loseBrowserResponse && route.request().url().startsWith(f.url + '/') && ['POST', 'PATCH'].includes(route.request().method())) {
      loseBrowserResponse = false
      await route.fetch() // Actual route/SQL commit; deliberately discard the acknowledgement.
      await route.abort('failed'); return
    }
    await route.continue()
  })
  const labels = Object.fromEntries(await Promise.all(['en', 'ar'].map(async locale => [locale, JSON.parse(await readFile(join(base, 'i18n/locales/' + locale + '.json'), 'utf8'))])))
  const show = async view => {
    await page.evaluate(view => window.productSaveTest.show(view), view)
    await page.locator('form fieldset').first().waitFor()
    await page.waitForFunction(() => !!document.querySelector('form button[type=submit]:not(:disabled)'))
  }
  const saved = async () => {
    try { await page.waitForFunction(() => !!window.productSaveTest.navigation.value, null, { timeout: 10000 }) }
    catch (error) {
      const state = await page.evaluate(() => ({ alert: document.querySelector('[role=alert]')?.innerText,
        invalid: [...document.querySelectorAll('form input,form select')].filter(n => !n.checkValidity()).map(n => ({id:n.id,value:n.value,message:n.validationMessage})) }))
      throw Error(error.message + '; ' + JSON.stringify(state) + '; ' + JSON.stringify(f.controls.rpcErrors) + '; ' + errors.join('; '))
    }
  }
  const populate = async language => {
    await page.getByPlaceholder(labels[language].common.productTitle, { exact: true }).fill(language === 'ar' ? 'منتج كتبه الموظف' : 'Staff authored product')
    await page.getByPlaceholder('product-slug', { exact: true }).fill('browser-' + crypto.randomUUID())
    await page.getByPlaceholder(labels[language].common.price, { exact: true }).fill('125.50')
    await page.locator('select').filter({ has: page.locator('option[value="' + f.warehouse + '"]') }).selectOption(f.warehouse)
  }
  await page.goto(url)
  try { await page.waitForFunction(() => !!window.productSaveTest, null, { timeout: 10000 }) }
  catch (error) { throw Error(error.message + '; ' + errors.join('; ')) }
  for (const language of ['en', 'ar']) for (const width of [390, 768, 1440]) for (const theme of ['light', 'dark', 'system']) {
    await page.setViewportSize({ width, height: 1000 }); await page.emulateMedia({ colorScheme: theme === 'light' ? 'light' : 'dark' })
    await page.evaluate(({ language, theme }) => { const t=window.productSaveTest;t.locale.value=language;t.theme.value=theme;t.appearance() }, { language, theme })
    for (const view of ['add', 'edit']) {
      await show(view)
      check(await page.locator('html').getAttribute('dir') === (language === 'ar' ? 'rtl' : 'ltr'), 'Correct locale direction')
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow: ' + view)
      check(await page.getByPlaceholder(labels[language].common.price, { exact: true }).getAttribute('step') === '0.01', 'Price accepts cents')
      check(!(await page.locator('body').innerText()).includes('productSave.'), 'Save labels translated')
      await page.screenshot({ path: join(dir, `${language}-${width}-${theme}-${view}.png`), fullPage: true }); screens++
    }
  }
  for (const language of ['en', 'ar']) {
    await page.evaluate(language => {window.productSaveTest.locale.value=language;window.productSaveTest.theme.value='light'}, language)
    await show('add'); await populate(language)
    const before = await f.counts()
    f.controls.delay = 500
    const writes = f.controls.writes
    await page.locator('form').evaluate(form => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    check(await page.getByPlaceholder(labels[language].common.productTitle, { exact: true }).isDisabled(), 'Fields lock while saving')
    check(await page.locator('button[type=submit]').isDisabled(), 'Submit locks while saving')
    await saved(); f.controls.delay = 0
    check(f.controls.writes === writes + 1, 'Double submission sends one command')
    check((await f.counts()).products === before.products + 1, 'Real SQL create succeeds')
    check((await f.counts()).audits === before.audits + 1, 'Server records one audit')
    await show('edit')
    await page.getByPlaceholder(labels[language].common.productTitle, { exact: true }).fill(language === 'ar' ? 'عنوان محفوظ' : 'Saved editorial title')
    await page.locator('button[type=submit]').click(); await saved()
    check((await f.snapshot(seed.id)).product.title === (language === 'ar' ? 'عنوان محفوظ' : 'Saved editorial title'), 'Real SQL edit succeeds')
    await show('add'); await populate(language)
    await page.getByPlaceholder(labels[language].common.oldPrice, { exact: true }).fill('12.345')
    await page.locator('form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    await page.getByRole('alert').waitFor()
    check((await page.getByRole('alert').innerText()) === labels[language].productSave.old_price, 'Strict validation has a translated field message')
  }
  await page.evaluate(() => {window.productSaveTest.locale.value='en';window.productSaveTest.actor.value='owner'})
  await show('add'); await populate('en')
  const beforeLoss = await f.counts()
  loseBrowserResponse = true
  await page.locator('button[type=submit]').click()
  await page.getByRole('button', { name: labels.en.productSave.retry, exact: true }).waitFor()
  check(await page.getByPlaceholder(labels.en.common.productTitle, { exact: true }).isDisabled(), 'Unconfirmed command stays immutable')
  const keys = await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('product-save:')).map(key => ({key,value:sessionStorage.getItem(key)})))
  check(keys.length === 1 && /^[0-9a-f-]{36}$/.test(keys[0].value) && keys[0].key.includes(f.actors.owner), 'Storage holds only actor-scoped request UUID')
  const verifyUser = f.client.auth.getUser
  f.client.auth.getUser = async () => ({ data: { user: null }, error: null })
  await page.getByRole('button', { name: labels.en.productSave.retry, exact: true }).click()
  await page.getByRole('alert').filter({ hasText: labels.en.productSave.errors.session }).waitFor()
  check(await page.evaluate(key => sessionStorage.getItem(key.key) === key.value, keys[0]), 'Expired session retains the unresolved request UUID')
  check(await page.getByPlaceholder(labels.en.common.productTitle, { exact: true }).isDisabled(), 'Expired-session retry preserves the immutable command')
  f.client.auth.getUser = verifyUser
  await page.getByRole('button', { name: labels.en.productSave.retry, exact: true }).click(); await saved()
  check((await f.counts()).products === beforeLoss.products + 1, 'Lost response retry never duplicates product')
  check((await f.counts()).audits === beforeLoss.audits + 1, 'Lost response retry never duplicates audit')
  await show('add'); await populate('en'); loseBrowserResponse = true
  await page.locator('button[type=submit]').click(); await page.getByRole('button', { name: labels.en.productSave.checkSave, exact: true }).waitFor()
  const invalidationsBeforeRecovery = await page.evaluate(() => window.productSaveTest.invalidations.length)
  await show('add'); await saved()
  check(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('product-save:')).length) === 0, 'Reload reconciles committed receipt without storing private draft')
  check(await page.evaluate(before => window.productSaveTest.invalidations.length === before + 2 &&
    window.productSaveTest.invalidations.slice(-2).join(',') === 'dashboard:products:,dashboard:home', invalidationsBeforeRecovery), 'Receipt recovery refreshes product listing and Dashboard counts')
  for (const language of ['en', 'ar']) {
    await page.evaluate(language => {window.productSaveTest.locale.value=language;window.productSaveTest.actor.value='editor'}, language)
    await show('edit')
    const typed = language === 'ar' ? 'تغيير غير محفوظ' : 'Unsaved editor title'
    await page.getByPlaceholder(labels[language].common.productTitle, { exact: true }).fill(typed)
    await f.db.query('update public.products set title=$1 where id=$2', ['Another administrator title', seed.id])
    const counts = await f.counts()
    await page.locator('button[type=submit]').click(); await page.getByRole('alert').waitFor()
    check((await page.getByRole('alert').innerText()) === labels[language].productSave.errors.conflict, 'Conflict explanation translated')
    check(await page.getByPlaceholder(labels[language].common.productTitle, { exact: true }).inputValue() === typed, 'Conflict preserves entered values')
    check(await page.locator('button[type=submit]').isDisabled(), 'Stale form cannot overwrite')
    check((await f.counts()).audits === counts.audits, 'Conflict makes no audit or product change')
    const reload = page.getByRole('button', { name: labels[language].productSave.reload, exact: true })
    page.once('dialog', dialog => dialog.dismiss()); await reload.click()
    check(await page.getByPlaceholder(labels[language].common.productTitle, { exact: true }).inputValue() === typed, 'Reload cancellation preserves draft')
    page.once('dialog', dialog => dialog.accept()); await reload.click()
    await page.waitForFunction(() => !document.querySelector('[role=alert]'))
    check(await page.getByPlaceholder(labels[language].common.productTitle, { exact: true }).inputValue() === 'Another administrator title', 'Confirmed reload gets current product and version')
    await page.getByPlaceholder(labels[language].common.productTitle, { exact: true }).fill(typed)
    await page.locator('button[type=submit]').click(); await saved()
    check((await f.snapshot(seed.id)).product.title === typed, 'Reloaded revision allows a deliberate edit')
  }
  await show('edit'); await page.evaluate(() => {window.productSaveTest.actor.value='viewer'})
  check(await page.locator('button[type=submit]').isDisabled(), 'Viewer cannot submit editor')
  check(await page.locator('form input[type=text]').first().isDisabled(), 'Viewer cannot edit fields')
  check(errors.length === 0, 'No unexpected console/page errors: ' + errors.join(';'))
  check(external.length === 0, 'No external browser requests')
  check(expectedNetworkErrors.length === 2, 'Only the two deliberately dropped responses cause network errors')
  const report = { assertions, screenshots: screens, database: 'native independent disposable PostgreSQL', errors, external,
    deliberatelyDroppedResponses: 2, expectedNetworkErrors: expectedNetworkErrors.length,
    limitation: 'Hosted Auth verification, Nuxt shell, media and SEO controls are fixtures; no hosted or production acceptance.' }
  await writeFile(join(dir, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report))
} finally {
  await browser?.close()
  if (server) {server.closeAllConnections();await new Promise(resolve => server.close(resolve))}
  await f.close()
}
