import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,readdir,mkdir} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {createServer} from 'node:http'
import {resolve,dirname} from 'node:path'
import {build} from 'esbuild'
import {parse,compileScript} from '@vue/compiler-sfc'

test('actual product card, public variant reader, access and owned cart on desktop/mobile EN/AR',async t=>{
 assert.ok(process.env.CARD_REVIEW_PLAYWRIGHT,'Set CARD_REVIEW_PLAYWRIGHT; browser validation cannot be skipped')
 const {chromium}=await import(process.env.CARD_REVIEW_PLAYWRIGHT)
 let helper=await readFile('tests/helpers/normalPurchaseBrowser.js','utf8')
 helper="import {useId} from 'vue'; import Card from '../../app/components/cards/ProductCard.vue';globalThis.useId=useId;\n"+helper
 helper=helper.replace("useNuxtData: () => ({ data: ref({ settings: {} }) })","useNuxtData: () => ({ data: ref({ settings: fixture.siteSettings || {} }) })")
  .replace('payment_bank_transfer_enabled: true, payment_instapay_enabled: true','payment_bank_transfer_enabled: true, payment_instapay_enabled: true, ...(fixture.siteSettings || {})')
  .replace("purchasingEnabled: Boolean(fixture.publicAccess), siteUrl:","purchasingEnabled: Boolean(fixture.publicAccess), betaPurchasingEnabled: fixture.beta !== false, siteUrl:")
  .replace("if (path === '/api/payments/capabilities') {","if (path === '/api/payments/capabilities') { if(fixture.capabilityError) throw Error('Synthetic unavailable capability');")
  .replace("purchase: { available: true, restricted: false }","purchase: { available: fixture.available !== false, restricted: false, beta: true, excludedProductIds: fixture.excludedProductIds || [] }")
  .replace("} else throw Error('Unexpected browser table: ' + table)",`}
    else if(table==='storefront_product_variants') {
      window.__requests.push({path:table,productId:filters.product_id});
      await holds.get('variant:'+filters.product_id);
      if(fixture.variantError) throw Error('Synthetic unavailable options');
      data=(fixture.variants||[]).filter(v=>v.product_id===filters.product_id&&v.is_active===true).slice(0,2);
    } else throw Error('Unexpected browser table: '+table)`)
  .replace("app.mount('#app')","app.component('CardsProductCard',Card);app.mount('#app')")
 const wrapper=`<template><main class="store-container"><ProductSection v-for="n in count" :key="n" title="Synthetic card section" :products="[product]" /></main></template><script setup>
 import ProductSection from '~/components/home/ProductSection.vue'
 const product=ref(window.__fixture.pageProps.product),count=window.__fixture.duplicates||1
 window.__changeCard=value=>{product.value=value}
 </script>`
 const result=await build({entryPoints:[resolve('tests/helpers/normalPurchaseBrowser.js')],bundle:true,write:false,format:'iife',platform:'browser',alias:{'~':resolve('app')},define:{'import.meta.client':'true','process.env.NODE_ENV':'"test"',__VUE_OPTIONS_API__:'true',__VUE_PROD_DEVTOOLS__:'false',__VUE_PROD_HYDRATION_MISMATCH_DETAILS__:'false'},plugins:[{name:'actual-card',setup(b){
  b.onResolve({filter:/^normal-purchase-page$/},()=>({path:'card-wrapper',namespace:'card'}))
  b.onLoad({filter:/.*/,namespace:'card'},()=>({contents:compileScript(parse(wrapper).descriptor,{id:'card-wrapper',inlineTemplate:true}).content,resolveDir:resolve('.'),loader:'js'}))
  b.onLoad({filter:/normalPurchaseBrowser\.js$/},()=>({contents:helper,resolveDir:resolve('tests/helpers'),loader:'js'}))
  b.onLoad({filter:/\.vue$/},async({path})=>({contents:compileScript(parse(await readFile(path,'utf8'),{filename:path}).descriptor,{id:path,inlineTemplate:true}).content,resolveDir:dirname(path),loader:'js'}))
 } } ]})
 const cssDir=resolve('.output/public/_nuxt'),css=(await Promise.all((await readdir(cssDir)).filter(x=>x.endsWith('.css')).map(x=>readFile(cssDir+'/'+x,'utf8')))).join('\n')
 let scenario
 const server=createServer((req,res)=>{
  res.setHeader('content-type',req.url==='/fixture.js'?'text/javascript':'text/html; charset=utf-8')
  res.end(req.url==='/fixture.js'?result.outputFiles[0].text:'<!doctype html><html lang="'+scenario.locale+'" dir="'+(scenario.locale==='ar'?'rtl':'ltr')+'" class="'+(scenario.dark?'dark':'')+'"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>'+css+'</style></head><body class="storefront"><div id="app"></div><script>window.__fixture='+JSON.stringify(scenario)+'</script><script src="/fixture.js"></script></body></html>')
 })
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,channel:'chrome'}),shots=resolve('../browser-evidence');await mkdir(shots,{recursive:true})
 const fixture=async(locale='en')=>{
  const id=randomUUID(),variant=randomUUID(),actor=randomUUID();return {locale,actorId:actor,allowedId:actor,publicAccess:true,siteUrl:'https://merchant.example.invalid',messages:JSON.parse(await readFile('i18n/locales/'+locale+'.json','utf8')),siteSettings:{inventory_tracking_required:false},pageProps:{product:{id,title:'Synthetic card item',slug:'synthetic-card-item',price:25,is_serialized:true,is_published:true,selling_mode:'normal',stock_quantity:0}},variants:[{id:variant,product_id:id,name:'Default',code:'DEFAULT',sku:'FIXTURE-ONLY',color_name:'',color_hex:'',stock_quantity:0,is_active:true}]}
 }
 const open=async(f,width=390)=>{
  scenario=f;const page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(7000);const errors=[],external=[]
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url().startsWith(origin)&&r.request().method()==='GET'?r.continue():(external.push(r.request().method()),r.abort()))
  await page.goto(origin);await page.locator('.store-product-add').first().waitFor();return {page,errors,external}
 }
 const ready=page=>page.waitForFunction(()=>[...document.querySelectorAll('.store-product-add')].every(b=>b.getAttribute('aria-busy')==='false'))
 try{
  for(const locale of ['en','ar'])for(const width of [1440,390])for(const dark of [false,true])await t.test(`${locale} ${width} ${dark?'dark':'light'} single Default direct add and double click`,async()=>{
   const f=await fixture(locale);f.dark=dark;const {page,errors,external}=await open(f,width);await ready(page);const button=page.locator('.store-product-add');assert.equal((await button.innerText()).trim(),f.messages.common.addToCart)
   await button.evaluate(b=>{b.click();b.click()});const cart=await page.evaluate(()=>window.__cartMemory());assert.equal(cart.items.length,1);assert.equal(cart.items[0].variant_id,f.variants[0].id);assert.equal(cart.items[0].quantity,1);assert.equal(cart.items[0].stock_quantity,0);assert.equal(cart.items[0].allow_out_of_stock_purchases,true)
   assert.equal((await button.innerText()).trim(),f.messages.common.added);assert.equal(await button.isDisabled(),true);assert.equal(await page.getAttribute('html','dir'),locale==='ar'?'rtl':'ltr');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
   await page.screenshot({path:shots+`/${locale}-${width}-${dark?'dark':'light'}.png`,fullPage:true});assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.ok(!(await page.evaluate(()=>window.__requests)).some(r=>r.method==='POST'||/checkout|intentions/.test(r.path)));await page.close()
  })
  for(const kind of ['multiple','empty','lookup-error','tracked-empty','bulk','coming-soon','preorder','unpublished','excluded','capability-error','capability-closed'])await t.test(kind+' preserves selection/availability and never creates a payment',async()=>{
   const f=await fixture(),p=f.pageProps.product
   if(kind==='multiple')f.variants.push({...f.variants[0],id:randomUUID(),name:'Another configuration'})
   if(kind==='empty')f.variants=[]
   if(kind==='lookup-error')f.variantError=true
   if(kind==='tracked-empty')f.siteSettings={inventory_tracking_required:true,allow_out_of_stock_purchases:true}
   if(kind==='bulk'){p.is_serialized=false;f.siteSettings={inventory_tracking_required:true,allow_out_of_stock_purchases:true}}
   if(kind==='coming-soon')p.selling_mode='coming_soon'
   if(kind==='preorder')p.selling_mode='preorder'
   if(kind==='unpublished')p.is_published=false
   if(kind==='excluded')f.excludedProductIds=[p.id]
   if(kind==='capability-error')f.capabilityError=true
   if(kind==='capability-closed')f.available=false
   const {page,errors}=await open(f);await ready(page);const button=page.locator('.store-product-add')
   if(['multiple','lookup-error','preorder'].includes(kind)){
    assert.equal(await button.isDisabled(),false);assert.equal((await button.innerText()).trim(),kind==='preorder'?f.messages.common.viewPreOrder:f.messages.common.options)
    if(kind==='preorder')assert.equal(await button.getAttribute('aria-label'),f.messages.common.viewPreOrder)
    if(kind==='lookup-error')assert.ok((await page.locator('[role=status]').allTextContents()).some(v=>v===f.messages.cards.ProductCard.optionsCheckFailed))
    await button.evaluate(b=>{b.click();b.click()});assert.equal((await page.evaluate(()=>window.__navigations)).length,1);assert.equal((await page.evaluate(()=>window.__cartMemory())).items.length,0)
   }else if(kind==='bulk'){await button.click();assert.equal((await page.evaluate(()=>window.__cartMemory())).items[0].variant_id,null)}
   else assert.equal(await button.isDisabled(),true)
   assert.deepEqual(errors,[]);await page.close()
  })
  for(const hold of ['storefront_product_variants','/api/payments/capabilities'])await t.test(hold+' delayed lookup has neutral disabled state',async()=>{
   const f=await fixture('ar');f.holdPaths=[hold];const {page}=await open(f);const button=page.locator('.store-product-add');assert.equal(await button.isDisabled(),true);assert.equal((await button.innerText()).trim(),f.messages.productPage.checkingPurchase);await button.evaluate(b=>b.click());assert.equal((await page.evaluate(()=>window.__cartMemory())).items.length,0)
   await page.evaluate(hold=>window.__release(hold),hold);await ready(page);await button.click();assert.equal((await page.evaluate(()=>window.__cartMemory())).items.length,1);await page.close()
  })
  await t.test('simultaneous duplicate homepage cards share one public metadata read',async()=>{
   const f=await fixture();f.duplicates=2;const {page}=await open(f);await ready(page);assert.equal((await page.evaluate(()=>window.__requests)).filter(r=>r.path==='storefront_product_variants').length,1);await page.close()
  })
  await t.test('late metadata for a previous card cannot select its variant for a new product',async()=>{
   const f=await fixture(),old=f.pageProps.product.id,next={...f.pageProps.product,id:randomUUID(),slug:'another-item'},variant={...f.variants[0],id:randomUUID(),product_id:next.id};f.variants.push(variant);f.holdPaths=['variant:'+old]
   const {page,errors}=await open(f);await page.evaluate(next=>window.__changeCard(next),next);await ready(page);await page.evaluate(old=>window.__release('variant:'+old),old);await page.locator('.store-product-add').click();const item=(await page.evaluate(()=>window.__cartMemory())).items[0];assert.equal(item.id,next.id);assert.equal(item.variant_id,variant.id);assert.deepEqual(errors,[]);await page.close()
  })
  await t.test('A to B to A cart/session ownership remains isolated',async()=>{
   const f=await fixture();const {page,errors}=await open(f);await ready(page);await page.locator('.store-product-add').click();const b=randomUUID();await page.evaluate(b=>window.__switchAccount(b),b);await ready(page);assert.equal((await page.evaluate(()=>window.__cartMemory())).items.length,0);await page.locator('.store-product-add').click();assert.equal((await page.evaluate(()=>window.__cartMemory())).items[0].quantity,1)
   await page.evaluate(a=>window.__switchAccount(a),f.actorId);await ready(page);assert.equal((await page.evaluate(()=>window.__cartMemory())).owner,'account:'+f.actorId);assert.equal((await page.evaluate(()=>window.__cartMemory())).items[0].quantity,1);assert.deepEqual(errors,[]);await page.close()
  })
 }finally{await browser.close();await new Promise(r=>server.close(r))}
})
