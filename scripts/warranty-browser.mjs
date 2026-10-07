// Actual Vue surfaces and built application CSS, with isolated catalog/auth/API
// fixtures. No production database, accounts, provider calls or credentials.
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { createServer } from 'node:http'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parse, compileScript, compileStyle } from '@vue/compiler-sfc'
import { build } from 'esbuild'
const { chromium } = await import(process.env.WARRANTY_REVIEW_PLAYWRIGHT ? pathToFileURL(process.env.WARRANTY_REVIEW_PLAYWRIGHT).href : 'playwright')
const base = resolve(new URL('..', import.meta.url).pathname)
const dir = process.env.WARRANTY_REVIEW_ARTIFACTS || '/tmp/elcomputer-warranty-review/browser'
await mkdir(dir, { recursive: true })
const components = {
  Add: 'app/pages/dashboard/products/add.vue', Edit: 'app/pages/dashboard/products/edit/[id].vue',
  WarrantyFields: 'app/components/dashboard/products/WarrantyFields.vue', ItemWarranty: 'app/components/account/ItemWarranty.vue',
  Details: 'app/pages/account/orders/[id].vue', Orders: 'app/pages/account/orders/index.vue',
  Progress: 'app/components/account/OrderProgress.vue', Card: 'app/components/account/OrderCard.vue',
  Product: 'app/pages/products/[slug].vue', Checkout: 'app/pages/checkout/index.vue',
  Variants: 'app/components/dashboard/products/VariantsEditor.vue', SellingMode: 'app/components/dashboard/products/SellingModeFields.vue',
  PageIntro: 'app/components/dashboard/PageIntro.vue'
}
let componentCss = ''
for (const [name, file] of Object.entries(components)) {
  const { descriptor } = parse(await readFile(join(base, file), 'utf8'))
  await writeFile(join(dir, name + '.js'), compileScript(descriptor, { id: 'warranty-' + name, inlineTemplate: true }).content)
  for (const style of descriptor.styles) componentCss += compileStyle({ source: style.content, filename: file, id: 'data-v-warranty-' + name, scoped: style.scoped }).code
}
await writeFile(join(dir, 'entry.js'), `
import {createApp,h,ref,shallowRef,reactive,computed,onMounted,onBeforeUnmount,watch,watchEffect,nextTick,Suspense,resolveComponent} from '${base}/node_modules/vue/dist/vue.esm-bundler.js'
import {createI18n} from '${base}/node_modules/vue-i18n/dist/vue-i18n.mjs'
import {useUiLocale} from '${base}/app/composables/useUiLocale.js'
import {normalizeProductWarranty} from '${base}/app/utils/warranty.js'
import en from '${base}/i18n/locales/en.json'
import ar from '${base}/i18n/locales/ar.json'
${Object.keys(components).map(name => `import ${name} from './${name}.js'`).join('\n')}
const i18n=createI18n({legacy:false,locale:'en',fallbackLocale:'en',messages:{en,ar}})
const view=ref('add'),generation=ref(0),theme=ref('light')
const productId='11111111-1111-4111-8111-111111111111',variantId='22222222-2222-4222-8222-222222222222',orderId='33333333-3333-4333-8333-333333333333',warehouseId='44444444-4444-4444-8444-444444444444'
const route=reactive({params:{id:productId,slug:'warranty-fixture'},query:{},path:'/dashboard/products/add'})
const user=ref({id:'buyer-fixture',email:'buyer@example.invalid'})
const fixture=reactive({requests:[],logs:[],permissions:null,navigation:'',failSave:false,reorders:0,added:0,
 product:{id:productId,title:'Warranty browser fixture',slug:'warranty-fixture',price:100,stock_quantity:5,is_serialized:true,is_published:true,primary_warehouse_id:warehouseId,selling_mode:'normal',preorder_payment_mode:'full',warranty_status:'included',warranty_duration_value:12,warranty_duration_unit:'months',long_description:'Local catalog fixture.'},
 variants:[{id:variantId,product_id:productId,name:'Default',code:'DEFAULT',sku:'WARRANTY-FIXTURE-SKU',stock_quantity:5,is_active:true}],
 order:{id:orderId,order_number:'WARRANTY-ORDER-FIXTURE',status:'pending_payment',payment_status:'pending',payment_method:'cash',currency:'EGP',total_amount:100,subtotal_amount:100,first_name:'Buyer',phone:'01012345678',street_address:'Street',city:'Cairo',governorate:'Cairo',created_at:'2026-10-07T08:00:00Z'},
 items:[{id:'months',order_id:orderId,product_id:productId,variant_id:variantId,product_title:'Purchased month warranty',quantity:1,unit_price:25,line_total:25,warranty_status:'included',warranty_duration_value:12,warranty_duration_unit:'months',warranty_start_basis:'unresolved',warranty_snapshot_at:'2026-10-07T08:00:00Z'},
 {id:'years',order_id:orderId,product_id:productId,product_title:'Purchased year warranty',quantity:1,unit_price:25,line_total:25,warranty_status:'included',warranty_duration_value:3,warranty_duration_unit:'years',warranty_start_basis:'unresolved',warranty_snapshot_at:'2026-10-07T08:00:00Z'},
 {id:'none',order_id:orderId,product_id:productId,product_title:'Purchased without warranty',quantity:1,unit_price:25,line_total:25,warranty_status:'none',warranty_snapshot_at:'2026-10-07T08:00:00Z'},
 {id:'history',order_id:orderId,product_id:productId,product_title:'Historical purchase',quantity:1,unit_price:25,line_total:25}]})
const clone=value=>JSON.parse(JSON.stringify(value))
const cartItems=ref([{id:productId,title:'Checkout fixture',price:100,quantity:1,selling_mode:'normal'}])
const supabase={auth:{getSession:async()=>({data:{session:{access_token:'local-fixture-token'}}}),getUser:async()=>({data:{user:user.value}})},from(table){
 let single=false
 const query={select(){return query},eq(){return query},neq(){return query},order(){return query},range(){return query},abortSignal(){return query},in(){return query},or(){return query},limit(){return query},maybeSingle(){single=true;return query},single(){single=true;return query},then(done){
  const rows=table==='products'||table==='storefront_products'?[clone(fixture.product)]:table==='product_variants'||table==='storefront_product_variants'?clone(fixture.variants):table==='customer_orders'?[clone(fixture.order)]:table==='customer_order_items'?clone(fixture.items):table==='commerce_warehouses'?[{id:warehouseId,name:'Fixture warehouse'}]:table==='customer_profiles'?[{id:user.value.id,full_name:'Buyer Fixture',phone:'01012345678',address_line_1:'Street',city:'Cairo',state:'Cairo',email:'buyer@example.invalid'}]:table==='product_specifications'?[{id:'legacy',label:'Warranty',value:'Legacy descriptive terms',sort_order:0}]:[]
  done({data:single?rows[0]||null:rows,count:rows.length,error:null})
 }};return query
}}
const fetcher=async(path,options={})=>{
 fixture.requests.push({path,method:options.method||'GET',body:clone(options.body||{})})
 if(path==='/api/admin-products'||path==='/api/admin-products/'+productId){
  if(fixture.failSave)throw {data:{statusMessage:'Choose a valid warranty option.'}}
  const terms=normalizeProductWarranty(options.body,{previous:fixture.product})
  Object.assign(fixture.product,clone(options.body),terms,{id:productId});return {id:productId}
 }
 if(path==='/api/account/orders/'+orderId)return {order:clone(fixture.order),items:clone(fixture.items),shipping:null}
 if(path==='/api/product-reviews')return {total:0,averageRating:0}
 if(path==='/api/checkout/quote')return {orderValue:100,requiredNow:100,paymentFee:0,lines:[]}
 if(path==='/api/checkout')return {order:{id:orderId,paymentMethod:'cash'}}
 throw Error('Unexpected fixture request '+path)
}
const show=async name=>{view.value=name;route.params.id=name==='details'?orderId:productId;route.path=name==='add'?'/dashboard/products/add':name==='edit'?'/dashboard/products/edit/'+productId:name==='product'?'/products/warranty-fixture':name==='checkout'?'/checkout':'/account/orders'+(name==='details'?'/'+orderId:'');route.query={};generation.value++;await nextTick()}
const appearance=()=>{document.documentElement.lang=i18n.global.locale.value;document.documentElement.dir=i18n.global.locale.value==='ar'?'rtl':'ltr';document.documentElement.classList.toggle('dark',theme.value==='dark'||theme.value==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)}
watch([theme,i18n.global.locale],appearance);matchMedia('(prefers-color-scheme: dark)').addEventListener('change',appearance)
Object.assign(globalThis,{ref,shallowRef,reactive,computed,onMounted,onBeforeUnmount,watch,watchEffect,nextTick,resolveComponent,definePageMeta(){},useHead(){},useUiLocale,useNuxtApp:()=>({$i18n:i18n.global}),useI18n:()=>i18n.global,useUiRoute:()=>route,useSupabaseClient:()=>supabase,useSupabaseUser:()=>user,
 useAdminAccess:()=>({hasPermission:key=>fixture.permissions===null||fixture.permissions.includes(key)}),useAdminLogs:()=>({getAdminAuthHeaders:async()=>({authorization:'Bearer local-fixture-token'}),recordAdminLog:async log=>fixture.logs.push(clone(log))}),
 useDashboardCache:()=>({getSnapshot:()=>null,invalidate(){},isFresh:()=>false,setSnapshot(){}}),useNuxtData:()=>({data:ref({mode:'built_in'})}),useDashboardLayout:()=>({dashboardLayout:ref('standard')}),
 useAsyncData:async(_key,loader)=>({data:ref(await loader()),pending:ref(false),error:ref(null),refresh:async()=>{}}),useSiteContent:()=>({data:ref({settings:{payment_cash_enabled:true}})}),useFetch:async()=>({data:ref({card:{available:false}})}),
 useSupportClient:()=>({request:fetcher,errorText:(e,f)=>e.message||f}),useShipmentUpdates(){},useReorder:()=>({addOrderToCart:async()=>{fixture.reorders++;return {message:'Products added to cart.'}}}),useStoreAnalytics:()=>({trackEvent(){}}),useUiNavigation:()=>({uiNavigateTo:async path=>{fixture.navigation=path}}),
 useCategoryLocale:()=>({categoryName:item=>item.name}),useProductEngagement(){},usePageSeo(){},useRuntimeConfig:()=>({public:{siteUrl:'https://fixture.example.invalid'}}),createError:error=>error,$fetch:fetcher,
 useCart:()=>({items:cartItems,cartId:ref('55555555-5555-4555-8555-555555555555'),itemCount:computed(()=>cartItems.value.length),subtotal:computed(()=>cartItems.value.reduce((s,i)=>s+i.price*i.quantity,0)),isEmpty:computed(()=>!cartItems.value.length),appliedCoupon:ref(null),addItem(){fixture.added++;return {message:'Product added to cart.'}},clearCart(){cartItems.value=[]},loadCart(){},setAppliedCoupon(){},resetCoupon(){}})})
const views={add:Add,edit:Edit,details:Details,orders:Orders,product:Product,checkout:Checkout}
const app=createApp({render:()=>h('div',{class:view.value==='add'||view.value==='edit'?'dashboard-modern p-4':'storefront p-4'},h(Suspense,null,{default:()=>h(views[view.value],{key:generation.value})}))})
app.use(i18n)
const ui=useUiLocale();app.config.globalProperties.$uiLabel=ui.uiLabel;app.config.globalProperties.$uiMessage=ui.uiMessage;app.config.globalProperties.$uiPluralSuffix=ui.uiPluralSuffix
for(const [name,component]of Object.entries({DashboardProductsWarrantyFields:WarrantyFields,AccountItemWarranty:ItemWarranty,AccountOrderProgress:Progress,AccountOrderCard:Card,DashboardProductsVariantsEditor:Variants,DashboardProductsSellingModeFields:SellingMode,DashboardPageIntro:PageIntro}))app.component(name,component)
for(const name of ['DashboardSeoFields','DashboardMediaUploadField','DashboardProductsSpecificationEditor','LayoutPageLoading','PaymentProofUpload','ProductReviews','CardsProductCard'])app.component(name,{render(){return null}})
app.component('Icon',{render(){return h('span',{'aria-hidden':'true'},'•')}})
app.component('NuxtLinkLocale',{props:['to'],setup(props,{slots}){return()=>h('a',{href:typeof props.to==='string'?props.to:props.to.path,onClick:event=>{event.preventDefault();const path=typeof props.to==='string'?props.to:props.to.path;if(path.startsWith('/account/orders/'))show('details');else if(path==='/account/orders')show('orders')}},slots.default?.())}})
app.mount('#app');appearance();window.warrantyTest={fixture,show,theme,locale:i18n.global.locale,appearance,nextTick,cartItems}
`)
await build({ entryPoints: [join(dir, 'entry.js')], bundle: true, outfile: join(dir, 'bundle.js'), alias: { '~': join(base, 'app') }, nodePaths: [join(base, 'node_modules')], define: { 'process.env.NODE_ENV': '"test"', 'import.meta.client': 'true', '__VUE_OPTIONS_API__': 'true', '__VUE_PROD_DEVTOOLS__': 'false', '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': 'false' } })
const css = (await Promise.all((await readdir(join(base, '.output/public/_nuxt'))).filter(file => file.endsWith('.css')).map(file => readFile(join(base, '.output/public/_nuxt', file), 'utf8')))).join('\n') + componentCss
const server = createServer(async (request, response) => {
  response.setHeader('content-type', request.url === '/bundle.js' ? 'text/javascript' : 'text/html')
  response.end(request.url === '/bundle.js' ? await readFile(join(dir, 'bundle.js')) : `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body class="bg-slate-100"><div id="app"></div><script src="/bundle.js"></script></body></html>`)
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const url = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch({ executablePath: process.env.WARRANTY_REVIEW_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Africa/Cairo' })
const page = await context.newPage()
const errors = [], external = []
let assertions = 0, screens = 0
const check = (condition, message) => { assert.ok(condition, message); assertions++ }
const contrast = ({ fg, bg }) => {
  const luminance = value => {
    const channels = value.map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  }
  return (Math.max(luminance(fg), luminance(bg)) + 0.05) / (Math.min(luminance(fg), luminance(bg)) + 0.05)
}
const colorsOf = (locator, section = false) => locator.evaluate((node, section) => {
  const canvas = document.createElement('canvas'), context = canvas.getContext('2d', { willReadFrequently: true })
  const rgb = value => { context.fillStyle = value; context.fillRect(0, 0, 1, 1); return Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3) }
  return { fg: rgb(getComputedStyle(node).color), bg: rgb(getComputedStyle(section ? node.closest('section') : node).backgroundColor) }
}, section)
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()) })
await page.route('**/*', route => route.request().url().startsWith(url) ? route.continue() : (external.push(route.request().url()), route.abort()))
const show = async view => { await page.evaluate(view => window.warrantyTest.show(view), view); await page.waitForTimeout(100) }
const labels = Object.fromEntries(await Promise.all(['en', 'ar'].map(async language => [language, JSON.parse(await readFile(join(base, 'i18n/locales/' + language + '.json'), 'utf8'))])))
try {
  await page.goto(url)
  await page.locator('[data-warranty-status]').waitFor()
  for (const language of ['en', 'ar']) for (const width of [1440, 390]) for (const theme of ['light', 'dark', 'system']) {
    await page.setViewportSize({ width, height: 1000 })
    await page.emulateMedia({ colorScheme: theme === 'light' ? 'light' : 'dark' })
    await page.evaluate(({ language, theme }) => { window.warrantyTest.locale.value = language; window.warrantyTest.theme.value = theme; window.warrantyTest.appearance() }, { language, theme })
    for (const view of ['add', 'edit', 'details', 'orders', 'product', 'checkout']) {
      await show(view)
      const text = await page.locator('body').innerText()
      check(await page.locator('html').getAttribute('dir') === (language === 'ar' ? 'rtl' : 'ltr'), 'EN/AR direction')
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow: ' + view)
      check(!text.includes('warranty.'), 'Warranty labels resolve')
      if (view === 'add' || view === 'edit') {
        check(await page.locator('[data-warranty-status]').inputValue() === (view === 'add' ? 'unknown' : 'included'), 'Create/edit default provenance')
        check(await page.locator('.warranty-fields').innerText().then(text => text.includes(labels[language].warranty.title)), 'Translated warranty editor')
        const colors = await colorsOf(page.locator('[data-warranty-status]'))
        check(contrast(colors) >= 4.5, 'Warranty input theme contrast')
        check((colors.fg[0] > colors.bg[0]) === (theme !== 'light'), 'Warranty uses the existing theme palette')
      }
      if (view === 'details') {
        const rows = await page.locator('[data-item-warranty]').allTextContents()
        check(rows.length === 4, 'Every purchased item has warranty information')
        check(rows[0].includes(labels[language].warranty.months.replace('{value}', '12')), 'Purchased months rendered')
        check(rows[1].includes(labels[language].warranty.years.replace('{value}', '3')), 'Purchased years rendered')
        check(rows[2].includes(labels[language].warranty.none), 'Explicit none rendered')
        check(rows[3].includes(labels[language].warranty.unavailable), 'Historical unknown rendered')
        check(!/valid until|expiry|expires|submit warranty claim|انتهاء|مطالبة الضمان/i.test(rows.join(' ')), 'No invented expiry or claim')
        check(await page.locator('section[aria-labelledby=order-progress-title]').count() === 1, 'Existing order/PDC progress remains')
        const colors = await colorsOf(page.locator('[data-item-warranty] dd').first(), true)
        check(contrast(colors) >= 4.5, 'Warranty detail theme contrast')
      }
      await page.screenshot({ path: join(dir, language + '-' + width + '-' + theme + '-' + view + '.png'), fullPage: true, animations: 'disabled' }); screens++
    }
  }
  await page.evaluate(() => { window.warrantyTest.locale.value = 'en'; window.warrantyTest.theme.value = 'light' })
  await show('add')
  await page.getByPlaceholder(labels.en.common.productTitle, { exact: true }).fill('Created warranty fixture')
  await page.getByPlaceholder(labels.en.common.price, { exact: true }).fill('100')
  await page.locator('select').filter({ has: page.locator('option[value="44444444-4444-4444-8444-444444444444"]') }).selectOption('44444444-4444-4444-8444-444444444444')
  await page.locator('[data-warranty-status]').selectOption('included')
  await page.locator('[data-warranty-duration]').fill('12')
  await page.getByRole('button', { name: labels.en.common.createProduct, exact: true }).click()
  await page.waitForTimeout(100)
  check(await page.evaluate(() => window.warrantyTest.fixture.product.warranty_duration_value) === 12, 'Create saves structured duration')
  check(await page.evaluate(() => window.warrantyTest.fixture.logs.at(-1)?.metadata.warranty.warranty_duration_value) === 12, 'Create audit includes warranty')
  await show('edit')
  check(await page.locator('[data-warranty-duration]').inputValue() === '12', 'Reload restores created duration')
  await page.locator('[data-warranty-duration]').fill('24')
  await page.getByRole('button', { name: labels.en.common.saveChanges, exact: true }).click()
  await page.waitForTimeout(100)
  check(await page.evaluate(() => window.warrantyTest.fixture.product.warranty_duration_value) === 24, 'Edit saves duration')
  check(await page.evaluate(() => window.warrantyTest.fixture.logs.at(-1)?.metadata.warranty_before.warranty_duration_value) === 12, 'Edit audit records prior duration')
  check(await page.evaluate(() => window.warrantyTest.fixture.logs.at(-1)?.metadata.warranty_after.warranty_duration_value) === 24, 'Edit audit records new duration')
  await show('edit')
  check(await page.locator('[data-warranty-duration]').inputValue() === '24', 'Saved edit reloads')
  await show('details')
  check((await page.locator('[data-item-warranty]').first().innerText()).includes('12 months'), 'Old purchase reads snapshot after catalog change')
  await show('edit')
  await page.locator('[data-warranty-unit]').selectOption('years')
  await page.locator('[data-warranty-duration]').fill('3')
  await page.getByRole('button', { name: labels.en.common.saveChanges, exact: true }).click()
  await show('edit')
  check(await page.locator('[data-warranty-unit]').inputValue() === 'years', 'Year configuration reloads')
  await page.locator('[data-warranty-status]').selectOption('none')
  check(await page.locator('[data-warranty-duration]').count() === 0, 'No-warranty clears duration fields')
  await page.getByRole('button', { name: labels.en.common.saveChanges, exact: true }).click()
  check(await page.evaluate(() => window.warrantyTest.fixture.product.warranty_duration_value) === null, 'No-warranty persists without stale duration')
  await show('details')
  check((await page.locator('[data-item-warranty]').first().innerText()).includes('12 months'), 'Removal keeps purchased display')
  await page.getByRole('button', { name: labels.en.common.orderAgain, exact: true }).click()
  check(await page.evaluate(() => window.warrantyTest.fixture.reorders) === 1, 'Existing Order again action works')
  await page.evaluate(() => { window.warrantyTest.fixture.product.is_serialized = false })
  await show('edit')
  check(await page.locator('[data-warranty-status]').count() === 1, 'Legacy aggregate-stock product supports warranty')
  await page.evaluate(() => { window.warrantyTest.fixture.permissions = ['products.view'] })
  check(await page.locator('[data-warranty-status]').isDisabled(), 'Viewer cannot edit warranty controls')
  await page.evaluate(() => { window.warrantyTest.fixture.permissions = null; window.warrantyTest.fixture.product.stock_quantity = 5 })
  await show('product')
  check((await page.locator('body').innerText()).includes('Legacy descriptive terms'), 'Existing descriptive warranty specification remains')
  await page.getByRole('button', { name: /^Add to cart$/i }).click()
  check(await page.evaluate(() => window.warrantyTest.fixture.added) === 1, 'Existing product add-to-cart works')
  await show('checkout')
  await page.getByRole('button', { name: labels.en.common.continueToPayment, exact: true }).click()
  await page.waitForTimeout(100)
  await page.getByRole('button', { name: labels.en.common.confirmCheckout, exact: true }).click()
  await page.waitForTimeout(100)
  const submitted = await page.evaluate(() => window.warrantyTest.fixture.requests.find(request => request.path === '/api/checkout'))
  check(!!submitted, 'Existing checkout submits')
  check(!JSON.stringify(submitted.body).includes('warranty_'), 'Browser checkout submits no authoritative warranty values')
  check(await page.evaluate(() => window.warrantyTest.fixture.navigation.startsWith('/checkout/summary/')), 'Checkout confirmation navigation preserved')
  await page.emulateMedia({ colorScheme: 'light' })
  await page.evaluate(() => { window.warrantyTest.theme.value = 'system'; window.warrantyTest.appearance() })
  check(await page.evaluate(() => !document.documentElement.classList.contains('dark')), 'System follows OS light')
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.waitForTimeout(100)
  check(await page.evaluate(() => document.documentElement.classList.contains('dark')), 'System follows OS dark')
  check(errors.length === 0, 'No browser errors/warnings: ' + errors.join('; '))
  check(external.length === 0, 'No external requests: ' + external.join('; '))
  const report = { assertions, screenshots: screens, errors, external, fixtures: 'Actual Vue pages/components and built CSS; mocked browser Auth/Supabase/API; SQL/HTTP tested separately.' }
  await writeFile(join(dir, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report))
} catch (error) {
  console.error(JSON.stringify({ errors, external, assertions, screenshots: screens }))
  await writeFile(join(dir, 'failure.html'), await page.content())
  await page.screenshot({ path: join(dir, 'failure.png'), fullPage: true })
  throw error
} finally { await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
