import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {createServer} from 'node:http'
import {resolve} from 'node:path'
import {build} from 'esbuild'
import {parse,compileScript} from '@vue/compiler-sfc'

test('actual EN/AR checkout displays separate merchandise and delivery discounts with EGP5 payable', {skip:!process.env.PDC_REVIEW_PLAYWRIGHT},async()=>{
 const{chromium}=await import(process.env.PDC_REVIEW_PLAYWRIGHT)
 const component=compileScript(parse(await readFile('app/pages/checkout/index.vue','utf8')).descriptor,{id:'coupon-checkout',inlineTemplate:true}).content
 let helper=await readFile('tests/helpers/normalPurchaseBrowser.js','utf8')
 helper=helper.replace("name: 'Synthetic PDC', price: 10","name: 'Manual fixture', price: 50").replace('totalAmount: 110, orderValue: 100, discountAmount: 0, paymentFee: 0, shippingFee: 10','totalAmount: 5, orderValue: 25, discountAmount: 70, deliveryDiscountAmount: 45, paymentFee: 0, shippingFee: 50').replace("code: 'ALICE_PRIVATE_COUPON', discountAmount: 1","code: 'FRE', discountAmount: 70, deliveryDiscountAmount: 45")
 const bundle=await build({entryPoints:[resolve('tests/helpers/normalPurchaseBrowser.js')],bundle:true,write:false,format:'iife',platform:'browser',alias:{'~':resolve('app')},define:{'import.meta.client':'true','process.env.NODE_ENV':'"test"',__VUE_OPTIONS_API__:'true',__VUE_PROD_DEVTOOLS__:'false',__VUE_PROD_HYDRATION_MISMATCH_DETAILS__:'false'},plugins:[{name:'actual-coupon-checkout',setup(b){b.onResolve({filter:/^normal-purchase-page$/},()=>({path:'checkout',namespace:'coupon-page'}));b.onLoad({filter:/.*/,namespace:'coupon-page'},()=>({contents:component,resolveDir:resolve('.'),loader:'js'}));b.onLoad({filter:/normalPurchaseBrowser\.js$/},()=>({contents:helper,resolveDir:resolve('tests/helpers'),loader:'js'}))}}]})
 let scenario;const server=createServer((req,res)=>{res.setHeader('content-type',req.url==='/fixture.js'?'text/javascript':'text/html; charset=utf-8');res.end(req.url==='/fixture.js'?bundle.outputFiles[0].text:'<!doctype html><html dir="'+(scenario.locale==='ar'?'rtl':'ltr')+'"><body><div id="app"></div><script>window.__fixture='+JSON.stringify(scenario)+'</script><script src="/fixture.js"></script></body></html>')})
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,channel:'chrome'})
 try{for(const locale of ['en','ar']){
  const messages=JSON.parse(await readFile('i18n/locales/'+locale+'.json','utf8')),actor=randomUUID(),product=randomUUID(),variant=randomUUID()
  scenario={locale,messages,actorId:actor,allowedId:actor,productId:product,variantId:variant,companyId:randomUUID(),quoteId:randomUUID(),orderId:randomUUID(),expiresAt:new Date(Date.now()+600000).toISOString(),siteUrl:'https://cedar.example.invalid',profile:{full_name:'Fixture Customer',email:'fixture@example.invalid',phone:'01012345678',address_line_1:'Fixture street',address_line_2:'Unit 1',city:'Fixture city',state:'Cairo'},cart:{version:2,id:randomUUID(),revision:randomUUID(),coupon:null,items:[{id:product,variant_id:variant,quantity:1,price:25,stock_quantity:3,is_serialized:true,selling_mode:'normal',title:'Coupon fixture'}]}}
  const page=await browser.newPage({viewport:{width:locale==='ar'?390:1100,height:900}});page.setDefaultTimeout(7000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());await page.goto(origin)
  await page.locator('select').nth(1).selectOption(scenario.companyId);await page.getByPlaceholder(messages.common.couponCode,{exact:true}).fill('FRE');await page.getByRole('button',{name:messages.common.apply,exact:true}).click();await page.getByText('Coupon applied.',{exact:true}).waitFor()
  const requests=await page.evaluate(()=>window.__requests),call=requests.find(r=>r.path==='/api/checkout/coupon');assert.ok(call);assert.equal(call.body.coupon_code,'FRE');assert.equal(call.body.items[0].id,product);assert.equal(call.body.shipping_company_id,scenario.companyId);assert.equal(call.body.payment_method,'card');assert.equal(call.body.address.address_line_2,'Unit 1');assert.equal('subtotal' in call.body,false)
  await page.getByRole('button',{name:messages.common.continueToPayment,exact:true}).click();await page.getByRole('button',{name:messages.common.confirmCheckout,exact:true}).waitFor();const quoteCalls=await page.evaluate(()=>window.__requests.filter(r=>r.path==='/api/checkout/quote'));assert.equal(quoteCalls.at(-1).body.coupon_code,'FRE')
  const totalText=await page.locator('dl > div').last().locator('dd').innerText(),digits=totalText.replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/٫/g,'.').match(/\d+(?:\.\d+)?/)?.[0];assert.equal(Number(digits),5)
  await page.getByText(messages.common.deliveryDiscount,{exact:true}).waitFor()
  const final=await page.evaluate(()=>window.__requests);assert.ok(!final.some(r=>r.path==='/api/checkout'||r.path==='/api/payments/intentions'));assert.deepEqual(errors,[]);await page.close()
 }}finally{await browser.close();await new Promise(r=>server.close(r))}
})
