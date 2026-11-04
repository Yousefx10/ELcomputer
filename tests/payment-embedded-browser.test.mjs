import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFile,readdir,mkdir} from 'node:fs/promises'
import {resolve,dirname,join} from 'node:path'
import {createServer} from 'node:http'
import {build} from 'esbuild'
import {parse,compileScript} from '@vue/compiler-sfc'

test('focused embedded checkout and single-read status qualification',{timeout:240000},async t=>{
 const engine=process.env.CHECKOUT_REVIEW_ENGINE||'chromium',pw=await import(process.env.COD_REVIEW_PLAYWRIGHT),pages={checkout:'app/pages/checkout/index.vue',status:'app/components/payment/CheckoutStatus.vue'},bundles={}
 let base=await readFile('tests/helpers/normalPurchaseBrowser.js','utf8');base=base.replace("if (fixture.publicAccess) return { card:","if (fixture.publicAccess) return { express: fixture.apple ? [{method:'apple_pay',available:true}] : [], card:").replace("available: true, initiationAvailable: true, mode: 'live'","available: true, initiationAvailable: true, mode: 'live', experience: fixture.pixel ? 'embedded' : 'redirect'")
 for(const[k,file]of Object.entries(pages)){
 let helper=base.replace("app.component('PaymentPaymobPixel', { setup: (_, context) => () => h('button', { 'data-fixture-pixel': 'true', onClick: () => context.emit('complete') }, 'Synthetic secure fields') })","app.component('PaymentPaymobPixel',{props:['session','authorize'],setup:(props,context)=>{window.__pixelUnavailable=beforeSubmit=>context.emit('unavailable',{beforeSubmit});window.__pixelCancel=()=>context.emit('cancel');window.__pixelAuthorize=()=>props.authorize?.();window.__pixelSession=props.session;return()=>h('button',{'data-fixture-pixel':'true',onClick:()=>context.emit('complete')},'Synthetic secure fields')}})").replace("import Component from 'normal-purchase-page'","import Component from 'normal-purchase-page'\nimport CheckoutStatus from '../../app/components/payment/CheckoutStatus.vue'")
 helper=helper.replace("uiNavigateTo: async value => { window.__navigations.push(value) }","uiNavigateTo: async (value,options) => { window.__navigations.push(value); (window.__navigationOptions ||= []).push(options) }")
 helper=helper.replace('payment_cash_enabled: true','payment_cash_enabled: false').replace('payment_bank_transfer_enabled: true, payment_instapay_enabled: true','payment_bank_transfer_enabled: false, payment_instapay_enabled: false')
 helper=helper.replace('siteUrl: fixture.siteUrl }','siteUrl: fixture.siteUrl, paymentFirstEnabled: true }').replace("params: { id: fixture.orderId }, query: { order_id: fixture.orderId }","params: { id: fixture.orderId }, query: {}")
 helper=helper.replace("  if (path === '/api/checkout') {",`  if (path === '/api/checkout') {
    if(fixture.blocked)return {created:false,allowed:false,blocked:true,checkout:structuredClone(fixture.checkout)}
    if(fixture.restartOnce&&!fixture.restarted){fixture.restarted=true;throw Object.assign(Error('Isolated cart restart'),{data:{data:{code:'checkout:restart'}}})}
    return {created:!window.__fixture.resume,checkout:window.__fixture.checkout,payment:window.__fixture.uncertain?undefined:{provider:'paymob',mode:'live',publicKey:'pk_live_fixture',clientSecret:'csk_live_fixture',interfaceToken:'00000000-0000-4000-8000-000000000002',experience:window.__fixture.pixel?'embedded':'redirect',paymentMethods:[options.body.paymob_method==='apple_pay'?'apple-pay':'card'],redirectFallback:options.body.paymob_method!=='apple_pay'}}
  }
  if (false) {`)
 helper=helper.replace("const app = createApp",`const originalRequest=globalThis.$fetch
 globalThis.useAdminAccess=()=>({adminUser:ref({role:'owner',is_active:true}),hasPermission:()=>true})
 globalThis.$fetch=async(path,options={})=>{
  if(path.startsWith('/api/account/payment-checkouts')||path.startsWith('/api/admin-transfers')){
   const body=options.body instanceof FormData ? {requestId:options.body.get('requestId'),revision:options.body.get('revision'),reference:options.body.get('reference')} : options.body
   if(options.headers?.authorization!=='Bearer synthetic-'+fixture.allowedId)throw Error('Foreign private session denied')
   window.__requests.push({path,method:options.method||'GET',body,retry:options.retry})
   if(path.endsWith('/interface')){
    if(options.body.action==='open')return {allowed:true,checkout:structuredClone(fixture.checkout),payment:{publicKey:'pk_live_fixture',clientSecret:'csk_live_fixture',interfaceToken:'00000000-0000-4000-8000-000000000002',expiresAt:new Date(Date.now()+1800000).toISOString(),experience:fixture.pixel?'embedded':'redirect',paymentMethods:['card'],redirectFallback:true}}
    if(fixture.deniedAuthorization)return {allowed:false,checkout:structuredClone(fixture.checkout)}
    fixture.checkout.canResume=false;fixture.checkout.interfaceState='submitted';return {allowed:true,checkout:structuredClone(fixture.checkout)}
   }
   if(path.endsWith('/settings'))return {revision:0,...fixture.config}
   if(path==='/api/admin-transfers')return {items:[{sessionId:fixture.orderId,reference:'TRF-FIXTURE',state:'under_review',revision:1,proofId:null,settingsRevision:1,recipient:fixture.checkout.transfer.recipient,totalAmount:'110.00',currency:'EGP'}]}
   if(options.method==='POST'&&path.endsWith('/proof')){fixture.checkout.transfer.state='under_review';fixture.checkout.transfer.revision=1;return {checkout:structuredClone(fixture.checkout)}}
   if(path==='/api/account/payment-checkouts')return {items:[structuredClone(fixture.checkout)]}
   return {checkout:structuredClone(fixture.checkout)}
  }
  return originalRequest(path,options)
 }
 const app = createApp`)
 helper=helper.replace("app.component('AddressLocationFields'", "app.component('PaymentCheckoutStatus',CheckoutStatus)\napp.component('NuxtLink',{props:['to'],setup:(_,c)=>()=>h('a',c.slots.default?.())})\napp.component('AddressLocationFields'")
 const bundle=await build({entryPoints:[resolve('tests/helpers/normalPurchaseBrowser.js')],bundle:true,write:false,format:'iife',platform:'browser',alias:{'~':resolve('app')},define:{'import.meta.client':'true','process.env.NODE_ENV':'"test"',__VUE_OPTIONS_API__:'true',__VUE_PROD_DEVTOOLS__:'false',__VUE_PROD_HYDRATION_MISMATCH_DETAILS__:'false'},plugins:[{name:'owned-pages',setup(b){b.onResolve({filter:/^normal-purchase-page$/},()=>({path:resolve(file)}));b.onLoad({filter:/normalPurchaseBrowser\.js$/},()=>({contents:helper,resolveDir:resolve('tests/helpers'),loader:'js'}));b.onLoad({filter:/\.vue$/},async({path})=>({contents:compileScript(parse(await readFile(path,'utf8'),{filename:path}).descriptor,{id:path,inlineTemplate:true}).content,resolveDir:dirname(path),loader:'js'}))}}]});bundles[k]=bundle.outputFiles[0].text
 }
 const css=(await Promise.all((await readdir('.output/public/_nuxt')).filter(x=>x.endsWith('.css')).map(x=>readFile('.output/public/_nuxt/'+x,'utf8')))).join('\n'),messages=Object.fromEntries(await Promise.all(['en','ar'].map(async l=>[l,JSON.parse(await readFile('i18n/locales/'+l+'.json','utf8'))])))
 let scenario,kind
 const fixture=(locale='en')=>{const actorId=randomUUID(),productId=randomUUID(),variantId=randomUUID(),id=randomUUID(),cartId=randomUUID(),lineId=randomUUID(),revision=randomUUID(),recipient={name:'Verified fixture recipient',address:'private-bank@fixture.invalid',instructions_en:'Transfer the exact amount shown.',instructions_ar:'حوّل المبلغ المحدد إلى الحساب الظاهر.',mime_types:['image/png','application/pdf'],max_bytes:5242880,max_proofs:3};return {locale,messages:messages[locale],actorId,allowedId:actorId,productId,variantId,orderId:id,companyId:randomUUID(),quoteId:randomUUID(),addressesByActor:{[actorId]:[{id:randomUUID(),revision:1,label:'Home',first_name:'Owned',last_name:'Buyer',street_address:'Owned street',address_line_2:'',city:'Ramses',governorate:'Cairo',phone:'01012345678'}]},publicAccess:true,siteUrl:'https://store.example.invalid',profile:{full_name:'Owned buyer',phone:'01012345678',email:'fixture@example.invalid',address_line_1:'Owned street',city:'Ramses',state:'Cairo'},pageProps:{sessionId:id},cart:{version:3,id:cartId,revision,coupon:null,items:[{id:productId,variant_id:variantId,cart_key:productId+':'+variantId,cart_line_id:lineId,quantity:1,price:100,stock_quantity:5,is_serialized:true,selling_mode:'normal',title:'Owned product'}]},checkout:{id,method:'card',address:{first_name:'Owned',street_address:'Private snapshot street',city:'Ramses'},items:[{product_title:'Frozen snapshot item',quantity:1,line_total:'100.00'}],reference:'CHK-FIXTURE',paymentStatus:'verifying',totalAmount:'110.00',currency:'EGP',cartId,cartRevision:revision,cartLines:[{cart_key:productId+':'+variantId,cart_line_id:lineId,quantity:1}],transfer:{reference:'TRF-FIXTURE',state:'awaiting_proof',revision:0,recipient}},config:{enabled:false,recipient_name:recipient.name,recipient_address:recipient.address,recipient_verified:true,instructions_en:recipient.instructions_en,instructions_ar:recipient.instructions_ar,mime_types:recipient.mime_types,max_bytes:5242880,max_proofs:3}}}
 const server=createServer((req,res)=>{res.setHeader('content-type',req.url==='/bundle.js'?'text/javascript;charset=utf-8':'text/html;charset=utf-8');res.end(req.url==='/bundle.js'?bundles[kind]:'<!doctype html><html dir="'+(scenario.locale==='ar'?'rtl':'ltr')+'" class="'+(scenario.dark?'dark':'')+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><div id="app"></div><script>window.__fixture='+JSON.stringify(scenario)+'</script><script src="/bundle.js"></script></body></html>')})
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chrome'}:{executablePath:process.env.REVIEW_WEBKIT_EXECUTABLE})}),artifact=process.env.PAYMENT_REVIEW_ARTIFACTS;if(artifact)await mkdir(artifact,{recursive:true})
 const open=async width=>{const page=await browser.newPage({viewport:{width,height:900}}),errors=[],handoffs=[];page.setDefaultTimeout(6000);await page.addInitScript(eligible=>{window.ApplePaySession=class{static canMakePayments(){return eligible}static supportsVersion(){return true}}},scenario.appleDevice!==false);page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',async r=>{const u=new URL(r.request().url());if(u.origin===origin)return r.continue();if(u.origin==='https://accept.paymob.com'&&u.pathname==='/unifiedcheckout/'){handoffs.push(u.href);return r.fulfill({contentType:'text/html',body:'<h1>Local payment interception</h1>'})}return r.abort()});await page.goto(origin);await page.waitForFunction(()=>document.querySelector('#app')?.textContent?.trim());return {page,errors,handoffs}}
 try{
 for(kind of (process.env.PAY_FIRST_DEBUG?['checkout','status','transfer','review','settings','activity']:Object.keys(pages)))for(const locale of (process.env.PAY_FIRST_DEBUG?['en']:['en','ar']))for(const width of (process.env.PAY_FIRST_DEBUG?[390]:[390,1440]))for(const dark of (process.env.PAY_FIRST_DEBUG?[false]:[false,true]))await t.test(`${engine} ${kind} ${locale} ${width} ${dark?'dark':'light'}`,async()=>{scenario={...fixture(locale),dark};if(kind==='activity'||kind==='transfer')scenario.checkout.method='instapay';const{page,errors}=await open(width);try{if(kind==='checkout')await page.getByTestId('saved-address-toggle').waitFor();else await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);assert.ok(!await page.locator('body').innerText().then(s=>s.includes('transfer.states.')||s.includes('paymentFirst.')||s.includes('paymentInterface.')));const requests=await page.evaluate(()=>window.__requests);assert.equal(requests.filter(x=>x.method==='POST'||x.method==='PATCH').length,0);assert.equal(requests.filter(x=>x.path==='/api/payments/intentions').length,0);if(artifact&&width===390&&dark===false)await page.screenshot({path:join(artifact,engine+'-'+kind+'-'+locale+'.png'),fullPage:true})}catch(e){if(artifact){await page.screenshot({path:join(artifact,engine+'-failure.png'),fullPage:true});await (await import('node:fs/promises')).writeFile(join(artifact,engine+'-failure.json'),JSON.stringify({message:e.message,errors,body:await page.locator('body').innerText()},null,2))}throw e}finally{await page.close()}})
 kind='checkout'
 await t.test('explicit final confirmation opens once and retains the unpaid cart',async()=>{scenario=fixture();const{page,errors,handoffs}=await open(390);try{await page.locator('input[name=delivery-method]').check();await page.getByRole('button',{name:scenario.messages.common.continueToPayment,exact:true}).click();await page.getByRole('button',{name:scenario.messages.paymentInterface.pay,exact:true}).evaluate(e=>{e.click();e.click()});await page.getByRole('heading',{name:'Local payment interception'}).waitFor();assert.equal(handoffs.length,1);await page.goBack();await page.waitForFunction(()=>window.__cartMemory()?.items?.length);assert.equal((await page.evaluate(()=>window.__cartMemory())).items[0].quantity,1);assert.deepEqual(errors,[])}finally{await page.close()}})
 await t.test('uncertain start creates no second intention and preserves recoverable cart',async()=>{scenario={...fixture(),uncertain:true};const{page,errors,handoffs}=await open(390);try{await page.locator('input[name=delivery-method]').check();await page.getByRole('button',{name:scenario.messages.common.continueToPayment,exact:true}).click();await page.getByRole('button',{name:scenario.messages.paymentInterface.pay,exact:true}).click();await page.waitForFunction(()=>window.__navigations.length);assert.ok((await page.evaluate(()=>window.__cartMemory())).items.length);assert.equal((await page.evaluate(()=>window.__requests)).filter(x=>x.path==='/api/checkout').length,1);assert.equal(handoffs.length,0);assert.deepEqual(errors,[])}finally{await page.close()}})
 kind='checkout'

 await t.test('a stale retained command cannot redirect an independent purchase to its old payment',async()=>{
  scenario={...fixture('ar'),pixel:true};const{page,errors}=await open(390)
  try{
   const stale={version:1,userId:scenario.actorId,body:{cart_id:randomUUID(),quote_id:randomUUID(),payment_method:'card'},cart:{revision:randomUUID()},review:{lines:[]}}
   await page.evaluate(c=>localStorage.setItem('elcomputer-checkout-pending-'+c.userId,JSON.stringify(c)),stale)
   await page.reload();await page.getByTestId('saved-address-toggle').waitFor()
   await page.locator('input[name=delivery-method]').check();await page.getByRole('button',{name:scenario.messages.common.continueToPayment,exact:true}).click()
   await page.getByRole('button',{name:scenario.messages.paymentInterface.pay,exact:true}).click();await page.locator('[data-fixture-pixel]').waitFor()
   const commands=(await page.evaluate(()=>window.__requests)).filter(r=>r.path==='/api/checkout')
   assert.equal(commands.length,1);assert.notEqual(commands[0].body.cart_id,stale.body.cart_id)
   assert.deepEqual(await page.evaluate(()=>window.__navigations),[])
   assert.equal(await page.evaluate(c=>Object.values(localStorage).some(v=>v===JSON.stringify(c)),stale),true)
   assert.deepEqual(errors,[])
  }finally{await page.close()}
 })
 await t.test('an affected unresolved payment keeps checkout editable with a private status reference',async()=>{
  scenario={...fixture(),pixel:true,blocked:true};const{page,errors,handoffs}=await open(390)
  try{
   await page.locator('input[name=delivery-method]').check();await page.getByRole('button',{name:scenario.messages.common.continueToPayment,exact:true}).click()
   await page.getByRole('button',{name:scenario.messages.paymentInterface.pay,exact:true}).click()
   await page.getByRole('alert').filter({hasText:scenario.messages.paymentInterface.affectedStatus}).waitFor()
   assert.equal(await page.locator('[data-fixture-pixel]').count(),0)
   assert.deepEqual(await page.evaluate(()=>window.__navigations),[]);assert.equal(handoffs.length,0)
   assert.equal((await page.evaluate(()=>window.__requests)).filter(r=>r.path==='/api/checkout').length,1)
   await page.getByRole('button',{name:scenario.messages.common.backToDelivery,exact:true}).click()
   await page.getByTestId('saved-address-toggle').waitFor();assert.ok((await page.evaluate(()=>window.__cartMemory())).items.length)
   assert.deepEqual(errors,[])
  }finally{await page.close()}
 })
 await t.test('scoped embedded CARD mounts once and refresh hides ordinary recovery warnings',async()=>{
  scenario={...fixture(),pixel:true};const{page,errors,handoffs}=await open(390)
  try{await page.locator('input[name=delivery-method]').check();await page.getByRole('button',{name:scenario.messages.common.continueToPayment,exact:true}).click();await page.getByRole('button',{name:scenario.messages.paymentInterface.pay,exact:true}).evaluate(e=>{e.click();e.click()});await page.locator('[data-fixture-pixel]').waitFor();assert.equal(await page.locator('[data-fixture-pixel]').count(),1);assert.equal(handoffs.length,0);assert.equal((await page.evaluate(()=>window.__requests)).filter(x=>x.path==='/api/checkout').length,1);assert.ok((await page.evaluate(()=>window.__cartMemory())).items.length);await page.reload();await page.getByTestId('saved-address-toggle').waitFor();assert.equal(await page.locator('[data-fixture-pixel]').count(),0);const text=await page.locator('body').innerText();assert.equal(text.includes('Recover this checkout before starting another.'),false);assert.equal(text.includes('Review your existing payment checkout.'),false);assert.equal((await page.evaluate(()=>window.__requests)).filter(x=>x.path==='/api/checkout').length,0);assert.deepEqual(errors,[])}finally{await page.close()}
 })
 await t.test('eligible Apple choice selects its single provider method; CARD remains available',async()=>{
  scenario={...fixture('ar'),pixel:true,apple:true};const{page,errors}=await open(390)
  try{await page.locator('input[name=delivery-method]').check();await page.getByRole('button',{name:scenario.messages.common.continueToPayment,exact:true}).click();await page.locator('input[name=payment-method][value=apple_pay]').check();await page.getByRole('button',{name:scenario.messages.paymentInterface.pay,exact:true}).click();await page.waitForFunction(()=>window.__navigations.length);assert.equal(await page.locator('[data-fixture-pixel]').count(),0);assert.deepEqual(await page.evaluate(()=>window.__navigationOptions),[{external:true}]);assert.equal((await page.evaluate(()=>window.__navigations))[0],'/checkout/apple/'+scenario.checkout.id);const command=(await page.evaluate(()=>window.__requests)).find(x=>x.path==='/api/checkout');assert.equal(command.body.payment_method,'card');assert.equal(command.body.paymob_method,'apple_pay');assert.equal((await page.evaluate(()=>window.__requests)).filter(x=>x.path==='/api/checkout').length,1);assert.deepEqual(errors,[])}finally{await page.close()}
 })
 await t.test('an unsubmitted form closes and reopens immediately without a global pending warning',async()=>{
  scenario={...fixture(),pixel:true};const{page,errors}=await open(390)
  try{
   await page.locator('input[name=delivery-method]').check();await page.getByRole('button',{name:scenario.messages.common.continueToPayment,exact:true}).click()
   await page.getByRole('button',{name:scenario.messages.paymentInterface.pay,exact:true}).click();await page.locator('[data-fixture-pixel]').waitFor()
   await page.getByRole('button',{name:scenario.messages.paymentInterface.back,exact:true}).click();assert.equal(await page.locator('[data-fixture-pixel]').count(),0)
   assert.equal((await page.locator('body').innerText()).includes(scenario.messages.embeddedCheckout.pending),false)
   await page.evaluate(()=>window.__fixture.resume=true)
   await page.getByRole('button',{name:scenario.messages.paymentInterface.pay,exact:true}).click();await page.locator('[data-fixture-pixel]').waitFor()
   const requests=await page.evaluate(()=>window.__requests);assert.equal(requests.filter(r=>r.path==='/api/checkout').length,2)
   assert.equal(requests.filter(r=>r.path.endsWith('/interface')).length,0)
   assert.equal(await page.evaluate(()=>Object.values(localStorage).some(v=>v.includes('csk_live_fixture'))),false)
   assert.equal((await page.evaluate(()=>window.__cartMemory())).items[0].quantity,1);assert.deepEqual(errors,[])
  }finally{await page.close()}
 })
 await t.test('refresh and immediate Pay reopen an acknowledged initialized session',async()=>{
  scenario={...fixture('ar'),pixel:true};const{page,errors}=await open(390)
  try{
   const confirm=async()=>{await page.locator('input[name=delivery-method]').check();await page.getByRole('button',{name:scenario.messages.common.continueToPayment,exact:true}).click();await page.getByRole('button',{name:scenario.messages.paymentInterface.pay,exact:true}).click();await page.locator('[data-fixture-pixel]').waitFor()}
   await confirm();scenario.resume=true;await page.reload();await page.getByTestId('saved-address-toggle').waitFor()
   assert.equal((await page.locator('body').innerText()).includes(scenario.messages.embeddedCheckout.pending),false)
   await confirm();assert.equal((await page.evaluate(()=>window.__requests)).filter(r=>r.path==='/api/checkout').length,1);assert.deepEqual(errors,[])
  }finally{await page.close()}
 })
 await t.test('an edited cart restarts once after a definitive server rollback',async()=>{
  scenario={...fixture(),pixel:true,restartOnce:true};const{page,errors}=await open(390)
  try{
   await page.locator('input[name=delivery-method]').check();await page.getByRole('button',{name:scenario.messages.common.continueToPayment,exact:true}).click()
   await page.getByRole('button',{name:scenario.messages.paymentInterface.pay,exact:true}).click();await page.locator('[data-fixture-pixel]').waitFor()
   const commands=(await page.evaluate(()=>window.__requests)).filter(r=>r.path==='/api/checkout');assert.equal(commands.length,2)
   assert.notEqual(commands[0].body.cart_id,commands[1].body.cart_id);assert.deepEqual(commands[0].body.items,commands[1].body.items)
   assert.equal(commands[1].retry,0);assert.deepEqual(errors,[])
  }finally{await page.close()}
 })
 await t.test('Apple secure-page handoff preserves cart and acknowledged session without a global recovery lock',async()=>{
  scenario={...fixture('ar'),pixel:true,apple:true};const{page,errors}=await open(390)
  try{
   await page.locator('input[name=delivery-method]').check();await page.getByRole('button',{name:scenario.messages.common.continueToPayment,exact:true}).click()
   await page.locator('input[name=payment-method][value=apple_pay]').check();await page.getByRole('button',{name:scenario.messages.paymentInterface.pay,exact:true}).click();await page.waitForFunction(()=>window.__navigations.length)
   assert.equal(await page.locator('[data-fixture-pixel]').count(),0)
   assert.equal((await page.evaluate(()=>window.__cartMemory())).items[0].quantity,1)
   assert.equal((await page.evaluate(()=>window.__navigations))[0],'/checkout/apple/'+scenario.checkout.id)
   assert.deepEqual(await page.evaluate(()=>window.__navigationOptions),[{external:true}])
   assert.equal((await page.evaluate(()=>window.__requests)).filter(x=>x.path.endsWith('/interface')).length,0);assert.deepEqual(errors,[])
  }finally{await page.close()}
 })
 await t.test('an ineligible device hides Apple while keeping CARD available',async()=>{scenario={...fixture(),pixel:true,apple:true,appleDevice:false};const{page,errors}=await open(390);try{await page.locator('input[name=delivery-method]').check();await page.getByRole('button',{name:scenario.messages.common.continueToPayment,exact:true}).click();assert.equal(await page.locator('input[name=payment-method][value=apple_pay]').count(),0);assert.equal(await page.locator('input[name=payment-method][value=card]').count(),1);assert.deepEqual(errors,[])}finally{await page.close()}})
 for(const beforeSubmit of [true,false])await t.test('hosted fallback is '+(beforeSubmit?'available before SDK submission':'withheld after SDK submission'),async()=>{scenario={...fixture(),pixel:true};const{page,errors}=await open(390);try{await page.locator('input[name=delivery-method]').check();await page.getByRole('button',{name:scenario.messages.common.continueToPayment,exact:true}).click();await page.getByRole('button',{name:scenario.messages.paymentInterface.pay,exact:true}).click();await page.locator('[data-fixture-pixel]').waitFor();await page.evaluate(before=>window.__pixelUnavailable(before),beforeSubmit);await page.waitForFunction(()=>!document.querySelector('[data-fixture-pixel]'));assert.equal(await page.getByRole('button',{name:scenario.messages.embeddedCheckout.hosted,exact:true}).count(),beforeSubmit?1:0);assert.ok((await page.evaluate(()=>window.__cartMemory())).items.length);assert.deepEqual(errors,[])}finally{await page.close()}})
 kind='status'
 await t.test('confirmed decline Try Again opens the same intention through one explicit server action',async()=>{
  scenario={...fixture('ar'),pixel:true};scenario.checkout.paymentStatus='failed';scenario.checkout.canResume=true
  const{page,errors}=await open(390)
  try{
   await page.getByRole('button',{name:scenario.messages.embeddedCheckout.tryAgain,exact:true}).click();await page.locator('[data-fixture-pixel]').waitFor()
   const requests=await page.evaluate(()=>window.__requests),writes=requests.filter(r=>r.method==='POST')
   assert.equal(writes.length,1);assert.equal(writes[0].path,'/api/account/payment-checkouts/'+scenario.checkout.id+'/interface');assert.equal(writes[0].body.action,'open');assert.equal(writes[0].retry,0)
   assert.equal(requests.filter(r=>r.path==='/api/checkout'||r.path==='/api/payments/intentions').length,0)
   assert.equal((await page.evaluate(()=>window.__cartMemory())).items[0].quantity,1);assert.deepEqual(errors,[])
  }finally{await page.close()}
 })
 await t.test('durable paid status clears purchased lines once, preserving new cart additions',async()=>{scenario=fixture();scenario.checkout.paymentStatus='paid';scenario.checkout.orderId=randomUUID();scenario.checkout.orderNumber='ORD-FIXTURE';scenario.cart.items[0].quantity=3;const{page,errors}=await open(390);try{await page.getByRole('heading',{name:scenario.messages.paymentFirst.confirmed}).waitFor();await page.waitForFunction(()=>window.__cartMemory()?.items?.[0]?.quantity===2);await page.reload();await page.waitForFunction(()=>window.__cartMemory()?.items?.[0]?.quantity===2);assert.deepEqual(errors,[])}finally{await page.close()}})
 await t.test('account changes clear private checkout details and stop stale responses',async()=>{scenario=fixture();const{page,errors}=await open(390);try{await page.locator('details summary').click();await page.getByText('Frozen snapshot item · 1 · 100.00 EGP',{exact:true}).waitFor();await page.evaluate(id=>window.__switchAccount(id),randomUUID());await page.waitForFunction(()=>!document.querySelector('#app').textContent.includes('Private snapshot street'));assert.equal(await page.getByText('Frozen snapshot item',{exact:false}).count(),0);assert.deepEqual(errors,[])}finally{await page.close()}})
 await t.test('a legacy unknown declined intention stays private until scoped reconciliation',async()=>{scenario=fixture();scenario.checkout.paymentStatus='failed';scenario.checkout.state='failed';scenario.checkout.fundsVerified=false;const{page,errors}=await open(390);try{await page.getByRole('heading',{name:scenario.messages.embeddedCheckout.failed}).waitFor();assert.equal(await page.getByRole('button',{name:scenario.messages.embeddedCheckout.tryAgain,exact:true}).isDisabled(),true);assert.ok((await page.evaluate(()=>window.__cartMemory())).items.length);assert.equal((await page.evaluate(()=>window.__requests)).filter(x=>x.method==='POST').length,0);assert.deepEqual(errors,[])}finally{await page.close()}})
 await t.test('explicit server retirement allows Try again while retaining cart items',async()=>{scenario=fixture();scenario.checkout.paymentStatus='failed';scenario.checkout.state='retired';scenario.checkout.fundsVerified=false;const{page,errors}=await open(390);try{const retry=page.getByRole('button',{name:scenario.messages.embeddedCheckout.tryAgain,exact:true});await retry.waitFor();assert.equal(await retry.isDisabled(),false);await retry.click();await page.waitForFunction(()=>window.__navigations.length);assert.ok((await page.evaluate(()=>window.__cartMemory())).items.length);assert.equal((await page.evaluate(()=>window.__requests)).filter(x=>x.method==='POST').length,0);assert.deepEqual(errors,[])}finally{await page.close()}})
 await t.test('pending status performs one initial read and no repeated polling',async()=>{scenario=fixture();const{page,errors}=await open(390);try{await page.getByRole('heading',{name:scenario.messages.embeddedCheckout.pending,exact:true}).waitFor();await page.waitForTimeout(3100);assert.equal((await page.evaluate(()=>window.__requests)).filter(x=>x.path.startsWith('/api/account/payment-checkouts/')).length,1);assert.ok((await page.evaluate(()=>window.__cartMemory())).items.length);assert.deepEqual(errors,[])}finally{await page.close()}})
 }finally{await browser.close();await new Promise(r=>server.close(r))}
})
