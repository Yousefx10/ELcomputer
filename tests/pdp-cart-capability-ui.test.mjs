import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {createServer} from 'node:http'
import {resolve} from 'node:path'
import {build} from 'esbuild'
import {parse as parseVue,compileScript} from '@vue/compiler-sfc'
import {parse} from '@babel/parser'

test('actual PDP controls and cart handle delayed capabilities and unrecorded serialized stock', {skip:!process.env.PDC_REVIEW_PLAYWRIGHT},async t=>{
 const{chromium}=await import(process.env.PDC_REVIEW_PLAYWRIGHT),source=parseVue(await readFile('app/pages/products/[slug].vue','utf8')).descriptor.scriptSetup.content
 const names=['isPreorder','isComingSoon','allowOutOfStockPurchases','stockIndependentSale','productVariants','hasVariants','requiresVariantSelection','selectedVariant','effectiveStockQuantity','hasPurchasableVariants','maximumQuantity','isOutOfStock','canPurchaseProduct','addToCartLabel','handleAddToCart','premiumPurchasingEnabled']
 const nodes=parse(source,{sourceType:'module'}).program.body.filter(n=>n.type==='VariableDeclaration'&&n.declarations.some(d=>names.includes(d.id.name)));assert.equal(nodes.length,names.length)
 const methods=nodes.map(n=>source.slice(n.start,n.end)).join('\n'),bundles={}
 let helper=await readFile('tests/helpers/normalPurchaseBrowser.js','utf8');helper=helper.replace('useNuxtData: () => ({ data: ref({ settings: {} }) })','useNuxtData: () => ({ data: ref({ settings: fixture.siteSettings || {} }) })').replace('payment_bank_transfer_enabled: true, payment_instapay_enabled: true','payment_bank_transfer_enabled: true, payment_instapay_enabled: true, ...(fixture.siteSettings || {})')
 for(const layout of ['Classic','Premium']){
  const template=parseVue(await readFile('app/components/product/'+layout+'.vue','utf8')).descriptor.template.content.match(/<button\b[^>]*@click="handleAddToCart"[\s\S]*?<\/button>/)[0]
  const text=`<template><main>${template}<p role="status">{{cartMessage}}</p></main></template><script setup>
import {usesUnrecordedStockSales} from '~/utils/backorder'
import {useCart} from '~/composables/useCart'
import {usePurchaseAccess} from '~/composables/usePurchaseAccess'
const {data:siteContent}=useSiteContent(),{t}=useI18n()
const {addItem,syncCart,items:cartItems}=useCart()
const {scope:purchaseScope,allowsProduct,pending:purchasingPending}=usePurchaseAccess()
const product=ref(window.__fixture.product),selectedVariantId=ref(window.__fixture.variantId),selectedQuantity=ref(1),cartMessage=ref(''),selectedVariantImages=ref([]),hasColorChoices=ref(false),preorderAvailability=ref(null)
${methods}
const canOrder=computed(()=>premiumPurchasingEnabled.value&&canPurchaseProduct.value)
const refreshPreorderAvailability=()=>{}
</script>`
  const compiled=compileScript(parseVue(text).descriptor,{id:'actual-pdp-control',inlineTemplate:true}).content
  const result=await build({entryPoints:[resolve('tests/helpers/normalPurchaseBrowser.js')],bundle:true,write:false,format:'iife',platform:'browser',alias:{'~':resolve('app')},define:{'import.meta.client':'true','process.env.NODE_ENV':'"test"',__VUE_OPTIONS_API__:'true',__VUE_PROD_DEVTOOLS__:'false',__VUE_PROD_HYDRATION_MISMATCH_DETAILS__:'false'},plugins:[{name:'actual-pdp-purchase-controls',setup(b){b.onResolve({filter:/^normal-purchase-page$/},()=>({path:'pdp',namespace:'pdp'}));b.onLoad({filter:/.*/,namespace:'pdp'},()=>({contents:compiled,resolveDir:resolve('.'),loader:'js'}));b.onLoad({filter:/normalPurchaseBrowser\.js$/},()=>({contents:helper,resolveDir:resolve('tests/helpers'),loader:'js'}))}}]});bundles[layout]=result.outputFiles[0].text
 }
 let scenario,layout
 const server=createServer((req,res)=>{res.setHeader('content-type',req.url==='/fixture.js'?'text/javascript':'text/html; charset=utf-8');res.end(req.url==='/fixture.js'?bundles[layout]:'<!doctype html><html dir="'+(scenario.locale==='ar'?'rtl':'ltr')+'"><body><div id="app"></div><script>window.__fixture='+JSON.stringify(scenario)+'</script><script src="/fixture.js"></script></body></html>')})
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,channel:'chrome'})
 const fixture=async(locale='en')=>{const actorId=randomUUID(),productId=randomUUID(),variantId=randomUUID();return {locale,messages:JSON.parse(await readFile('i18n/locales/'+locale+'.json','utf8')),actorId,allowedId:actorId,productId,variantId,companyId:randomUUID(),quoteId:randomUUID(),orderId:randomUUID(),expiresAt:new Date(Date.now()+600000).toISOString(),siteUrl:'https://birch.example.invalid',siteSettings:{inventory_tracking_required:false,allow_out_of_stock_purchases:true},holdPaths:['/api/payments/capabilities'],product:{id:productId,title:'Fixture normal item',slug:'fixture-normal-item',price:25,is_serialized:true,selling_mode:'normal',is_published:true,stock_quantity:0,variants:[{id:variantId,name:'Default',is_active:true,stock_quantity:0}]}}}
 const pageFor=async()=>{const page=await browser.newPage();page.setDefaultTimeout(7000);await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());return page}
 try{
  for(layout of ['Classic','Premium'])for(const locale of ['en','ar'])await t.test(layout+' '+locale+' neutral permission load, zero-stock add and restored cart',async()=>{
   scenario=await fixture(locale);const page=await pageFor(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);const button=page.getByRole('button')
   await button.waitFor();assert.equal(await button.isDisabled(),true);assert.equal((await button.innerText()).trim(),scenario.messages.productPage.checkingPurchase);assert.equal(await button.getAttribute('aria-busy'),'true')
   await page.evaluate(()=>window.__release('/api/payments/capabilities'));await page.waitForFunction(()=>!document.querySelector('button').disabled)
   assert.equal((await button.innerText()).includes(scenario.messages.productPage.buyingHeld),false);await button.click()
   const cart=await page.evaluate(()=>window.__cartMemory());assert.equal(cart.items.length,1);assert.equal(cart.items[0].quantity,1);assert.equal(cart.items[0].stock_quantity,0);assert.equal(cart.items[0].allow_out_of_stock_purchases,true)
   await page.reload();await page.getByRole('button').waitFor();assert.equal((await page.evaluate(()=>window.__cartMemory())).items[0].allow_out_of_stock_purchases,true)
   await page.evaluate(()=>window.__release('/api/payments/capabilities'));await page.waitForFunction(()=>!document.querySelector('button').disabled);await page.getByRole('button').click();assert.equal((await page.evaluate(()=>window.__cartMemory())).items[0].quantity,1)
   const calls=await page.evaluate(()=>window.__requests);assert.ok(!calls.some(r=>['/api/checkout','/api/checkout/quote','/api/payments/intentions'].includes(r.path)));assert.deepEqual(errors,[]);await page.close()
  })
  for(const mode of ['denied','expired','public'])await t.test(mode+' access remains correct for ordinary customers',async()=>{
   layout='Premium';scenario=await fixture();if(mode==='denied')scenario.allowedId=randomUUID();if(mode==='expired')scenario.expiresAt=new Date(Date.now()-1000).toISOString();if(mode==='public')scenario.publicAccess=true
   const page=await pageFor();await page.goto(origin);const button=page.getByRole('button');await button.waitFor()
   if(mode!=='public'){await page.evaluate(()=>window.__release('/api/payments/capabilities'));await page.waitForFunction(()=>document.querySelector('button').getAttribute('aria-busy')==='false');assert.equal(await button.isDisabled(),true);assert.equal((await button.innerText()).trim(),scenario.messages.productPage.buyingHeld)}
   else{assert.equal(await button.isDisabled(),false);await button.click();assert.equal((await page.evaluate(()=>window.__cartMemory())).items.length,1)}
   await page.close()
  })
 }finally{await browser.close();await new Promise(r=>server.close(r))}
})
