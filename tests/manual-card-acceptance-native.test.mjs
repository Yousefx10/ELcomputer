import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID,createHash} from 'node:crypto'
import {createCodCheckoutFixture} from './helpers/codCheckoutFixture.mjs'
import {emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'

// Full schema + actual HTTP handlers on loopback. All products/stock/people below
// are disposable fixtures, never evidence for production stock or carrier terms.
test('manual delivery supports two isolated CARD customers, recorded or deferred stock, and uncertain-payment recovery', {skip:!emailNativeAvailable}, async t=>{
 const runtime={paymobEnabled:false,paymobLiveRequestsEnabled:false,paymobMode:'live',paymobCardIntegrationMode:'live',paymobSecretKey:'sk_live_isolated_manual',paymobPublicKey:'pk_live_isolated_manual',paymobHmacSecret:'isolated-manual-hmac',paymobCardIntegrationId:'12345',public:{purchasingEnabled:false,siteUrl:'https://orchid.example.invalid'}}
 const f=await createCodCheckoutFixture({runtime,routes:[
  ['get','/api/account/orders/:id','server/api/account/orders/[id].get.js'],
  ['post','/api/payments/intentions','server/api/payments/intentions.post.js']
 ]})
 t.after(f.close)
 const originalFetch=globalThis.fetch;let syntheticPaymentDispatches=0
 globalThis.fetch=async(url,options)=>{
  if(String(url)==='https://accept.paymob.com/v1/intention/'){syntheticPaymentDispatches++;throw new TypeError('Synthetic lost provider acknowledgement')}
  assert.ok(String(url).startsWith('http://127.0.0.1:'),'External network is forbidden in this fixture')
  return originalFetch(url,options)
 }
 t.after(()=>{globalThis.fetch=originalFetch})
 f.actors.customerB=randomUUID()
 await f.db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'customer-b@product-save.example.invalid',now())",[f.actors.customerB])
 f.client.auth.getUser=async actor=>({data:{user:f.actors[actor]?{id:f.actors[actor],email:actor+'@product-save.example.invalid',is_anonymous:false,email_confirmed_at:'2026-01-01T00:00:00Z'}:null},error:null})
 await f.db.exec("update public.site_settings set payment_card_enabled=true,payment_card_fee=0,allow_out_of_stock_purchases=true,backorder_fulfillment_message='Fixture sourcing requires confirmation.',backorder_fulfillment_message_ar='موعد التوريد يحتاج إلى تأكيد.'")
 const company=(await f.db.query("insert into public.commerce_shipping_companies(name,provider,client_shipping_price,checkout_enabled,checkout_governorates) values('Disposable manual delivery','manual',50,true,array['Cairo']) returning id")).rows[0].id
 const product=async(title,price)=>(await f.db.query('insert into public.products(title,slug,price,is_serialized,is_published,primary_warehouse_id) values($1,$2,$3,true,true,$4) returning id',[title,'manual-'+randomUUID(),price,f.warehouse])).rows[0].id
 const ready=await product('Disposable received item',100),deferred=await product('Disposable unrecorded-stock item',200)
 const variant=async id=>(await f.db.query('select id from public.product_variants where product_id=$1',[id])).rows[0].id
 const readyVariant=await variant(ready),deferredVariant=await variant(deferred)
 assert.equal((await f.client.rpc('commerce_create_procurement_order',{p_supplier_id:f.supplier,p_warehouse_id:f.warehouse,p_invoice_number:randomUUID(),p_notes:'Disposable native fixture receipt',p_paid_amount:0,p_items:[{product_id:ready,variant_id:readyVariant,quantity:1,unit_cost:60}]})).error,null)
 const address=actor=>({first_name:actor,last_name:'Fixture',email:actor+'@product-save.example.invalid',phone:'01012345678',street_address:actor+' private fixture street',city:'Manual fixture city',governorate:'Cairo'})
 const hashAddress=a=>createHash('sha256').update(JSON.stringify(['first_name','last_name','email','phone','street_address','city','governorate'].map(k=>a[k]))).digest('hex')
 const grant=(actor,id,model,total)=>({enabled:true,customer_id:f.actors[actor],cart_id:randomUUID(),product_id:id,variant_id:model,shipping_company_id:company,total_minor:total,address_sha256:hashAddress(address(actor)),starts_at:new Date(Date.now()-1000).toISOString(),expires_at:new Date(Date.now()+600000).toISOString(),payment_enabled:false,review_key:'66'.repeat(32)})
 const grants={customer:grant('customer',ready,readyVariant,15000),customerB:grant('customerB',deferred,deferredVariant,25000)}
 const input=(actor,id,model)=>({cart_id:randomUUID(),items:[{id,variant_id:model,quantity:1}],address:address(actor),shipping_method:'shipping',shipping_company_id:company,payment_method:'card',backorder_accepted:true,locale:'en'})
 const post=(path,body,actor='customer')=>f.call(path,{method:'POST',body,actor})
 const reviewed=async(actor,body)=>{const q=await post('/api/checkout/quote',body,actor);assert.equal(q.response.status,200,JSON.stringify(q.body));return {...body,quote_id:q.body.quoteId,review_token:q.body.reviewToken}}
 const orderIds={}
 await t.test('manual quotes require coverage, snapshot EGP50 and leave PDC disabled',async()=>{
  runtime.controlledPurchase=grants.customer
  const shipping=await f.call('/api/checkout/shipping');assert.equal(shipping.response.status,200)
  assert.deepEqual(shipping.body.options.map(x=>[x.id,x.price]),[[company,50]])
  const body=input('customer',ready,readyVariant)
  for(const changes of [{payment_method:'cash'},{coupon_code:'NOT-ALLOWED'}])assert.ok((await post('/api/checkout/quote',{...body,...changes})).response.status>=400)
  const wrong={...body,address:{...body.address,governorate:'Giza'}}
  runtime.controlledPurchase={...grants.customer,address_sha256:hashAddress(wrong.address)}
  assert.ok((await post('/api/checkout/quote',wrong)).response.status>=400)
  runtime.controlledPurchase=grants.customer
  assert.equal((await f.db.query("select is_enabled from public.shipping_provider_settings where id='pdc'")).rows[0].is_enabled,false)
 })
 await t.test('A uses received stock; lost checkout acknowledgement recovers the same order once',async()=>{
  const command=await reviewed('customer',input('customer',ready,readyVariant))
  f.controls.loseResponse=true;await assert.rejects(()=>post('/api/checkout',command))
  const recovered=await post('/api/checkout',command);assert.equal(recovered.response.status,200,JSON.stringify(recovered.body));orderIds.a=recovered.body.order.id
  assert.equal((await post('/api/checkout',command)).body.order.id,orderIds.a)
  const stored=(await f.db.query('select user_id,shipping_fee_amount,total_amount,stock_fulfillment_state from public.customer_orders where id=$1',[orderIds.a])).rows[0]
  assert.equal(stored.user_id,f.actors.customer);assert.equal(Number(stored.shipping_fee_amount),50);assert.equal(Number(stored.total_amount),150);assert.equal(stored.stock_fulfillment_state,'ready')
  assert.equal((await f.db.query('select count(*)::int n from public.commerce_serialized_units where customer_order_id=$1',[orderIds.a])).rows[0].n,1)
 })
 await t.test('zero-recorded-stock quotes fail closed while fulfillment expectations are missing',async()=>{
  runtime.controlledPurchase=grants.customerB
  await f.db.exec("update public.site_settings set backorder_fulfillment_message='',backorder_fulfillment_message_ar=''")
  assert.ok((await post('/api/checkout/quote',input('customerB',deferred,deferredVariant),'customerB')).response.status>=400)
  await f.db.exec("update public.site_settings set backorder_fulfillment_message='Fixture sourcing requires confirmation.',backorder_fulfillment_message_ar='موعد التوريد يحتاج إلى تأكيد.'")
 })
 await t.test('B can order a legitimate published zero-recorded-stock model without invented allocations',async()=>{
  runtime.controlledPurchase=grants.customerB
  const body=input('customerB',deferred,deferredVariant),command=await reviewed('customerB',body)
  assert.ok((await post('/api/checkout',command,'customer')).response.status>=400)
  const created=await post('/api/checkout',command,'customerB');assert.equal(created.response.status,200,JSON.stringify(created.body));orderIds.b=created.body.order.id
  const stored=(await f.db.query('select user_id,total_amount,stock_fulfillment_state,backorder_accepted_at from public.customer_orders where id=$1',[orderIds.b])).rows[0]
  assert.equal(stored.user_id,f.actors.customerB);assert.equal(Number(stored.total_amount),250);assert.equal(stored.stock_fulfillment_state,'awaiting_stock');assert.ok(stored.backorder_accepted_at)
  assert.equal((await f.db.query('select stock_quantity from public.products where id=$1',[deferred])).rows[0].stock_quantity,0)
  assert.equal((await f.db.query('select count(*)::int n from public.commerce_serialized_units where product_id=$1',[deferred])).rows[0].n,0)
 })
 await t.test('both positive owned order details work and foreign direct URLs are denied',async()=>{
  for(const[actor,owned,foreign]of[['customer',orderIds.a,orderIds.b],['customerB',orderIds.b,orderIds.a]]){
   const own=await f.call('/api/account/orders/'+owned,{actor});assert.equal(own.response.status,200,JSON.stringify(own.body));assert.equal(own.body.order.id,owned)
   assert.equal((await f.call('/api/account/orders/'+foreign,{actor})).response.status,404)
  }
 })
 await t.test('uncertain payment keeps one attempt and never dispatches another intention automatically',async()=>{
  runtime.controlledPurchase={...grants.customer,payment_enabled:true}
  const first=await post('/api/payments/intentions',{order_id:orderIds.a});assert.equal(first.response.status,502)
  assert.equal((await post('/api/payments/intentions',{order_id:orderIds.a})).response.status,409)
  assert.equal(syntheticPaymentDispatches,1)
  const attempts=(await f.db.query('select status,error_code,intention_id from public.payment_attempts where order_id=$1',[orderIds.a])).rows
  assert.equal(attempts.length,1);assert.equal(attempts[0].error_code,'intention_uncertain');assert.equal(attempts[0].intention_id,null)
  assert.notEqual((await f.db.query('select payment_status from public.customer_orders where id=$1',[orderIds.a])).rows[0].payment_status,'paid')
 })
 await t.test('unpaid deferred-stock cancellation creates no stock and never queues PDC',async()=>{
  const cancelled=await f.call('/api/admin-orders/'+orderIds.b,{method:'PATCH',actor:'owner',body:{status:'cancelled'}})
  assert.equal(cancelled.response.status,200,JSON.stringify(cancelled.body))
  assert.equal((await f.db.query('select stock_quantity from public.products where id=$1',[deferred])).rows[0].stock_quantity,0)
  assert.equal((await f.db.query('select count(*)::int n from public.commerce_serialized_units where product_id=$1',[deferred])).rows[0].n,0)
  assert.equal((await f.db.query('select count(*)::int n from public.shipping_order_jobs')).rows[0].n,0)
  assert.equal((await f.db.query('select count(*)::int n from public.customer_orders')).rows[0].n,2)
  assert.equal(runtime.public.purchasingEnabled,false);assert.equal(runtime.paymobEnabled,false);assert.equal(runtime.paymobLiveRequestsEnabled,false)
 })
})
