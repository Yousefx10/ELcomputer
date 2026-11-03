import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {readFile} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {build} from 'esbuild'
import {parse,compileScript} from '@vue/compiler-sfc'
import {paymobFrameCsp} from '../app/utils/paymobFramePolicy.js'
const {chromium,webkit}=await import(process.env.COD_REVIEW_PLAYWRIGHT)
const vendor=resolve('public/paymob-pixel/1.2.8')
const helper=`import {createApp,h,ref,shallowRef,onMounted,onBeforeUnmount,nextTick} from 'vue';import Pixel from './app/components/payment/PaymobPixel.vue';
 const visible=ref(true),events=[];Object.assign(globalThis,{ref,shallowRef,onMounted,onBeforeUnmount,useI18n:()=>({locale:ref(window.__fixture.locale)}),useColorMode:()=>({value:window.__fixture.dark?'dark':'light'})});
 const app=createApp({render:()=>visible.value?h(Pixel,{session:{publicKey:'egy_pk_test_fixture',clientSecret:'egy_csk_test_fixture',paymentMethods:[window.__fixture.method||'card'],expiresAt:new Date(Date.now()+1800000).toISOString()},onComplete:()=>events.push('complete'),onCancel:()=>events.push('cancel')}):h('p','Unmounted')});app.config.globalProperties.$t=k=>k;app.mount('#app');window.__events=events;window.__hide=async()=>{visible.value=false;await nextTick()};window.__show=async()=>{visible.value=true;await nextTick()};`
const compiled=await build({stdin:{contents:helper,resolveDir:resolve('.'),sourcefile:'pixel-fixture.js'},write:false,bundle:true,format:'iife',platform:'browser',alias:{'~':resolve('app')},define:{'process.env.NODE_ENV':'"test"',__VUE_OPTIONS_API__:'true',__VUE_PROD_DEVTOOLS__:'false',__VUE_PROD_HYDRATION_MISMATCH_DETAILS__:'false'},plugins:[{name:'vue',setup(b){b.onLoad({filter:/\.vue$/},async({path})=>({contents:compileScript(parse(await readFile(path,'utf8'),{filename:path}).descriptor,{id:path,inlineTemplate:true}).content,resolveDir:dirname(path),loader:'js'}))}}]})
let fixture,mode
const fakeSdk=`window.Pixel=class{constructor(options){window.__options=options;window.__constructs=(window.__constructs||0)+1;document.getElementById(options.elementId).textContent='Provider-owned field fixture'}}`
const server=createServer(async(req,res)=>{
 const path=new URL(req.url,'http://fixture.invalid').pathname
 if(path==='/fixture.js'){res.setHeader('content-type','text/javascript');res.end(compiled.outputFiles[0].text);return}
 if(path.startsWith('/paymob-pixel/1.2.8/')){
  const name=path.split('/').pop();if(!['host.html','host.js','main.js'].includes(name)){res.statusCode=404;res.end();return}
  if(name==='host.html'){res.setHeader('content-security-policy',paymobFrameCsp);res.setHeader('referrer-policy','no-referrer')}
  res.setHeader('content-type',name.endsWith('.html')?'text/html':'text/javascript')
  if(name==='main.js'&&mode==='hanging'){res.writeHead(200);res.write('/* pending SDK fixture */');setTimeout(()=>res.end(),1500).unref();return}
  if(name==='main.js'&&mode!=='actual'){res.statusCode=mode==='missing'?404:200;res.end(mode==='missing'?'':fakeSdk);return}
  let body=await readFile(resolve(vendor,name),'utf8');if(name==='host.html'&&mode!=='actual')body=body.replace(/ integrity="[^"]+"/,'');res.end(body);return
 }
 res.setHeader('content-type','text/html');res.end('<!doctype html><html lang="'+fixture.locale+'" dir="'+(fixture.locale==='ar'?'rtl':'ltr')+'"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div><script>window.__fixture='+JSON.stringify(fixture)+'</script><script src="/fixture.js"></script></body></html>')
})
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port
try{for(const [engine,type]of [['chromium',chromium],['webkit',webkit]])await test(engine+' private Pixel lifecycle',{timeout:180000},async t=>{
 const browser=await type.launch({headless:true,timeout:30000,...(engine==='chromium'?{channel:'chrome'}:process.env.REVIEW_WEBKIT_EXECUTABLE?{executablePath:process.env.REVIEW_WEBKIT_EXECUTABLE}:{})})
 try{for(const locale of ['en','ar'])for(const width of [1440,390])await t.test(locale+' '+width+' callbacks, ownership and disposal',async()=>{
  fixture={locale,dark:width===390};mode='fake';const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[],unsafe=[]
  await context.route('**/*',r=>r.request().url().startsWith(origin)&&r.request().method()==='GET'?r.continue():(unsafe.push(r.request().method()),r.abort()))
  page.on('pageerror',e=>errors.push(e.message));await page.goto(origin)
  const frame=page.frameLocator('iframe');await frame.locator('#paymob-card').getByText('Provider-owned field fixture').waitFor()
  const child=page.frames().find(f=>f.url().includes('/host.html'))
  assert.ok(child);assert.equal(await child.evaluate(()=>window.__constructs),1)
  assert.deepEqual(await child.evaluate(()=>({save:window.__options.showSaveCard,force:window.__options.forceSaveCard,methods:window.__options.paymentMethods,dir:document.documentElement.dir})),{save:false,force:false,methods:['card'],dir:locale==='ar'?'rtl':'ltr'})
  // Wrong source and channel cannot claim completion.
  await page.evaluate(()=>window.postMessage({source:'paymob-frame-v1',type:'complete',channel:'00000000-0000-4000-8000-000000000000'},location.origin));assert.deepEqual(await page.evaluate(()=>window.__events),[])
  assert.deepEqual(await child.evaluate(()=>[window.__options.beforePaymentComplete(),window.__options.beforePaymentComplete()]),[true,false])
  await child.evaluate(()=>{window.__options.afterPaymentComplete({PAN_CANARY:'DO_NOT_FORWARD'});window.__options.afterPaymentComplete({success:true})})
  await page.waitForFunction(()=>window.__events.length===1);assert.deepEqual(await page.evaluate(()=>window.__events),['complete'])
  assert.equal(await page.evaluate(()=>Object.keys(localStorage).length),0)
  await page.evaluate(()=>window.__hide());await page.waitForFunction(()=>!document.querySelector('iframe'));assert.equal(page.frames().length,1)
  await page.evaluate(()=>window.__show());await page.frameLocator('iframe').locator('#paymob-card').getByText('Provider-owned field fixture').waitFor();assert.equal(page.frames().filter(f=>f.url().includes('/host.html')).length,1)
  assert.deepEqual(errors,[]);assert.deepEqual(unsafe,[]);await context.close()
 })
 await t.test('expired sessions withhold payment without claiming failure or creating an intention',async()=>{
  fixture={locale:'en'};mode='fake';const context=await browser.newContext(),page=await context.newPage();await context.route('**/*',r=>r.request().url().startsWith(origin)&&r.request().method()==='GET'?r.continue():r.abort());await page.goto(origin);await page.frameLocator('iframe').locator('#paymob-card').getByText('Provider-owned field fixture').waitFor();const child=page.frames().find(f=>f.url().includes('/host.html'));const started=await child.evaluate(()=>{Date.now=()=>4102444800000;return window.__options.beforePaymentComplete()});assert.equal(started,false);await page.getByRole('alert').waitFor();assert.equal(await page.locator('iframe').count(),0);assert.deepEqual(await page.evaluate(()=>window.__events),[]);await context.close()
 })
 await t.test('SDK timeout removes the frame without retrying or submitting payment',async()=>{
  fixture={locale:'en'};mode='hanging';const context=await browser.newContext(),page=await context.newPage();let sdk=0
  await context.addInitScript(()=>{const timeout=window.setTimeout;window.setTimeout=(fn,ms,...args)=>timeout(fn,ms===15000?300:ms,...args)})
  await context.route('**/*',r=>{if(r.request().url().endsWith('/main.js'))sdk++;return r.request().url().startsWith(origin)&&r.request().method()==='GET'?r.continue():r.abort()})
  await page.goto(origin);await page.getByRole('alert').waitFor();assert.equal(sdk,1);assert.equal(await page.locator('iframe').count(),0);assert.deepEqual(await page.evaluate(()=>window.__events),[]);await context.close()
 })
 await t.test('missing SDK fails closed without a reload or payment request',async()=>{
  fixture={locale:'en'};mode='missing';const context=await browser.newContext(),page=await context.newPage();let sdk=0
  await context.route('**/*',r=>{if(r.request().url().endsWith('/main.js'))sdk++;return r.request().url().startsWith(origin)&&r.request().method()==='GET'?r.continue():r.abort()})
  await page.goto(origin);await page.getByRole('alert').waitFor();assert.equal(sdk,1);assert.equal(await page.locator('iframe').count(),0);assert.deepEqual(await page.evaluate(()=>window.__events),[]);await context.close()
 })
 await t.test('Apple cancellation never unlocks a second submission or claims paid status',async()=>{
  fixture={locale:'en',method:'apple-pay'};mode='fake';const context=await browser.newContext(),page=await context.newPage()
  await context.addInitScript(()=>{window.ApplePaySession=class{static canMakePayments(){return true}static supportsVersion(){return true}}})
  await context.route('**/*',r=>r.request().url().startsWith(origin)&&r.request().method()==='GET'?r.continue():r.abort());await page.goto(origin)
  await page.frameLocator('iframe').locator('#paymob-card').getByText('Provider-owned field fixture').waitFor();const child=page.frames().find(f=>f.url().includes('/host.html'))
  assert.deepEqual(await child.evaluate(()=>window.__options.paymentMethods),['apple-pay'])
  assert.equal(await child.evaluate(()=>window.__options.beforePaymentComplete()),true)
  await child.evaluate(()=>window.__options.onPaymentCancel({privatePayload:'DO_NOT_FORWARD'}));await page.waitForFunction(()=>window.__events.length===1)
  assert.deepEqual(await page.evaluate(()=>window.__events),['cancel']);assert.equal(await child.evaluate(()=>window.__options.beforePaymentComplete()),false)
  await context.close()
 })
 for(const method of ['card','apple-pay'])await t.test('actual pinned package renders '+method+' with isolated provider responses',async()=>{
  fixture={locale:'ar',method};mode='actual';const context=await browser.newContext({viewport:{width:390,height:900}}),page=await context.newPage(),writes=[],unapproved=[],errors=[];page.on('pageerror',e=>errors.push(e.message));let metadata=0
  if(method==='apple-pay')await context.addInitScript(()=>{window.ApplePaySession=class{static canMakePayments(){return true}static supportsVersion(){return true}}})
  await context.route('**/*',async r=>{
   const req=r.request(),u=new URL(req.url())
   // The unmodified Apple component checks for a provider discount on mount.
   // Fulfill only that exact fixture request; every payment request is blocked.
   if(method==='apple-pay'&&req.method()==='POST'&&u.origin==='https://accept.paymob.com'&&u.pathname==='/api/acceptance/transaction_discount')return r.fulfill({contentType:'application/json',body:JSON.stringify({discounted_amount_cents:0})})
   if(req.method()!=='GET'){writes.push(req.method());return r.abort()}
   if(u.origin===origin)return r.continue()
   if(u.origin==='https://accept.paymob.com'&&u.pathname.startsWith('/v1/intention/element/')){metadata++;return r.fulfill({contentType:'application/json',body:JSON.stringify({intention_detail:{amount:12345,currency:'EGP'},payment_methods:[{integration_id:1,name:method,live:false,currency:'EGP'}],payment_keys:{[method]:'fixture-provider-token',[method+'_iframe_id']:1},card_tokens:[],merchant_name:'Isolated fixture'})})}
   if(u.origin==='https://eg.checkout.paymob.com')return r.fulfill({contentType:'text/html',body:'<!doctype html><title>Provider fixture</title><p>Isolated provider card fields</p>'})
   unapproved.push(u.origin+u.pathname);return r.abort()
  })
  await page.goto(origin);const child=page.frames().find(f=>f.url().includes('/host.html'))||await new Promise(resolve=>page.once('frameattached',resolve))
  await page.frameLocator('iframe').locator('#paymob-card').waitFor();await page.waitForFunction(()=>!document.querySelector('[role=status]'))
  const actual=page.frames().find(f=>f.url().includes('/host.html'));await actual.waitForFunction(()=>typeof window.Pixel==='function'&&[...document.querySelectorAll('#paymob-card div')].some(node=>!!node.shadowRoot))
  assert.equal(metadata,1);assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);assert.deepEqual(unapproved,[]);assert.deepEqual(await page.evaluate(()=>window.__events),[])
  await page.evaluate(()=>window.__hide());assert.equal(page.frames().length,1);await context.close()
 })
 }finally{await browser.close()}
})}finally{await new Promise(r=>server.close(r))}
