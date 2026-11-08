import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {paymentFirstFixture} from './helpers/paymentFirstFixture.mjs'
import {emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'
import {metaSafeSearch} from '../app/utils/metaTracking.js'

const hash=c=>c.repeat(64),cipher='v1.YQ.Yg.Yw'
const config=(consentMode)=>({enabled:true,capiEnabled:true,pixelId:'123456789',graphVersion:'v26.0',testEventCode:'',consentMode})
const rowFor=async(f,h)=>(await f.db.query('select granted,basis,revoked_at is not null revoked,policy_revision from private.meta_consents where token_hash=$1',[h])).rows[0]

test('native: tracking by default is opt-in unless a store chooses it, and stays truthful',{skip:!emailNativeAvailable,timeout:240000},async t=>{
 await t.test('a new store still asks first and refuses automatic grants',async()=>{
  const f=await paymentFirstFixture();try{
   await f.rpc('commerce_meta_configure',[f.actors.owner,0,config(undefined),cipher,false])
   assert.equal((await f.rpc('commerce_meta_settings',[f.actors.owner])).consentMode,'opt_in')
   assert.deepEqual(await f.rpc('commerce_meta_default_consent',[hash('a'),'Browser']),{granted:false})
   assert.equal(await rowFor(f,hash('a')),undefined)
  }finally{await f.close()}
 })
 await t.test('default mode records a default basis and allows events',async()=>{
  const f=await paymentFirstFixture();try{
   await f.rpc('commerce_meta_configure',[f.actors.owner,0,config('default'),cipher,false])
   const r=await f.rpc('commerce_meta_default_consent',[hash('a'),'Browser']);assert.equal(r.granted,true)
   const row=await rowFor(f,hash('a'));assert.equal(row.granted,true);assert.equal(row.basis,'default')
   const event=await f.rpc('commerce_meta_event',[hash('a'),null,{eventName:'PageView',eventId:'00000000-0000-4000-8000-000000000001',path:'/shop'}])
   assert.equal(event.eventName,'PageView')
  }finally{await f.close()}
 })
 await t.test('an explicit Allow is still recorded as opt-in',async()=>{
  const f=await paymentFirstFixture();try{
   await f.rpc('commerce_meta_configure',[f.actors.owner,0,config('default'),cipher,false])
   await f.rpc('commerce_meta_consent',[hash('b'),true,'Browser'])
   assert.equal((await rowFor(f,hash('b'))).basis,'opt_in')
  }finally{await f.close()}
 })
 await t.test('a decline stands, even after a settings change',async()=>{
  const f=await paymentFirstFixture();try{
   await f.rpc('commerce_meta_configure',[f.actors.owner,0,config('default'),cipher,false])
   await f.rpc('commerce_meta_default_consent',[hash('a'),'Browser'])
   await f.rpc('commerce_meta_consent',[hash('a'),false,''])
   assert.deepEqual(await f.rpc('commerce_meta_default_consent',[hash('a'),'Browser']),{granted:false,declined:true})
   await f.rpc('commerce_meta_configure',[f.actors.owner,1,config('default'),null,false])
   assert.deepEqual(await f.rpc('commerce_meta_default_consent',[hash('a'),'Browser']),{granted:false,declined:true})
   assert.equal((await rowFor(f,hash('a'))).granted,false)
  }finally{await f.close()}
 })
 await t.test('a settings change re-issues a default grant at the new revision',async()=>{
  const f=await paymentFirstFixture();try{
   await f.rpc('commerce_meta_configure',[f.actors.owner,0,config('default'),cipher,false])
   await f.rpc('commerce_meta_default_consent',[hash('a'),'Browser'])
   await f.rpc('commerce_meta_configure',[f.actors.owner,1,config('default'),null,false])
   assert.equal((await rowFor(f,hash('a'))).policy_revision,1)
   assert.equal((await f.rpc('commerce_meta_default_consent',[hash('a'),'Browser'])).granted,true)
   assert.equal((await rowFor(f,hash('a'))).policy_revision,2)
  }finally{await f.close()}
 })
 await t.test('staff are never granted and an invalid mode is refused',async()=>{
  const f=await paymentFirstFixture();try{
   await f.rpc('commerce_meta_configure',[f.actors.owner,0,config('default'),cipher,false])
   await f.db.query('insert into public.store_analytics_internal_users(user_id) values($1) on conflict do nothing',[f.actors.owner])
   assert.deepEqual(await f.rpc('commerce_meta_default_consent',[hash('c'),'Browser',f.actors.owner]),{granted:false})
   await assert.rejects(f.rpc('commerce_meta_configure',[f.actors.owner,1,config('silent'),null,false]))
  }finally{await f.close()}
 })
 await t.test('omitting the mode keeps the saved mode',async()=>{
  const f=await paymentFirstFixture();try{
   await f.rpc('commerce_meta_configure',[f.actors.owner,0,config('default'),cipher,false])
   await f.rpc('commerce_meta_configure',[f.actors.owner,1,config(undefined),null,false])
   assert.equal((await f.rpc('commerce_meta_settings',[f.actors.owner])).consentMode,'default')
  }finally{await f.close()}
 })
})

test('ad-click IDs from Google and TikTok keep a landing page eligible',()=>{
 for(const ok of ['?gclid=abc','?gbraid=a&wbraid=b','?gad_source=1&gad_campaignid=2&gclid=c','?srsltid=abc','?ttclid=abc'])assert.equal(metaSafeSearch(ok),true,ok)
 for(const bad of ['?gclid=abc&email=a@b.c','?q=mouse'])assert.equal(metaSafeSearch(bad),false,bad)
})

test('the banner is hidden by default mode and the opt-out stays reachable',async()=>{
 const consent=await readFile('app/components/privacy/MarketingConsent.vue','utf8')
 assert.match(consent,/consentMode!=='default'/)
 assert.doesNotMatch(consent,/privacySettings/,'The floating preferences box is gone')
 for(const footer of ['app/components/layout/Footer.vue','app/components/layout/ModernFooter.vue'])assert.match(await readFile(footer,'utf8'),/PrivacyPreferencesLink/)
 const flow=await readFile('app/composables/useMetaTracking.js','utf8')
 assert.match(flow,/consentMode==='default'&&saved\?\.choice==='denied'/,'A saved decline is checked before any default grant')
 assert.match(flow,/navigator\.webdriver/,'Automated browsers are not granted by default')
})
