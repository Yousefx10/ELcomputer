// Local, isolated browser acceptance. No real customer/admin/provider credentials.
// Set PDC_REVIEW_PLAYWRIGHT to an installed Playwright entry and optionally PDC_REVIEW_CHROME.
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { createServer } from 'node:http'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parse, compileScript } from '@vue/compiler-sfc'
import { build } from 'esbuild'
const { chromium } = await import(process.env.PDC_REVIEW_PLAYWRIGHT ? pathToFileURL(process.env.PDC_REVIEW_PLAYWRIGHT).href : 'playwright')
const base = resolve(new URL('..', import.meta.url).pathname)
const dir = process.env.PDC_REVIEW_ARTIFACTS || '/tmp/elcomputer-pdc-audit/browser'
await mkdir(dir, { recursive: true })
for (const [name, file] of Object.entries({ Details: 'app/pages/account/orders/[id].vue', Progress: 'app/components/account/OrderProgress.vue', Card: 'app/components/account/OrderCard.vue', Orders: 'app/pages/account/orders/index.vue', Shipping: 'app/components/dashboard/commerce/ShippingTab.vue' })) {
  const { descriptor } = parse(await readFile(join(base, file), 'utf8'))
  await writeFile(join(dir, name + '.js'), compileScript(descriptor, { id: name, inlineTemplate: true }).content)
}
await writeFile(join(dir, 'entry.js'), `
import { createApp, h, ref, reactive, computed, onMounted, onBeforeUnmount, watch, nextTick } from '${base}/node_modules/vue/dist/vue.esm-bundler.js'
import { createI18n } from '${base}/node_modules/vue-i18n/dist/vue-i18n.mjs'
import { useUiLocale } from '${base}/app/composables/useUiLocale.js'
import { useShipmentUpdates } from '${base}/app/composables/useShipmentUpdates.js'
import en from '${base}/i18n/locales/en.json'
import ar from '${base}/i18n/locales/ar.json'
import Details from './Details.js'
import Progress from './Progress.js'
import Card from './Card.js'
import Orders from './Orders.js'
import Shipping from './Shipping.js'
const i18n=createI18n({legacy:false,locale:'en',fallbackLocale:'en',messages:{en,ar},missingWarn:true,fallbackWarn:true})
const view=ref('orders'), fixture=reactive({scenario:'out_for_delivery',requests:[],broadcast:null,realtimeSubscriptions:0,removed:0,authCallback:null,refreshFail:false})
const route=reactive({params:{id:'00000000-0000-4000-8000-000000000001'},query:{},path:'/account/orders'})
const user=ref({id:'fixture-owner'})
const order={id:route.params.id,order_number:'ORDER-FIXTURE',status:'processing',payment_status:'paid',paid_at:'2026-10-01T09:00:00Z',packing_completed_at:'2026-10-02T10:00:00Z',created_at:'2026-10-01T08:00:00Z',currency:'EGP',payment_method:'cash',street_address:'Fixture Street',city:'Cairo',governorate:'Cairo',total_amount:100,subtotal_amount:100,shipping_review_status:'approved'}
const courierEvents=[{id:'picked',state:'picked_up',status_at:'2026-10-03T08:00:00Z',source:'webhook'}, {id:'hub',state:'arrived_at_hub',status_at:'2026-10-04T16:18:00Z',source:'webhook'}, {id:'ofd',state:'out_for_delivery',status_at:'2026-10-05T07:42:00Z',source:'webhook'}]
const detail=()=>{
 const scenario=fixture.scenario
 let events=structuredClone(courierEvents)
 let current='out_for_delivery',reason=null
 if(scenario==='delivered'){events.push({id:'delivered',state:'delivered',status_at:'2026-10-05T10:00:00Z',source:'webhook'});current='delivered'}
 if(scenario==='exception'){events.push({id:'attempt',state:'delivery_attempted',reason_key:'shipment.reasons.r1',status_at:'2026-10-05T10:00:00Z',source:'webhook'});current='delivery_attempted';reason='shipment.reasons.r1'}
 if(scenario==='unknown'){events.push({id:'unknown',state:'unknown',status_at:'2026-10-05T10:00:00Z',source:'webhook'});current='unknown'}
 if(scenario==='out_of_order') events=[events[2],events[0],events[1]]
 if(scenario==='duplicate') events=structuredClone(courierEvents) // The API projection deduplicates the provider ledger.
 if(scenario==='snapshot') {events=[{id:'snapshot',state:'delivered',status_at:null,observed_at:'2026-10-05T10:00:00Z',source:'reconciliation'}];current='delivered'}
 const last=events.findLast(e=>e.state===current)
 return {order:{...order,...(scenario==='none'?{status:'pending_payment',payment_status:'pending',paid_at:null,packing_completed_at:null}:{})},items:[{id:'item-1',product_title:'Fixture keyboard',quantity:1,unit_price:100,line_total:100}],shipping:scenario==='none'?null:{provider:'pdc',awb:'EDC-FIXTURE',has_update:true,current_state:current,status_at:last.status_at,observed_at:last.observed_at,reason_key:reason,events}}
}
const pdc=reactive({display_name:'PDC',base_url:'https://clientsapi.pdc-eg.com/api/ClientUsers/V6/',api_mode:'production',status_timezone:'Africa/Cairo',company_id:'123456',product_id:64,origin_city_id:1,origin_address:'Fixture street',origin_phone:'01000000000',origin_contact_name:'Store',default_weight_kg:1,shipment_type_id:1,label_template_id:1,allow_open_shipment:false,all_must_valid:true,is_enabled:true,auto_create_labels:false,access_token_configured:true,webhook_secret_configured:true,encryption_ready:true,live_requests_enabled:true,city_mapping_count:382,pending_job_count:0,cities_cache:[],products_cache:[],cities_synced_at:null,products_synced_at:null})
const mappings=reactive([{provider_status_id:4,provider_label:'Out For Delivery',normalized_state:'out_for_delivery',provider_aliases:['Out For Delivery']},{provider_status_id:97,provider_label:'Received At Hub',normalized_state:'unknown',provider_aliases:['Received At Hub']}])
const channel=()=>({on(type,filter,callback){fixture.broadcast=callback;return this},subscribe(callback){fixture.realtimeSubscriptions++;callback('SUBSCRIBED');return this}})
const supabase={auth:{getSession:async()=>({data:{session:{access_token:'browser-only-auth-token'}}}),onAuthStateChange:callback=>{fixture.authCallback=callback;return {data:{subscription:{unsubscribe(){}}}}}},realtime:{setAuth:async()=>{}},channel,removeChannel:async()=>{fixture.removed++},from(table){return {select(){return this},eq(){return this},order(){return this},range(){return this},abortSignal(){return this},in(){return this},ilike(){return this},then(resolve){resolve({data:table==='customer_orders'?[{...order,status:'out_for_delivery'}]:[],count:table==='customer_orders'?1:0})}}}}
const fetcher=async(path,options={})=>{
 fixture.requests.push({path,method:options.method||'GET',body:options.body})
 if(path.startsWith('/api/account/orders/')){if(fixture.refreshFail)throw new Error('Fixture unavailable');return detail()}
 if(path==='/api/admin-shipping/settings'){
  if(options.method==='PATCH'){for(const [key,value]of Object.entries(options.body))if(!['access_token','webhook_secret'].includes(key))pdc[key]=value}
  return {settings:JSON.parse(JSON.stringify(pdc)),mappings:JSON.parse(JSON.stringify(mappings))}
 }
 if(path==='/api/admin-shipping/lookups'){
  if(options.body.action==='sync'){Object.assign(pdc,{cities_cache:[{id:1,name:'Cairo'},{id:2,name:'Giza'}],products_cache:[{id:64,name:'Fixture Service'}],cities_synced_at:'2026-10-05T10:00:00Z',products_synced_at:'2026-10-05T10:00:00Z'})}
  return {connected:true}
 }
 if(path==='/api/admin-shipping/mappings') {const found=mappings.find(m=>m.provider_status_id===options.body.provider_status_id);if(found)Object.assign(found,options.body);else mappings.push(options.body);return {saved:true}}
 throw new Error('Unexpected fixture request '+path)
}
Object.assign(globalThis,{ref,reactive,computed,onMounted,onBeforeUnmount,watch,useUiLocale,useShipmentUpdates,useNuxtApp:()=>({$i18n:i18n.global}),useI18n:()=>i18n.global,useUiRoute:()=>route,useRoute:()=>route,useSupabaseClient:()=>supabase,useSupabaseUser:()=>user,useSupportClient:()=>({request:fetcher,errorText:(error,fallback)=>fallback}),useReorder:()=>({addOrderToCart:async()=>({message:'Fixture added'})}),useAdminAccess:()=>({hasPermission:()=>true,loadAdminAccess:async()=>{}}),useAdminLogs:()=>({recordAdminLog:async()=>{}}),useHead(){},definePageMeta(){},$fetch:fetcher})
const app=createApp({render:()=>h('main',{class:'mx-auto max-w-6xl p-4', 'data-view':view.value},[h(view.value==='orders'?Orders:view.value==='settings'?Shipping:Details)])})
app.use(i18n)
app.component('Icon',{props:['name'],render(){return h('span',{'aria-hidden':'true'},'•')}})
app.component('PaymentProofUpload',{render(){return null}})
app.component('AccountOrderProgress',Progress);app.component('AccountOrderCard',Card)
app.component('NuxtLinkLocale',{props:['to'],setup(props,{slots}){return()=>h('a',{href:typeof props.to==='string'?props.to:props.to.path,onClick:event=>{event.preventDefault();const path=typeof props.to==='string'?props.to:props.to.path;route.path=path;route.query=typeof props.to==='object'?props.to.query||{}:{};view.value=/orders\\//.test(path)?'details':'orders'}},slots.default?.())}})
const ui=useUiLocale();app.config.globalProperties.$uiLabel=ui.uiLabel;app.config.globalProperties.$uiMessage=ui.uiMessage
app.mount('#app')
window.pdcTest={fixture,pdc,mappings,view,route,locale:i18n.global.locale,nextTick,detail}
`)
await build({ entryPoints: [join(dir, 'entry.js')], bundle: true, outfile: join(dir, 'bundle.js'), alias: { '~': join(base, 'app') }, nodePaths: [join(base, 'node_modules')], define: { 'process.env.NODE_ENV': '"test"', '__VUE_OPTIONS_API__': 'true', '__VUE_PROD_DEVTOOLS__': 'false', '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': 'false' } })
const files=await readdir(join(base,'.output/public/_nuxt'))
const styles=files.filter(f=>f.endsWith('.css'))
const css=(await Promise.all(styles.map(f=>readFile(join(base,'.output/public/_nuxt',f),'utf8')))).join('\n')
const server=createServer(async(req,res)=>{
 res.setHeader('content-type',req.url==='/bundle.js'?'text/javascript':'text/html')
 res.end(req.url==='/bundle.js'?await readFile(join(dir,'bundle.js')):`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="app"></div><script src="/bundle.js"></script></body></html>`)
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const url=`http://127.0.0.1:${server.address().port}`
const browser=await chromium.launch({executablePath:process.env.PDC_REVIEW_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Africa/Cairo'})
const page=await context.newPage()
const errors=[],external=[];let assertions=0,screens=0
page.on('pageerror',error=>errors.push(error.message))
page.on('console',message=>{if(['error','warning'].includes(message.type()))errors.push(message.text())})
await page.route('**/*',route=>{if(!route.request().url().startsWith(url)){external.push(route.request().url());return route.abort()}return route.continue()})
const check=(condition,message)=>{assert.ok(condition,message);assertions++}
const content=()=>page.locator('main').innerText()
const screenshot=async name=>{await page.evaluate(async()=>{scrollTo(0,0);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))});await page.screenshot({path:join(dir,name+'.png'),fullPage:true,animations:'disabled'});screens++}
const setScenario=async scenario=>{
 await page.evaluate(async value=>{window.pdcTest.fixture.scenario=value;window.pdcTest.fixture.broadcast?.();await window.pdcTest.nextTick()},scenario)
 await page.waitForTimeout(350)
}
try{
 await page.goto(url);await page.getByRole('heading',{name:'Orders',exact:true}).waitFor()
 check((await content()).includes('Out for Delivery'),'existing order status chip')
 await page.getByRole('link',{name:/View Order/i}).click();await page.getByRole('heading',{name:'ORDER-FIXTURE'}).waitFor()
 for(const locale of ['en','ar'])for(const width of [1440,390])for(const theme of ['light','dark','system']){
  await page.setViewportSize({width,height:1000});await page.emulateMedia({colorScheme:theme==='light'?'light':'dark'})
  await page.evaluate(({locale,theme})=>{window.pdcTest.locale.value=locale;document.documentElement.lang=locale;document.documentElement.dir=locale==='ar'?'rtl':'ltr';document.documentElement.classList.toggle('dark',theme==='dark'||theme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)}, {locale,theme})
  for(const scenario of ['none','out_for_delivery','delivered','exception','unknown','snapshot','duplicate','out_of_order']){
   await setScenario(scenario)
   const text=await content()
   check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow')
   check((await page.locator('html').getAttribute('dir'))===(locale==='ar'?'rtl':'ltr'),'document direction')
   check(!text.includes('shipment.')&&!text.includes('RAW_INTERNAL'),'translated/normalized customer labels')
   const times=await page.locator('section[aria-labelledby=order-progress-title] time').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('datetime')))
   check(times.every((value,index)=>index===0||new Date(times[index-1])<=new Date(value)),'chronological timeline')
   if(scenario==='none')check(times.length===1,'no fabricated payment/packing/courier')
   if(scenario==='snapshot')check(text.includes(locale==='en'?'Status checked:':'تم التحقق من الحالة:'),'observation time is labelled')
   if(scenario==='exception')check(text.includes(locale==='en'?'Recipient unavailable':'المستلم غير متواجد'),'translated exception reason')
   if(['duplicate','out_of_order'].includes(scenario))check(times.length===6,'no duplicate timeline entries')
   if(scenario==='out_for_delivery')check(times.includes('2026-10-05T07:42:00Z'),'provider event datetime')
   if(['out_for_delivery','exception','none'].includes(scenario))await screenshot([locale,width,theme,scenario].join('-'))
  }
 }
 await page.evaluate(()=>{window.pdcTest.locale.value='en';document.documentElement.dir='ltr';document.documentElement.classList.remove('dark')})
 await setScenario('out_for_delivery')
 await page.evaluate(()=>window.pdcTest.fixture.refreshFail=true)
 await page.getByRole('button',{name:'Refresh tracking',exact:true}).click()
 check((await content()).includes('EDC-FIXTURE'),'refresh failure retains previous shipment')
 await page.evaluate(()=>{window.pdcTest.fixture.refreshFail=false;window.pdcTest.view.value='settings'})
 await page.getByRole('heading',{name:/PDC API/i}).waitFor()
 check(await page.locator('#pdc-api-url').evaluate(node=>node.labels?.length===1),'associated label: base_url')
 check(await page.locator('#pdc-company-id').evaluate(node=>node.labels?.length===1),'associated label: company_id')
 check(await page.locator('#pdc-product').evaluate(node=>node.labels?.length===1),'associated label: product_id')
 check(await page.locator('#pdc-pickup-city').evaluate(node=>node.labels?.length===1),'associated label: origin_city_id')
 check(await page.locator('#pdc-pickup-contact').evaluate(node=>node.labels?.length===1),'associated label: origin_contact_name')
 check(await page.locator('#pdc-pickup-phone').evaluate(node=>node.labels?.length===1),'associated label: origin_phone')
 check(await page.locator('#pdc-pickup-address').evaluate(node=>node.labels?.length===1),'associated label: origin_address')
 check(await page.locator('#pdc-weight').evaluate(node=>node.labels?.length===1),'associated label: default_weight_kg')
 check(await page.locator('#pdc-shipment-type').evaluate(node=>node.labels?.length===1),'associated label: shipment_type_id')
 check(await page.locator('#pdc-label-template').evaluate(node=>node.labels?.length===1),'associated label: label_template_id')
 check(await page.locator('#pdc-access-token').evaluate(node=>node.labels?.length===1),'associated label: access_token')
 check(await page.locator('#pdc-webhook-secret').evaluate(node=>node.labels?.length===1),'associated label: webhook_secret')
 check(await page.locator('input[type=password]').first().inputValue()==='','saved token masked/absent')
 check(await page.locator('input[type=password]').nth(1).inputValue()==='','saved webhook secret masked/absent')
 check(!await page.locator('input').evaluateAll(nodes=>nodes.some(n=>n.value.includes('browser-only-auth-token'))),'auth token never in settings fields')
 await page.locator('input[type=password]').first().fill('typed-test-token')
 await page.locator('input[type=password]').nth(1).fill('typed-webhook-fixture-abcdefghijklmnopqrstuvwxyz')
 await page.getByRole('button',{name:/Save PDC settings/i}).click()
 await page.waitForTimeout(100)
 check(await page.locator('input[type=password]').first().inputValue()==='','token cleared after storage')
 check(await page.locator('input[type=password]').nth(1).inputValue()==='','secret cleared after storage')
 await page.getByRole('button',{name:'Test connection',exact:true}).click()
 await page.getByText('PDC connection checked.',{exact:true}).waitFor()
 await page.getByRole('button',{name:'Sync cities and products',exact:true}).click()
 await page.getByText('Cities and products synced.',{exact:true}).waitFor()
 check(await page.locator('#pdc-product').inputValue()==='64','configured product retained after lookup')
 check(await page.locator('#pdc-city-options option').count()===2,'city lookup displayed')
 await page.locator('summary').filter({hasText:'Courier status mappings'}).click()
 check((await content()).includes('Confirm status 97'),'ambiguity visible')
 await page.locator('details select').first().selectOption('delayed')
 await page.getByRole('button',{name:'Save mapping',exact:true}).first().click()
 await page.getByText('Courier mapping saved.',{exact:true}).waitFor()
 check(await page.evaluate(()=>window.pdcTest.mappings[0].normalized_state)==='delayed','dashboard mapping saved')
 for(const locale of ['en','ar'])for(const width of [1440,390])for(const theme of ['light','dark','system']){
  await page.setViewportSize({width,height:1000})
  await page.evaluate(({locale,theme})=>{window.pdcTest.locale.value=locale;document.documentElement.dir=locale==='ar'?'rtl':'ltr';document.documentElement.classList.toggle('dark',theme!=='light')},{locale,theme})
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'settings no overflow')
  await screenshot([locale,width,theme,'settings'].join('-'))
 }
 check(await page.evaluate(()=>window.pdcTest.fixture.removed)>0,'subscription removed on navigation')
 check(!(await page.evaluate(()=>window.pdcTest.fixture.requests)).some(r=>/SaveShipmentEx|ExportPDF|payments|checkout/.test(r.path)),'no shipment/payment API calls')
 check(errors.length===0,'no browser errors/warnings: '+errors.join('\n'))
 check(external.length===0,'no external network calls')
 console.log(JSON.stringify({assertions,screens,errors,externalRequests:external.length,scenarios:8,locales:['en','ar'],widths:[1440,390],themes:['light','dark','system'],authentication:'isolated fixtures only'},null,2))
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
