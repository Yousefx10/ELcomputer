import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash,randomUUID} from 'node:crypto'
import {createCodCheckoutFixture} from './helpers/codCheckoutFixture.mjs'
import {emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'
import {readFile} from 'node:fs/promises'
import {schemaState} from '../scripts/footer-release/database.mjs'
import {definitions,protectedRows,digest} from '../scripts/customer-migration/final-db.mjs'

test('delivery-discount coupon preserves prices and pays one exact EGP5 total', {skip:!emailNativeAvailable}, async t=>{
 const runtime={paymobEnabled:false,paymobLiveRequestsEnabled:false,paymobMode:'live',paymobCardIntegrationMode:'live',paymobSecretKey:'sk_live_coupon_fixture',paymobPublicKey:'pk_live_coupon_fixture',paymobHmacSecret:'fixture-hmac',paymobCardIntegrationId:'12345',shippingLiveRequestsEnabled:false,public:{purchasingEnabled:false,siteUrl:'https://cedar.example.invalid'}}
 const f=await createCodCheckoutFixture({runtime,stopBefore:'20261027004500_untracked_card_coupons.sql',routes:[['post','/api/checkout/coupon','server/api/checkout/coupon.post.js'],['post','/api/payments/intentions','server/api/payments/intentions.post.js']]})
 const originalFetch=globalThis.fetch;let providerCalls=0
 globalThis.fetch=async(url,options)=>{
  if(String(url)==='https://accept.paymob.com/v1/intention/'){
   providerCalls++;const payload=JSON.parse(options.body);assert.equal(payload.amount,500);assert.equal(payload.currency,'EGP')
   return new Response(JSON.stringify({id:'pi_live_coupon_fixture',intention_order_id:987655,client_secret:'csk_live_coupon_fixture',intention_detail:{amount:500,currency:'EGP'},special_reference:payload.special_reference}))
  }
  assert.ok(String(url).startsWith('http://127.0.0.1:'),'No external request is permitted');return originalFetch(url,options)
 }
 try{
  await t.test('additive delivery migration preserves original rows and permissions',async()=>{
   await f.db.query(await readFile(new URL('../supabase/migrations/20261027004500_untracked_card_coupons.sql',import.meta.url),'utf8'))
   const before=await schemaState(f.db),tables=await definitions(f.db),rows=await protectedRows(f.db,tables)
   await f.db.query(await readFile(new URL('../supabase/migrations/20261027090000_coupon_delivery_discount.sql',import.meta.url),'utf8'))
   const after=await schemaState(f.db),signatures=['commerce_create_normal_customer_order(uuid,jsonb,jsonb,boolean,uuid)','private.checkout_review(jsonb)','private.guard_card_checkout_snapshot()']
   for(const signature of signatures){const old=before.functions.find(x=>x.signature===signature),next=after.functions.find(x=>x.signature===signature);assert.ok(old&&next);assert.notEqual(old.definition,next.definition);assert.deepEqual({...next,definition:old.definition},old)}
   const added=c=>c.schema==='public'&&((c.table_name==='site_coupons'&&c.name==='delivery_discount_value')||(c.table_name==='customer_orders'&&c.name==='delivery_discount_amount'))
   assert.equal(after.columns.filter(added).length,2);assert.ok(after.columns.filter(added).every(c=>c.not_null&&c.default_value==='0'))
   const addedConstraint=c=>['site_coupons_delivery_discount_value_check','customer_orders_delivery_discount_amount_check'].includes(c.name)
   assert.equal(after.constraints.filter(addedConstraint).length,2)
   assert.equal(digest({...after,columns:after.columns.filter(c=>!added(c)),constraints:after.constraints.filter(c=>!addedConstraint(c)),functions:after.functions.map(x=>signatures.includes(x.signature)?before.functions.find(o=>o.signature===x.signature):x)}),digest(before))
   assert.deepEqual(await protectedRows(f.db,tables),rows)
  })
  f.client.auth.getUser=async actor=>({data:{user:f.actors[actor]?{id:f.actors[actor],email:actor+'@product-save.example.invalid',is_anonymous:false,email_confirmed_at:'2026-01-01T00:00:00Z'}:null},error:null})
  await f.db.query("update public.site_settings set payment_card_enabled=true,payment_card_fee=0,inventory_tracking_required=false,backorder_fulfillment_message='Owner-managed delivery',backorder_fulfillment_message_ar='توصيل يدوي'")
  const product=(await f.db.query("insert into public.products(title,slug,price,is_serialized,is_published,primary_warehouse_id) values('Coupon fixture',$1,25,true,true,$2) returning id",['coupon-'+randomUUID(),f.warehouse])).rows[0].id
  const variant=(await f.db.query('select id from public.product_variants where product_id=$1',[product])).rows[0].id
  const company=(await f.db.query("insert into public.commerce_shipping_companies(name,provider,client_shipping_price,checkout_enabled,checkout_governorates) values('Manual fixture','manual',50,true,array['Cairo']) returning id")).rows[0].id
  await f.db.query("insert into public.site_coupons(code,discount_type,discount_value,minimum_order_amount,usage_limit,usage_count,delivery_discount_value) values('FRE','fixed',100,1,1,0,45),('OTHER','fixed',100,1,1,0,0)")
  const address={first_name:'Fixture',last_name:'Customer',email:'customer@product-save.example.invalid',phone:'01012345678',street_address:'Private fixture street',address_line_2:'Unit 1',city:'Fixture city',governorate:'Cairo'}
  const normalized={...address,street_address:address.street_address+', '+address.address_line_2}
  const grant={enabled:true,customer_id:f.actors.customer,cart_id:randomUUID(),product_id:product,variant_id:variant,shipping_company_id:company,total_minor:500,address_sha256:createHash('sha256').update(JSON.stringify(['first_name','last_name','email','phone','street_address','city','governorate'].map(k=>normalized[k]))).digest('hex'),starts_at:new Date(Date.now()-1000).toISOString(),expires_at:new Date(Date.now()+600000).toISOString(),payment_enabled:true,review_key:'44'.repeat(32),coupon_code:'FRE'}
  runtime.controlledPurchase=grant
  const body={cart_id:randomUUID(),items:[{id:product,variant_id:variant,quantity:1}],address,shipping_method:'shipping',shipping_company_id:company,payment_method:'card',coupon_code:' fre ',locale:'en'}
  const post=(path,body,actor='customer')=>f.call(path,{method:'POST',body,actor})
  const counts=async()=>(await f.db.query("select (select count(*)::int from public.customer_orders) orders,(select count(*)::int from public.payment_attempts) attempts,(select count(*)::int from public.shipping_order_jobs) pdc_jobs,(select usage_count from public.site_coupons where code='FRE') coupon_uses,(select count(*)::int from public.commerce_serialized_units) stock_units")).rows[0]
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
    const r=await post('/api/checkout/coupon',body);assert.equal(r.response.status,200,JSON.stringify(r.body));assert.equal(r.body.coupon.code,'FRE');assert.equal(r.body.coupon.discountAmount,70);assert.equal(r.body.coupon.deliveryDiscountAmount,45);assert.match(r.response.headers.get('cache-control'),/private, no-store/)
   }
   assert.deepEqual(await counts(),{orders:0,attempts:0,pdc_jobs:0,coupon_uses:0,stock_units:0});assert.equal(providerCalls,0)
  })
  await t.test('the original twelve-field coupon-free grant remains compatible',async()=>{
   const legacy={...grant,total_minor:7500};delete legacy.coupon_code;runtime.controlledPurchase=legacy
   const quote=await post('/api/checkout/quote',{...body,coupon_code:''});assert.equal(quote.response.status,200,JSON.stringify(quote.body));assert.equal(Number(quote.body.totalAmount),75);runtime.controlledPurchase=grant
  })
  await t.test('expiry, minimum and usage limits remain enforced by SQL',async()=>{
   for(const sql of ["ends_at=now()-interval '1 hour'",'minimum_order_amount=26','usage_count=1']){
    await f.db.query('update public.site_coupons set '+sql+" where code='FRE'");assert.ok((await post('/api/checkout/coupon',body)).response.status>=400)
    await f.db.query("update public.site_coupons set ends_at=null,minimum_order_amount=1,usage_count=0 where code='FRE'")
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
   await assert.rejects(f.db.query("update public.site_coupons set delivery_discount_value=-1 where code='FRE'"))
   await f.db.query("update public.site_coupons set delivery_discount_value=0 where code='FRE'");runtime.controlledPurchase={...grant,total_minor:5000}
   const old=await post('/api/checkout/quote',body);assert.equal(old.response.status,200,JSON.stringify(old.body));assert.equal(Number(old.body.totalAmount),50);assert.equal(Number(old.body.discountAmount),25)
   runtime.controlledPurchase=grant;await f.db.query("update public.site_coupons set delivery_discount_value=200 where code='FRE'");assert.ok((await post('/api/checkout/quote',body)).response.status>=400)
   await f.db.query("update public.site_coupons set delivery_discount_value=45 where code='FRE'")
  })
  await t.test('changed delivery terms invalidate the quote before commit',async()=>{
   const quote=await post('/api/checkout/quote',body);assert.equal(quote.response.status,200,JSON.stringify(quote.body))
   await f.db.query("update public.site_coupons set delivery_discount_value=20 where code='FRE'")
   const r=await post('/api/checkout',{...body,quote_id:quote.body.quoteId,review_token:quote.body.reviewToken});assert.equal(r.response.status,409)
   assert.equal((await counts()).orders,0);assert.equal((await counts()).coupon_uses,0);await f.db.query("update public.site_coupons set delivery_discount_value=45 where code='FRE'")
  })
  await t.test('discounted review binds total, coupon and durable cart; repeated commit consumes once',async()=>{
   const quote=await post('/api/checkout/quote',body);assert.equal(quote.response.status,200,JSON.stringify(quote.body));assert.equal(Number(quote.body.orderValue),25);assert.equal(Number(quote.body.discountAmount),70);assert.equal(Number(quote.body.shippingFee),50);assert.equal(Number(quote.body.totalAmount),5)
   command={...body,quote_id:quote.body.quoteId,review_token:quote.body.reviewToken}
   assert.equal((await post('/api/checkout',{...command,coupon_code:'OTHER'})).response.status,403)
   runtime.controlledPurchase={...grant,coupon_code:'OTHER'};assert.equal((await post('/api/checkout',{...command,coupon_code:'OTHER'})).response.status,409);runtime.controlledPurchase=grant
   const outcomes=await Promise.all([post('/api/checkout',command),post('/api/checkout',command)]);assert.ok(outcomes.every(r=>r.response.status===200),JSON.stringify(outcomes.map(r=>r.body)));orderId=outcomes[0].body.order.id;assert.equal(outcomes[1].body.order.id,orderId)
   const order=(await f.db.query('select coupon_code,subtotal_amount,discount_amount,delivery_discount_amount,shipping_fee_amount,total_amount,user_id,stock_fulfillment_state from public.customer_orders where id=$1',[orderId])).rows[0]
   assert.equal(order.coupon_code,'FRE');assert.equal(Number(order.subtotal_amount),25);assert.equal(Number(order.discount_amount),70);assert.equal(Number(order.delivery_discount_amount),45);assert.equal(Number(order.shipping_fee_amount),50);assert.equal(Number(order.total_amount),5);assert.equal(order.user_id,f.actors.customer);assert.equal(order.stock_fulfillment_state,'untracked')
   assert.deepEqual(await counts(),{orders:1,attempts:0,pdc_jobs:0,coupon_uses:1,stock_units:0})
  })
  await t.test('payment rejects a changed coupon, then creates one synthetic EGP5 intention',async()=>{
   runtime.controlledPurchase={...grant,coupon_code:'OTHER'};assert.ok((await post('/api/payments/intentions',{order_id:orderId,locale:'en'})).response.status>=400);assert.equal(providerCalls,0);assert.equal((await counts()).attempts,0);runtime.controlledPurchase=grant
   await assert.rejects(f.db.query('update public.customer_orders set delivery_discount_amount=0 where id=$1',[orderId]),/checkout context cannot change/)
   const first=await post('/api/payments/intentions',{order_id:orderId,locale:'en'});assert.equal(first.response.status,200,JSON.stringify(first.body));assert.equal((await post('/api/payments/intentions',{order_id:orderId,locale:'en'})).response.status,200)
   assert.equal(providerCalls,1);assert.deepEqual(await counts(),{orders:1,attempts:1,pdc_jobs:0,coupon_uses:1,stock_units:0});assert.equal(runtime.paymobEnabled,false);assert.equal(runtime.paymobLiveRequestsEnabled,false);assert.equal(runtime.public.purchasingEnabled,false)
  })
 }finally{globalThis.fetch=originalFetch;await f.close()}
})
