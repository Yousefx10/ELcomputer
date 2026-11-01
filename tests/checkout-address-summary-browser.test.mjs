import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFile,readdir} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {createServer} from 'node:http'
import {build} from 'esbuild'
import {parse,compileScript} from '@vue/compiler-sfc'

const addressSelector = page => {
 const toggle = page.getByTestId('saved-address-toggle')
 return { waitFor: () => toggle.waitFor(), count: () => toggle.count(), inputValue: () => toggle.getAttribute('data-selected-address'), textContent: async () => { if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click(); return page.locator('#checkout-saved-addresses').textContent() }, selectOption: async value => {
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click()
  const list=page.locator('#checkout-saved-addresses')
  if (['new','profile'].includes(value)) await list.locator(value === 'new' ? 'button:last-child' : 'button').filter(value === 'new' ? {} : {hasText: /Unsaved address|عنوان غير محفوظ/}).first().click()
  else await list.locator('[data-address-id="'+value+'"]').click()
 }}
}
const deliverySelector = page => ({ selectOption: value => page.locator('input[name="delivery-method"][value="'+value+'"]').check(), inputValue: async () => await page.locator('input[name="delivery-method"]:checked').count() ? page.locator('input[name="delivery-method"]:checked').inputValue() : '' })

test('saved shipping summary retains validation, editing and customer isolation',async t=>{
 const {chromium}=await import(process.env.COD_REVIEW_PLAYWRIGHT)
 let helper=await readFile('tests/helpers/normalPurchaseBrowser.js','utf8')
 helper=helper.replaceAll('value => value','value => fixture.uiKeys[value] ? translate(fixture.uiKeys[value]) : value')
  helper=helper.replace('payment_cash_enabled: true','payment_cash_enabled: false').replace('payment_bank_transfer_enabled: true, payment_instapay_enabled: true','payment_bank_transfer_enabled: false, payment_instapay_enabled: false')
 const compiled=await build({entryPoints:[resolve('tests/helpers/normalPurchaseBrowser.js')],bundle:true,write:false,format:'iife',platform:'browser',alias:{'~':resolve('app')},
  define:{'import.meta.client':'true','process.env.NODE_ENV':'"test"',__VUE_OPTIONS_API__:'true',__VUE_PROD_DEVTOOLS__:'false',__VUE_PROD_HYDRATION_MISMATCH_DETAILS__:'false'},
  plugins:[{name:'address-summary-browser',setup(b){
   b.onResolve({filter:/^normal-purchase-page$/},()=>({path:resolve('app/pages/checkout/index.vue')}))
   b.onLoad({filter:/normalPurchaseBrowser\.js$/},()=>({contents:helper,resolveDir:resolve('tests/helpers'),loader:'js'}))
   b.onLoad({filter:/\.vue$/},async({path})=>({contents:compileScript(parse(await readFile(path,'utf8'),{filename:path}).descriptor,{id:path,inlineTemplate:true}).content,resolveDir:dirname(path),loader:'js'}))
  }}]})
 const cssDir=process.env.CHECKOUT_REVIEW_CSS_DIR || resolve('.output/public/_nuxt')
 const css=(await Promise.all((await readdir(cssDir)).filter(x=>x.endsWith('.css')).map(x=>readFile(cssDir+'/'+x,'utf8')))).join('\n')
 const messages=Object.fromEntries(await Promise.all(['en','ar'].map(async lang=>[lang,JSON.parse(await readFile('i18n/locales/'+lang+'.json','utf8'))])))
 const uiKeys=JSON.parse(await readFile('app/utils/uiMessageKeys.json','utf8'))
 let scenario
 const fixture=locale=>{
  const actorId=randomUUID(),productId=randomUUID(),variantId=randomUUID()
  return {locale,messages:messages[locale],uiKeys,publicAccess:true,actorId,allowedId:actorId,productId,variantId,orderId:randomUUID(),companyId:randomUUID(),quoteId:randomUUID(),siteUrl:'https://store.example.invalid',
   profile:{full_name:'Synthetic Buyer',phone:'01012345678',email:'fixture@example.invalid',address_line_1:'Owned saved street',address_line_2:'Owned unit',city:'Fixture city',state:'Cairo'},
   ordersByActor:{},orderItems:[],cart:{version:3,id:randomUUID(),revision:randomUUID(),coupon:null,items:[{id:productId,variant_id:variantId,quantity:1,price:100,stock_quantity:5,allow_out_of_stock_purchases:true,is_serialized:true,selling_mode:'normal',title:'Synthetic item'}]}}
 }
 const server=createServer((req,res)=>{
  res.setHeader('content-type',req.url==='/fixture.js'?'text/javascript':'text/html;charset=utf-8')
  res.end(req.url==='/fixture.js'?compiled.outputFiles[0].text:'<!doctype html><html lang="'+scenario.locale+'" dir="'+(scenario.locale==='ar'?'rtl':'ltr')+'" class="'+(scenario.dark?'dark':'')+'"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><div id="app"></div><script>window.__fixture='+JSON.stringify(scenario)+'</script><script src="/fixture.js"></script></body></html>')
 })
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,channel:'chrome'})
 const open=async width=>{
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[],blocked=[];page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message))
  await page.route('**/*',r=>r.request().url().startsWith(origin)&&r.request().method()==='GET'?r.continue():(blocked.push(r.request().method()),r.abort()))
  await page.goto(origin);return {page,errors,blocked}
 }
 try{
  for(const locale of ['en','ar'])for(const width of [1440,390])for(const dark of [false,true])await t.test(`${locale} ${width} ${dark?'dark':'light'} complete saved address is compact and editable`,async()=>{
   scenario={...fixture(locale),dark};const {page,errors,blocked}=await open(width)
   try{
    const summary=page.getByTestId('saved-address-summary');await summary.waitFor()
    assert.match(await summary.textContent(),/Synthetic Buyer/);assert.match(await summary.textContent(),/Owned saved street/);assert.match(await summary.textContent(),/Owned unit/)
    assert.equal(await page.locator('#checkout-address-fields').isVisible(),false)
    const delivery=deliverySelector(page);await delivery.selectOption(scenario.companyId)
    await page.getByRole('button',{name:scenario.messages.common.edit,exact:true}).click()
    const street=page.locator('input[autocomplete=address-line1]');await street.waitFor();assert.equal(await page.locator('input[autocomplete=given-name]').evaluate(x=>x===document.activeElement),true)
    await street.fill('Owned revised street');await page.getByRole('button',{name:scenario.messages.common.hideDetails,exact:true}).click()
    assert.match(await summary.textContent(),/Owned revised street/);assert.equal(await delivery.inputValue(),scenario.companyId)
    await page.getByRole('button',{name:scenario.messages.common.continueToPayment,exact:true}).click()
    await page.getByRole('heading',{name:scenario.messages.common.paymentMethod,exact:true}).waitFor()
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
    assert.deepEqual(errors,[]);assert.deepEqual(blocked,[])
    const requests=await page.evaluate(()=>window.__requests);assert.equal(requests.filter(x=>x.path==='/api/checkout'||x.path==='/api/payments/intentions').length,0)
   }finally{await page.close()}
  })
  for(const locale of ['en','ar'])for(const missing of ['new','phone','street'])await t.test(`${locale} ${missing} address stays expanded`,async()=>{
   scenario=fixture(locale)
   if(missing==='new')scenario.profile={email:'fixture@example.invalid'}
   else if(missing==='phone')scenario.profile.phone='123'
   else scenario.profile.address_line_1=''
   const {page,errors}=await open(390)
   try{
    await page.locator('input[autocomplete=given-name]').waitFor()
    assert.equal(await page.getByTestId('saved-address-summary').count(),0)
    await page.getByRole('button',{name:scenario.messages.common.continueToPayment,exact:true}).click()
    assert.equal(await page.locator('#checkout-address-fields').isVisible(),true);assert.deepEqual(errors,[])
   }finally{await page.close()}
  })
  await t.test('profile loading is neutral and a customer change removes the old summary',async()=>{
   scenario=fixture('en');const second=randomUUID(),key='profile:'+scenario.actorId
   scenario.holdPaths=[key,'profile:'+second];scenario.profiles={[scenario.actorId]:scenario.profile,[second]:{...scenario.profile,full_name:'Second Buyer',address_line_1:'Second owned street'}}
   const {page,errors}=await open(390)
   try{
    await page.getByText(scenario.messages.common.loadingAccount,{exact:true}).waitFor();assert.equal(await page.getByTestId('saved-address-summary').count(),0)
    await page.evaluate(k=>window.__release(k),key);await page.getByTestId('saved-address-summary').waitFor()
    await page.evaluate(({id,cart})=>{
     localStorage.setItem(window.__cartKey(id),JSON.stringify({...cart,id:crypto.randomUUID(),revision:crypto.randomUUID(),owner:'account:'+id}))
     window.__switchAccount(id)
    },{id:second,cart:scenario.cart})
    await page.getByText(scenario.messages.common.loadingAccount,{exact:true}).waitFor();assert.equal(await page.getByText('Synthetic Buyer',{exact:true}).count(),0)
    await page.evaluate(k=>window.__release(k),'profile:'+second);await page.getByText('Second Buyer',{exact:true}).waitFor()
    assert.match(await page.getByTestId('saved-address-summary').textContent(),/Second owned street/);assert.deepEqual(errors,[])
   }finally{await page.close()}
  })
 }finally{await browser.close();await new Promise(r=>server.close(r))}
})
