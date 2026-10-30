// Owned, loopback-only UI qualification. All order/API data is explicit fixture data.
import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises'
import {createServer} from 'node:http'
import {resolve,join,dirname} from 'node:path'
import {pathToFileURL} from 'node:url'
import {parse,compileScript} from '@vue/compiler-sfc'
import {build} from 'esbuild'
const {chromium}=await import(pathToFileURL(process.env.PDC_REVIEW_PLAYWRIGHT).href)
const base=resolve(new URL('..',import.meta.url).pathname),dir=process.env.PDC_REVIEW_ARTIFACTS
assert.ok(dir);await mkdir(dir,{recursive:true})
const component=join(base,'app/components/dashboard/OrderDetailsDialog.vue')
const source=await readFile(component,'utf8'),tags=[...new Set([...source.matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)].map(x=>x[1]))].filter(x=>!['Teleport','Transition','Suspense'].includes(x))
const entry=`
import {createApp,h,Suspense,ref,computed,watch,onMounted,onBeforeUnmount,nextTick} from '${base}/node_modules/vue/dist/vue.esm-bundler.js'
import {createI18n} from '${base}/node_modules/vue-i18n/dist/vue-i18n.mjs'
import {useUiLocale} from '${base}/app/composables/useUiLocale.js'
import en from '${base}/i18n/locales/en.json'
import ar from '${base}/i18n/locales/ar.json'
import Dialog from '${component}'
const i18n=createI18n({legacy:false,locale:'en',fallbackLocale:'en',messages:{en,ar}})
const id=ref('00000000-0000-4000-8000-000000000001'),method=ref('cash'),state=ref('not_booked'),requests=[]
const detail=()=>({order:{id:id.value,order_number:'OWNED-FIXTURE',status:'ready_to_deliver',payment_status:method.value==='card'?'paid':'pending',payment_method:method.value,erp_owner:'built_in',is_preorder:false,total_amount:200,subtotal_amount:100,discount_amount:0,shipping_fee_amount:50,payment_fee_amount:method.value==='cash'?50:0,currency:'EGP',created_at:'2026-10-31T00:00:00Z',first_name:'Owned fixture',phone:'01000000000',street_address:'Fixture street',city:'Fixture city',governorate:'Cairo',shipping_review_status:'approved',stock_fulfillment_state:'untracked'},items:[],customer:null,preorderPayments:[],codCash:null,shipping:{provider:'pdc',state:state.value,awb:null,label_ready:false,events:[]}})
const request=async(path,options={})=>{requests.push({path,method:options.method||'GET',body:options.body,retry:options.retry});if(path==='/api/admin-orders/'+id.value)return detail();if(path==='/api/admin-shipping/orders/'+id.value+'/booking'&&options.method==='POST'){state.value='uncertain';return {state:'uncertain'}};throw Error('Unexpected owned request')}
Object.assign(globalThis,{ref,computed,watch,onMounted,onBeforeUnmount,useNuxtData:()=>({data:ref(null)}),useNuxtApp:()=>({$i18n:i18n.global}),useUiLocale,useI18n:()=>i18n.global,useSupabaseClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'owned-synthetic-token'}}})}}),useSiteContent:async()=>({data:ref({site_name:'Owned fixture store'})}),$fetch:request})
const app=createApp({render:()=>h(Suspense,null,{default:()=>h(Dialog,{open:true,orderId:id.value}),fallback:()=>h('p','Loading')})});app.use(i18n)
for(const tag of ${JSON.stringify(tags)})app.component(tag,{render(){return null}})
const ui=useUiLocale();Object.assign(app.config.globalProperties,{$uiLabel:ui.uiLabel,$uiMessage:ui.uiMessage,$uiPluralSuffix:ui.uiPluralSuffix})
app.mount('#app');window.bookingFixture={id,method,state,requests,locale:i18n.global.locale,nextTick,messages:{en,ar}}
`
const output=await build({stdin:{contents:entry,resolveDir:base,sourcefile:'owned-booking-entry.js'},bundle:true,write:false,format:'iife',platform:'browser',alias:{'~':join(base,'app')},define:{'process.env.NODE_ENV':'"test"',__VUE_OPTIONS_API__:'true',__VUE_PROD_DEVTOOLS__:'false',__VUE_PROD_HYDRATION_MISMATCH_DETAILS__:'false'},plugins:[{name:'owned-vue',setup(b){b.onLoad({filter:/\.vue$/},async({path})=>({contents:compileScript(parse(await readFile(path,'utf8'),{filename:path}).descriptor,{id:path,inlineTemplate:true}).content,resolveDir:dirname(path),loader:'js'}))}}]})
const files=await readdir(join(base,'.output/public/_nuxt')),css=(await Promise.all(files.filter(x=>x.endsWith('.css')).map(x=>readFile(join(base,'.output/public/_nuxt',x),'utf8')))).join('\n')
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'application/javascript':'text/html');res.end(req.url==='/fixture.js'?output.outputFiles[0].text:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><div id="app"></div><script src="/fixture.js"></script></body></html>')})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),page=await browser.newPage(),errors=[],external=[]
page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept())
await page.route('**/*',route=>{if(!route.request().url().startsWith(url)){external.push(route.request().url());return route.abort()}return route.continue()})
let assertions=0,index=1;const check=(condition,label)=>{assert.ok(condition,label);assertions++}
try{
 await page.goto(url)
 for(const locale of ['en','ar'])for(const width of [1440,390])for(const method of ['cash','card']){
  await page.setViewportSize({width,height:1000})
  await page.evaluate(({locale,method,index})=>{const f=window.bookingFixture;f.locale.value=locale;f.method.value=method;f.state.value='not_booked';f.id.value='00000000-0000-4000-8000-'+String(index).padStart(12,'0');document.documentElement.lang=locale;document.documentElement.dir=locale==='ar'?'rtl':'ltr'},{locale,method,index:++index})
  const copy=await page.evaluate(locale=>window.bookingFixture.messages[locale],locale),weight=page.getByLabel(copy.pdcParcel.weight),confirmed=page.getByLabel(copy.pdcParcel.confirm),button=page.getByRole('button',{name:copy.liveSales.book,exact:true})
  await weight.waitFor();check(await weight.inputValue()==='','new orders have no guessed weight');check(!await confirmed.isChecked(),'new order confirmation is unchecked');check(await button.isDisabled(),'blank parcel cannot book');check(await page.getByText(copy.liveSales.uncertain,{exact:true}).count()===0,'prior-order uncertainty notice is cleared')
  await weight.fill('0');await confirmed.check();check(await button.isDisabled(),'zero weight cannot book')
  await weight.fill('1.2345');check(await button.isDisabled(),'weight cannot silently round')
  await weight.fill('2.345');check(await button.isEnabled(),'explicit confirmed weight enables the action')
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow')
  await page.screenshot({path:join(dir,locale+'-'+width+'-'+method+'.png'),fullPage:true})
  const before=await page.evaluate(()=>window.bookingFixture.requests.filter(x=>x.method==='POST').length)
  await button.click();await page.waitForFunction(count=>window.bookingFixture.requests.filter(x=>x.method==='POST').length===count+1,before)
  await button.waitFor({state:'hidden'})
  const sent=await page.evaluate(()=>window.bookingFixture.requests.filter(x=>x.method==='POST').at(-1))
  check(sent.body.actual_weight_kg===2.345&&sent.body.weight_confirmed===true&&sent.body.action==='book','only the explicit measured booking is submitted');check(sent.retry===0,'client never auto-retries booking')
 }
 check(errors.length===0,'no browser exceptions: '+errors.join('; '));check(external.length===0,'no external network')
 console.log(JSON.stringify({result:'MEASURED_BOOKING_BROWSER_PASS',assertions,locales:['en','ar'],widths:[1440,390],payment_methods:['cash','card'],scenarios:8,provider_calls:0,real_orders:0,external_requests:0}))
}catch(error){await writeFile(join(dir,'failure.private.json'),JSON.stringify({error:String(error),errors,external},null,2));await page.screenshot({path:join(dir,'failure.png'),fullPage:true});throw error}
finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
