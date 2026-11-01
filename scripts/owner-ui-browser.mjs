// Current actual Dashboard/My Account/Settings components, owned fixtures only.
import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises'
import {createServer} from 'node:http'
import {resolve,join,dirname} from 'node:path'
import {pathToFileURL} from 'node:url'
import {parse,compileScript} from '@vue/compiler-sfc'
import {build} from 'esbuild'
const {chromium}=await import(pathToFileURL(process.env.OWNER_UI_REVIEW_PLAYWRIGHT).href),base=resolve(new URL('..',import.meta.url).pathname),dir=process.env.OWNER_UI_REVIEW_ARTIFACTS
assert.ok(dir);await mkdir(dir,{recursive:true})
const files={History:'app/components/account/HistoricalOrders.vue',Dialog:'app/components/dashboard/OrderDetailsDialog.vue',Account:'app/pages/account/orders/[id].vue',Progress:'app/components/account/OrderProgress.vue',Cod:'app/components/payment/CodStatus.vue',Card:'app/components/payment/OrderStatus.vue',Settings:'app/components/dashboard/commerce/ShippingTab.vue'}
const tags=[...new Set((await Promise.all(Object.values(files).map(f=>readFile(join(base,f),'utf8')))).flatMap(s=>[...s.matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)].map(m=>m[1])))].filter(x=>!['Teleport','Transition','Suspense','Icon','NuxtLinkLocale','AccountOrderProgress','PaymentCodStatus','PaymentOrderStatus'].includes(x))
const entry=`
import {createApp,h,Suspense,ref,shallowRef,reactive,computed,watch,onMounted,onBeforeUnmount,nextTick,onScopeDispose} from '${base}/node_modules/vue/dist/vue.esm-bundler.js'
import {createI18n} from '${base}/node_modules/vue-i18n/dist/vue-i18n.mjs'
import {useUiLocale} from '${base}/app/composables/useUiLocale.js'
import {useShipmentUpdates} from '${base}/app/composables/useShipmentUpdates.js'
import en from '${base}/i18n/locales/en.json';import ar from '${base}/i18n/locales/ar.json'
${Object.entries(files).map(([k,v])=>`import ${k} from '${base}/${v}'`).join('\n')}
const i18n=createI18n({legacy:false,locale:'en',fallbackLocale:'en',messages:{en,ar},missingWarn:false,fallbackWarn:false}),view=ref('account'),scenario=ref('active'),version=ref(0),requests=[],callbacks=[],route=reactive({params:{id:'00000000-0000-4000-8000-000000000001'}})
let broadcast,authChanged,reads=0,invalid=false;const deferred=[];let delayOrders=false;const dialogOpen=ref(true)
const session={user:{id:'owned-customer'},access_token:'LOCAL-TOKEN'}
const supabase={auth:{getSession:async()=>({data:{session}}),onAuthStateChange(fn){authChanged=fn;return {data:{subscription:{unsubscribe(){}}}}}},realtime:{setAuth:async()=>{}},channel(){return {on(type,filter,fn){broadcast=fn;return this},subscribe(){return this}}},removeChannel:async()=>{},from(){const q={select(){return q},order(){return q},ilike(){return q},then(ok){return Promise.resolve({data:[],error:null}).then(ok)}};return q}}
const order=()=>({id:route.params.id,order_number:'LOCAL-TRACKING',status:'ready_to_deliver',payment_status:'pending',payment_method:scenario.value==='card'?'card':'cash',amount_paid:0,paid_at:null,customer_payment:{status:'pending',verified:false,recovery:'review'},total_amount:187.25,subtotal_amount:137.25,currency:'EGP',created_at:'2026-10-01T08:00:00Z',packing_completed_at:'2026-10-01T10:00:00Z',first_name:'Owned fixture',street_address:'Owned street',city:'Owned city',governorate:'Cairo',shipping_method:'shipping',erp_owner:'built_in',is_preorder:scenario.value==='preorder',initial_amount_due:50,preorder_fulfillment_state:'awaiting_stock',stock_fulfillment_state:'untracked'})
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
 if(path==='/api/account/history')return {orders:[{source_id:'fixture',legacy_id:'42',kind:'shop_order',status:'wc-completed',total:'250.00',currency:'EGP',created_at:'2025-05-15T12:00:00Z'}],total:1,profiles:[]};if(path==='/api/account/history/fixture/42')return {order:{created_at:'2025-05-15T12:00:00Z',payment_title:'Cash on delivery',billing_address:{},shipping_address:{}},items:[{legacy_id:'1',title:'Fixture purchase',quantity:1}]};if(delayOrders&&path.startsWith('/api/admin-orders/'))return new Promise(resolve=>deferred.push({path,resolve}));requests.push({path,method:options.method||'GET',retry:options.retry});if(path.startsWith('/api/account/orders/')){reads++;return detail()}
 if(path.startsWith('/api/admin-orders/')){const d=detail();if(d.shipping){d.shipping.events=d.shipping.events.map(x=>({...x,reason_name:'PRIVATE-DIAGNOSTIC-CANARY'}))}return d}
 if(path.endsWith('/refresh')){scenario.value='throttled';return {checked:1,failed:0}}
 if(path==='/api/admin-shipping/settings'){if(options.method==='PATCH')Object.assign(pdc,options.body);return {settings:structuredClone(pdc),mappings:[]}}
 throw Error('Unexpected fixture request '+path)
}
const scope=()=>({accountId:'owned-customer',isCurrent:()=>!invalid,onInvalidate:fn=>callbacks.push(fn),request,headers:async()=>({authorization:'Bearer LOCAL-TOKEN'})})
Object.assign(globalThis,{ref,shallowRef,reactive,computed,watch,onMounted,onBeforeUnmount,onScopeDispose,nextTick,useUiLocale,useShipmentUpdates,useCustomerScope:scope,useNuxtApp:()=>({$i18n:i18n.global}),useI18n:()=>i18n.global,useUiRoute:()=>route,useRoute:()=>route,useNuxtData:()=>({data:ref(null)}),useSupabaseClient:()=>supabase,useSiteContent:async()=>({data:ref({site_name:'Owned fixture store'})}),useSupportClient:()=>({request,errorText:(e,f)=>f}),useReorder:()=>({addOrderToCart:async()=>({message:''})}),useHead(){},definePageMeta(){},useAdminLogs:()=>({recordAdminLog:async()=>{}}),useAdminAccess:()=>({hasPermission:()=>true,loadAdminAccess:async()=>{}}),$fetch:request})
const app=createApp({render:()=>h(Suspense,null,{default:()=>h('main',{key:version.value,class:'mx-auto max-w-6xl p-4'},[view.value==='history'?h(History):view.value==='staff'?h(Dialog,{open:dialogOpen.value,orderId:route.params.id,'onUpdate:open':v=>dialogOpen.value=v}):view.value==='settings'?h(Settings):h(Account)])})});app.use(i18n)
app.component('Icon',{render(){return h('span',{'aria-hidden':'true'})}});app.component('NuxtLinkLocale',{props:['to'],setup(p,{slots}){return()=>h('a',{href:'#'},slots.default?.())}})
app.component('AccountOrderProgress',Progress);app.component('PaymentCodStatus',Cod);app.component('PaymentOrderStatus',Card)
for(const name of ${JSON.stringify(tags)})app.component(name,{render(){return null}})
const ui=useUiLocale();Object.assign(app.config.globalProperties,{$uiLabel:ui.uiLabel,$uiMessage:ui.uiMessage,$uiPluralSuffix:ui.uiPluralSuffix});app.mount('#app')
window.trackingFixture={view,scenario,requests,route,dialogOpen,deferred,delayOrders:v=>delayOrders=v,resolveOrder:(index,label)=>{const d=detail();d.order={...d.order,id:deferred[index].path.split('/').at(-1),order_number:label};deferred[index].resolve(d)},locale:i18n.global.locale,messages:{en,ar},nextTick,change:(v,s)=>{view.value=v;scenario.value=s;version.value++},broadcast:()=>broadcast?.(),invalidate:()=>{invalid=true;callbacks.forEach(fn=>fn())},reads:()=>reads,pdc}
`
const bundle=await build({stdin:{contents:entry,resolveDir:base,sourcefile:'tracking-ui.js'},bundle:true,write:false,format:'iife',platform:'browser',alias:{'~':join(base,'app')},define:{'process.env.NODE_ENV':'"test"','import.meta.client':'true',__VUE_OPTIONS_API__:'true',__VUE_PROD_DEVTOOLS__:'false',__VUE_PROD_HYDRATION_MISMATCH_DETAILS__:'false'},plugins:[{name:'actual-vue',setup(b){b.onResolve({filter:/pdf\.worker\.min\.mjs\?url$/},()=>({path:'fixture-worker',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export default "/unused-worker.mjs"',loader:'js'}));b.onLoad({filter:/\.vue$/},async({path})=>({contents:compileScript(parse(await readFile(path,'utf8'),{filename:path}).descriptor,{id:path,inlineTemplate:true}).content,resolveDir:dirname(path),loader:'js'}))}}]})
const css=(await Promise.all((await readdir(join(base,'.output/public/_nuxt'))).filter(x=>x.endsWith('.css')).map(x=>readFile(join(base,'.output/public/_nuxt',x),'utf8')))).join('\n')
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'application/javascript':'text/html');res.end(req.url==='/fixture.js'?bundle.outputFiles[0].text:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><div id="app"></div><script src="/fixture.js"></script></body></html>')});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port
const browser=process.env.REVIEW_ENGINE==='webkit'?await (await import(pathToFileURL(process.env.OWNER_UI_REVIEW_PLAYWRIGHT).href)).webkit.launch():await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),page=await browser.newPage(),errors=[],external=[];let assertions=0
const check=(v,label)=>{assert.ok(v,label);assertions++};page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>{if(!r.request().url().startsWith(origin)){external.push(r.request().url());return r.abort()}return r.continue()})
try{
 await page.goto(origin)
 await page.evaluate(()=>{const button=document.createElement('button');button.id='dialog-launcher';button.textContent='Open fixture order';document.body.prepend(button);button.focus()})
 await page.evaluate(()=>{const f=window.trackingFixture;f.delayOrders(true);f.change('staff','none')})
 await page.waitForFunction(()=>window.trackingFixture.deferred.length===1);check(await page.getByRole('button',{name:'Close',exact:true}).evaluate(e=>document.activeElement===e),'focus entry')
 await page.getByRole('button',{name:'Close',exact:true}).click()
 await page.evaluate(()=>{const f=window.trackingFixture;f.route.params.id='00000000-0000-4000-8000-000000000002';f.dialogOpen.value=true})
 await page.waitForFunction(()=>window.trackingFixture.deferred.length===2)
 await page.evaluate(()=>window.trackingFixture.resolveOrder(1,'SECOND-ORDER'))
 await page.getByRole('heading',{name:'SECOND-ORDER'}).waitFor()
 await page.evaluate(()=>window.trackingFixture.resolveOrder(0,'FIRST-ORDER'))
 await page.waitForTimeout(100);check(await page.getByRole('heading',{name:'SECOND-ORDER'}).count()===1,'late A cannot replace B')
 check(await page.getByRole('heading',{name:'FIRST-ORDER'}).count()===0,'stale identity hidden')
 check(await page.getByRole('dialog').count()===1,'dialog semantics')
 await page.getByRole('button',{name:'PDF',exact:true}).focus();await page.keyboard.press('Shift+Tab');check(await page.getByRole('dialog').evaluate(e=>e.contains(document.activeElement)&&document.activeElement!==e.querySelector('button')),'reverse focus contained')
 await page.getByRole('dialog').evaluate(e=>{const controls=[...e.querySelectorAll('button,a[href],input,select')].filter(x=>!x.matches(':disabled')&&x.getClientRects().length);controls.at(-1).focus()});await page.keyboard.press('Tab');check(await page.getByRole('button',{name:'PDF',exact:true}).evaluate(e=>document.activeElement===e),'forward focus contained')
 await page.keyboard.press('Escape');check(await page.getByRole('dialog').count()===0,'Escape closes safe read');check(await page.locator('#dialog-launcher').evaluate(e=>document.activeElement===e),'focus restored')
 await page.evaluate(()=>{const f=window.trackingFixture;f.delayOrders(false);f.dialogOpen.value=true;f.change('staff','preorder')})
 await page.getByRole('spinbutton').waitFor();await page.getByRole('spinbutton').fill('20.35');await page.locator('input[type=text]').fill('LOCAL-REFERENCE');await page.locator('input[type=checkbox]').check()
 await page.getByRole('button',{name:'Close',exact:true}).click()
 await page.evaluate(async()=>{const f=window.trackingFixture;f.route.params.id='00000000-0000-4000-8000-000000000003';f.dialogOpen.value=true;await f.nextTick()})
 await page.getByRole('spinbutton').waitFor();check(await page.getByRole('spinbutton').inputValue()==='','amount cleared');check(await page.locator('input[type=text]').inputValue()==='','reference cleared');check(!await page.locator('input[type=checkbox]').isChecked(),'receipt assertion cleared')
 await page.getByRole('button',{name:'Close',exact:true}).click()
 for(const locale of ['en','ar'])for(const width of [320,360,375,390,414,768,1280,1440])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:900});await page.evaluate(({locale,theme})=>{const f=window.trackingFixture;f.locale.value=locale;document.documentElement.lang=locale;document.documentElement.dir=locale==='ar'?'rtl':'ltr';document.documentElement.classList.toggle('dark',theme==='dark');f.change('history','none')},{locale,theme})
  await page.getByRole('button',{name:locale==='en'?'Details':'التفاصيل',exact:true}).waitFor()
  const text=await page.locator('body').innerText();check(!text.includes('wc-completed'),'localized status');check(text.includes(locale==='en'?'2025':'٢٠٢٥'),'original date visible')
  check(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),'history viewport contained')
  await page.screenshot({path:join(dir,'history-'+locale+'-'+width+'-'+theme+'.png'),fullPage:true});await page.evaluate(()=>{const f=window.trackingFixture;f.dialogOpen.value=true;f.change('staff','none')});await page.getByRole('dialog').waitFor();check(await page.getByRole('dialog').evaluate(e=>{const b=e.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth&&e.scrollWidth<=e.clientWidth+1}),'staff dialog component bounds');await page.getByRole('button',{name:locale==='en'?'Close':'إغلاق',exact:true}).click()
 }
 check(errors.length===0,'no browser exceptions '+errors.join(';'));check(external.length===0,'no external requests')
 const result={assertions,errors,external,mutationsSubmitted:0,productionWrites:0,providerRequests:0};await writeFile(join(dir,'report.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result))
}finally{await browser.close();await new Promise(r=>server.close(r))}
