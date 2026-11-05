import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {paymentFirstFixture} from './helpers/paymentFirstFixture.mjs'
import {emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'

const hash='a'.repeat(64),cipher='v1.YQ.Yg.Yw'
const config={enabled:true,capiEnabled:true,pixelId:'123456789',graphVersion:'v26.0',testEventCode:''}
async function setup(){
 const f=await paymentFirstFixture()
 await f.rpc('commerce_meta_configure',[f.actors.owner,0,config,cipher,false])
 await f.rpc('commerce_meta_consent',[hash,true,'Isolated browser'])
 return f
}
const event=()=>({eventName:'PageView',eventId:randomUUID(),path:'/shop'})
const signed=async(f,a,{status='succeeded',provider='90001',id='10001'}={})=>f.rpc('commerce_accept_payment_callback',[{transaction_id:id,provider_order_id:provider,integration_id:123,mode:'live',currency:'EGP',amount_minor:Number(a.attempt.amount_minor),status,evidence_sha256:'b'.repeat(64),signature_sha256:'c'.repeat(64)}])
test('Meta native PostgreSQL financial, consent and dispatch boundaries',{skip:!emailNativeAvailable,timeout:240000},async t=>{
 await t.test('inactive installation captures nothing and has no browser/private table access',async()=>{
  const f=await paymentFirstFixture();try{
   const s=await f.rpc('commerce_meta_settings',[f.actors.owner]);assert.equal(s.enabled,false);assert.equal(s.tokenSet,false)
   assert.equal((await f.rpc('commerce_meta_consent',[hash,true,''])).granted,false)
   assert.equal(await f.rpc('commerce_meta_event',[hash,null,event()]),null)
   const security=(await f.db.query("select c.relname,c.relrowsecurity,array(select r from unnest(array['anon','authenticated','service_role']) r where has_table_privilege(r,c.oid,'SELECT,INSERT,UPDATE,DELETE')) allowed from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relkind='r' and c.relname like 'meta_%'")).rows
   assert.equal(security.length,4);assert.ok(security.every(x=>x.relrowsecurity&&x.allowed.length===0))
  }finally{await f.close()}
 })
 await t.test('settings require named permissions, preserve revision and redact the token',async()=>{
  const f=await setup();try{
   await assert.rejects(f.rpc('commerce_meta_configure',[f.actors.viewer,1,config,null,false]))
   await assert.rejects(f.rpc('commerce_meta_configure',[f.actors.owner,0,config,null,false]))
   assert.ok(!JSON.stringify(await f.rpc('commerce_meta_settings',[f.actors.owner])).includes(cipher))
   assert.equal((await f.rpc('commerce_meta_settings',[null])).tokenSet,false)
   const publicRole=await f.db.connect('authenticated');await assert.rejects(publicRole.query('select public.commerce_meta_settings(null)'))
  }finally{await f.close()}
 })
 await t.test('server values, immutable shared ID, no forged Purchase, no private URL or raw checkout notes',async()=>{
  const f=await setup();try{
   assert.equal(await f.rpc('commerce_meta_context',[hash,'fb.1.1793700000000.fixture',null]),true);assert.equal(await f.rpc('commerce_meta_context',[hash,'invalid-private-note',null]),false)
   const e={eventName:'AddToCart',eventId:randomUUID(),path:'/products/item?secret=discarded',productId:f.product,variantId:f.variant,quantity:2}
   const a=await f.rpc('commerce_meta_event',[hash,null,e]),b=await f.rpc('commerce_meta_event',[hash,null,e]);assert.deepEqual(a,b);assert.equal(a.data.value,200.70);assert.deepEqual(a.data.content_ids,[f.variant])
   assert.equal((await f.db.query('select count(*)::int n from private.meta_event_outbox')).rows[0].n,1)
   await assert.rejects(f.rpc('commerce_meta_event',[hash,null,{...e,eventName:'Purchase'}]));for(const path of ['/sms/unsubscribe','/ar/sms/unsubscribe'])await assert.rejects(f.rpc('commerce_meta_event',[hash,null,{...e,path}]));await assert.rejects(f.rpc('commerce_meta_event',[hash,null,{...e,path:'/account/orders/secret'}]));await assert.rejects(f.rpc('commerce_meta_event',[hash,null,{...e,value:0.01}]))
   await assert.rejects(f.db.query("update private.meta_event_outbox set event_id='changed'"))
   assert.equal((await f.db.query('select source_path from private.meta_event_outbox')).rows[0].source_path,'/products/item')
  }finally{await f.close()}
 })
 await t.test('selected SKU prices and authenticated quote totals drive checkout events',async()=>{
  const f=await setup();try{
   await f.db.query('update public.product_variants set sale_price=175.25 where id=$1',[f.variant]);
   const e={eventName:'AddToCart',eventId:randomUUID(),path:'/products/item',productId:f.product,variantId:f.variant,quantity:2};
   const added=await f.rpc('commerce_meta_event',[hash,null,e]);assert.equal(added.data.value,350.50);assert.deepEqual(added.data.content_ids,[f.variant]);
   await assert.rejects(f.rpc('commerce_meta_event',[hash,null,{...e,eventId:randomUUID(),variantId:randomUUID()}]),/Product unavailable/);
   const actor=await f.user(),cart=randomUUID(),quote={currency:'EGP',value:400.50,content_type:'product',content_ids:[f.variant],contents:[{id:f.variant,quantity:2,item_price:175.25}],num_items:2};
   assert.equal(await f.rpc('commerce_meta_quote',[actor.id,cart,hash,quote,new Date(Date.now()+60000).toISOString()]),true);
   for(const eventName of ['InitiateCheckout','AddPaymentInfo']){
    const result=await f.rpc('commerce_meta_event',[hash,actor.id,{eventName,eventId:randomUUID(),path:'/checkout',cartId:cart}]);assert.deepEqual(result.data,quote);
    assert.equal(await f.rpc('commerce_meta_event',[hash,null,{eventName,eventId:randomUUID(),path:'/checkout',cartId:cart}]),null)
   }
   await f.db.query("update private.meta_checkout_consents set quote_expires_at=now()-interval '1 second'");
   assert.equal(await f.rpc('commerce_meta_event',[hash,actor.id,{eventName:'AddPaymentInfo',eventId:randomUUID(),path:'/checkout',cartId:cart}]),null)
  }finally{await f.close()}
 })
 await t.test('pending and failed CARD are not purchases; verified late success creates one durable event',async()=>{
  const f=await setup();try{
   const actor=await f.user(),cart=randomUUID()
   // Fixture preparation generates a cart, so bind it before any external dispatch and before order creation.
   const s=await f.prepare({actor}),a=await f.claim(s);await f.rpc('commerce_meta_bind_checkout',[actor.id,s.cart,hash]);await f.store(a)
   assert.equal((await f.db.query("select count(*)::int n from private.meta_event_outbox where event_name='Purchase'")).rows[0].n,0)
   await signed(f,a,{status:'failed'});assert.equal((await f.counts()).orders,0)
   await signed(f,a,{status:'succeeded',id:'10002'});await signed(f,a,{status:'succeeded',id:'10002'})
   const rows=(await f.db.query("select * from private.meta_event_outbox where event_name='Purchase'")).rows;assert.equal(rows.length,1)
   assert.equal(rows[0].custom_data.currency,'EGP');assert.equal(rows[0].custom_data.value,250.70)
   const order=(await f.db.query('select id from public.customer_orders')).rows[0].id
   const receipt=await f.rpc('commerce_meta_purchase',[actor.id,order,hash]);assert.equal(receipt.eventId,rows[0].event_id);assert.equal(await f.rpc('commerce_meta_purchase',[actor.id,order,hash]),null)
   const stranger=await f.user();assert.equal(await f.rpc('commerce_meta_purchase',[stranger.id,order,hash]),null)
  }finally{await f.close()}
 })
 await t.test('authoritative authenticated inquiry success produces one Purchase without fabricating a signed callback',async()=>{
  const f=await setup();try{
   const actor=await f.user(),journey=await f.prepare({actor}),attempt=await f.claim(journey);await f.rpc('commerce_meta_bind_checkout',[actor.id,journey.cart,hash]);await f.store(attempt,'90099');
   const tx={transaction_id:'10099',provider_order_id:'90099',integration_id:123,mode:'live',currency:'EGP',amount_minor:Number(attempt.attempt.amount_minor),status:'succeeded'};
   await assert.rejects(f.rpc('commerce_record_checkout_inquiry',[f.actors.viewer,attempt.attempt.id,tx,'e'.repeat(64)]),e=>e.code==='42501');
   await f.rpc('commerce_record_checkout_inquiry',[f.actors.owner,attempt.attempt.id,tx,'e'.repeat(64)]);
   assert.equal((await f.db.query("select count(*)::int n from private.meta_event_outbox where event_name='Purchase'")).rows[0].n,1);
   assert.equal((await f.db.query("select count(*)::int n from private.payment_callback_receipts where transaction_id='10099'")).rows[0].n,0)
  }finally{await f.close()}
 })
 await t.test('consent withdrawal and configuration changes fence already claimed events',async()=>{
  const f=await setup();try{
   await f.rpc('commerce_meta_event',[hash,null,event()]);const claimed=await f.rpc('commerce_meta_claim')
   assert.ok(await f.rpc('commerce_meta_dispatch',[claimed.id,claimed.lease]))
   await f.rpc('commerce_meta_consent',[hash,false,'']);assert.equal(await f.rpc('commerce_meta_dispatch',[claimed.id,claimed.lease]),null)
   assert.deepEqual((await f.db.query('select user_agent,fbp,fbc from private.meta_consents where token_hash=$1',[hash])).rows[0],{user_agent:'',fbp:null,fbc:null})
   assert.equal(await f.rpc('commerce_meta_finish',[claimed.id,claimed.lease,'accepted']),false)
   await f.rpc('commerce_meta_consent',['d'.repeat(64),true,'']);await f.rpc('commerce_meta_event',['d'.repeat(64),null,event()]);const second=await f.rpc('commerce_meta_claim')
   await f.rpc('commerce_meta_configure',[f.actors.owner,1,{...config,enabled:false},null,false]);assert.equal(await f.rpc('commerce_meta_dispatch',[second.id,second.lease]),null);assert.equal(await f.rpc('commerce_meta_claim'),null)
  }finally{await f.close()}
 })
 await t.test('expired consent attributes are scrubbed while tracking is disabled; receipts remain immutable',async()=>{
  const f=await setup();try{
   await f.rpc('commerce_meta_context',[hash,'fb.1.1793700000000.fixture',null]);await f.rpc('commerce_meta_event',[hash,null,event()])
   await f.db.query("update private.meta_consents set expires_at=clock_timestamp()-interval '1 second'")
   await f.db.query('update private.meta_settings set enabled=false,capi_enabled=false')
   assert.deepEqual(await f.rpc('commerce_meta_retention'),{scrubbed:1,suppressed:1})
   assert.deepEqual((await f.db.query('select granted,user_agent,fbp,fbc from private.meta_consents')).rows[0],{granted:false,user_agent:'',fbp:null,fbc:null})
   assert.deepEqual(await f.rpc('commerce_meta_retention'),{scrubbed:0,suppressed:0})
   assert.equal((await f.db.query("select count(*)::int n from private.meta_event_outbox where state='suppressed'")).rows[0].n,1)
  }finally{await f.close()}
 })
 await t.test('concurrent workers claim once; an uncertain acknowledgement reuses the exact event ID',async()=>{
  const f=await setup();try{
   const e=await f.rpc('commerce_meta_event',[hash,null,event()]),other=await f.db.connect()
   const results=await Promise.all([f.rpc('commerce_meta_claim'),f.rpc('commerce_meta_claim',[],other)]);assert.equal(results.filter(Boolean).length,1)
   const c=results.find(Boolean);await f.rpc('commerce_meta_finish',[c.id,c.lease,'uncertain']);await f.db.query("update private.meta_event_outbox set next_attempt_at=clock_timestamp()-interval '1 second'")
   const retry=await f.rpc('commerce_meta_claim'),context=await f.rpc('commerce_meta_dispatch',[retry.id,retry.lease]);assert.equal(context.event.event_id,e.eventId)
   await f.rpc('commerce_meta_finish',[retry.id,retry.lease,'accepted']);assert.equal(await f.rpc('commerce_meta_claim'),null)
  }finally{await f.close()}
 })
})
