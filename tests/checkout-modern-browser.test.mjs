import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFile,readdir,mkdir} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {createServer} from 'node:http'
import {build} from 'esbuild'
import {parse,compileScript} from '@vue/compiler-sfc'

// Modern checkout in a real browser: saved details, automatic delivery,
// payment marks, one-tap payment, mobile pay bar, EN/AR and light/dark.
const icons=['arrow-left','lock','clock','info','triangle-alert','shopping-bag','chevron-down','circle-alert','check','map-pin','pencil','plus','shield-check','smartphone','tag','credit-card','banknote','landmark','badge-dollar-sign']

test('modern checkout browser qualification',{timeout:240000},async t=>{
 const engine=process.env.CHECKOUT_REVIEW_ENGINE||'chromium',pw=await import(process.env.COD_REVIEW_PLAYWRIGHT),shots=process.env.CHECKOUT_MODERN_SCREENSHOTS
 let helper=await readFile('tests/helpers/normalPurchaseBrowser.js','utf8')
 helper=helper.replace("app.component('Icon', { render: () => h('span') })","app.component('Icon', { props: ['name', 'size'], setup: props => () => { const i = fixture.icons[String(props.name).replace('lucide:', '')]; return i ? h('svg', { width: props.size || 20, height: props.size || 20, viewBox: '0 0 24 24', innerHTML: i, 'aria-hidden': 'true' }) : h('span') } })")
 // Harness translation: choose the singular/plural form like vue-i18n.
 helper=helper.replace("  if (typeof value !== 'string') throw Error('Missing translation: ' + key)","  if (typeof value !== 'string') throw Error('Missing translation: ' + key)\n  if (value.includes(' | ') && 'count' in values) value = value.split(' | ')[values.count === 1 ? 0 : 1]")
 helper=helper.replace("if (path === '/api/payments/capabilities') {","if (path === '/api/payments/capabilities') {\n    if (fixture.apple) return { card: { available: true, initiationAvailable: true, mode: 'live', experience: 'redirect' }, express: [{ method: 'apple_pay', available: true, experience: 'redirect' }], purchase: { available: true, restricted: false } }")
 helper=helper.replace("if (path === '/api/checkout/shipping') return { options: [{ id: fixture.companyId, name: 'Synthetic PDC', price: 10, governorates: ['Cairo'] }] }","if (path === '/api/checkout/shipping') return { options: [{ id: fixture.companyId, name: 'Synthetic PDC', price: 10, governorates: ['Cairo'], cashAvailable: true }, { id: fixture.expressId, name: 'Synthetic Express', price: 45, governorates: ['Cairo'], cashAvailable: true }] }")
 helper=helper.replace('siteUrl: fixture.siteUrl }','siteUrl: fixture.siteUrl, paymentFirstEnabled: fixture.paymentFirst === true }')
 helper=helper.replace("  if (path === '/api/checkout') {","  if (path === '/api/checkout' && fixture.paymentFirst) window.__reportCheckout?.(JSON.parse(JSON.stringify(options.body)))\n  if (path === '/api/checkout' && fixture.paymentFirst) return { created: true, checkout: { id: fixture.orderId, totalAmount: 110, currency: 'EGP', expiresAt: new Date(Date.now() + 1800000).toISOString() }, payment: { provider: 'paymob', mode: 'live', publicKey: 'pk_live_fixture', clientSecret: 'csk_live_fixture', experience: 'redirect', paymentMethods: [options.body.paymob_method === 'apple_pay' ? 'apple-pay' : 'card'] } }\n  if (path === '/api/checkout') {")
 const compiled=await build({entryPoints:[resolve('tests/helpers/normalPurchaseBrowser.js')],bundle:true,write:false,format:'iife',platform:'browser',alias:{'~':resolve('app')},
  define:{'import.meta.client':'true','process.env.NODE_ENV':'"test"',__VUE_OPTIONS_API__:'true',__VUE_PROD_DEVTOOLS__:'false',__VUE_PROD_HYDRATION_MISMATCH_DETAILS__:'false'},
  plugins:[{name:'checkout-modern-browser',setup(b){
   b.onResolve({filter:/^normal-purchase-page$/},()=>({path:resolve('app/pages/checkout/index.vue')}))
   b.onLoad({filter:/normalPurchaseBrowser\.js$/},()=>({contents:helper,resolveDir:resolve('tests/helpers'),loader:'js'}))
   b.onLoad({filter:/\.vue$/},async({path})=>({contents:compileScript(parse(await readFile(path,'utf8'),{filename:path}).descriptor,{id:path,inlineTemplate:true}).content,resolveDir:dirname(path),loader:'js'}))
  }}]})
 const cssDir=process.env.CHECKOUT_REVIEW_CSS_DIR||resolve('.output/public/_nuxt')
 const css=(await Promise.all((await readdir(cssDir)).filter(x=>x.endsWith('.css')).map(x=>readFile(cssDir+'/'+x,'utf8')))).join('\n')
 assert.match(css,/\.checkout-modern/,'Build the app before this test')
 const messages=Object.fromEntries(await Promise.all(['en','ar'].map(async l=>[l,JSON.parse(await readFile('i18n/locales/'+l+'.json','utf8'))])))
 const lucide=JSON.parse(await readFile('node_modules/@iconify-json/lucide/icons.json','utf8')).icons,iconBodies=Object.fromEntries(icons.map(n=>[n,lucide[n]?.body||'']))
 const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60"><rect width="60" height="60" rx="8" fill="#e8eefb"/><rect x="14" y="20" width="32" height="20" rx="4" fill="#0654e9"/></svg>')
 let scenario
 const fixture=(locale,extra={})=>{
  const actorId=randomUUID(),productId=randomUUID(),variantId=randomUUID()
  return {locale,messages:messages[locale],icons:iconBodies,checkoutStyle:'modern',publicAccess:true,actorId,allowedId:actorId,productId,variantId,orderId:randomUUID(),companyId:randomUUID(),expressId:randomUUID(),quoteId:randomUUID(),siteUrl:'https://store.example.invalid',
   profile:{full_name:'Synthetic Buyer',phone:'01012345678',email:'fixture@example.invalid',address_line_1:'Owned saved street',address_line_2:'Owned unit',city:'Fixture city',state:'Cairo'},
   ordersByActor:{},orderItems:[],cart:{version:3,id:randomUUID(),revision:randomUUID(),coupon:null,items:[{id:productId,variant_id:variantId,quantity:2,price:50,stock_quantity:5,allow_out_of_stock_purchases:true,is_serialized:true,selling_mode:'normal',title:'Synthetic item',image_url:image}]},...extra}
 }
 const server=createServer((req,res)=>{
  res.setHeader('content-type',req.url==='/fixture.js'?'text/javascript':'text/html;charset=utf-8')
  res.end(req.url==='/fixture.js'?compiled.outputFiles[0].text:'<!doctype html><html lang="'+scenario.locale+'" dir="'+(scenario.locale==='ar'?'rtl':'ltr')+'" class="'+(scenario.dark?'dark':'')+'"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body class="storefront"><div id="app"></div><script>window.__fixture='+JSON.stringify(scenario)+'</script><script src="/fixture.js"></script></body></html>')
 })
 await new Promise(r=>server.listen(0,'127.0.0.1',r))
 const origin='http://127.0.0.1:'+server.address().port,browser=await pw[engine].launch(engine==='chromium'?{headless:true,channel:'chrome'}:{headless:true,executablePath:process.env.REVIEW_WEBKIT_EXECUTABLE})
 const open=async(width,height=900)=>{
  const page=await browser.newPage({viewport:{width,height}}),errors=[],blocked=[];page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message))
  if(scenario.apple)await page.addInitScript(()=>{window.ApplePaySession={canMakePayments:()=>true,supportsVersion:()=>true}})
  const reported=[];await page.exposeFunction('__reportCheckout',body=>{reported.push(body)})
  await page.route('**/*',r=>r.request().url().startsWith(origin)&&r.request().method()==='GET'?r.continue():(blocked.push(r.request().url()),r.abort()))
  await page.goto(origin);await page.locator('.checkout-modern').waitFor();return {page,errors,blocked,reported}
 }
 const primary=(page,width)=>page.locator(width<1024?'.cm-paybar .cm-primary':'.cm-primary-desktop')
 if(shots)await mkdir(shots,{recursive:true})
 try{
  for(const locale of ['en','ar'])for(const width of [1440,390])for(const dark of [false,true])await t.test(`${locale} ${width} ${dark?'dark':'light'} saved details are ready for one-tap payment`,async()=>{
   scenario={...fixture(locale,{apple:true,paymentFirst:true}),dark};const {page,errors,blocked,reported}=await open(width)
   try{
    const summary=page.getByTestId('saved-address-summary');await summary.waitFor()
    assert.match(await summary.textContent(),/Synthetic Buyer/);assert.match(await summary.textContent(),/Owned saved street/)
    assert.equal(await page.locator('#checkout-address-fields').isVisible(),false)
    // Cheapest delivery is preselected; card and Apple Pay show real marks.
    assert.equal(await page.locator('input[name="delivery-method"]:checked').inputValue(),scenario.companyId)
    for(const label of ['Visa','Mastercard','Apple Pay'])assert.equal(await page.locator(`svg[aria-label="${label}"]`).first().isVisible(),true,label)
    const pay=primary(page,width);await page.waitForFunction(width<1024?'!document.querySelector(".cm-paybar .cm-primary").disabled':'!document.querySelector(".cm-primary-desktop").disabled')
    assert.match(await pay.textContent(),locale==='en'?/Pay/:/ادفع/)
    if(width<1024){assert.equal(await page.locator('.cm-paybar').isVisible(),true);assert.equal(await page.locator('.cm-summary').isVisible(),false)}
    else{assert.equal(await page.locator('.cm-summary').isVisible(),true);assert.equal(await page.locator('.cm-paybar').isVisible(),false)}
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);assert.equal(overflow,false,'No horizontal scroll')
    if(shots)await page.screenshot({path:`${shots}/modern-${locale}-${width}-${dark?'dark':'light'}.png`,fullPage:true})
    // Changing delivery reprices without losing the visible total.
    await page.locator(`input[name="delivery-method"][value="${scenario.expressId}"]`).check({force:true})
    assert.equal(await page.locator('input[name="delivery-method"]:checked').inputValue(),scenario.expressId)
    await page.locator(`input[name="delivery-method"][value="${scenario.companyId}"]`).check({force:true})
    await page.waitForFunction(width<1024?'!document.querySelector(".cm-paybar .cm-primary").disabled':'!document.querySelector(".cm-primary-desktop").disabled')
    await primary(page,width).click()
    for(let i=0;i<80&&!(reported.length&&blocked.length);i++)await new Promise(r=>setTimeout(r,50))
    assert.equal(reported.length,1);const sent=reported[0]
    assert.equal(sent.payment_method,'card');assert.equal(sent.shipping_company_id,scenario.companyId);assert.equal(sent.quote_id,scenario.quoteId)
    assert.equal(sent.address.street_address,'Owned saved street');assert.equal(sent.paymob_method,'card');assert.equal(sent.payment_ui_version,2)
    // The browser leaves for Paymob's hosted page; the harness blocks that navigation.
    assert.deepEqual(errors,[]);assert.equal(blocked.length,1);assert.ok(blocked[0].startsWith('https://accept.paymob.com/unifiedcheckout/'),blocked[0])
   }finally{await page.close()}
  })

  await t.test('incomplete address opens the form instead of paying',async()=>{
   scenario={...fixture('en'),profile:{full_name:'Synthetic Buyer',phone:'',email:'fixture@example.invalid'}};const {page,errors}=await open(390)
   try{
    await page.locator('#checkout-address-fields').waitFor()
    const pay=primary(page,390);assert.match(await pay.textContent(),/Add delivery details/)
    await pay.click();assert.equal(await page.locator('#checkout-address-fields').isVisible(),true)
    assert.equal(await page.evaluate(()=>window.__requests.some(r=>r.path==='/api/checkout')),false)
    if(shots)await page.screenshot({path:`${shots}/modern-en-390-new-address.png`,fullPage:true})
    assert.deepEqual(errors,[])
   }finally{await page.close()}
  })

  await t.test('cash on delivery is one tap and keeps the delivery choice',async()=>{
   scenario=fixture('en');const {page,errors}=await open(1440)
   try{
    await page.getByTestId('saved-address-summary').waitFor()
    await page.locator('input[name="payment-method"][value="cash"]').check({force:true})
    await page.waitForFunction('!document.querySelector(".cm-primary-desktop").disabled')
    assert.match(await primary(page,1440).textContent(),/Place order/)
    await primary(page,1440).click();await page.waitForFunction(()=>window.__requests.some(r=>r.path==='/api/checkout'))
    const sent=await page.evaluate(()=>window.__requests.find(r=>r.path==='/api/checkout').body)
    assert.equal(sent.payment_method,'cash');assert.equal(sent.shipping_company_id,scenario.companyId)
    assert.deepEqual(errors,[])
   }finally{await page.close()}
  })

  await t.test('classic stays the default layout',async()=>{
   scenario={...fixture('en'),checkoutStyle:'classic'};const page=await browser.newPage({viewport:{width:1440,height:900}})
   try{await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());await page.goto(origin);await page.getByTestId('saved-address-summary').waitFor();assert.equal(await page.locator('.checkout-modern').count(),0)}
   finally{await page.close()}
  })
 }finally{await browser.close();await new Promise(r=>server.close(r))}
})
