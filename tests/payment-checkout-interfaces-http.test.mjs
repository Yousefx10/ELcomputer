import test from 'node:test'
import assert from 'node:assert/strict'
import {createHmac,randomUUID} from 'node:crypto'
import {createCodCheckoutFixture} from './helpers/codCheckoutFixture.mjs'
import {createEmailFixture} from './helpers/emailFixture.mjs'
import {emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'
import {hmacMessage} from '../server/utils/payments/paymob.js'

test('actual HTTP interface lifecycle keeps abandoned forms independent from financial uncertainty',{skip:!emailNativeAvailable,timeout:240000},async t=>{
 const runtime={paymentFirstEnabled:true,paymobEnabled:true,paymobLiveRequestsEnabled:true,paymobMode:'live',paymobSecretKey:'sk_live_offline_fixture',paymobPublicKey:'pk_live_offline_fixture',paymobHmacSecret:'offline-hmac',paymobCardIntegrationId:'123',paymobCardIntegrationMode:'live',paymobPixelEnabled:true,paymobRedirectFallbackEnabled:true,public:{purchasingEnabled:true,siteUrl:'https://independent.example.invalid'}}
 const f=await createCodCheckoutFixture({runtime,routes:[['post','/api/payments/paymob/webhook','server/api/payments/paymob/webhook.post.js'],['get','/api/account/payment-checkouts/:id','server/api/account/payment-checkouts/[id].get.js'],['get','/api/account/payment-checkouts','server/api/account/payment-checkouts/index.get.js'],['post','/api/account/payment-checkouts/:id/interface','server/api/account/payment-checkouts/[id]/interface.post.js']]})
 runtime.paymobPixelCustomerIds=JSON.stringify([f.actors.customer])
 const original=globalThis.fetch,requests=[];let loseProvider=false
 globalThis.fetch=async(input,options)=>{
  const url=new URL(input)
  if(url.hostname==='accept.paymob.com'){
   assert.equal(url.pathname,'/v1/intention/');const payload=JSON.parse(options.body),number=92000+requests.length
   requests.push(payload);if(loseProvider)throw Error('isolated transport timeout')
   return {ok:true,json:async()=>({id:'pi_live_fixture'+number,intention_order_id:number,client_secret:'csk_live_fixture'+number,intention_detail:{amount:payload.amount,currency:'EGP'},special_reference:payload.special_reference})}
  }
  assert.equal(url.hostname,'127.0.0.1','No external provider or hosted test traffic')
  return original(input,options)
 }
 try{
  await f.db.query("update public.site_settings set payment_card_enabled=true,payment_cash_enabled=true,payment_cash_fee=10,inventory_tracking_required=false,backorder_fulfillment_message='Delivery timing depends on your address.',backorder_fulfillment_message_ar='تختلف مدة التوصيل حسب العنوان.' where key='default'")
  await f.db.query('update private.payment_checkout_settings set enabled=true,enabled_since=now()')
  const email=await createEmailFixture({database:f.db});await email.activate();await email.configure({marketing_enabled:false,webhook_enabled:false})
  await f.db.query('select public.order_email_configure($1,0,true)',[email.actors.owner])
  const company=(await f.db.query("insert into public.commerce_shipping_companies(name,client_shipping_price,checkout_enabled,checkout_governorates,cod_collection_enabled) values('Interface delivery',50,true,array['Cairo'],true) returning id")).rows[0].id
  const city=(await f.db.query("select name_en from private.delivery_location_cities where governorate_code='eg-cairo' order by code limit 1")).rows[0].name_en
  const quote=async body=>{
   const {cart_revision,cart_lines,paymob_method,payment_ui_version,quote_id,...data}=body
   const result=await f.call('/api/checkout/quote',{method:'POST',body:data});assert.equal(result.response.status,200,JSON.stringify(result.body));return {...body,quote_id:result.body.quoteId}
  }
  const body=async()=>{
   const product=(await f.db.query("insert into public.products(title,slug,price,is_serialized,is_published,primary_warehouse_id) values('Interface fixture',$1,100.35,true,true,$2) returning id",['interface-'+randomUUID(),f.warehouse])).rows[0].id
   const variant=(await f.db.query('select id from public.product_variants where product_id=$1',[product])).rows[0].id
   return quote({payment_ui_version:2,cart_id:randomUUID(),cart_revision:randomUUID(),cart_lines:[{cart_key:product+':'+variant,cart_line_id:randomUUID(),quantity:1}],items:[{id:product,variant_id:variant,quantity:1}],address:{first_name:'Owned',last_name:'Buyer',email:'customer@product-save.example.invalid',phone:'01012345678',street_address:'Fixture street',city,governorate:'Cairo'},payment_method:'card',shipping_method:'shipping',shipping_company_id:company,locale:'ar'})
  }
  const start=async b=>{const r=await f.call('/api/checkout',{method:'POST',body:b});assert.equal(r.response.status,200,JSON.stringify(r.body));return r.body}
  const action=(id,action,token,actor='customer')=>f.call('/api/account/payment-checkouts/'+id+'/interface',{method:'POST',actor,body:{version:2,action,...(token?{token}:{})}})
  let tx=82000
  const callback=async(session,success,{pending=false,signature=true,id=++tx}={})=>{
   const provider=(await f.db.query('select * from private.payment_checkout_attempts where session_id=$1',[session.id])).rows[0]
   const value={id,order:{id:Number(provider.provider_order_id)},amount_cents:Number(provider.amount_minor),currency:'EGP',integration_id:Number(provider.integration_id),pending,success,error_occured:false,is_auth:false,is_capture:false,is_refunded:false,is_voided:false,has_parent_transaction:false,is_standalone_payment:true,is_3d_secure:true,created_at:'2026-11-04T01:00:00Z',owner:123,source_data:{pan:'2346',sub_type:'MasterCard',type:'card'}}
   const hmac=signature?createHmac('sha512',runtime.paymobHmacSecret).update(hmacMessage(value)).digest('hex'):'0'.repeat(128)
   const result=await f.call('/api/payments/paymob/webhook?hmac='+hmac,{actor:null,method:'POST',body:{type:'TRANSACTION',obj:value}})
   return {result,id}
  }
  await t.test('an outdated UI fails before intention creation',async()=>{
   const b=await body();delete b.payment_ui_version
   const r=await f.call('/api/checkout',{method:'POST',body:b});assert.equal(r.response.status,409);assert.equal(requests.length,0)
  })
  let first,command,reopened
  await t.test('opening, leaving and reopening immediately return the existing embedded fields',async()=>{
   command=await body();first=await start(command);reopened=await start(await quote(command))
   assert.equal(first.checkout.paymentStatus,'ready');assert.equal(first.payment.experience,'embedded');assert.equal(first.checkout.orderId,null)
   assert.equal(reopened.created,false);assert.equal(reopened.checkout.id,first.checkout.id);assert.equal(reopened.payment.clientSecret,first.payment.clientSecret)
   assert.notEqual(reopened.payment.interfaceToken,first.payment.interfaceToken);assert.equal(requests.length,1)
   assert.equal((await f.db.query('select count(*)::int n from public.customer_orders')).rows[0].n,0)
  })
  await t.test('editing an acknowledged unsubmitted cart requires a fresh quote and creates no cancellation',async()=>{
   const changed=await quote({...command,cart_revision:randomUUID(),items:command.items.map(x=>({...x,quantity:2})),cart_lines:command.cart_lines.map(x=>({...x,quantity:2}))})
   const rejected=await f.call('/api/checkout',{method:'POST',body:changed});assert.equal(rejected.response.status,409);assert.equal(rejected.body.data.code,'checkout:restart');assert.equal(requests.length,1)
   command=await quote({...changed,cart_id:randomUUID(),cart_revision:randomUUID()});reopened=await start(command)
   assert.equal(requests.length,2);assert.equal(reopened.checkout.totalAmount,'250.70');assert.equal((await f.db.query('select status from private.payment_checkout_attempts where session_id=$1',[first.checkout.id])).rows[0].status,'pending')
  })
  await t.test('concurrent tabs share one intention and only one submission passes the server gate',async()=>{
   const opened=await Promise.all([start(command),start(command)])
   const results=await Promise.all(opened.map(r=>action(r.checkout.id,'submit',r.payment.interfaceToken)))
   assert.equal(results.filter(r=>r.body.allowed===true).length,1);assert.equal(requests.length,2)
   assert.equal((await action(first.checkout.id,'submit',first.payment.interfaceToken)).body.allowed,false)
  })
  await t.test('a submitted unknown result does not lock an unrelated product journey',async()=>{
   const duplicate=await start(await quote({...command,cart_id:randomUUID(),cart_revision:randomUUID()}));assert.equal(duplicate.blocked,true);assert.equal(duplicate.payment,undefined)
   const other=await start(await body());assert.ok(other.payment);assert.equal(requests.length,3)
  })
  await t.test('foreign accounts and anonymous requests cannot open or arm the private interface',async()=>{
   for(const actor of [null,'owner']){const r=await action(reopened.checkout.id,'open',null,actor);assert.ok([401,403].includes(r.response.status));assert.ok(!JSON.stringify(r.body).includes('csk_live'))}
   const r=await f.call('/api/account/payment-checkouts/'+reopened.checkout.id);assert.equal(r.response.headers.get('cache-control'),'private, no-store');assert.ok(!JSON.stringify(r.body).includes('interfaceToken'));assert.ok(!JSON.stringify(r.body).includes('csk_live'))
  })
  await t.test('an authenticated decline enables Try Again on that same intention',async()=>{
   const declined=(await callback(reopened.checkout,false));assert.equal(declined.result.response.status,200)
   const read=await f.call('/api/account/payment-checkouts/'+reopened.checkout.id);assert.equal(read.body.checkout.paymentStatus,'failed');assert.equal(read.body.checkout.canResume,true)
   const retry=await action(reopened.checkout.id,'open');assert.ok(retry.body.payment);assert.equal(retry.body.payment.clientSecret,reopened.payment.clientSecret)
   assert.equal(requests.length,3);assert.equal((await action(reopened.checkout.id,'submit',retry.body.payment.interfaceToken)).body.allowed,true)
   await callback(reopened.checkout,false,{id:declined.id})
   assert.equal((await action(reopened.checkout.id,'open')).body.allowed,false)
  })
  await t.test('delayed HMAC success creates one paid order and one localized notification; replay is harmless',async()=>{
   const bad=await callback(reopened.checkout,true,{signature:false});assert.equal(bad.result.response.status,401)
   const pending=await callback(reopened.checkout,false,{pending:true});assert.equal(pending.result.response.status,200)
   const before=(await f.db.query('select count(*)::int n from public.customer_orders')).rows[0].n
   const success=await callback(reopened.checkout,true);assert.equal(success.result.response.status,200,JSON.stringify(success.result.body))
   for(let i=0;i<3;i++)assert.equal((await callback(reopened.checkout,true,{id:success.id})).result.response.status,200)
   const paid=await f.call('/api/account/payment-checkouts/'+reopened.checkout.id);assert.equal(paid.body.checkout.paymentStatus,'paid')
   assert.equal((await f.db.query('select count(*)::int n from public.customer_orders')).rows[0].n,before+1)
   const events=(await f.db.query('select event_type,locale from public.order_email_events where order_id=$1',[paid.body.checkout.orderId])).rows;assert.deepEqual(events,[{event_type:'payment_verified',locale:'ar'}])
   assert.equal(requests.length,3)
  })
  await t.test('SDK fallback is handed off once through the server; it cannot bypass an armed payment',async()=>{
   const value=await start(await body()),id=value.checkout.id,token=value.payment.interfaceToken
   assert.equal((await action(id,'hosted',token)).body.allowed,true);assert.equal((await action(id,'hosted',token)).body.allowed,false)
   assert.equal((await action(id,'open')).body.allowed,false)
  })
  await t.test('an uncertain intention creation is never retried or marked failed',async()=>{
   const b=await body(),before=requests.length;loseProvider=true
   const uncertain=await start(b),again=await start(b);assert.equal(uncertain.checkout.state,'uncertain');assert.equal(again.checkout.id,uncertain.checkout.id);assert.equal(again.payment,undefined);assert.equal(requests.length,before+1)
   assert.equal((await f.db.query('select status from private.payment_checkout_attempts where session_id=$1',[uncertain.checkout.id])).rows[0].status,'uncertain')
   loseProvider=false
  })
 }finally{globalThis.fetch=original;await f.close()}
})
