import test from 'node:test'
import assert from 'node:assert/strict'
import {createHmac,randomUUID} from 'node:crypto'
import {createCodCheckoutFixture} from './helpers/codCheckoutFixture.mjs'
import {hmacMessage} from '../server/utils/payments/paymob.js'
import {emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'
test('actual HTTP charges the authoritative preorder payable amount for CARD and Apple',{skip:!emailNativeAvailable,timeout:180000},async t=>{
 const runtime={paymentFirstEnabled:true,paymobEnabled:true,paymobLiveRequestsEnabled:true,paymobMode:'live',paymobSecretKey:'sk_live_offline_fixture',paymobPublicKey:'pk_live_offline_fixture',paymobHmacSecret:'offline-hmac',paymobCardIntegrationId:'123',paymobCardIntegrationMode:'live',paymobPixelEnabled:true,paymobIntegrationIds:JSON.stringify({apple_pay:{id:124,mode:'live',enabled:true,pixelVerified:true,certificatesVerified:true,verifiedOrigin:'https://preorder.example.invalid'}}),public:{purchasingEnabled:true,siteUrl:'https://preorder.example.invalid'}}
 const f=await createCodCheckoutFixture({runtime,routes:[['post','/api/payments/paymob/webhook','server/api/payments/paymob/webhook.post.js'],['post','/api/account/payment-checkouts/:id/interface','server/api/account/payment-checkouts/[id]/interface.post.js'],['get','/api/account/payment-checkouts/:id','server/api/account/payment-checkouts/[id].get.js']]}),original=globalThis.fetch,requests=[]
 globalThis.fetch=async(input,options)=>{
  const url=new URL(input)
  if(url.hostname==='accept.paymob.com'){
   assert.equal(url.pathname,'/v1/intention/');const payload=JSON.parse(options.body),id=770000+requests.length;requests.push(payload)
   return {ok:true,json:async()=>({id:'pi_live_fixture'+id,intention_order_id:id,client_secret:'csk_live_fixture'+id,intention_detail:{amount:payload.amount,currency:'EGP'},special_reference:payload.special_reference})}
  }
  assert.equal(url.hostname,'127.0.0.1','Only local fixture requests are allowed');return original(input,options)
 }
 try {
  await f.db.query('update public.site_settings set payment_card_enabled=true,payment_preorder_card_enabled=true,inventory_tracking_required=false')
  await f.db.query('update private.payment_checkout_settings set enabled=true,enabled_since=now()')
  const company=(await f.db.query("insert into public.commerce_shipping_companies(name,client_shipping_price,checkout_enabled,checkout_governorates) values('Fixture delivery',50,true,array['Cairo']) returning id")).rows[0].id
  const city=(await f.db.query("select name_en from private.delivery_location_cities where governorate_code='eg-cairo' order by code limit 1")).rows[0].name_en
  const webhookValue=async(attempt,id)=>({id:id,order:{id:Number(attempt.provider_order_id)},amount_cents:Number(attempt.amount_minor),currency:'EGP',integration_id:Number(attempt.integration_id),pending:false,success:true,error_occured:false,is_auth:false,is_capture:false,is_refunded:false,is_voided:false,has_parent_transaction:false,is_standalone_payment:true,is_3d_secure:true,created_at:'2026-11-05T00:00:00Z',owner:123,source_data:{pan:'2346',sub_type:'MasterCard',type:'card'}})
  for(const paymob_method of ['card','apple_pay'])for(const mode of ['full','deposit'])await t.test(paymob_method+' '+mode,async()=>{
   const product=(await f.db.query("insert into public.products(title,slug,price,is_serialized,is_published,primary_warehouse_id,selling_mode,preorder_payment_mode,preorder_deposit_percent) values('Preorder API fixture',$1,100.35,true,true,$2,'preorder',$3,25) returning id",['pre-http-'+randomUUID(),f.warehouse,mode])).rows[0].id
   const variant=(await f.db.query('select id from public.product_variants where product_id=$1',[product])).rows[0].id
   const body={cart_id:randomUUID(),items:[{id:product,variant_id:variant,quantity:1}],address:{first_name:'Fixture',email:'customer@product-save.example.invalid',phone:'01012345678',street_address:'Fixture street',city,governorate:'Cairo'},shipping_method:'shipping',shipping_company_id:company,payment_method:'card',locale:'en',preorder_accepted:true}
   const quote=await f.call('/api/checkout/quote',{method:'POST',body});assert.equal(quote.response.status,200,JSON.stringify(quote.body))
   const command={...body,quote_id:quote.body.quoteId,paymob_method,payment_ui_version:2,cart_revision:randomUUID(),cart_lines:[{cart_key:product+':'+variant,cart_line_id:randomUUID(),quantity:1}]}
   const before=requests.length,first=await f.call('/api/checkout',{method:'POST',body:command});assert.equal(first.response.status,200,JSON.stringify(first.body))
   assert.equal(requests.at(-1).amount,mode==='full'?15035:7509);assert.equal(requests.at(-1).payment_methods[0],paymob_method==='card'?123:124)
   assert.equal(Number(first.body.checkout.paymentAmount),mode==='full'?150.35:75.09);assert.equal(Number(first.body.checkout.totalAmount),150.35);assert.equal(first.body.checkout.orderId,null)
   const replay=await f.call('/api/checkout',{method:'POST',body:command});assert.equal(replay.response.status,200);assert.equal(requests.length,before+1)
   assert.match(first.response.headers.get('cache-control'),/private, no-store/)
   const armed=await f.call('/api/account/payment-checkouts/'+first.body.checkout.id+'/interface',{method:'POST',body:{version:2,action:'submit',token:replay.body.payment.interfaceToken}});assert.equal(armed.body.allowed,true)
   const attempt=(await f.db.query('select * from private.payment_checkout_attempts where session_id=$1',[first.body.checkout.id])).rows[0]
   const value={id:880000+requests.length,order:{id:Number(attempt.provider_order_id)},amount_cents:Number(attempt.amount_minor),currency:'EGP',integration_id:Number(attempt.integration_id),pending:false,success:true,error_occured:false,is_auth:false,is_capture:false,is_refunded:false,is_voided:false,has_parent_transaction:false,is_standalone_payment:true,is_3d_secure:true,created_at:'2026-11-05T00:00:00Z',owner:123,source_data:{pan:'2346',sub_type:'MasterCard',type:'card'}}
   const invalid=await f.call('/api/payments/paymob/webhook?hmac='+'0'.repeat(128),{actor:null,method:'POST',body:{type:'TRANSACTION',obj:value}});assert.equal(invalid.response.status,401)
   const signature=createHmac('sha512',runtime.paymobHmacSecret).update(hmacMessage(value)).digest('hex')
   for(let i=0;i<2;i++)assert.equal((await f.call('/api/payments/paymob/webhook?hmac='+signature,{actor:null,method:'POST',body:{type:'TRANSACTION',obj:value}})).response.status,200)
   const order=(await f.db.query('select * from public.customer_orders where checkout_session_id=$1',[first.body.checkout.id])).rows[0]
   assert.ok(order);assert.equal(order.is_preorder,true);assert.equal(order.amount_paid,mode==='full'?'150.35':'75.09');assert.equal(order.payment_status,mode==='full'?'paid':'partially_paid')
   assert.equal((await f.db.query('select count(*)::int n from public.customer_orders where checkout_session_id=$1',[first.body.checkout.id])).rows[0].n,1)

  })
  assert.equal((await f.db.query('select count(*)::int n from public.customer_orders')).rows[0].n,4)
  await t.test('the customer pays the rest from the order',async()=>{
   await f.db.query("update public.site_settings set payment_preorder_balance_mode='online'")
   const order=(await f.db.query("select * from public.customer_orders where payment_status='partially_paid' order by created_at desc limit 1")).rows[0],before=requests.length
   const first=await f.call('/api/checkout',{method:'POST',body:{action:'preorder_balance',order_id:order.id,paymob_method:'card',payment_ui_version:2}});assert.equal(first.response.status,200,JSON.stringify(first.body))
   assert.equal(requests.length,before+1);assert.equal(requests.at(-1).amount,7526);assert.equal(first.body.checkout.isPreorderBalance,true);assert.ok(first.body.payment)
   assert.match(first.response.headers.get('cache-control'),/private, no-store/)
   assert.equal((await f.call('/api/checkout',{method:'POST',body:{action:'preorder_balance',order_id:order.id,payment_ui_version:1}})).response.status,400)
   const armed=await f.call('/api/account/payment-checkouts/'+first.body.checkout.id+'/interface',{method:'POST',body:{version:2,action:'submit',token:first.body.payment.interfaceToken}});assert.equal(armed.body.allowed,true)
   const attempt=(await f.db.query('select * from private.payment_checkout_attempts where session_id=$1',[first.body.checkout.id])).rows[0]
   const value=await webhookValue(attempt,990001);const signature=createHmac('sha512',runtime.paymobHmacSecret).update(hmacMessage(value)).digest('hex')
   for(let i=0;i<2;i++)assert.equal((await f.call('/api/payments/paymob/webhook?hmac='+signature,{actor:null,method:'POST',body:{type:'TRANSACTION',obj:value}})).response.status,200)
   const paid=(await f.db.query('select * from public.customer_orders where id=$1',[order.id])).rows[0];assert.equal(paid.payment_status,'paid');assert.equal(paid.amount_paid,'150.35')
   assert.equal((await f.db.query('select count(*)::int n from public.preorder_payments where order_id=$1',[order.id])).rows[0].n,1)
   assert.equal((await f.call('/api/checkout',{method:'POST',body:{action:'preorder_balance',order_id:order.id,paymob_method:'card',payment_ui_version:2}})).response.status>=400,true)
   const status=await f.call('/api/account/payment-checkouts/'+first.body.checkout.id);assert.equal(status.body.checkout.paymentStatus,'paid');assert.equal(status.body.checkout.orderId,order.id)
  })
 } finally {globalThis.fetch=original;await f.close()}
})
