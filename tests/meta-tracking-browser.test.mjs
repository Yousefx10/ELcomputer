import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {readFile} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {build} from 'esbuild'
import {parse,compileScript} from '@vue/compiler-sfc'
const {chromium,webkit}=await import(process.env.COD_REVIEW_PLAYWRIGHT)
const helper=`import {createApp,h,ref,computed,onMounted,onBeforeUnmount,reactive} from 'vue';import Consent from './app/components/privacy/MarketingConsent.vue';import {useMetaTracking} from './app/composables/useMetaTracking.js';
const states=new Map(),route=reactive({path:'/shop'});Object.assign(globalThis,{ref,computed,onMounted,onBeforeUnmount,useState:(key,init)=>{if(!states.has(key))states.set(key,ref(init()));return states.get(key)},useRoute:()=>route,useMetaTracking,$fetch:async(url,options={})=>{const r=await fetch(url,{method:options.method||'GET',headers:{'content-type':'application/json',...options.headers},...(options.body?{body:JSON.stringify(options.body)}:{})});if(!r.ok)throw Error('HTTP '+r.status);return r.json()}});
const app=createApp({render:()=>h(Consent)});app.config.globalProperties.$t=key=>window.__fixture.locale==='ar'?'الخصوصية '+key:key;app.mount('#app');const tracking=useMetaTracking();window.__tracking=tracking;window.__route=route;tracking.initialize();`
const bundle=await build({stdin:{contents:helper,sourcefile:'meta-browser-fixture.js',resolveDir:resolve('.')},bundle:true,write:false,format:'iife',platform:'browser',alias:{'~':resolve('app')},define:{'import.meta.client':'true','process.env.NODE_ENV':'"test"',__VUE_OPTIONS_API__:'true',__VUE_PROD_DEVTOOLS__:'false',__VUE_PROD_HYDRATION_MISMATCH_DETAILS__:'false'},plugins:[{name:'meta-vue',setup(b){
 b.onResolve({filter:/useStorefrontAudience$/},()=>({path:'audience',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const STOREFRONT_AUDIENCE_ELIGIBLE="eligible";export const getStorefrontAudienceStatus=()=>"eligible";export const getStorefrontAudienceAccessToken=()=>window.__authToken||null;',loader:'js'}))
 b.onLoad({filter:/\.vue$/},async({path})=>({contents:compileScript(parse(await readFile(path,'utf8'),{filename:path}).descriptor,{id:path,inlineTemplate:true}).content,loader:'js',resolveDir:dirname(path)}))
}}]})
let fixture
const server=createServer(async(req,res)=>{
 const path=new URL(req.url,'http://fixture.invalid').pathname;res.setHeader('content-type','application/json')
 if(path==='/fixture.js'){res.setHeader('content-type','text/javascript');res.end(bundle.outputFiles[0].text);return}
 if(path==='/api/marketing/config'){res.end(JSON.stringify({enabled:fixture.enabled,pixelId:'123456789',revision:1,testExpiresAt:fixture.expires||null}));return}
 if(path==='/api/marketing/consent'){let raw='';for await(const b of req)raw+=b;const body=JSON.parse(raw);fixture.consent.push(body.granted);res.end(JSON.stringify({granted:body.granted,revision:1}));return}
 if(path==='/api/marketing/events'){let raw='';for await(const b of req)raw+=b;const e=JSON.parse(raw);fixture.events.push(e);res.end(JSON.stringify({event:{eventName:e.eventName,eventId:e.eventId,data:{}}}));return}
 if(path==='/api/marketing/purchase'){res.end(JSON.stringify({event:fixture.paid?{eventName:'Purchase',eventId:'purchase:verified-local-order',data:{currency:'EGP',value:150.35,content_ids:['local-product']}}:null}));return}
 res.setHeader('content-type','text/html');res.end('<!doctype html><html lang="'+fixture.locale+'" dir="'+(fixture.locale==='ar'?'rtl':'ltr')+'"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div><script>window.__fixture='+JSON.stringify({locale:fixture.locale})+'</script><script src="/fixture.js"></script></body></html>')
})
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port
try{for(const [engine,type]of [['chromium',chromium],['webkit',webkit]])await test(engine+' Meta consent, deduplication and privacy',{timeout:90000},async t=>{
 const browser=await type.launch({headless:true,...(engine==='chromium'?{channel:'chrome'}:{executablePath:process.env.REVIEW_WEBKIT_EXECUTABLE})})
 try{for(const locale of ['en','ar'])for(const width of [390,1440])await t.test(locale+' '+width+' consent, server receipt and withdrawal',async()=>{
  fixture={enabled:true,locale,events:[],consent:[],paid:false};const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),unsafe=[],errors=[];let sdk=0
  page.on('pageerror',e=>errors.push(e.message));await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin===origin)return r.continue();if(u.origin==='https://connect.facebook.net'&&r.request().method()==='GET'){sdk++;return r.fulfill({contentType:'text/javascript',body:'window.__metaCalls=[];const q=window.fbq;const queued=q.queue.slice();q.callMethod=(...args)=>window.__metaCalls.push(args);queued.forEach(args=>q.callMethod(...args));'})}unsafe.push(u.origin);return r.abort()})
  await page.goto(origin);await page.getByText(locale==='ar'?'الخصوصية metaTracking.privacyTitle':'metaTracking.privacyTitle',{exact:true}).waitFor();assert.equal(sdk,0)
  await page.evaluate(()=>window.__tracking.choose(false));assert.equal(sdk,0);assert.deepEqual(fixture.events,[])
  await page.evaluate(()=>window.__tracking.choose(true));assert.equal(sdk,1);assert.equal(fixture.events.length,1)
  const calls=await page.evaluate(()=>window.__metaCalls);const view=calls.find(x=>x[0]==='track'&&x[1]==='PageView');assert.equal(view[3].eventID,fixture.events[0].eventId)
  const id='00000000-0000-4000-8000-000000000001';await page.evaluate(id=>window.__tracking.purchase(id),id);assert.equal(await page.evaluate(()=>window.__metaCalls.filter(x=>x[1]==='Purchase').length),0)
  fixture.paid=true;await page.evaluate(async id=>{await window.__tracking.purchase(id);await window.__tracking.purchase(id)},id);assert.equal(await page.evaluate(()=>window.__metaCalls.filter(x=>x[1]==='Purchase').length),1)
  await page.reload();await page.waitForFunction(()=>window.__tracking.state.value.choice==='granted');await page.evaluate(id=>window.__tracking.purchase(id),id);assert.equal(sdk,1)
  await page.evaluate(()=>window.__tracking.choose(false));assert.deepEqual(fixture.consent,[false,true,false]);assert.ok(!await page.evaluate(()=>window.__tracking.allowed()))
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(unsafe,[]);assert.deepEqual(errors,[]);await context.close()
 })
 await t.test('payment return URLs and account changes cannot leak a stale browser Purchase',async()=>{
  fixture={enabled:true,locale:'en',events:[],consent:[],paid:true};const context=await browser.newContext(),page=await context.newPage();let scripts=0
  await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin===origin)return r.continue();scripts++;return r.fulfill({contentType:'text/javascript',body:'window.__metaCalls=[];const q=window.fbq;q.callMethod=(...args)=>window.__metaCalls.push(args);q.queue.forEach(args=>q.callMethod(...args));'})})
  await page.goto(origin);await page.waitForFunction(()=>window.__tracking.state.value.enabled);await page.evaluate(()=>window.__tracking.choose(true))
  await page.evaluate(()=>history.pushState({},'', '/checkout/payment-result?transaction=private&HMAC=private'));await page.evaluate(()=>window.__tracking.purchase('00000000-0000-4000-8000-000000000001'));assert.equal(await page.evaluate(()=>window.__metaCalls.filter(x=>x[1]==='Purchase').length),0)
  await page.evaluate(()=>{history.replaceState({},'','/shop');const request=window.$fetch;window.__authToken='accountA';window.$fetch=async(...args)=>{const r=await request(...args);if(args[0].includes('/purchase'))window.__authToken='accountB';return r}})
  await page.evaluate(()=>window.__tracking.purchase('00000000-0000-4000-8000-000000000001'));assert.equal(await page.evaluate(()=>window.__metaCalls.filter(x=>x[1]==='Purchase').length),0);assert.equal(scripts,1);await context.close()
 })
 await t.test('controlled expiry revokes an existing Pixel and prevents later events',async()=>{
  fixture={enabled:true,locale:'en',events:[],consent:[],paid:false,expires:new Date(Date.now()+1600).toISOString()};const context=await browser.newContext(),page=await context.newPage()
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.fulfill({contentType:'text/javascript',body:'window.__metaCalls=[];const q=window.fbq;q.callMethod=(...a)=>window.__metaCalls.push(a);q.queue.forEach(a=>q.callMethod(...a));'}))
  await page.goto(origin);await page.waitForFunction(()=>window.__tracking?.state.value.enabled);await page.evaluate(()=>window.__tracking.choose(true));assert.equal(fixture.events.length,1)
  await page.waitForFunction(()=>!window.__tracking.allowed());await page.evaluate(()=>window.__tracking.track('AddToCart'));assert.equal(fixture.events.length,1);assert.ok(await page.evaluate(()=>window.__metaCalls.some(a=>a[0]==='consent'&&a[1]==='revoke')));await context.close()
 })
 for(const scenario of ['disabled','gpc','dnt'])await t.test(scenario+' does not load a provider or record an event',async()=>{
  fixture={enabled:scenario!=='disabled',locale:'en',events:[],consent:[],paid:false};const context=await browser.newContext(),page=await context.newPage(),external=[]
  if(scenario!=='disabled')await context.addInitScript(scenario=>Object.defineProperty(navigator,scenario==='gpc'?'globalPrivacyControl':'doNotTrack',{value:scenario==='gpc'?true:'1'}),scenario)
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():(external.push(r.request().url()),r.abort()))
  await page.goto(origin);await page.waitForFunction(()=>!!window.__tracking);await page.evaluate(()=>window.__tracking.track('PageView'));assert.equal(await page.locator('aside').count(),0);assert.deepEqual(external,[]);assert.deepEqual(fixture.events,[]);await context.close()
 })
 }finally{await browser.close()}
})}finally{await new Promise(r=>server.close(r))}
