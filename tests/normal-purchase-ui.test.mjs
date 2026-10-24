import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { build } from 'esbuild'
import { parse, compileScript } from '@vue/compiler-sfc'

test('normal checkout and payment pages preserve owner actions and browser cart recovery', { skip: !process.env.PDC_REVIEW_PLAYWRIGHT }, async t => {
  const { chromium } = await import(process.env.PDC_REVIEW_PLAYWRIGHT)
  const messages = Object.fromEntries(await Promise.all(['en','ar'].map(async locale => [locale, JSON.parse(await readFile('i18n/locales/' + locale + '.json','utf8'))])))
  const bundles = {}
  for (const [name, file] of [['checkout','app/pages/checkout/index.vue'],['payment','app/pages/checkout/payment/[id].vue'],['card','app/components/cards/ProductCard.vue']]) {
    const descriptor = parse(await readFile(file,'utf8')).descriptor
    const component = compileScript(descriptor,{id:'normal-'+name,inlineTemplate:true}).content
    const built = await build({ entryPoints:[resolve('tests/helpers/normalPurchaseBrowser.js')], bundle:true,write:false,format:'iife',platform:'browser',
      alias:{'~':resolve('app')},define:{'import.meta.client':'true','process.env.NODE_ENV':'"test"',__VUE_OPTIONS_API__:'true',__VUE_PROD_DEVTOOLS__:'false',__VUE_PROD_HYDRATION_MISMATCH_DETAILS__:'false'},
      plugins:[{name:'actual-normal-page',setup(b){
        b.onResolve({filter:/^normal-purchase-page$/},()=>({path:name,namespace:'normal-page'}))
        b.onLoad({filter:/.*/,namespace:'normal-page'},()=>({contents:component,resolveDir:resolve('.'),loader:'js'}))
      }}] })
    bundles[name]=built.outputFiles[0].text
  }
  const base = locale => {
    const owner=randomUUID(),productId=randomUUID(),variantId=randomUUID()
    return { locale,messages:messages[locale],actorId:owner,allowedId:owner,productId,variantId,companyId:randomUUID(),quoteId:randomUUID(),orderId:randomUUID(),
      expiresAt:new Date(Date.now()+600000).toISOString(),siteUrl:locale==='ar'?'https://cedar.example.invalid':'https://orchid.example.invalid',
      profile:{full_name:'Synthetic Buyer',phone:'01012345678',email:'fixture@example.invalid',address_line_1:'Isolated street',address_line_2:'Isolated floor',city:'Fixture city',state:'Cairo'},
      cart:{version:2,id:randomUUID(),revision:randomUUID(),coupon:null,items:[{id:productId,variant_id:variantId,quantity:1,price:100,stock_quantity:3,is_serialized:true,selling_mode:'normal',title:'Synthetic physical item'}]} }
  }
  let scenario,kind='checkout',browser
  const server=createServer((req,res)=>{
    res.setHeader('content-type',req.url==='/fixture.js'?'text/javascript; charset=utf-8':'text/html; charset=utf-8')
    res.end(req.url==='/fixture.js'?bundles[kind]:'<!doctype html><html lang="'+scenario.locale+'" dir="'+(scenario.locale==='ar'?'rtl':'ltr')+'"><body><div id="app"></div><script>window.__fixture='+JSON.stringify(scenario)+'</script><script src="/fixture.js"></script></body></html>')
  })
  await new Promise(r=>server.listen(0,'127.0.0.1',r))
  const origin='http://127.0.0.1:'+server.address().port
  const open=async()=>{
    const page=await browser.newPage({viewport:{width:scenario.locale==='ar'?390:1100,height:900}})
    page.setDefaultTimeout(7000)
    const errors=[];page.on('pageerror',error=>errors.push(error.message))
    await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort())
    await page.goto(origin)
    return {page,errors}
  }
  try {
    browser=await chromium.launch({headless:true,channel:'chrome'})
    await t.test('EN/AR prefill preserves both lines and does not create an order or intention',async()=>{
      for(const locale of ['en','ar']) {
        scenario=base(locale);kind='checkout'
        const {page,errors}=await open()
        await page.locator('input[autocomplete=address-line2]').waitFor()
        assert.equal(await page.locator('input[autocomplete=address-line1]').inputValue(),'Isolated street')
        assert.equal(await page.locator('input[autocomplete=address-line2]').inputValue(),'Isolated floor')
        assert.equal(await page.locator('html').getAttribute('dir'),locale==='ar'?'rtl':'ltr')
        const result=await page.evaluate(()=>({requests:window.__requests,cart:JSON.parse(localStorage.getItem(window.__cartKey())),meta:window.__pageMeta}))
        assert.equal(result.cart.id,scenario.cart.id);assert.equal(result.cart.items[0].quantity,1)
        assert.ok(!result.requests.some(x=>x.path==='/api/checkout'||x.path==='/api/payments/intentions'))
        assert.deepEqual(result.meta.middleware,['customer-auth','purchasing'])
        assert.deepEqual(errors,[]);await page.close()
      }
    })
    await t.test('normal PDC selection and explicit confirmation keep exact pending recovery after lost acknowledgement',async()=>{
      scenario={...base('en'),loseOrderAck:true};kind='checkout'
      const {page,errors}=await open()
      await page.locator('select').nth(1).selectOption(scenario.companyId)
      await page.getByRole('button',{name:messages.en.common.continueToPayment,exact:true}).click()
      await page.getByRole('button',{name:messages.en.common.confirmCheckout,exact:true}).waitFor()
      assert.equal(await page.locator('input[name=payment-method]').count(),1)
      assert.equal(await page.locator('input[name=payment-method]').inputValue(),'card')
      await page.getByText('Isolated street, Isolated floor, Fixture city, Cairo',{exact:true}).waitFor()
      await page.getByRole('button',{name:messages.en.common.confirmCheckout,exact:true}).click()
      await page.getByRole('button',{name:messages.en.checkoutRecovery.recover,exact:true}).waitFor()
      const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('elcomputer-checkout-pending-'+window.__fixture.actorId)))
      assert.equal(saved.body.cart_id,scenario.cart.id)
      assert.equal(saved.body.address.address_line_2,'Isolated floor')
      assert.equal(saved.body.review_token,'55'.repeat(32))
      await page.getByRole('button',{name:messages.en.checkoutRecovery.recover,exact:true}).click()
      await page.waitForFunction(()=>window.__navigations.length===1).catch(async error=>{
        error.message += JSON.stringify(await page.evaluate(()=>({paths:window.__requests.map(x=>x.path),navigations:window.__navigations,alerts:[...document.querySelectorAll('[role=alert]')].map(x=>x.textContent?.slice(0,200))})))
        throw error
      })
      const result=await page.evaluate(()=>({posts:window.__requests.filter(x=>x.path==='/api/checkout'),navigations:window.__navigations,pending:localStorage.getItem('elcomputer-checkout-pending-'+window.__fixture.actorId)}))
      assert.equal(result.posts.length,2);assert.deepEqual(result.posts[0].body,result.posts[1].body)
      assert.ok(result.posts.every(x=>x.retry===0))
      assert.equal(result.pending,null);assert.equal(result.navigations[0],'/checkout/payment/'+scenario.orderId)
      assert.deepEqual(errors,[]);await page.close()
    })
    await t.test('normal payment requires an explicit action and hides uncertain reinitialization',async()=>{
      for(const locale of ['en','ar']) {
        scenario={...base(locale),loseIntention:true};kind='payment'
        const {page,errors}=await open()
        const button=page.getByRole('button',{name:messages[locale].paymob.openSecure,exact:true})
        await button.waitFor().catch(async error=>{
          error.message += JSON.stringify(await page.evaluate(()=>({paths:window.__requests.map(x=>x.path),alerts:[...document.querySelectorAll('[role=alert]')].map(x=>x.textContent?.slice(0,200))})))
          throw error
        })
        assert.equal(await page.evaluate(()=>window.__requests.filter(x=>x.path==='/api/payments/intentions').length),0)
        await button.click()
        await page.getByRole('alert').waitFor()
        assert.equal(await button.count(),0)
        const posts=await page.evaluate(()=>window.__requests.filter(x=>x.path==='/api/payments/intentions'))
        assert.equal(posts.length,1);assert.equal(posts[0].retry,0)
        assert.deepEqual(errors,[]);await page.close()
      }
    })
    await t.test('separate payment hold and account changes cannot expose card initialization',async()=>{
      for(const change of [{paymentEnabled:false},{actorId:randomUUID()}]) {
        scenario={...base('en'),...change};kind='payment'
        const {page,errors}=await open();await page.waitForTimeout(100)
        assert.equal(await page.getByRole('button',{name:messages.en.paymob.openSecure,exact:true}).count(),0)
        assert.equal(await page.evaluate(()=>window.__requests.filter(x=>x.path==='/api/payments/intentions').length),0)
        assert.deepEqual(errors,[]);await page.close()
      }
      scenario=base('en');kind='payment'
      const {page,errors}=await open()
      await page.getByRole('button',{name:messages.en.paymob.openSecure,exact:true}).waitFor()
      await page.evaluate(id=>window.__switchAccount(id),randomUUID())
      await page.waitForFunction(()=>window.__requests.filter(x=>x.path==='/api/payments/capabilities').length>=2)
      assert.equal(await page.getByRole('button',{name:messages.en.paymob.openSecure,exact:true}).count(),0)
      assert.deepEqual(errors,[]);await page.close()
    })
    await t.test('expiry removes already displayed secure fields without asserting payment',async()=>{
      scenario={...base('en'),expiresAt:new Date(Date.now()+1800).toISOString()};kind='payment'
      const {page,errors}=await open()
      await page.getByRole('button',{name:messages.en.paymob.openSecure,exact:true}).click()
      await page.locator('[data-fixture-pixel]').waitFor()
      await page.waitForFunction(()=>!document.querySelector('[data-fixture-pixel]'),{},{timeout:5000})
      assert.equal(await page.evaluate(()=>window.__navigations.length),0)
      assert.equal(await page.evaluate(()=>window.__requests.filter(x=>x.path==='/api/payments/intentions').length),1)
      assert.deepEqual(errors,[]);await page.close()
    })
    await t.test('product cards preserve actual stock labels and send scoped users through normal option selection',async()=>{
      for(const locale of ['en','ar'])for(const enabled of [true,false]) {
        scenario=base(locale);kind='card'
        if(!enabled)scenario.actorId=randomUUID()
        scenario.pageProps={product:{id:scenario.productId,title:'Synthetic physical item',slug:'synthetic-item',price:100,stock_quantity:3,is_serialized:true}}
        const {page,errors}=await open()
        const button=page.locator('.store-product-add')
        await button.waitFor()
        if(enabled)await page.waitForFunction(()=>!document.querySelector('.store-product-add').disabled)
        else await page.waitForTimeout(50)
        assert.equal(await button.isDisabled(),!enabled)
        await page.getByText(messages[locale].common.inStock,{exact:true}).waitFor()
        if(enabled) {
          await button.click()
          assert.deepEqual(await page.evaluate(()=>window.__navigations),['/products/synthetic-item'])
        }else assert.equal((await button.textContent()).trim(),messages[locale].productPage.buyingHeld)
        assert.deepEqual(errors,[]);await page.close()
      }
    })
  } finally { await browser?.close();await new Promise(r=>server.close(r)) }
})
