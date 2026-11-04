import test from 'node:test'
import assert from 'node:assert/strict'
import {createHmac,randomUUID} from 'node:crypto'
import {createCodCheckoutFixture} from './helpers/codCheckoutFixture.mjs'
import {emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'
import {hmacMessage} from '../server/utils/payments/paymob.js'
const config={paymentFirstEnabled:true,paymobEnabled:true,paymobLiveRequestsEnabled:true,paymobMode:'live',paymobSecretKey:'sk_live_offline_fixture',paymobPublicKey:'pk_live_offline_fixture',paymobHmacSecret:'offline-hmac',paymobCardIntegrationId:'123',paymobCardIntegrationMode:'live',public:{purchasingEnabled:true,siteUrl:'https://independent.example.invalid'}}
test('actual HTTP checkout, HMAC callback and owner-scoped recovery have no provider network',{skip:!emailNativeAvailable,timeout:180000},async t=>{
 const runtime=structuredClone(config),f=await createCodCheckoutFixture({runtime,...(process.env.PAYMENT_FIRST_CORE_ONLY?{stopBefore:'20261101221000'}:{}),routes:[['post','/api/payments/paymob/webhook','server/api/payments/paymob/webhook.post.js'],['get','/api/account/payment-checkouts','server/api/account/payment-checkouts/index.get.js'],['get','/api/account/payment-checkouts/:id','server/api/account/payment-checkouts/[id].get.js']]})
 const realFetch=globalThis.fetch;let providerCalls=0,providerBody,providerResponseLost=false
 try{
 globalThis.fetch=async(input,options)=>{const u=new URL(input);if(u.hostname==='accept.paymob.com'){
  providerCalls++;providerBody=JSON.parse(options.body);if(providerResponseLost)throw Error('fixture uncertain transport')
  return {ok:true,json:async()=>({id:'pi_live_fixture'+providerCalls,intention_order_id:80000+providerCalls,client_secret:'csk_live_fixture'+providerCalls,intention_detail:{amount:providerBody.amount,currency:'EGP'},special_reference:providerBody.special_reference})}
 }if(u.hostname!=='127.0.0.1')throw Error('External network forbidden');return realFetch(input,options)}
 await f.db.query("update public.site_settings set payment_card_enabled=true,payment_cash_enabled=true,payment_cash_fee=10,inventory_tracking_required=false,backorder_fulfillment_message='Delivery timing depends on your address.',backorder_fulfillment_message_ar='تختلف مدة التوصيل حسب العنوان.' where key='default'")
 await f.db.query('update private.payment_checkout_settings set enabled=true,enabled_since=now()')
 const product=(await f.db.query("insert into public.products(title,slug,price,is_serialized,is_published,primary_warehouse_id) values('HTTP fixture',$1,100.35,true,true,$2) returning id",['http-'+randomUUID(),f.warehouse])).rows[0].id,variant=(await f.db.query('select id from public.product_variants where product_id=$1',[product])).rows[0].id
 const company=(await f.db.query("insert into public.commerce_shipping_companies(name,client_shipping_price,checkout_enabled,checkout_governorates,cod_collection_enabled) values('HTTP delivery',50,true,array['Cairo'],true) returning id")).rows[0].id,city=(await f.db.query("select name_en from private.delivery_location_cities where governorate_code='eg-cairo' order by code limit 1")).rows[0].name_en
 const lineId=randomUUID(),body={payment_ui_version:2,cart_id:randomUUID(),cart_revision:randomUUID(),cart_lines:[{cart_key:product+':'+variant,cart_line_id:lineId,quantity:1}],items:[{id:product,variant_id:variant,quantity:1}],address:{first_name:'Owned',last_name:'Buyer',email:'customer@product-save.example.invalid',phone:'01012345678',street_address:'Fixture street',city,governorate:'Cairo'},payment_method:'card',shipping_method:'shipping',shipping_company_id:company,locale:'ar'}
 const {cart_revision,cart_lines,payment_ui_version,...quoteBody}=body,q=await f.call('/api/checkout/quote',{method:'POST',body:quoteBody});assert.equal(q.response.status,200,JSON.stringify(q.body));body.quote_id=q.body.quoteId
 let started
 await t.test('old cached clients fail before payment or order creation',async()=>{
  const r=await f.call('/api/checkout',{method:'POST',body:{...quoteBody,quote_id:body.quote_id}});assert.equal(r.response.status,409);assert.equal(providerCalls,0);assert.equal((await f.db.query('select count(*)::int n from public.customer_orders')).rows[0].n,0)
 })
 await t.test('explicit modern confirmation starts once, freezes amount and returns no order',async()=>{
  started=await f.call('/api/checkout',{method:'POST',body});assert.equal(started.response.status,200,JSON.stringify(started.body));assert.ok(started.body.checkout.id);assert.equal(started.body.order,undefined);assert.equal(providerCalls,1);assert.equal(providerBody.amount,15035);assert.equal(new URL(providerBody.redirection_url).searchParams.get('checkout_id'),started.body.checkout.id);assert.equal(new URL(providerBody.redirection_url).searchParams.has('order_id'),false)
  assert.equal((await f.db.query('select count(*)::int n from public.customer_orders')).rows[0].n,0)
 })
 await t.test('retrying a lost acknowledgement never opens another provider intention',async()=>{
  const r=await f.call('/api/checkout',{method:'POST',body});assert.equal(r.response.status,200);assert.equal(r.body.created,false);assert.equal(r.body.checkout.id,started.body.checkout.id);assert.equal(r.body.payment,undefined);assert.equal(providerCalls,1)
 })
 await t.test('foreign and anonymous status requests cannot read a session or its secret',async()=>{
  for(const actor of [null,'owner']){const r=await f.call('/api/account/payment-checkouts/'+started.body.checkout.id,{actor});assert.ok([401,403].includes(r.response.status));assert.ok(!JSON.stringify(r.body).includes('Owned'))}
  const r=await f.call('/api/account/payment-checkouts/'+started.body.checkout.id);assert.equal(r.response.status,200);assert.equal(r.response.headers.get('cache-control'),'private, no-store');assert.ok(!JSON.stringify(r.body).includes('csk_live'))
 })
 const transaction={id:99001,order:{id:80001},amount_cents:15035,currency:'EGP',integration_id:123,pending:false,success:true,error_occured:false,is_auth:false,is_capture:false,is_refunded:false,is_voided:false,has_parent_transaction:false,is_standalone_payment:true,is_3d_secure:true,created_at:'2026-11-01T20:00:00Z',owner:123,source_data:{pan:'2346',sub_type:'MasterCard',type:'card'}}
 const callback=async(tx,signature=createHmac('sha512',runtime.paymobHmacSecret).update(hmacMessage(tx)).digest('hex'))=>f.call('/api/payments/paymob/webhook?hmac='+signature,{actor:null,method:'POST',body:{type:'TRANSACTION',obj:tx}})
 await t.test('browser return and unsigned callbacks cannot create an order',async()=>{
  const r=await callback(transaction,'0'.repeat(128));assert.equal(r.response.status,401);assert.equal((await f.db.query('select count(*)::int n from public.customer_orders')).rows[0].n,0)
 })
 await t.test('signed pending status is retained without creating an order',async()=>{const r=await callback({...transaction,pending:true,success:false});assert.equal(r.response.status,200);assert.equal((await f.db.query('select count(*)::int n from public.customer_orders')).rows[0].n,0);assert.equal((await f.db.query('select count(*)::int n from private.payment_callback_receipts')).rows[0].n,1)})
 await t.test('valid HMAC success commits exactly one paid order before customer confirmation',async()=>{
  const result=await callback(transaction);assert.equal(result.response.status,200,JSON.stringify(result.body));const order=(await f.db.query('select * from public.customer_orders')).rows[0];assert.equal(order.payment_status,'paid');assert.equal(order.amount_paid,'150.35');assert.equal(order.user_id,f.actors.customer)
  const r=await f.call('/api/account/payment-checkouts/'+started.body.checkout.id);assert.equal(r.body.checkout.paymentStatus,'paid');assert.equal(r.body.checkout.orderId,order.id)
  for(let i=0;i<3;i++)assert.equal((await callback(transaction)).response.status,200)
  assert.equal((await f.db.query('select count(*)::int n from public.customer_orders')).rows[0].n,1);assert.equal(providerCalls,1)
  const receipts=(await f.db.query('select * from private.payment_callback_receipts')).rows;assert.equal(receipts.length,2);assert.deepEqual(receipts.map(r=>r.status).sort(),['pending','succeeded']);await assert.rejects(f.db.query('delete from private.payment_callback_receipts'),/immutable/);const evidence=receipts.find(r=>r.status==='succeeded');assert.match(evidence.evidence_sha256,/^[a-f0-9]{64}$/);assert.match(evidence.signature_sha256,/^[a-f0-9]{64}$/)
 })
 await t.test('new COD checkout stays unpaid with live configured fee and no provider dispatch',async()=>{
  const {cart_revision,cart_lines,payment_ui_version,...cash}=body;cash.cart_id=randomUUID();cash.payment_method='cash';delete cash.quote_id;
  const q=await f.call('/api/checkout/quote',{method:'POST',body:cash});assert.equal(q.response.status,200,JSON.stringify(q.body));cash.quote_id=q.body.quoteId;
  const result=await f.call('/api/checkout',{method:'POST',body:cash});assert.equal(result.response.status,200,JSON.stringify(result.body));assert.equal(result.body.order.paymentFeeAmount,10);assert.equal(result.body.order.amountPaid,0);assert.equal(result.body.order.paymentMethod,'cash');assert.equal(providerCalls,1)
 })
 await t.test('lost provider response stays quarantined, including a signed callback with no known mapping',async()=>{
  const {cart_revision,cart_lines,payment_ui_version,...quoteBody}=body;quoteBody.cart_id=randomUUID();delete quoteBody.quote_id;
  const q=await f.call('/api/checkout/quote',{method:'POST',body:quoteBody});assert.equal(q.response.status,200);const newBody={...quoteBody,payment_ui_version:2,quote_id:q.body.quoteId,cart_revision:randomUUID(),cart_lines:body.cart_lines};providerResponseLost=true;
  const first=await f.call('/api/checkout',{method:'POST',body:newBody});assert.equal(first.response.status,200);assert.equal(first.body.checkout.state,'uncertain');const before=(await f.db.query('select count(*)::int n from public.customer_orders')).rows[0].n;
  const again=await f.call('/api/checkout',{method:'POST',body:newBody});assert.equal(again.response.status,200);assert.equal(again.body.payment,undefined);assert.equal(providerCalls,2);
  const receipt=await callback({...transaction,id:99002,order:{id:80002}});assert.equal(receipt.response.status,200);assert.equal((await f.db.query('select count(*)::int n from public.customer_orders')).rows[0].n,before);assert.equal((await f.db.query("select count(*)::int n from private.payment_callback_inbox where transaction_id='99002' and not processed")).rows[0].n,1)
 })
 }finally{globalThis.fetch=realFetch;await f.close()}
})
