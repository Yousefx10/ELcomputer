import test from 'node:test'
import assert from 'node:assert/strict'
import {createHmac,randomUUID} from 'node:crypto'
import {createCodCheckoutFixture} from './helpers/codCheckoutFixture.mjs'
import {emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'
import {hmacMessage} from '../server/utils/payments/paymob.js'

// Hosted Apple Pay: no Pixel rollout, no merchant-domain flags, Paymob's own page.
const config={paymentFirstEnabled:true,paymobEnabled:true,paymobLiveRequestsEnabled:true,paymobMode:'live',paymobSecretKey:'sk_live_offline_fixture',paymobPublicKey:'pk_live_offline_fixture',paymobHmacSecret:'offline-hmac',paymobCardIntegrationId:'123',paymobCardIntegrationMode:'live',paymobPixelEnabled:false,paymobIntegrationIds:JSON.stringify({apple_pay:{id:321,mode:'live',enabled:true,hosted:true}}),public:{purchasingEnabled:true,siteUrl:'https://independent.example.invalid'}}
test('hosted Apple Pay checkout uses its own intention and records one paid order',{skip:!emailNativeAvailable,timeout:180000},async t=>{
 const runtime=structuredClone(config),f=await createCodCheckoutFixture({runtime,routes:[['get','/api/payments/capabilities','server/api/payments/capabilities.get.js'],['post','/api/payments/paymob/webhook','server/api/payments/paymob/webhook.post.js'],['get','/api/account/payment-checkouts/:id','server/api/account/payment-checkouts/[id].get.js']]})
 const realFetch=globalThis.fetch;let providerCalls=0,providerBody
 try{
 globalThis.fetch=async(input,options)=>{const u=new URL(input);if(u.hostname==='accept.paymob.com'){
  providerCalls++;providerBody=JSON.parse(options.body)
  return {ok:true,json:async()=>({id:'pi_live_hosted'+providerCalls,intention_order_id:81000+providerCalls,client_secret:'csk_live_hosted'+providerCalls,intention_detail:{amount:providerBody.amount,currency:'EGP'},special_reference:providerBody.special_reference})}
 }if(u.hostname!=='127.0.0.1')throw Error('External network forbidden');return realFetch(input,options)}
 await f.db.query("update public.site_settings set payment_card_enabled=true,payment_cash_enabled=true,payment_cash_fee=10,inventory_tracking_required=false,backorder_fulfillment_message='Delivery timing depends on your address.',backorder_fulfillment_message_ar='تختلف مدة التوصيل حسب العنوان.' where key='default'")
 await f.db.query('update private.payment_checkout_settings set enabled=true,enabled_since=now()')
 const product=(await f.db.query("insert into public.products(title,slug,price,is_serialized,is_published,primary_warehouse_id) values('Hosted fixture',$1,325,true,true,$2) returning id",['hosted-'+randomUUID(),f.warehouse])).rows[0].id,variant=(await f.db.query('select id from public.product_variants where product_id=$1',[product])).rows[0].id
 const company=(await f.db.query("insert into public.commerce_shipping_companies(name,client_shipping_price,checkout_enabled,checkout_governorates,cod_collection_enabled) values('Hosted delivery',50,true,array['Cairo'],true) returning id")).rows[0].id,city=(await f.db.query("select name_en from private.delivery_location_cities where governorate_code='eg-cairo' order by code limit 1")).rows[0].name_en
 const body={payment_ui_version:2,cart_id:randomUUID(),cart_revision:randomUUID(),cart_lines:[{cart_key:product+':'+variant,cart_line_id:randomUUID(),quantity:1}],items:[{id:product,variant_id:variant,quantity:1}],address:{first_name:'Owned',last_name:'Buyer',email:'customer@product-save.example.invalid',phone:'01012345678',street_address:'Fixture street',city,governorate:'Cairo'},payment_method:'card',paymob_method:'apple_pay',shipping_method:'shipping',shipping_company_id:company,locale:'en'}
 const {cart_revision,cart_lines,paymob_method,payment_ui_version,...quoteBody}=body,q=await f.call('/api/checkout/quote',{method:'POST',body:quoteBody});assert.equal(q.response.status,200,JSON.stringify(q.body));body.quote_id=q.body.quoteId
 let started
 await t.test('test accounts see hosted Apple Pay; other visitors do not',async()=>{
  runtime.paymobIntegrationIds=JSON.stringify({apple_pay:{id:321,mode:'live',enabled:true,hosted:true,customerIds:[f.actors.customer]}})
  const own=await f.call('/api/payments/capabilities');assert.deepEqual(own.body.express,[{method:'apple_pay',available:true,experience:'redirect'}])
  for(const actor of [null,'owner']){const r=await f.call('/api/payments/capabilities',{actor});assert.equal(r.response.status,200);assert.deepEqual(r.body.express,[])}
  runtime.paymobIntegrationIds=config.paymobIntegrationIds
 })
 await t.test('capabilities offer hosted Apple Pay without exposing the integration',async()=>{
  const r=await f.call('/api/payments/capabilities');assert.equal(r.response.status,200);assert.equal(r.body.card.experience,'redirect')
  assert.deepEqual(r.body.express,[{method:'apple_pay',available:true,experience:'redirect'}]);assert.equal(JSON.stringify(r.body).includes('321'),false)
 })
 await t.test('Apple Pay checkout creates an Apple-only hosted intention',async()=>{
  started=await f.call('/api/checkout',{method:'POST',body});assert.equal(started.response.status,200,JSON.stringify(started.body))
  assert.equal(providerCalls,1);assert.deepEqual(providerBody.payment_methods,[321]);assert.equal(providerBody.amount,37500)
  assert.equal(started.body.payment.experience,'redirect');assert.deepEqual(started.body.payment.paymentMethods,['apple-pay']);assert.equal(started.body.payment.redirectFallback,false)
  assert.match(started.body.payment.clientSecret,/^csk_live_hosted1$/);assert.equal(started.body.payment.interfaceToken,undefined)
  assert.equal((await f.db.query('select count(*)::int n from public.customer_orders')).rows[0].n,0)
 })
 await t.test('a retried request never opens another provider intention',async()=>{
  const r=await f.call('/api/checkout',{method:'POST',body});assert.equal(r.response.status,200);assert.equal(r.body.created,false);assert.equal(providerCalls,1)
 })
 const transaction={id:99101,order:{id:81001},amount_cents:37500,currency:'EGP',integration_id:321,pending:false,success:true,error_occured:false,is_auth:false,is_capture:false,is_refunded:false,is_voided:false,has_parent_transaction:false,is_standalone_payment:true,is_3d_secure:false,created_at:'2026-11-07T10:00:00Z',owner:123,source_data:{pan:'2542',sub_type:'MasterCard',type:'apple_pay'}}
 const callback=tx=>f.call('/api/payments/paymob/webhook?hmac='+createHmac('sha512',runtime.paymobHmacSecret).update(hmacMessage(tx)).digest('hex'),{actor:null,method:'POST',body:{type:'TRANSACTION',obj:tx}})
 const orders=async()=>(await f.db.query('select * from public.customer_orders')).rows
 await t.test('signed callbacks from another method or integration create no order',async()=>{
  assert.notEqual((await callback({...transaction,id:99102,source_data:{...transaction.source_data,type:'wallet'}})).response.status,200)
  // A card-integration receipt for this Apple attempt is kept unprocessed, never applied.
  await callback({...transaction,id:99103,integration_id:123,source_data:{...transaction.source_data,type:'card'}})
  assert.equal((await orders()).length,0)
  const s=await f.call('/api/account/payment-checkouts/'+started.body.checkout.id);assert.notEqual(s.body.checkout.paymentStatus,'paid')
 })
 await t.test('a signed Apple Pay success records exactly one paid order',async()=>{
  const r=await callback(transaction);assert.equal(r.response.status,200,JSON.stringify(r.body))
  for(let i=0;i<2;i++)assert.equal((await callback(transaction)).response.status,200)
  const paid=await orders();assert.equal(paid.length,1);assert.equal(paid[0].payment_status,'paid');assert.equal(paid[0].amount_paid,'375.00');assert.equal(paid[0].user_id,f.actors.customer)
  const s=await f.call('/api/account/payment-checkouts/'+started.body.checkout.id);assert.equal(s.body.checkout.paymentStatus,'paid');assert.equal(s.body.checkout.orderId,paid[0].id)
 })
 }finally{globalThis.fetch=realFetch;await f.close()}
})
