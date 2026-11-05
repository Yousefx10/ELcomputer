import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {paymentFirstFixture} from './helpers/paymentFirstFixture.mjs'
import {emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'
test('controlled Test Events bind one customer, expire, cap events and exclude Purchase',{skip:!emailNativeAvailable,timeout:120000},async()=>{
 const f=await paymentFirstFixture(),hash='a'.repeat(64),cipher='v1.YQ.Yg.Yw'
 try{
  const actor=await f.user(),other=await f.user(),config={enabled:true,capiEnabled:true,pixelId:'123456789',graphVersion:'v26.0',testEventCode:'TEST_LOCAL',testCustomerId:actor.id,testWindowMinutes:5,testEventLimit:3}
  await assert.rejects(f.rpc('commerce_meta_configure',[f.actors.owner,0,{...config,testCustomerId:f.actors.owner},cipher,false]))
  await f.rpc('commerce_meta_configure',[f.actors.owner,0,config,cipher,false])
  assert.equal((await f.rpc('commerce_meta_settings',[null,null])).enabled,false)
  assert.equal((await f.rpc('commerce_meta_settings',[null,other.id])).enabled,false)
  assert.equal((await f.rpc('commerce_meta_settings',[null,actor.id])).enabled,true)
  assert.equal((await f.rpc('commerce_meta_consent',[hash,true,'Private fixture',other.id])).granted,false)
  assert.equal((await f.rpc('commerce_meta_consent',[hash,true,'Private fixture',actor.id])).granted,true)
  const event=()=>({eventName:'PageView',eventId:randomUUID(),path:'/shop'})
  assert.equal(await f.rpc('commerce_meta_event',[hash,other.id,event()]),null)
  const first=event(),receipt=await f.rpc('commerce_meta_event',[hash,actor.id,first]);assert.deepEqual(await f.rpc('commerce_meta_event',[hash,actor.id,first]),receipt)
  await f.rpc('commerce_meta_event',[hash,actor.id,event()]);await f.rpc('commerce_meta_event',[hash,actor.id,event()])
  assert.equal(await f.rpc('commerce_meta_event',[hash,actor.id,event()]),null)
  assert.equal((await f.db.query('select count(*)::int n from private.meta_event_outbox')).rows[0].n,3)
  const journey=await f.prepare({actor}),attempt=await f.claim(journey);await f.rpc('commerce_meta_bind_checkout',[actor.id,journey.cart,hash]);await f.store(attempt)
  await f.rpc('commerce_accept_payment_callback',[{transaction_id:'10001',provider_order_id:'90001',integration_id:123,mode:'live',currency:'EGP',amount_minor:Number(attempt.attempt.amount_minor),status:'succeeded',evidence_sha256:'b'.repeat(64),signature_sha256:'c'.repeat(64)}])
  assert.equal((await f.db.query("select count(*)::int n from private.meta_event_outbox where event_name='Purchase'")).rows[0].n,0)
  const claimed=await f.rpc('commerce_meta_claim');assert.ok(claimed)
  const context=await f.rpc('commerce_meta_dispatch',[claimed.id,claimed.lease]);assert.equal(context.revision,1);assert.equal(context.testEventCode,'TEST_LOCAL')
  await f.db.query("update private.meta_settings set test_expires_at=clock_timestamp()-interval '1 second'")
  assert.equal(await f.rpc('commerce_meta_dispatch',[claimed.id,claimed.lease]),null)
  assert.equal(await f.rpc('commerce_meta_event',[hash,actor.id,event()]),null)
  await assert.rejects(f.rpc('commerce_meta_configure',[f.actors.owner,1,{...config,testEventCode:''},null,false]))
  await f.rpc('commerce_meta_configure',[f.actors.owner,1,{...config,enabled:false,capiEnabled:false,testEventCode:'',testCustomerId:'',testEventLimit:0},null,false])
  assert.equal((await f.rpc('commerce_meta_settings',[f.actors.owner])).enabled,false)
 }finally{await f.close()}
})
