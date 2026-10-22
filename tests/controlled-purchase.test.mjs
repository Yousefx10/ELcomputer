import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, createHmac } from 'node:crypto'
import { build } from 'esbuild'
import { resolve } from 'node:path'
import { createCodCheckoutFixture } from './helpers/codCheckoutFixture.mjs'
import { emailNativeAvailable } from './helpers/emailNativeDatabase.mjs'
import { hmacMessage, getPaymobConfig, buildIntentionRequest } from '../server/utils/payments/paymob.js'
const bundle=await build({entryPoints:[resolve('server/utils/controlledPurchase.js')],bundle:true,write:false,format:'esm',platform:'node',alias:{'~':resolve('app')},plugins:[{name:'absolute-h3',setup(b){b.onResolve({filter:/^h3$/},()=>({path:import.meta.resolve('h3'),external:true}))}}]})
const {controlledPurchase,controlledPurchaseScope,controlledAddressHash}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'))
const user={id:randomUUID(),email:'customer@product-save.example.invalid',is_anonymous:false,email_confirmed_at:'2026-01-01T00:00:00.000Z'}
const address={first_name:'Synthetic',last_name:'Buyer',email:user.email,phone:'01012345678',street_address:'Isolated fixture street',city:'Fixture city',governorate:'Cairo'}
const config=()=>({paymobEnabled:false,paymobLiveRequestsEnabled:false,paymobMode:'live',paymobCardIntegrationMode:'live',paymobSecretKey:'sk_live_isolated_fixture',paymobPublicKey:'pk_live_isolated_fixture',paymobHmacSecret:'isolated-hmac',paymobCardIntegrationId:'12345',public:{siteUrl:'https://orchid.example.invalid',purchasingEnabled:false}})
const grant=()=>({enabled:true,customer_id:user.id,cart_id:randomUUID(),product_id:randomUUID(),variant_id:randomUUID(),shipping_company_id:randomUUID(),total_minor:11000,address_sha256:controlledAddressHash(address),starts_at:new Date(Date.now()-1000).toISOString(),expires_at:new Date(Date.now()+600000).toISOString(),payment_enabled:true,review_key:'11'.repeat(32)})

test('controlled purchase fails closed for default/config errors, other identities and closed windows',async()=>{
 const runtime=config(),g=grant();assert.throws(()=>controlledPurchaseScope(runtime,user))
 runtime.controlledPurchase=JSON.stringify(g)
 assert.equal(controlledPurchaseScope(runtime,user).customer_id,user.id)
 assert.equal(controlledPurchaseScope({...runtime,controlledPurchase:{...g}},user).cart_id,g.cart_id)
 for(const change of [{enabled:false},{payment_enabled:'true'},{customer_id:randomUUID()},{total_minor:0},{total_minor:1.5},{review_key:'bad'},{address_sha256:'bad'},{extra:true},{expires_at:new Date(Date.now()+7200000).toISOString()},{starts_at:'yesterday'}])assert.throws(()=>controlledPurchaseScope({...runtime,controlledPurchase:JSON.stringify({...g,...change})},user))
 for(const actor of [null,{...user,id:randomUUID()},{...user,email_confirmed_at:null},{...user,is_anonymous:true}])assert.throws(()=>controlledPurchaseScope(runtime,actor))
 assert.throws(()=>controlledPurchaseScope(runtime,user,{now:Date.parse(g.starts_at)-1}))
 assert.throws(()=>controlledPurchaseScope(runtime,user,{now:Date.parse(g.expires_at)}))
 assert.equal(controlledPurchaseScope(runtime,user,{now:Date.parse(g.expires_at),readOnly:true}).cart_id,g.cart_id)
 assert.throws(()=>getPaymobConfig(runtime),/gateway_disabled/)
 let touched=false;await assert.rejects(controlledPurchase({runtime:{},user,db:{rpc(){touched=true}},action:'order',input:{}}));assert.equal(touched,false)
})

test('controlled return uses the existing signed receiver and a fixed local path',()=>{
 const c=getPaymobConfig({...config(),paymobEnabled:true,paymobLiveRequestsEnabled:true})
 const o={id:randomUUID(),total_amount:'110.00',currency:'EGP'},a={id:randomUUID(),amount_minor:11000}
 const p=buildIntentionRequest(c,o,a,'ar','/account/controlled-purchase')
 assert.equal(p.notification_url,'https://orchid.example.invalid/api/payments/paymob/webhook')
 assert.equal(p.redirection_url,`https://orchid.example.invalid/ar/account/controlled-purchase?order_id=${o.id}`)
 assert.throws(()=>buildIntentionRequest(c,o,a,'en','https://other.example.invalid'))
})

test('native controlled purchase binds one stock-backed order and one intention while public gates remain off',{skip:!emailNativeAvailable},async t=>{
 const runtime=config(),f=await createCodCheckoutFixture({runtime,routes:[['get','/api/checkout/controlled','server/api/checkout/controlled.get.js'],['post','/api/checkout/controlled','server/api/checkout/controlled.post.js'],['post','/api/payments/paymob/webhook','server/api/payments/paymob/webhook.post.js']]})
 const me={...user,id:f.actors.customer}
 try{
  f.client.auth.getUser=async actor=>({data:{user:actor==='customer'?me:actor==='owner'?{...me,id:f.actors.owner}:null},error:null})
  await f.db.query('update public.site_settings set payment_card_enabled=true,payment_card_fee=0')
  const product=(await f.db.query("insert into public.products(title,slug,price,is_serialized,is_published,primary_warehouse_id) values('Isolated controlled item',$1,100,true,true,$2) returning id",['controlled-'+randomUUID(),f.warehouse])).rows[0].id
  const variant=(await f.db.query('select id from public.product_variants where product_id=$1',[product])).rows[0].id
  const received=await f.client.rpc('commerce_create_procurement_order',{p_supplier_id:f.supplier,p_warehouse_id:f.warehouse,p_invoice_number:randomUUID(),p_notes:'Isolated fixture only',p_paid_amount:0,p_items:[{product_id:product,variant_id:variant,quantity:3,unit_cost:60}]});assert.equal(received.error,null)
  const company=(await f.db.query("insert into public.commerce_shipping_companies(name,provider,client_shipping_price,checkout_enabled,checkout_governorates) values('Fixture PDC','pdc',10,true,array['Cairo']) returning id")).rows[0].id
  const g={...grant(),customer_id:me.id,product_id:product,variant_id:variant,shipping_company_id:company}
  runtime.controlledPurchase=JSON.stringify(g)
  const invoke=(action,input={},extra={})=>controlledPurchase({db:f.client,user:me,runtime,action,input,...extra})
  const post=body=>f.call('/api/checkout/controlled',{method:'POST',body})
  await t.test('HTTP identity checks precede scoped data; default and other accounts cannot purchase',async()=>{
   assert.equal((await f.call('/api/checkout/controlled',{actor:null})).response.status,401)
   assert.equal((await f.call('/api/checkout/controlled',{actor:'owner'})).response.status,403)
   runtime.controlledPurchase='{}';assert.equal((await post({action:'quote',address})).response.status,403);runtime.controlledPurchase=JSON.stringify(g)
   runtime.controlledPurchase={...g};assert.equal((await f.call('/api/checkout/controlled')).response.status,200);runtime.controlledPurchase=JSON.stringify(g)
  })
  await t.test('actual SQL rejects the disabled PDC account, then missing cities, without provider calls',async()=>{
   assert.equal((await post({action:'quote',address})).response.status,409)
   await f.db.query("update public.shipping_provider_settings set is_enabled=true,product_id=40,origin_city_id=1,origin_address='Isolated pickup',origin_contact_name='Isolated sender',origin_phone='01000000000',access_token_encrypted='fixture',webhook_secret_encrypted='independent-fixture',cod_enabled=false,auto_create_labels=false")
   assert.equal((await post({action:'quote',address})).response.status,409)
   await f.db.query("update public.shipping_provider_settings set cities_cache='[{\"id\":1,\"name\":\"Origin\"},{\"id\":2,\"name\":\"Destination\"}]',products_cache='[{\"id\":40,\"name\":\"Fixture high value\"}]'")
   await f.db.query("delete from public.shipping_city_mappings")
   await f.db.query("insert into public.shipping_city_mappings(provider,governorate,city,provider_city_id) values('pdc','Cairo','Fixture city',2)")
  })
  let review,orderId
  await t.test('address, item, total and signed review are bound before the ordinary SQL command',async()=>{
   for(const input of [{action:'quote',address:{...address,city:'Elsewhere'}},{action:'quote',address,items:[{id:randomUUID()}]},{action:'order',address,quote_id:randomUUID(),review_token:'0'.repeat(64)}])assert.ok((await post(input)).response.status>=400)
   const q=await post({action:'quote',address});assert.equal(q.response.status,200,JSON.stringify(q.body));review=q.body;assert.equal(review.totalAmount,110);assert.equal(review.reviewToken.length,64)
   runtime.controlledPurchase=JSON.stringify({...g,total_minor:11100})
   assert.equal((await post({action:'order',address,quote_id:review.quoteId,review_token:review.reviewToken})).response.status,409)
   runtime.controlledPurchase=JSON.stringify(g)
  })
  await t.test('concurrent exact commands and lost acknowledgements produce only one order and allocation',async()=>{
   const input={action:'order',address,quote_id:review.quoteId,review_token:review.reviewToken}
   const results=await Promise.all(Array.from({length:5},()=>post(input)))
   assert.ok(results.every(r=>r.response.status===200),JSON.stringify(results.map(r=>r.body)));assert.equal(new Set(results.map(r=>r.body.order.id)).size,1);orderId=results[0].body.order.id
   const view=await invoke('view');assert.equal(view.order.id,orderId);assert.equal(view.quantity,1);assert.equal(JSON.stringify(view).includes(g.review_key),false);assert.equal(JSON.stringify(view).includes(g.customer_id),false)
   assert.equal((await f.db.query('select count(*)::int n from public.customer_orders')).rows[0].n,1)
   assert.equal((await f.db.query('select count(*)::int n from public.commerce_serialized_units where customer_order_id=$1',[orderId])).rows[0].n,1)
  })
  await t.test('payment requires the exact approved order; concurrent initiation creates one synthetic provider intention',async()=>{
   let calls=0
   const fetcher=async(url,options)=>{calls++;const p=JSON.parse(options.body);assert.equal(p.amount,11000);assert.match(p.redirection_url,/\/account\/controlled-purchase\?order_id=/);return new Response(JSON.stringify({id:'pi_live_isolated',intention_order_id:987654,client_secret:'csk_live_isolated',intention_detail:{amount:11000,currency:'EGP'},special_reference:p.special_reference}))}
   await assert.rejects(invoke('pay',{order_id:randomUUID()},{fetcher}));assert.equal(calls,0)
   runtime.controlledPurchase=JSON.stringify({...g,total_minor:11100});await assert.rejects(invoke('pay',{order_id:orderId},{fetcher}));assert.equal(calls,0);runtime.controlledPurchase=JSON.stringify(g)
   runtime.controlledPurchase=JSON.stringify({...g,payment_enabled:false});await assert.rejects(invoke('pay',{order_id:orderId},{fetcher}));assert.equal(calls,0);runtime.controlledPurchase=JSON.stringify(g)
   const results=await Promise.allSettled(Array.from({length:5},()=>invoke('pay',{order_id:orderId},{fetcher})))
   assert.ok(results.some(r=>r.status==='fulfilled'),JSON.stringify(results));assert.equal(calls,1)
   assert.equal(runtime.paymobEnabled,false);assert.equal(runtime.paymobLiveRequestsEnabled,false);assert.equal(runtime.public.purchasingEnabled,false)
  })
  await t.test('expired outbound access still permits owned status and HMAC settlement; duplicates do not allocate or book',async()=>{
   runtime.controlledPurchase=JSON.stringify({...g,starts_at:new Date(Date.now()-1200000).toISOString(),expires_at:new Date(Date.now()-600000).toISOString()})
   await assert.rejects(invoke('pay',{order_id:orderId},{fetcher:()=>{throw Error('Must not call provider')}}));assert.equal((await invoke('view')).order.id,orderId)
   const tx={amount_cents:11000,created_at:'2026-10-23T00:00:00',currency:'EGP',error_occured:false,has_parent_transaction:false,id:7777,integration_id:12345,is_3d_secure:true,is_auth:false,is_capture:false,is_refunded:false,is_standalone_payment:true,is_voided:false,order:{id:987654},owner:333,pending:false,source_data:{pan:'2346',sub_type:'MasterCard',type:'card'},success:true}
   const call=signature=>f.call('/api/payments/paymob/webhook?hmac='+signature,{method:'POST',body:{type:'TRANSACTION',obj:tx}})
   assert.equal((await call('0'.repeat(128))).response.status,401)
   const signed=createHmac('sha512',runtime.paymobHmacSecret).update(hmacMessage(tx)).digest('hex')
   assert.equal((await call(signed)).response.status,200);assert.equal((await call(signed)).response.status,200)
   assert.equal((await invoke('view')).order.paymentStatus,'paid')
   assert.equal((await f.db.query('select count(*)::int n from public.payment_transactions')).rows[0].n,1)
   assert.equal((await f.db.query('select count(*)::int n from public.shipping_order_jobs')).rows[0].n,0)
   assert.equal((await f.db.query('select count(*)::int n from public.commerce_serialized_units where customer_order_id=$1',[orderId])).rows[0].n,1)
  })
 }finally{await f.close()}
})
