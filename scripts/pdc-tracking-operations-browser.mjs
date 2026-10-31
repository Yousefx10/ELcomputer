// Current actual Dashboard/My Account/Settings components, owned fixtures only.
import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises'
import {createServer} from 'node:http'
import {resolve,join,dirname} from 'node:path'
import {pathToFileURL} from 'node:url'
import {parse,compileScript} from '@vue/compiler-sfc'
import {build} from 'esbuild'
const {chromium}=await import(pathToFileURL(process.env.PDC_REVIEW_PLAYWRIGHT).href),base=resolve(new URL('..',import.meta.url).pathname),dir=process.env.PDC_REVIEW_ARTIFACTS
assert.ok(dir);await mkdir(dir,{recursive:true})
const files={Dialog:'app/components/dashboard/OrderDetailsDialog.vue',Account:'app/pages/account/orders/[id].vue',Progress:'app/components/account/OrderProgress.vue',Cod:'app/components/payment/CodStatus.vue',Card:'app/components/payment/OrderStatus.vue',Settings:'app/components/dashboard/commerce/ShippingTab.vue'}
const tags=[...new Set((await Promise.all(Object.values(files).map(f=>readFile(join(base,f),'utf8')))).flatMap(s=>[...s.matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)].map(m=>m[1])))].filter(x=>!['Teleport','Transition','Suspense','Icon','NuxtLinkLocale','AccountOrderProgress','PaymentCodStatus','PaymentOrderStatus'].includes(x))
const entry=`
import {createApp,h,Suspense,ref,shallowRef,reactive,computed,watch,onMounted,onBeforeUnmount,nextTick,onScopeDispose} from '${base}/node_modules/vue/dist/vue.esm-bundler.js'
import {createI18n} from '${base}/node_modules/vue-i18n/dist/vue-i18n.mjs'
import {useUiLocale} from '${base}/app/composables/useUiLocale.js'
import {useShipmentUpdates} from '${base}/app/composables/useShipmentUpdates.js'
import en from '${base}/i18n/locales/en.json';import ar from '${base}/i18n/locales/ar.json'
${Object.entries(files).map(([k,v])=>`import ${k} from '${base}/${v}'`).join('\n')}
const i18n=createI18n({legacy:false,locale:'en',fallbackLocale:'en',messages:{en,ar},missingWarn:false,fallbackWarn:false}),view=ref('account'),scenario=ref('active'),version=ref(0),requests=[],callbacks=[],route=reactive({params:{id:'00000000-0000-4000-8000-000000000001'}})
let broadcast,authChanged,reads=0,invalid=false
const session={user:{id:'owned-customer'},access_token:'LOCAL-TOKEN'}
const supabase={auth:{getSession:async()=>({data:{session}}),onAuthStateChange(fn){authChanged=fn;return {data:{subscription:{unsubscribe(){}}}}}},realtime:{setAuth:async()=>{}},channel(){return {on(type,filter,fn){broadcast=fn;return this},subscribe(){return this}}},removeChannel:async()=>{},from(){const q={select(){return q},order(){return q},ilike(){return q},then(ok){return Promise.resolve({data:[],error:null}).then(ok)}};return q}}
const order=()=>({id:route.params.id,order_number:'LOCAL-TRACKING',status:'ready_to_deliver',payment_status:'pending',payment_method:scenario.value==='card'?'card':'cash',amount_paid:0,paid_at:null,customer_payment:{status:'pending',verified:false,recovery:'review'},total_amount:187.25,subtotal_amount:137.25,currency:'EGP',created_at:'2026-10-01T08:00:00Z',packing_completed_at:'2026-10-01T10:00:00Z',first_name:'Owned fixture',street_address:'Owned street',city:'Owned city',governorate:'Cairo',shipping_method:'shipping',erp_owner:'built_in',is_preorder:false,stock_fulfillment_state:'untracked'})
const events=()=>[{id:'picked',provider_status_id:12,provider_status_name:'Picked Up',normalized_state:'picked_up',state:'picked_up',status_date:'2026-10-02T08:00:00Z',status_at:'2026-10-02T08:00:00Z',source:'webhook'},{id:'ofd',provider_status_id:4,provider_status_name:'Out For Delivery',normalized_state:'out_for_delivery',state:'out_for_delivery',status_date:'2026-10-03T08:00:00Z',status_at:'2026-10-03T08:00:00Z',source:'reconciliation'}]
const shipping=()=>{
 if(scenario.value==='none')return null
 if(scenario.value==='unavailable')return {provider:'pdc',unavailable:true,has_update:false,events:[]}
 const terminal=['delivered','card'].includes(scenario.value),pending=scenario.value==='pending',list=pending?[]:events()
 if(terminal)list.push({id:'delivered',provider_status_id:5,provider_status_name:'Delivered',state:'delivered',normalized_state:'delivered',status_date:'2026-10-04T08:00:00Z',status_at:'2026-10-04T08:00:00Z',source:'webhook'})
 return {id:'10000000-0000-4000-8000-000000000001',provider:'pdc',awb:'FIXTURE-'+('X'.repeat(92)),state:'ready',label_ready:false,booking_verified:true,booked_at:'2026-10-01T11:00:00Z',has_update:!pending,current_state:pending?'unknown':terminal?'delivered':'out_for_delivery',normalized_state:pending?'unknown':terminal?'delivered':'out_for_delivery',status_at:pending?null:list.at(-1).status_at,provider_status_at:pending?null:list.at(-1).status_at,provider_status_name:pending?null:list.at(-1).provider_status_name,latest_update_at:pending?null:'2026-10-04T09:00:00Z',stale:scenario.value==='stale',tracking_requests_enabled:true,tracking:{booking_verified:true,manual_due:!terminal&&scenario.value!=='throttled',last_success_at:pending?null:'2026-10-04T09:00:00Z',latest_update_at:pending?null:'2026-10-04T09:00:00Z',stale:scenario.value==='stale',error_code:scenario.value==='stale'?'PROVIDER_UNAVAILABLE':null},events:list}
}
const detail=()=>({order:order(),items:[],customer:null,preorderPayments:[],codCash:null,shipping:shipping()})
const pdc={display_name:'PDC',base_url:'https://clientsapi.pdc-eg.com/api/ClientUsers/V6/',api_mode:'production',status_timezone:'Africa/Cairo',company_id:'123456',product_id:64,default_weight_kg:1,shipment_type_id:1,label_template_id:1,allow_open_shipment:false,all_must_valid:true,is_enabled:true,auto_create_labels:false,cod_enabled:true,access_token_configured:true,webhook_secret_configured:true,encryption_ready:true,live_requests_enabled:false,cities_cache:[],products_cache:[],tracking_policy:{enabled:false,interval_seconds:900,max_requests_minute:2,max_requests_hour:20,max_requests_day:100,batch_size:3,concurrency:1,max_failures:8,max_age_days:90,stale_seconds:3600},tracking_requests_enabled:false}
const request=async(path,options={})=>{
 requests.push({path,method:options.method||'GET',retry:options.retry});if(path.startsWith('/api/account/orders/')){reads++;return detail()}
 if(path.startsWith('/api/admin-orders/')){const d=detail();if(d.shipping){d.shipping.events=d.shipping.events.map(x=>({...x,reason_name:'PRIVATE-DIAGNOSTIC-CANARY'}))}return d}
 if(path.endsWith('/refresh')){scenario.value='throttled';return {checked:1,failed:0}}
 if(path==='/api/admin-shipping/settings'){if(options.method==='PATCH')Object.assign(pdc,options.body);return {settings:structuredClone(pdc),mappings:[]}}
 throw Error('Unexpected fixture request '+path)
}
const scope=()=>({accountId:'owned-customer',isCurrent:()=>!invalid,onInvalidate:fn=>callbacks.push(fn),request,headers:async()=>({authorization:'Bearer LOCAL-TOKEN'})})
Object.assign(globalThis,{ref,shallowRef,reactive,computed,watch,onMounted,onBeforeUnmount,onScopeDispose,nextTick,useUiLocale,useShipmentUpdates,useCustomerScope:scope,useNuxtApp:()=>({$i18n:i18n.global}),useI18n:()=>i18n.global,useUiRoute:()=>route,useRoute:()=>route,useNuxtData:()=>({data:ref(null)}),useSupabaseClient:()=>supabase,useSiteContent:async()=>({data:ref({site_name:'Owned fixture store'})}),useSupportClient:()=>({request,errorText:(e,f)=>f}),useReorder:()=>({addOrderToCart:async()=>({message:''})}),useHead(){},definePageMeta(){},useAdminLogs:()=>({recordAdminLog:async()=>{}}),useAdminAccess:()=>({hasPermission:()=>true,loadAdminAccess:async()=>{}}),$fetch:request})
const app=createApp({render:()=>h(Suspense,null,{default:()=>h('main',{key:version.value,class:'mx-auto max-w-6xl p-4'},[view.value==='staff'?h(Dialog,{open:true,orderId:route.params.id}):view.value==='settings'?h(Settings):h(Account)])})});app.use(i18n)
app.component('Icon',{render(){return h('span',{'aria-hidden':'true'})}});app.component('NuxtLinkLocale',{props:['to'],setup(p,{slots}){return()=>h('a',{href:'#'},slots.default?.())}})
app.component('AccountOrderProgress',Progress);app.component('PaymentCodStatus',Cod);app.component('PaymentOrderStatus',Card)
for(const name of ${JSON.stringify(tags)})app.component(name,{render(){return null}})
const ui=useUiLocale();Object.assign(app.config.globalProperties,{$uiLabel:ui.uiLabel,$uiMessage:ui.uiMessage,$uiPluralSuffix:ui.uiPluralSuffix});app.mount('#app')
window.trackingFixture={view,scenario,requests,locale:i18n.global.locale,messages:{en,ar},nextTick,change:(v,s)=>{view.value=v;scenario.value=s;version.value++},broadcast:()=>broadcast?.(),invalidate:()=>{invalid=true;callbacks.forEach(fn=>fn())},reads:()=>reads,pdc}
`
const bundle=await build({stdin:{contents:entry,resolveDir:base,sourcefile:'tracking-ui.js'},bundle:true,write:false,format:'iife',platform:'browser',alias:{'~':join(base,'app')},define:{'process.env.NODE_ENV':'"test"',__VUE_OPTIONS_API__:'true',__VUE_PROD_DEVTOOLS__:'false',__VUE_PROD_HYDRATION_MISMATCH_DETAILS__:'false'},plugins:[{name:'actual-vue',setup(b){b.onResolve({filter:/pdf\.worker\.min\.mjs\?url$/},()=>({path:'fixture-worker',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export default "/unused-worker.mjs"',loader:'js'}));b.onLoad({filter:/\.vue$/},async({path})=>({contents:compileScript(parse(await readFile(path,'utf8'),{filename:path}).descriptor,{id:path,inlineTemplate:true}).content,resolveDir:dirname(path),loader:'js'}))}}]})
const css=(await Promise.all((await readdir(join(base,'.output/public/_nuxt'))).filter(x=>x.endsWith('.css')).map(x=>readFile(join(base,'.output/public/_nuxt',x),'utf8')))).join('\n')
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'application/javascript':'text/html');res.end(req.url==='/fixture.js'?bundle.outputFiles[0].text:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><div id="app"></div><script src="/fixture.js"></script></body></html>')});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),page=await browser.newPage(),errors=[],external=[];let assertions=0
const check=(v,label)=>{assert.ok(v,label);assertions++};page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>{if(!r.request().url().startsWith(origin)){external.push(r.request().url());return r.abort()}return r.continue()})
try{
 await page.goto(origin)
 for(const locale of ['en','ar'])for(const width of [1440,390])for(const theme of ['light','dark','system']){
  await page.setViewportSize({width,height:1000});await page.emulateMedia({colorScheme:theme==='light'?'light':'dark'})
  await page.evaluate(({locale,theme})=>{const f=window.trackingFixture;f.locale.value=locale;document.documentElement.dir=locale==='ar'?'rtl':'ltr';document.documentElement.lang=locale;document.documentElement.classList.toggle('dark',theme!=='light')},{locale,theme})
  const copy=await page.evaluate(locale=>window.trackingFixture.messages[locale],locale)
  for(const scenario of ['none','pending','active','delivered','stale','unavailable','card']){
   await page.evaluate(s=>window.trackingFixture.change('account',s),scenario);await page.locator('#order-progress-title').waitFor();const text=await page.locator('body').innerText()
   check(text.includes(copy.shipment.orderPlaced),'actual placed timeline')
   check(!text.includes('PRIVATE-DIAGNOSTIC-CANARY'),'customer diagnostics hidden')
   check(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),'responsive account')
   if(!['none','unavailable'].includes(scenario))check(text.includes(copy.shipment.booked),'verified booked milestone')
   if(['delivered','card'].includes(scenario))check(text.includes(copy.shipment.states.delivered),'actual delivered milestone')
   if(scenario==='delivered')check(text.includes(copy.codCheckout.status.awaiting),'delivery never marks COD collected')
   if(scenario==='card')check(text.includes(copy.paymentStatus.title.pending),'delivery never marks CARD paid')
   if(scenario==='stale')check(text.includes(copy.shipment.stale),'honest stale state')
   if(scenario==='unavailable')check(text.includes(copy.shipment.unavailable),'honest unavailable state')
  }
  await page.evaluate(()=>window.trackingFixture.change('staff','stale'));await page.locator('[data-shipment-tracking]').waitFor();await page.locator('[data-shipment-tracking] summary').click();check((await page.locator('body').innerText()).includes('PRIVATE-DIAGNOSTIC-CANARY'),'authorized raw evidence');check(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),'responsive staff');check(await page.locator('[data-shipment-tracking]').evaluate(e=>{const card=e.closest('section');return card.scrollWidth<=card.clientWidth+1}),'bounded AWB fits staff card')
  const refresh=page.getByRole('button',{name:copy.shipment.reconcile,exact:true});await refresh.click();await page.waitForTimeout(40);check(await refresh.isDisabled(),'manual refresh throttled after success');check(await page.evaluate(()=>window.trackingFixture.requests.filter(x=>x.path.endsWith('/refresh')).every(x=>x.retry===0)),'manual provider refresh no HTTP resubmit')
  await page.screenshot({path:join(dir,locale+'-'+width+'-'+theme+'-staff.png'),fullPage:true})
 }
 await page.evaluate(()=>window.trackingFixture.change('settings','active'));await page.locator('[data-tracking-policy]').waitFor();check(await page.locator('[data-tracking-policy] input').count()===9,'bounded editable policy controls');check(await page.locator('[data-tracking-policy] input[type=checkbox]').count()===0,'no UI activation toggle')
 await page.evaluate(()=>window.trackingFixture.change('account','active'));await page.locator('#order-progress-title').waitFor();const before=await page.evaluate(()=>window.trackingFixture.reads());await page.getByRole('button',{name:await page.evaluate(()=>window.trackingFixture.messages[window.trackingFixture.locale.value].shipment.refresh),exact:true}).click();await page.waitForTimeout(50);check(await page.evaluate(()=>window.trackingFixture.reads())>before,'customer refresh reads owned stored endpoint');check(await page.evaluate(()=>window.trackingFixture.requests.filter(x=>x.path.startsWith('/api/account')).every(x=>x.method==='GET')),'customer reads never call provider endpoints')
 await page.evaluate(()=>window.trackingFixture.invalidate());const after=await page.evaluate(()=>window.trackingFixture.reads());await page.evaluate(()=>window.trackingFixture.broadcast());await page.waitForTimeout(350);check(await page.evaluate(()=>window.trackingFixture.reads())===after,'revoked scope cannot refresh private timeline')
 check(errors.length===0,JSON.stringify(errors));check(external.length===0,'zero external requests')
 console.log(JSON.stringify({result:'PDC_TRACKING_OPERATIONS_BROWSER_PASS',assertions,scenarios:7,locales:['en','ar'],widths:[1440,390],themes:['light','dark','system'],provider_calls:0,real_orders:0,external_requests:0}))
}catch(error){await writeFile(join(dir,'failure.json'),JSON.stringify({error:error.message,errors,external,body:await page.locator('body').innerText(),requests:await page.evaluate(()=>window.trackingFixture.requests)},null,2));await page.screenshot({path:join(dir,'failure.png'),fullPage:true});throw error}finally{await browser.close();await new Promise(r=>server.close(r))}
