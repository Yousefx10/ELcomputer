import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,mkdir} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {createServer} from 'node:http'
import {build} from 'esbuild'
import {parse,compileScript} from '@vue/compiler-sfc'

const {chromium,webkit}=await import(process.env.COD_REVIEW_PLAYWRIGHT)
const messages=Object.fromEntries(await Promise.all(['en','ar'].map(async locale=>[locale,JSON.parse(await readFile('i18n/locales/'+locale+'.json','utf8'))])))
const id='00000000-0000-4000-8000-000000000001'
const artifacts=process.env.PAYMENT_REVIEW_ARTIFACTS
if(artifacts)await mkdir(artifacts,{recursive:true,mode:0o700})
const helper=`import {createApp,ref,shallowRef,onMounted,onBeforeUnmount} from 'vue';import Apple from './app/components/payment/ApplePay.vue';import Legacy from './app/components/payment/PaymobPixel.vue';
 const fixture=window.__fixture;window.__requests=[];window.__navigations=[];window.__phases=[];
 const translate=key=>key.split('.').reduce((value,part)=>value?.[part],fixture.messages)||key;
 const request=async(path,options)=>{window.__requests.push({path,method:options.method,body:options.body,retry:options.retry});
  if(options.body.action==='submit'){if(fixture.lostAcknowledgement)throw Error('Isolated lost acknowledgement');return {allowed:!fixture.denied,checkout:{id:fixture.id,totalAmount:'3050.00',currency:'EGP',paymentStatus:'verifying'}}}
  if(fixture.interfaceFailure)throw Error('Isolated interface failure');
  return {allowed:true,checkout:{id:fixture.id,totalAmount:'3050.00',currency:'EGP',paymentStatus:'ready'},payment:{publicKey:'egy_pk_live_fixture',clientSecret:'egy_csk_live_fixture',interfaceToken:fixture.id,expiresAt:new Date(Date.now()+(fixture.expired?-1000:1800000)).toISOString(),experience:'embedded',paymentMethods:[fixture.cardContext?'card':'apple-pay']}}
 };
 Object.assign(globalThis,{ref,shallowRef,onMounted,onBeforeUnmount,useI18n:()=>({locale:ref(fixture.locale)}),useColorMode:()=>({value:fixture.dark?'dark':'light'}),useCustomerScope:()=>({isCurrent:()=>true,request,onInvalidate:fn=>{window.__invalidate=fn}}),useUiNavigation:()=>({uiNavigateTo:(path,options)=>{window.__navigations.push({path,options});document.querySelector('#app').setAttribute('data-navigation',path)}}),onBeforeRouteLeave:fn=>{window.__leave=fn}});
 const warn=console.warn;console.warn=(...values)=>{window.__phases.push(values);warn(...values)};
 const options={publicKey:'egy_pk_live_fixture',clientSecret:'egy_csk_live_fixture',paymentMethods:['apple-pay'],expiresAt:new Date(Date.now()+1800000).toISOString()};
 const app=createApp(fixture.legacy?{render:()=>h(Legacy,{session:options,onUnavailable:()=>{window.__legacyError=translate('paymentInterface.formUnavailable')}})}:Apple,fixture.legacy?{}:{sessionId:fixture.id});app.config.globalProperties.$t=translate;app.mount('#app');`
const compiled=await build({stdin:{contents:helper.replace('createApp,ref,','createApp,h,ref,'),resolveDir:resolve('.'),sourcefile:'apple-page-fixture.js'},bundle:true,write:false,format:'iife',platform:'browser',alias:{'~':resolve('app')},define:{'process.env.NODE_ENV':'"test"',__VUE_OPTIONS_API__:'true',__VUE_PROD_DEVTOOLS__:'false',__VUE_PROD_HYDRATION_MISMATCH_DETAILS__:'false'},plugins:[{name:'vue',setup(b){b.onLoad({filter:/\.vue$/},async({path})=>({contents:compileScript(parse(await readFile(path,'utf8'),{filename:path}).descriptor,{id:path,inlineTemplate:true}).content,resolveDir:dirname(path),loader:'js'}))}}]})
let fixture
const server=createServer(async(req,res)=>{
 const path=new URL(req.url,'http://fixture.invalid').pathname
 if(path==='/fixture.js'){res.setHeader('content-type','text/javascript; charset=utf-8');res.end(compiled.outputFiles[0].text);return}
 if(path.startsWith('/paymob-pixel/1.2.8/')){
  const file=path.split('/').pop();if(!['host.html','host.js','main.js'].includes(file)){res.statusCode=404;res.end();return}
  res.setHeader('content-type',file.endsWith('.html')?'text/html':'text/javascript');res.end(await readFile('public/paymob-pixel/1.2.8/'+file));return
 }
 res.setHeader('content-type','text/html; charset=utf-8');res.end('<!doctype html><html lang="'+fixture.locale+'" dir="'+(fixture.locale==='ar'?'rtl':'ltr')+'"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;font:16px system-ui}#app{max-width:720px;padding:16px;margin:auto}button{min-height:44px}</style><div id="app"></div><script>window.__fixture='+JSON.stringify({...fixture,id,messages:messages[fixture.locale]})+'</script><script src="/fixture.js"></script></html>')
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port
const native=()=>{
 let Pixel
 Object.defineProperty(window,'Pixel',{configurable:true,get:()=>Pixel,set:Base=>{Pixel=class extends Base{constructor(options){window.__sdkOptions=options;super(options)}}}})
 window.__nativeConstructions=[];window.__nativeBegins=0;window.__nativeCompletions=[];window.__gesture=false
 document.addEventListener('click',event=>{if(event.isTrusted){window.__gesture=true;setTimeout(()=>{window.__gesture=false},0)}},true)
 window.ApplePaySession=class{
  static STATUS_SUCCESS=0;static STATUS_FAILURE=1
  static canMakePayments(){return window===window.top}
  static supportsVersion(version){return version===3}
  constructor(version,request){if(window!==top)throw new DOMException('Fixture disallows Apple Pay in child context','SecurityError');if(window.__fixture?.nativeBlocked)throw new DOMException('Isolated native policy rejection','InvalidAccessError');if(!window.__gesture)throw new DOMException('Fixture requires a user gesture','InvalidAccessError');window.__nativeConstructions.push({version,request});window.__nativeSession=this}
  begin(){window.__nativeBegins++}
  completePayment(value){window.__nativeCompletions.push(value)}
 }
}
try{for(const [engine,type]of [['chromium',chromium],['webkit',webkit]])await test(engine+' actual pinned Apple SDK page',{timeout:180000},async t=>{
 const browser=await type.launch({headless:true,...(engine==='chromium'?{channel:'chrome'}:process.env.REVIEW_WEBKIT_EXECUTABLE?{executablePath:process.env.REVIEW_WEBKIT_EXECUTABLE}:{})})
 const open=async(options={})=>{
  fixture={locale:'en',...options};const context=await browser.newContext({viewport:{width:options.width||390,height:900},serviceWorkers:'block'}),page=await context.newPage(),unsafe=[],errors=[]
  page.setDefaultTimeout(15000)
  await context.addInitScript(native)
  if(options.fastTimeout)await context.addInitScript(()=>{const timeout=window.setTimeout;window.setTimeout=(fn,ms,...args)=>timeout(fn,ms===15000?300:ms,...args)})
  if(options.ineligible)await context.addInitScript(()=>{window.ApplePaySession.canMakePayments=()=>false})
  page.on('pageerror',error=>errors.push(error.message))
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url())
   if(url.origin===origin){if(fixture.sdkMissing&&url.pathname.endsWith('/main.js'))return route.abort();return route.continue()}
   if(url.origin==='https://accept.paymob.com'&&url.pathname.startsWith('/v1/intention/element/')&&req.method()==='GET'){
    if(fixture.metadataFailure)return route.abort()
    return route.fulfill({contentType:'application/json',body:JSON.stringify({intention_detail:{amount:305000,currency:'EGP'},payment_methods:[{integration_id:321,name:'apple-pay',live:true,currency:'EGP'}],payment_keys:{'apple-pay':'isolated-provider-token','apple-pay_iframe_id':321},card_tokens:[],merchant_name:'Isolated merchant'})})
   }
   if(url.origin==='https://accept.paymob.com'&&url.pathname==='/api/acceptance/transaction_discount'&&req.method()==='POST')return route.fulfill({contentType:'application/json',body:JSON.stringify({discounted_amount_cents:0})})
   if(url.origin==='https://eg.checkout.paymob.com'&&req.method()==='GET')return route.fulfill({contentType:'text/html',body:'<!doctype html><p>Isolated preload</p>'})
   unsafe.push({method:req.method(),origin:url.origin,path:url.pathname});return route.abort()
  })
  await page.goto(origin);return {context,page,unsafe,errors}
 }
 try{
  await t.test('restricted-child fixture reproduces deployed unavailable guard before any submission',async()=>{
   const {context,page,unsafe}=await open({legacy:true})
   try{await page.waitForFunction(()=>window.__legacyError);assert.equal(await page.evaluate(()=>window.__legacyError),messages.en.paymentInterface.formUnavailable);assert.equal(await page.evaluate(()=>window.__nativeBegins),0);assert.deepEqual(await page.evaluate(()=>window.__requests),[]);assert.deepEqual(unsafe,[])}finally{await context.close()}
  })
  for(const locale of ['en','ar'])for(const width of [390,1440])await t.test(locale+' '+width+' opens the SDK authorization fixture from a user gesture',async()=>{
   const {context,page,unsafe,errors}=await open({locale,width,dark:width===390})
   try{
    await page.locator('#paymob-apple').getByRole('button').waitFor();await page.waitForFunction(()=>!document.querySelector('[role=status]'))
    if(artifacts)await page.screenshot({path:resolve(artifacts,engine+'-'+locale+'-'+width+'.png'),fullPage:true})
    const button=page.locator('#paymob-apple').locator('#apple-pay-button');await button.click()
    await page.waitForFunction(()=>window.__nativeBegins===1)
    const observed=await page.evaluate(()=>({native:window.__nativeConstructions,requests:window.__requests,frames:document.querySelectorAll('iframe').length,overflow:document.documentElement.scrollWidth>innerWidth+1}))
    assert.equal(observed.native.length,1);assert.equal(observed.native[0].version,3);assert.equal(observed.native[0].request.currencyCode,'EGP');assert.equal(Number(observed.native[0].request.total.amount),3050)
    assert.equal(observed.frames,0);assert.equal(observed.overflow,false);assert.equal(observed.requests.filter(x=>x.body.action==='open').length,1);assert.equal(observed.requests.filter(x=>x.body.action==='submit').length,1);assert.ok(observed.requests.every(x=>x.retry===0));assert.deepEqual(unsafe,[]);assert.deepEqual(errors,[])
   }finally{await context.close()}
  })
  for(const [name,options,key]of [
   ['expired secret',{expired:true},'expired'],
   ['ineligible browser',{ineligible:true},'ineligible'],
   ['wrong CARD intention',{cardContext:true},null],
   ['interface request failure',{interfaceFailure:true},'unavailable'],
   ['SDK resource failure',{sdkMissing:true},'unavailable'],
   ['provider metadata failure',{metadataFailure:true,fastTimeout:true},'unavailable']
  ])await t.test(name+' retains recovery without submitting or creating another intention',async()=>{
   const {context,page,unsafe}=await open(options)
   try{await page.getByRole('alert').waitFor();const text=await page.getByRole('alert').innerText();assert.equal(text,key?messages.en.applePayment[key]:messages.en.paymentInterface.unavailable);const requests=await page.evaluate(()=>window.__requests);assert.equal(requests.filter(x=>x.body.action==='submit').length,0);assert.ok(requests.every(x=>x.path.endsWith('/'+id+'/interface')&&x.body.action==='open'&&x.retry===0));assert.deepEqual(unsafe,[])}finally{await context.close()}
  })
  await t.test('native initialization rejection becomes a sanitized recoverable error',async()=>{
   const {context,page,unsafe}=await open({nativeBlocked:true})
   try{await page.locator('#apple-pay-button').click();await page.getByRole('alert').waitFor();assert.equal(await page.getByRole('alert').innerText(),messages.en.applePayment.unavailable);assert.equal(await page.getByRole('button',{name:messages.en.embeddedCheckout.tryAgain,exact:true}).count(),1);assert.equal(await page.evaluate(()=>window.__nativeBegins),0);assert.equal((await page.evaluate(()=>window.__requests)).filter(x=>x.body.action==='submit').length,0);assert.deepEqual(await page.evaluate(()=>window.__phases.at(-1)),['[apple-payment]','SDK_RUNTIME']);assert.deepEqual(unsafe,[])}finally{await context.close()}
  })
  for(const lostAcknowledgement of [false,true])await t.test((lostAcknowledgement?'uncertain':'denied')+' submission gate never opens the sheet or permits a blind retry',async()=>{
   const {context,page,unsafe}=await open({denied:true,lostAcknowledgement})
   try{await page.locator('#apple-pay-button').click();await page.getByRole('alert').waitFor();assert.equal(await page.evaluate(()=>window.__nativeBegins),0);assert.equal(await page.getByRole('button',{name:messages.en.embeddedCheckout.tryAgain,exact:true}).count(),0);assert.equal(await page.evaluate(()=>window.__sdkOptions.beforePaymentComplete()),false);assert.equal((await page.evaluate(()=>window.__requests)).filter(x=>x.body.action==='submit').length,1);assert.deepEqual(unsafe,[])}finally{await context.close()}
  })
  await t.test('unsubmitted cancellation leaves through a full navigation without another intention or payment status claim',async()=>{
   const {context,page,unsafe}=await open()
   try{await page.locator('#apple-pay-button').waitFor();await page.evaluate(()=>window.__sdkOptions.onPaymentCancel({success:true}));assert.deepEqual(await page.evaluate(()=>window.__navigations),[{path:'/checkout',options:{external:true}}]);assert.equal((await page.evaluate(()=>window.__requests)).filter(x=>x.body.action==='submit').length,0);assert.deepEqual(unsafe,[])}finally{await context.close()}
  })
  await t.test('sheet cancellation keeps the server submission fence consumed',async()=>{
   const {context,page,unsafe}=await open()
   try{await page.locator('#apple-pay-button').click();await page.waitForFunction(()=>window.__nativeBegins===1);await page.evaluate(()=>window.__nativeSession.oncancel());assert.deepEqual(await page.evaluate(()=>window.__navigations),[{path:'/checkout',options:{external:true}}]);assert.equal(await page.evaluate(()=>window.__sdkOptions.beforePaymentComplete()),false);assert.equal((await page.evaluate(()=>window.__requests)).filter(x=>x.body.action==='submit').length,1);assert.deepEqual(unsafe,[])}finally{await context.close()}
  })
  await t.test('browser success/replayed callbacks only navigate to server status, never create or pay an order',async()=>{
   const {context,page,unsafe}=await open()
   try{await page.locator('#apple-pay-button').waitFor();await page.evaluate(()=>{window.__sdkOptions.afterPaymentComplete({success:true,paid:true,orderId:'untrusted'});window.__sdkOptions.afterPaymentComplete({success:true})});assert.deepEqual(await page.evaluate(()=>window.__navigations),[{path:'/checkout/session/'+id,options:{external:true}}]);assert.ok((await page.evaluate(()=>window.__requests)).every(x=>x.body.action==='open'));assert.deepEqual(unsafe,[])}finally{await context.close()}
  })
  await t.test('account change clears private data and late callbacks cannot navigate to old payment details',async()=>{
   const {context,page,unsafe}=await open()
   try{await page.locator('#apple-pay-button').waitFor();await page.evaluate(()=>{window.__invalidate();window.__sdkOptions.afterPaymentComplete({success:true})});assert.deepEqual(await page.evaluate(()=>window.__navigations),[{path:'/login',options:{external:true}}]);assert.equal(await page.locator('#paymob-apple').textContent(),'');assert.deepEqual(unsafe,[])}finally{await context.close()}
  })
 }finally{await browser.close()}
})}finally{await new Promise(resolve=>server.close(resolve))}
