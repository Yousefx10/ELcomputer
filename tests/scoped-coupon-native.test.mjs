import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash,createHmac,randomUUID} from 'node:crypto'
import {createCodCheckoutFixture} from './helpers/codCheckoutFixture.mjs'
import {emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'
import {hmacMessage} from '../server/utils/payments/paymob.js'
import {readFile} from 'node:fs/promises'
import {schemaState} from '../scripts/footer-release/database.mjs'
import {definitions,protectedRows,digest} from '../scripts/customer-migration/final-db.mjs'

test('scoped combined coupon preserves EGP5 pricing, eligibility and reconciliation', {skip:!emailNativeAvailable}, async t=>{
 const runtime={paymobEnabled:false,paymobLiveRequestsEnabled:false,paymobMode:'live',paymobCardIntegrationMode:'live',paymobSecretKey:'sk_live_coupon_fixture',paymobPublicKey:'pk_live_coupon_fixture',paymobHmacSecret:'fixture-hmac',paymobCardIntegrationId:'12345',shippingLiveRequestsEnabled:false,public:{purchasingEnabled:false,siteUrl:'https://cedar.example.invalid'}}
 const f=await createCodCheckoutFixture({runtime,stopBefore:'20261027100000_scoped_combined_coupons.sql',routes:[['post','/api/checkout/coupon','server/api/checkout/coupon.post.js'],['post','/api/payments/intentions','server/api/payments/intentions.post.js'],['post','/api/payments/paymob/webhook','server/api/payments/paymob/webhook.post.js'],['get','/api/account/orders/:id','server/api/account/orders/[id].get.js']]})
 const originalFetch=globalThis.fetch;let providerCalls=0
 globalThis.fetch=async(url,options)=>{
  if(String(url)==='https://accept.paymob.com/v1/intention/'){
   providerCalls++;const payload=JSON.parse(options.body);assert.equal(payload.amount,500);assert.equal(payload.currency,'EGP')
   return new Response(JSON.stringify({id:'pi_live_coupon_fixture',intention_order_id:987655,client_secret:'csk_live_coupon_fixture',intention_detail:{amount:500,currency:'EGP'},special_reference:payload.special_reference}))
  }
  assert.ok(String(url).startsWith('http://127.0.0.1:'),'No external request is permitted');return originalFetch(url,options)
 }
 try{
  await t.test('migration preserves original values, ACL/RLS and all unscoped promotions',async()=>{
   const before=await schemaState(f.db),tables=await definitions(f.db),rows=await protectedRows(f.db,tables)
   await f.db.query(await readFile(new URL('../supabase/migrations/20261027100000_scoped_combined_coupons.sql',import.meta.url),'utf8'))
   const after=await schemaState(f.db),signatures=['private.checkout_authorize(uuid)','private.checkout_review(jsonb)']
   const columns=after.columns.filter(c=>!before.columns.some(o=>o.schema===c.schema&&o.table_name===c.table_name&&o.name===c.name));assert.equal(columns.length,3);assert.ok(columns.every(c=>c.schema==='public'&&c.table_name==='site_coupons'&&!c.not_null&&c.default_value===null))
   const constraints=after.constraints.filter(c=>!before.constraints.some(o=>o.schema===c.schema&&o.table_name===c.table_name&&o.name===c.name));assert.equal(constraints.length,3)
   for(const signature of signatures){const old=before.functions.find(x=>x.signature===signature),next=after.functions.find(x=>x.signature===signature);assert.notEqual(old.definition,next.definition);assert.deepEqual({...next,definition:old.definition},old)}
   assert.equal(digest({...after,columns:after.columns.filter(c=>!columns.includes(c)),constraints:after.constraints.filter(c=>!constraints.includes(c)),functions:after.functions.map(x=>signatures.includes(x.signature)?before.functions.find(o=>o.signature===x.signature):x)}),digest(before))
   assert.deepEqual(await protectedRows(f.db,tables),rows)
  })
  f.client.auth.getUser=async actor=>({data:{user:f.actors[actor]?{id:f.actors[actor],email:actor+'@product-save.example.invalid',is_anonymous:false,email_confirmed_at:'2026-01-01T00:00:00Z'}:null},error:null})
  await f.db.query("update public.site_settings set payment_card_enabled=true,payment_card_fee=0,inventory_tracking_required=false,backorder_fulfillment_message='Owner-managed delivery',backorder_fulfillment_message_ar='توصيل يدوي'")
  const product=(await f.db.query("insert into public.products(title,slug,price,is_serialized,is_published,primary_warehouse_id) values('Coupon fixture',$1,25,true,true,$2) returning id",['coupon-'+randomUUID(),f.warehouse])).rows[0].id
  const variant=(await f.db.query('select id from public.product_variants where product_id=$1',[product])).rows[0].id
  const company=(await f.db.query("insert into public.commerce_shipping_companies(name,provider,client_shipping_price,checkout_enabled,checkout_governorates) values('Manual fixture','manual',50,true,array['Cairo']) returning id")).rows[0].id
  await f.db.query("insert into public.site_coupons(code,discount_type,discount_value,minimum_order_amount,usage_limit,usage_count,delivery_discount_value) values('COMBINED5','fixed',25,1,1,0,45),('OTHER','fixed',100,1,1,0,0)")
  await f.db.query('update public.site_coupons set eligible_customer_id=$1,eligible_product_id=$2,eligible_shipping_company_id=$3 where code=$4',[f.actors.customer,product,company,'COMBINED5'])
  const address={first_name:'Fixture',last_name:'Customer',email:'customer@product-save.example.invalid',phone:'01012345678',street_address:'Private fixture street',address_line_2:'Unit 1',city:'Fixture city',governorate:'Cairo'}
  const normalized={...address,street_address:address.street_address+', '+address.address_line_2}
  const grant={enabled:true,customer_id:f.actors.customer,cart_id:randomUUID(),product_id:product,variant_id:variant,shipping_company_id:company,total_minor:500,address_sha256:createHash('sha256').update(JSON.stringify(['first_name','last_name','email','phone','street_address','city','governorate'].map(k=>normalized[k]))).digest('hex'),starts_at:new Date(Date.now()-1000).toISOString(),expires_at:new Date(Date.now()+600000).toISOString(),payment_enabled:true,review_key:'44'.repeat(32),coupon_code:'COMBINED5'}
  runtime.controlledPurchase=grant
  const body={cart_id:randomUUID(),items:[{id:product,variant_id:variant,quantity:1}],address,shipping_method:'shipping',shipping_company_id:company,payment_method:'card',coupon_code:' combined5 ',locale:'en'}
  const post=(path,body,actor='customer')=>f.call(path,{method:'POST',body,actor})
  const counts=async()=>(await f.db.query("select (select count(*)::int from public.customer_orders) orders,(select count(*)::int from public.payment_attempts) attempts,(select count(*)::int from public.shipping_order_jobs) pdc_jobs,(select usage_count from public.site_coupons where code='COMBINED5') coupon_uses,(select count(*)::int from public.commerce_serialized_units) stock_units")).rows[0]
  await t.test('anonymous, foreign and unapproved coupons fail before review writes',async()=>{
   assert.equal((await post('/api/checkout/coupon',body,null)).response.status,401)
   assert.equal((await post('/api/checkout/coupon',body,'owner')).response.status,403)
   for(const coupon_code of ['', 'OTHER'])assert.equal((await post('/api/checkout/coupon',{...body,coupon_code})).response.status,403)
   const legacy={...grant};delete legacy.coupon_code;runtime.controlledPurchase=legacy
   assert.equal((await post('/api/checkout/coupon',body)).response.status,403);runtime.controlledPurchase=grant
   assert.equal((await f.db.query('select count(*)::int n from private.checkout_quotes')).rows[0].n,0)
  })
  await t.test('browser financial claims are rejected; two valid previews consume no usage',async()=>{
   assert.equal((await post('/api/checkout/coupon',{...body,subtotal:99999})).response.status,400)
   assert.equal((await post('/api/checkout/coupon',{...body,items:[{...body.items[0],price:1}]})).response.status,400)
   for(let i=0;i<2;i++){
    const r=await post('/api/checkout/coupon',body);assert.equal(r.response.status,200,JSON.stringify(r.body));assert.equal(r.body.coupon.code,'COMBINED5');assert.equal(r.body.coupon.discountAmount,70);assert.equal(r.body.coupon.deliveryDiscountAmount,45);assert.match(r.response.headers.get('cache-control'),/private, no-store/)
   }
   assert.deepEqual(await counts(),{orders:0,attempts:0,pdc_jobs:0,coupon_uses:0,stock_units:0});assert.equal(providerCalls,0)
  })
  await t.test('SQL scopes reject another customer, spoofed email, mixed products and another courier',async()=>{
   const order={...normalized,payment_method:'card',shipping_method:'shipping',shipping_company_id:company,coupon_code:'COMBINED5',locale:'en'},items=[{product_id:product,variant_id:variant,quantity:1}]
   const quote=(user,o=order,i=items)=>f.client.rpc('commerce_checkout_quote',{p_user_id:user,p_cart_id:randomUUID(),p_order:o,p_items:i})
   assert.match((await quote(f.actors.owner)).error?.message||'',/checkout:coupon/)
   const other=(await f.db.query("insert into public.products(title,slug,price,is_serialized,is_published,primary_warehouse_id) values('Other fixture',$1,25,true,true,$2) returning id",['other-'+randomUUID(),f.warehouse])).rows[0].id
   const ov=(await f.db.query('select id from public.product_variants where product_id=$1',[other])).rows[0].id
   for(const i of [[{product_id:other,variant_id:ov,quantity:1}],[...items,{product_id:other,variant_id:ov,quantity:1}]])assert.match((await quote(f.actors.customer,order,i)).error?.message||'',/checkout:coupon/)
   const courier=(await f.db.query("insert into public.commerce_shipping_companies(name,provider,client_shipping_price,checkout_enabled,checkout_governorates) values('Other Manual','manual',50,true,array['Cairo']) returning id")).rows[0].id
   assert.match((await quote(f.actors.customer,{...order,shipping_company_id:courier})).error?.message||'',/checkout:coupon/)
   const ordinary=await quote(f.actors.owner,{...order,coupon_code:'OTHER'});assert.equal(ordinary.error,null);assert.equal(Number(ordinary.data.totalAmount),50)
   const removed=await quote(f.actors.customer,{...order,coupon_code:null});assert.equal(removed.error,null);assert.equal(Number(removed.data.discountAmount),0);assert.equal(Number(removed.data.totalAmount),75)
   assert.equal((await post('/api/checkout/quote',{...body,coupon_code:''})).response.status,403)
   const reapplied=await post('/api/checkout/coupon',body);assert.equal(reapplied.response.status,200);assert.equal(reapplied.body.coupon.discountAmount,70);assert.equal(reapplied.body.coupon.deliveryDiscountAmount,45)
   for(const k of ['eligible_customer_id','eligible_product_id','eligible_shipping_company_id'])assert.equal(k in reapplied.body.coupon,false)
   assert.equal((await counts()).orders,0);assert.equal((await counts()).coupon_uses,0)
  })
  await t.test('the original twelve-field coupon-free grant remains compatible',async()=>{
   const legacy={...grant,total_minor:7500};delete legacy.coupon_code;runtime.controlledPurchase=legacy
   const quote=await post('/api/checkout/quote',{...body,coupon_code:''});assert.equal(quote.response.status,200,JSON.stringify(quote.body));assert.equal(Number(quote.body.totalAmount),75);runtime.controlledPurchase=grant
  })
  await t.test('expiry, minimum and usage limits remain enforced by SQL',async()=>{
   for(const sql of ["ends_at=now()-interval '1 hour'",'minimum_order_amount=26','usage_count=1']){
    await f.db.query('update public.site_coupons set '+sql+" where code='COMBINED5'");assert.ok((await post('/api/checkout/coupon',body)).response.status>=400)
    await f.db.query("update public.site_coupons set ends_at=null,minimum_order_amount=1,usage_count=0 where code='COMBINED5'")
   }
  })
  let command,orderId
  await t.test('delivery coupons reject tracked backorders without consuming a use',async()=>{
   await f.db.query('update public.site_settings set inventory_tracking_required=true,allow_out_of_stock_purchases=true')
   assert.ok((await post('/api/checkout/quote',{...body,backorder_accepted:true})).response.status>=400)
   assert.equal((await counts()).orders,0);assert.equal((await counts()).coupon_uses,0)
   await f.db.query('update public.site_settings set inventory_tracking_required=false,allow_out_of_stock_purchases=false')
  })
  await t.test('zero defaults and delivery caps preserve merchandise-only offers',async()=>{
   await assert.rejects(f.db.query("update public.site_coupons set delivery_discount_value=-1 where code='COMBINED5'"))
   await f.db.query("update public.site_coupons set delivery_discount_value=0 where code='COMBINED5'");runtime.controlledPurchase={...grant,total_minor:5000}
   const old=await post('/api/checkout/quote',body);assert.equal(old.response.status,200,JSON.stringify(old.body));assert.equal(Number(old.body.totalAmount),50);assert.equal(Number(old.body.discountAmount),25)
   runtime.controlledPurchase=grant;await f.db.query("update public.site_coupons set delivery_discount_value=200 where code='COMBINED5'");assert.ok((await post('/api/checkout/quote',body)).response.status>=400)
   await f.db.query("update public.site_coupons set delivery_discount_value=45 where code='COMBINED5'")
  })
  await t.test('changed delivery terms invalidate the quote before commit',async()=>{
   const quote=await post('/api/checkout/quote',body);assert.equal(quote.response.status,200,JSON.stringify(quote.body))
   await f.db.query("update public.site_coupons set delivery_discount_value=20 where code='COMBINED5'")
   const r=await post('/api/checkout',{...body,quote_id:quote.body.quoteId,review_token:quote.body.reviewToken});assert.equal(r.response.status,409)
   assert.equal((await counts()).orders,0);assert.equal((await counts()).coupon_uses,0);await f.db.query("update public.site_coupons set delivery_discount_value=45 where code='COMBINED5'")
  })
  await t.test('discounted review binds total, coupon and durable cart; repeated commit consumes once',async()=>{
   const quote=await post('/api/checkout/quote',body);assert.equal(quote.response.status,200,JSON.stringify(quote.body));assert.equal(Number(quote.body.orderValue),25);assert.equal(Number(quote.body.discountAmount),70);assert.equal(Number(quote.body.shippingFee),50);assert.equal(Number(quote.body.totalAmount),5)
   command={...body,quote_id:quote.body.quoteId,review_token:quote.body.reviewToken}
   assert.equal((await post('/api/checkout',{...command,coupon_code:'OTHER'})).response.status,403)
   runtime.controlledPurchase={...grant,coupon_code:'OTHER'};assert.equal((await post('/api/checkout',{...command,coupon_code:'OTHER'})).response.status,409);runtime.controlledPurchase=grant
   const outcomes=await Promise.all([post('/api/checkout',command),post('/api/checkout',command)]);assert.ok(outcomes.every(r=>r.response.status===200),JSON.stringify(outcomes.map(r=>r.body)));orderId=outcomes[0].body.order.id;assert.equal(outcomes[1].body.order.id,orderId)
   const order=(await f.db.query('select coupon_code,subtotal_amount,discount_amount,delivery_discount_amount,shipping_fee_amount,total_amount,user_id,stock_fulfillment_state from public.customer_orders where id=$1',[orderId])).rows[0]
   assert.equal(order.coupon_code,'COMBINED5');assert.equal(Number(order.subtotal_amount),25);assert.equal(Number(order.discount_amount),70);assert.equal(Number(order.delivery_discount_amount),45);assert.equal(Number(order.shipping_fee_amount),50);assert.equal(Number(order.total_amount),5);assert.equal(order.user_id,f.actors.customer);assert.equal(order.stock_fulfillment_state,'untracked')
   assert.deepEqual(await counts(),{orders:1,attempts:0,pdc_jobs:0,coupon_uses:1,stock_units:0})
  })
  await t.test('payment rejects a changed coupon, then creates one synthetic EGP5 intention',async()=>{
   runtime.controlledPurchase={...grant,coupon_code:'OTHER'};assert.ok((await post('/api/payments/intentions',{order_id:orderId,locale:'en'})).response.status>=400);assert.equal(providerCalls,0);assert.equal((await counts()).attempts,0);runtime.controlledPurchase=grant
   await assert.rejects(f.db.query('update public.customer_orders set delivery_discount_amount=0 where id=$1',[orderId]),/checkout context cannot change/)
   const first=await post('/api/payments/intentions',{order_id:orderId,locale:'en'});assert.equal(first.response.status,200,JSON.stringify(first.body));assert.equal((await post('/api/payments/intentions',{order_id:orderId,locale:'en'})).response.status,200)
   assert.equal(providerCalls,1);assert.deepEqual(await counts(),{orders:1,attempts:1,pdc_jobs:0,coupon_uses:1,stock_units:0});assert.equal(runtime.paymobEnabled,false);assert.equal(runtime.paymobLiveRequestsEnabled,false);assert.equal(runtime.public.purchasingEnabled,false)
  })
  await t.test('signed EGP5 confirmation and late replay survive grant revocation with immutable discounts',async()=>{
   const obj={amount_cents:500,created_at:'2026-10-27T00:00:00',currency:'EGP',error_occured:false,has_parent_transaction:false,id:987656,integration_id:12345,is_3d_secure:true,is_auth:false,is_capture:false,is_refunded:false,is_standalone_payment:true,is_voided:false,order:{id:987655},owner:123,pending:false,source_data:{pan:'0000',sub_type:'MasterCard',type:'card'},success:true}
   const signature=createHmac('sha512',runtime.paymobHmacSecret).update(hmacMessage(obj)).digest('hex');runtime.controlledPurchase={}
   for(let i=0;i<2;i++){const r=await post('/api/payments/paymob/webhook?hmac='+signature,{type:'TRANSACTION',obj},null);assert.equal(r.response.status,200,JSON.stringify(r.body))}
   const paid=(await f.db.query('select user_id,payment_status,status,amount_paid,total_amount,discount_amount,delivery_discount_amount,shipping_fee_amount from public.customer_orders where id=$1',[orderId])).rows[0]
   assert.equal(paid.user_id,f.actors.customer);assert.equal(paid.payment_status,'paid');assert.equal(paid.status,'processing')
   for(const [k,v]of Object.entries({amount_paid:5,total_amount:5,discount_amount:70,delivery_discount_amount:45,shipping_fee_amount:50}))assert.equal(Number(paid[k]),v)
   assert.equal((await f.db.query('select count(*)::int n from public.payment_transactions')).rows[0].n,1)
   assert.equal((await f.call('/api/account/orders/'+orderId,{actor:'owner'})).response.status,404);assert.equal((await f.call('/api/account/orders/'+orderId)).response.status,200)
   assert.deepEqual(await counts(),{orders:1,attempts:1,pdc_jobs:0,coupon_uses:1,stock_units:0});assert.equal(providerCalls,1)
  })
 }finally{globalThis.fetch=originalFetch;await f.close()}
})
