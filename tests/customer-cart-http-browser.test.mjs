import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createServer} from 'node:http'
import {resolve} from 'node:path'
import {build} from 'esbuild'
import {createCodCheckoutFixture} from './helpers/codCheckoutFixture.mjs'
import {emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'

test('actual account-cart composable, H3 and PostgreSQL across devices and identities',{skip:!emailNativeAvailable,timeout:180000},async t=>{
 const f=await createCodCheckoutFixture({routes:[['get','/api/account/cart','server/api/account/cart.get.js'],['post','/api/account/cart','server/api/account/cart.post.js']]})
 let server
 try {
  for(const name of ['customer','owner'])await f.db.query("insert into public.customer_profiles(id,email,is_active) values($1,$2,true) on conflict(id) do update set is_active=true",[f.actors[name],name+'@fixture.invalid'])
  await f.db.query('update public.site_settings set inventory_tracking_required=false')
  const p=(await f.db.query("insert into public.products(title,slug,price,is_published,is_serialized,primary_warehouse_id) values('Private fixture item','cart-http-fixture',125,true,true,$1) returning id",[f.warehouse])).rows[0].id
  const variant=(await f.db.query('select id from public.product_variants where product_id=$1',[p])).rows[0].id
  const script=`import{createApp,ref,computed,watch,effectScope,onMounted}from'vue';import{useCart}from'./app/composables/useCart.js';
  const fixture=window.__fixture,state=new Map(),nuxt={},session=ref(null);let actor='';
  const choose=name=>{actor=name;localStorage.setItem('fixture-actor',name);session.value=name?{access_token:name,user:{id:fixture.actors[name]}}:null};choose(new URL(location.href).searchParams.get('actor')||localStorage.getItem('fixture-actor')||'');
  const supabase={auth:{getSession:async()=>({data:{session:session.value}})}};
  Object.assign(globalThis,{ref,computed,watch,effectScope,onMounted,useNuxtApp:()=>nuxt,useState:(k,f)=>{if(!state.has(k))state.set(k,ref(f()));return state.get(k)},useNuxtData:()=>({data:ref({settings:{inventory_tracking_required:false}})}),useSupabaseClient:()=>supabase,useSupabaseUser:()=>ref(null),useSupabaseSession:()=>session,useStoreAnalytics:()=>({trackEvent:()=>{}}),$fetch:async(path,options={})=>{const r=await fetch('/fixture-cart',{method:options.method||'GET',headers:{...options.headers,'content-type':'application/json'},...(options.body?{body:JSON.stringify(options.body)}:{})});const data=await r.json();if(!r.ok)throw Error(data.statusMessage||'Cart unavailable');return data}});
  const app=createApp({setup(){const cart=useCart();window.__cart=cart;window.__choose=choose;window.__add=()=>cart.addItem({id:fixture.product,variant_id:fixture.variant,title:'Private fixture item',price:125,is_serialized:true,stock_quantity:10});return()=>null}});nuxt.vueApp=app;app.mount('#app');`
  const bundle=await build({stdin:{contents:script,resolveDir:resolve('.'),sourcefile:'cart-browser-fixture.js'},bundle:true,write:false,format:'iife',platform:'browser',alias:{'~':resolve('app')},define:{'import.meta.client':'true','process.env.NODE_ENV':'"test"',__VUE_OPTIONS_API__:'true',__VUE_PROD_DEVTOOLS__:'false',__VUE_PROD_HYDRATION_MISMATCH_DETAILS__:'false'}})
  server=createServer(async(req,res)=>{
   if(req.url.startsWith('/fixture-cart')){
    const chunks=[];for await(const b of req)chunks.push(b)
    const r=await f.call('/api/account/cart',{method:req.method,actor:req.headers.authorization?.replace('Bearer ',''),...(chunks.length?{body:JSON.parse(Buffer.concat(chunks))}:{})})
    res.statusCode=r.response.status;res.setHeader('cache-control',r.response.headers.get('cache-control'));res.setHeader('content-type','application/json');res.end(JSON.stringify(r.body));return
   }
   res.setHeader('content-type','text/html');res.end('<!doctype html><div id="app"></div><script>window.__fixture='+JSON.stringify({actors:f.actors,product:p,variant})+'</script><script>'+bundle.outputFiles[0].text+'</script>')
  })
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port
  const pw=await import(process.env.COD_REVIEW_PLAYWRIGHT)
  for(const engine of ['chromium','webkit'])await t.test(engine+' device merge, persistence, stale edits and cross-account privacy',async()=>{
   await f.db.query('delete from private.customer_cart_receipts');await f.db.query('delete from private.customer_carts')
   const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{channel:'chrome'}:{executablePath:process.env.REVIEW_WEBKIT_EXECUTABLE})})
   const c1=await browser.newContext(),c2=await browser.newContext(),a=await c1.newPage(),b=await c2.newPage(),errors=[]
   for(const page of [a,b]){page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort())}
   const ready=page=>page.waitForFunction(()=>window.__cart?.syncState.value==='ready',{},{timeout:6000})
   try {
    await a.goto(origin);await a.waitForFunction(()=>window.__cart?.isReady.value)
    await a.evaluate(()=>window.__add());assert.equal(await a.evaluate(()=>window.__cart.items.value.length),1)
    await a.evaluate(()=>window.__choose('customer'));await ready(a);assert.equal(await a.evaluate(()=>window.__cart.items.value[0].quantity),1)
    await b.goto(origin+'?actor=customer');await ready(b);assert.equal(await b.evaluate(()=>window.__cart.items.value[0].quantity),1)
    await a.evaluate(()=>window.__cart.setQuantity(window.__cart.items.value[0].cart_key,3));await ready(a)
    await b.evaluate(()=>window.__cart.setQuantity(window.__cart.items.value[0].cart_key,2));await b.waitForFunction(()=>window.__cart.syncState.value==='conflict')
    await b.evaluate(()=>window.__cart.reviewServerCart());await ready(b);assert.equal(await b.evaluate(()=>window.__cart.items.value[0].quantity),3)
    await a.reload();await ready(a);assert.equal(await a.evaluate(()=>window.__cart.items.value[0].quantity),3)
    await a.evaluate(()=>window.__choose(''));assert.equal(await a.evaluate(()=>window.__cart.items.value.length),0)
    await a.evaluate(()=>window.__choose('owner'));await ready(a);assert.equal(await a.evaluate(()=>window.__cart.items.value.length),0)
    await a.evaluate(()=>window.__choose('customer'));await ready(a);assert.equal(await a.evaluate(()=>window.__cart.items.value[0].quantity),3)
    assert.deepEqual(errors,[])
   } finally {await browser.close()}
  })
 } finally {if(server){server.closeAllConnections();await new Promise(r=>server.close(r))}await f.close()}
})
