import {randomUUID} from 'node:crypto'
import {createEmailNativeDatabase} from './emailNativeDatabase.mjs'
import {createProductSaveFixture} from './productSaveFixture.mjs'
export async function paymentFirstFixture(options={}){
 const db=await createEmailNativeDatabase(options);try {
 const f=await createProductSaveFixture({database:db})
 await db.query('update auth.users set email_confirmed_at=now()')
 await db.query("update public.site_settings set payment_card_enabled=true,payment_cash_enabled=true,payment_cash_fee=10,inventory_tracking_required=false,backorder_fulfillment_message='Delivery timing depends on your address.',backorder_fulfillment_message_ar='تختلف مدة التوصيل حسب العنوان.' where key='default'")
 await db.query('update private.payment_checkout_settings set enabled=true,enabled_since=clock_timestamp()')
 const product=(await db.query("insert into public.products(title,slug,price,is_serialized,is_published,primary_warehouse_id) values('Frozen item',$1,100.35,true,true,$2) returning id",['prepaid-'+randomUUID(),f.warehouse])).rows[0].id
 const variant=(await db.query('select id from public.product_variants where product_id=$1',[product])).rows[0].id
 const company=(await db.query("insert into public.commerce_shipping_companies(name,client_shipping_price,checkout_enabled,checkout_governorates,cod_collection_enabled) values('Fixture delivery',50,true,array['Cairo'],true) returning id")).rows[0].id
 const user=async()=>{const id=randomUUID(),email='owned-'+id+'@fixture.invalid';await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,email]);await db.query("insert into public.customer_profiles(id,email,full_name,is_active) values($1,$2,'Owned fixture',true) on conflict(id) do update set is_active=true",[id,email]);return {id,email}}
 const city=(await db.query("select name_en from private.delivery_location_cities where governorate_code='eg-cairo' and is_active order by code limit 1")).rows[0].name_en
 const rpc=async(name,args=[],c=db)=>(await c.query('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') v',args.map(v=>v&&typeof v==='object'?JSON.stringify(v):v))).rows[0].v
 const prepare=async({actor,method='card',quantity=2,coupon=null,locale='en'}={})=>{
  actor ||= await user();const cart=randomUUID(),order={first_name:'Owned',last_name:'Fixture',email:actor.email,phone:'01012345678',street_address:'Fixture street',city,governorate:'Cairo',shipping_method:'shipping',shipping_company_id:company,payment_method:method,locale,coupon_code:coupon},items=[{product_id:product,variant_id:variant,quantity}]
  const revision=randomUUID();const review=await rpc('commerce_checkout_quote',[actor.id,cart,order,items]);const created=await rpc('commerce_prepare_payment_checkout',[actor.id,cart,review.quoteId,order,items,revision]);return {actor,cart,order,items,revision,review,session:created.checkout}
 }
 const interfaceClaim=(await db.query("select to_regprocedure('public.commerce_claim_checkout_payment(uuid,uuid,text,bigint,integer)') is not null installed")).rows[0].installed
 const claim=async(s,mode='live')=>rpc('commerce_claim_checkout_payment',[s.actor.id,s.session.id,mode,123,...(interfaceClaim?[2]:[])])
 const store=async(a,id='90001')=>rpc('commerce_store_checkout_intention',[a.attempt.id,'pi_'+a.attempt.mode+'_fixture'+id,id,'csk_'+a.attempt.mode+'_fixture'+id])
 const callback=async(a,{id='10001',provider='90001',status='succeeded',amount=Number(a.attempt.amount_minor),mode=a.attempt.mode}={})=>rpc('commerce_accept_payment_callback',[{transaction_id:id,provider_order_id:provider,integration_id:123,mode,currency:'EGP',amount_minor:amount,status}])
 const counts=async()=>(await db.query("select (select count(*)::int from public.customer_orders) orders,(select count(*)::int from public.payment_attempts) attempts,(select count(*)::int from public.payment_transactions) transactions,(select count(*)::int from public.shipping_order_jobs) shipping,(select count(*)::int from public.order_email_events) emails,(select count(*)::int from public.commerce_inventory_movements) stock,(select count(*)::int from private.payment_checkout_sessions) sessions")).rows[0]
 return {...f,db,user,rpc,prepare,claim,store,callback,counts,product,variant,company,city,interfaceVersion:interfaceClaim?2:1,close:()=>db.close()}
 }catch(e){await db.close();throw e}
}
