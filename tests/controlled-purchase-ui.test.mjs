import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createServer} from 'node:http'
import {resolve} from 'node:path'
import {build} from 'esbuild'
import {parse,compileScript} from '@vue/compiler-sfc'

test('actual controlled purchase page requires explicit actions and retains uncertain outcomes',{skip:!process.env.PDC_REVIEW_PLAYWRIGHT},async t=>{
 const {chromium}=await import(process.env.PDC_REVIEW_PLAYWRIGHT)
 const source=await readFile('app/pages/account/controlled-purchase.vue','utf8')
 const descriptor=parse(source).descriptor,component=compileScript(descriptor,{id:'controlled-purchase-fixture',inlineTemplate:true}).content.replace('export default','const Component =')
 const locales=Object.fromEntries(await Promise.all(['en','ar'].map(async l=>[l,JSON.parse(await readFile('i18n/locales/'+l+'.json','utf8'))])))
 const prefix=`import {ref,shallowRef,reactive,onMounted,createApp,h} from 'vue';
 const fixture=window.__fixture;window.__requests=[];const definePageMeta=()=>{};const useHead=()=>{};
 const translate=k=>{const v=k.split('.').reduce((p,n)=>p?.[n],${JSON.stringify(locales)}[fixture.locale]);if(typeof v!=='string')throw Error('Missing translation '+k);return v};
 const useI18n=()=>({locale:ref(fixture.locale),t:translate});
 const useSupabaseClient=()=>({auth:{getSession:async()=>({data:{session:{access_token:'synthetic-fixture'}}})}});
 const $fetch=async(path,options)=>{if(path!=='/api/checkout/controlled'||options.retry!==0)throw Error('Unexpected request');window.__requests.push(options.body?.action||'view');
 if(fixture.unavailable)throw Error('Scoped denial');if(!options.body)return structuredClone(fixture.setup);
 if(options.body.action==='quote')return {quoteId:'00000000-0000-4000-8000-000000000001',reviewToken:'0'.repeat(64),totalAmount:110};
 if(options.body.action==='order'){fixture.setup.order={id:'00000000-0000-4000-8000-000000000002',orderNumber:'ISOLATED-ORDER',paymentStatus:'pending'};if(fixture.loseOrder)throw Error('Lost acknowledgement');return {order:structuredClone(fixture.setup.order)}}
 if(options.body.action==='pay'){fixture.setup.attempt={status:'initiated'};if(fixture.losePayment)throw Error('Uncertain intention');return {publicKey:'pk_live_synthetic',clientSecret:'csk_live_synthetic',methods:['card']}};throw Error('Unexpected action')};`
 const suffix=`const app=createApp(Component);app.component('ClientOnly',{setup:(_,ctx)=>()=>ctx.slots.default?.()});app.component('PaymentPaymobPixel',{setup:(_,ctx)=>()=>h('button',{'data-synthetic-pixel':'true',onClick:()=>ctx.emit('complete')},'Synthetic card fields')});app.config.globalProperties.$t=translate;app.config.globalProperties.$uiLabel=v=>v;app.mount('#app');`
 const bundle=await build({stdin:{contents:prefix+'\n'+component+';\n'+suffix,resolveDir:resolve('.')},bundle:true,write:false,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"test"',__VUE_OPTIONS_API__:'true',__VUE_PROD_DEVTOOLS__:'false',__VUE_PROD_HYDRATION_MISMATCH_DETAILS__:'false'}})
 const js=bundle.outputFiles[0].text
 let scenario
 const server=createServer((req,res)=>{res.setHeader('content-type',req.url==='/fixture.js'?'text/javascript':'text/html');res.end(req.url==='/fixture.js'?js:`<!doctype html><html lang="${scenario.locale}" dir="${scenario.locale==='ar'?'rtl':'ltr'}"><body><div id="app"></div><script>window.__fixture=${JSON.stringify(scenario)}</script><script src="/fixture.js"></script></body></html>`)})
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port
 let browser
 const base=()=>({locale:'en',setup:{active:true,paymentEnabled:true,totalMinor:11000,product:{title:'Synthetic item'},variant:{name:'Default'},delivery:{name:'Synthetic carrier'},order:null,attempt:null}})
 try{
  browser=await chromium.launch({headless:true,channel:'chrome'});browser.on('page',p=>p.setDefaultTimeout(5000))
  await t.test('EN/AR render the existing form fields without starting orders or payment',async()=>{
   for(const locale of ['en','ar']){scenario={...base(),locale};const page=await browser.newPage({viewport:{width:locale==='ar'?390:1100,height:850}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());await page.goto(origin);await page.waitForSelector('input');assert.equal(await page.locator('input').count(),7);assert.deepEqual(await page.evaluate(()=>window.__requests),['view']);assert.deepEqual(errors,[]);await page.close()}
  })
  await t.test('lost order acknowledgement blocks resubmission; an owned read recovers it',async()=>{
   scenario={...base(),loseOrder:true};const page=await browser.newPage();await page.goto(origin);await page.waitForSelector('input');for(const input of await page.locator('input').all())await input.fill((await input.getAttribute('type'))==='email'?'fixture@example.invalid':'Synthetic');await page.locator('button[type=submit]').click();await page.getByRole('button',{name:locales.en.common.confirmCheckout,exact:true}).waitFor();await page.getByRole('button',{name:locales.en.common.confirmCheckout,exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(await page.getByRole('button',{name:locales.en.common.confirmCheckout,exact:true}).count(),0);await page.getByRole('button',{name:locales.en.controlledPurchase.checkOrder,exact:true}).click();await page.getByText('ISOLATED-ORDER',{exact:false}).waitFor();assert.deepEqual(await page.evaluate(()=>window.__requests),['view','quote','order','view']);await page.close()
  })
  await t.test('uncertain payment initialization cannot be blindly resubmitted',async()=>{
   scenario={...base(),losePayment:true};scenario.setup.order={id:'00000000-0000-4000-8000-000000000002',orderNumber:'ISOLATED-ORDER',paymentStatus:'pending'};const page=await browser.newPage();await page.goto(origin);const button=page.getByRole('button',{name:locales.en.paymob.openSecure,exact:true});await button.waitFor();assert.deepEqual(await page.evaluate(()=>window.__requests),['view']);await button.click();await page.getByRole('alert').waitFor();assert.equal(await button.count(),0);assert.deepEqual(await page.evaluate(()=>window.__requests),['view','pay']);await page.close()
  })
  await t.test('SDK completion closes fields and reads the receipt without asserting payment',async()=>{
   scenario=base();scenario.setup.order={id:'00000000-0000-4000-8000-000000000002',orderNumber:'ISOLATED-ORDER',paymentStatus:'pending'};const page=await browser.newPage();await page.goto(origin);await page.getByRole('button',{name:locales.en.paymob.openSecure,exact:true}).click();await page.locator('[data-synthetic-pixel]').click();await page.waitForFunction(()=>window.__requests.length===3);assert.equal(await page.locator('[data-synthetic-pixel]').count(),0);assert.deepEqual(await page.evaluate(()=>window.__requests),['view','pay','view']);assert.equal(await page.getByRole('button',{name:locales.en.paymob.openSecure,exact:true}).count(),0);await page.close()
  })
  await t.test('closed or denied grants never expose a purchase/payment button',async()=>{
   for(const unavailable of [false,true]){scenario={...base(),unavailable};scenario.setup.active=false;const page=await browser.newPage();await page.goto(origin);if(unavailable)await page.getByRole('alert').waitFor();else await page.getByText(locales.en.controlledPurchase.closed).waitFor();assert.equal(await page.locator('input').count(),0);assert.deepEqual(await page.evaluate(()=>window.__requests),['view']);await page.close()}
  })
 }finally{await browser?.close();await new Promise(r=>server.close(r))}
})
