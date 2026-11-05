import test from 'node:test'
import assert from 'node:assert/strict'
import {createCodCheckoutFixture} from './helpers/codCheckoutFixture.mjs'
import {emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'

test('actual Meta HTTP boundaries and encrypted Dashboard configuration',{skip:!emailNativeAvailable,timeout:180000},async t=>{
 const site='https://independent-store.example.invalid',runtime={paymentFirstEnabled:true,metaTrackingEnabled:true,metaDispatchEnabled:false,metaWorkerSecret:'local-worker-secret-longer-than-thirty-two-bytes',credentialsEncryptionKey:'local-fixture-encryption-key-is-at-least-32-bytes',public:{purchasingEnabled:true,siteUrl:site}}
 const routes=[['get','/api/admin-marketing/settings','server/api/admin-marketing/settings.get.js'],['patch','/api/admin-marketing/settings','server/api/admin-marketing/settings.patch.js'],['get','/api/marketing/config','server/api/marketing/config.get.js'],['post','/api/marketing/consent','server/api/marketing/consent.post.js'],['post','/api/marketing/events','server/api/marketing/events.post.js'],['post','/api/marketing/purchase','server/api/marketing/purchase.post.js'],['post','/api/internal/marketing/process','server/api/internal/marketing/process.post.js']]
 routes.push(['post','/api/internal/marketing/retention','server/api/internal/marketing/retention.post.js'])
 const f=await createCodCheckoutFixture({runtime,routes});let requests=0
 try{
  const first=await f.call('/api/admin-marketing/settings',{actor:'owner'}),origin=new URL(first.response.url).origin
  const call=async(path,{method='GET',actor='customer',body,headers={}}={})=>{const r=await fetch(origin+path,{method,headers:{origin:site,'content-type':'application/json',...(actor?{authorization:'Bearer '+actor}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});requests++;return {status:r.status,headers:r.headers,body:await r.json()}}
  await t.test('anonymous, disabled and insufficient staff cannot read or change settings',async()=>{
   for(const actor of [null,'disabled','editor'])assert.ok([401,403].includes((await call('/api/admin-marketing/settings',{actor})).status))
   const r=await call('/api/admin-marketing/settings',{actor:'owner'});assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/)
  })
  const token='LOCAL_META_TOKEN_CANARY_NO_PROVIDER',settings={enabled:true,capiEnabled:true,pixelId:'123456789',graphVersion:'v26.0',testEventCode:''}
  await t.test('configuration saves an encrypted token and never returns it',async()=>{
   const r=await call('/api/admin-marketing/settings',{actor:'owner',method:'PATCH',body:{revision:0,config:settings,token}});assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.tokenSet,true);assert.ok(!JSON.stringify(r.body).includes(token))
   const stored=(await f.db.query('select token_encrypted from private.meta_settings where id')).rows[0].token_encrypted;assert.match(stored,/^v1\./);assert.ok(!stored.includes(token))
   const publicConfig=await call('/api/marketing/config');assert.equal(publicConfig.body.enabled,true);assert.equal(publicConfig.body.pixelId,settings.pixelId);assert.equal(publicConfig.body.tokenSet,undefined)
  })
  await t.test('cross-origin writes and stale settings fail without losing the saved configuration',async()=>{
   assert.equal((await call('/api/marketing/consent',{method:'POST',body:{granted:true},headers:{origin:'https://foreign.example.invalid'}})).status,403)
   assert.equal((await call('/api/admin-marketing/settings',{actor:'owner',method:'PATCH',body:{revision:0,config:settings}})).status,409)
   assert.equal((await f.call('/api/admin-marketing/settings',{actor:'owner'})).body.settings.revision,1)
  })
  let cookie
  await t.test('explicit consent creates an HttpOnly receipt; DNT and GPC cannot grant consent',async()=>{
   const accepted=await call('/api/marketing/consent',{method:'POST',body:{granted:true}});assert.equal(accepted.status,200);assert.equal(accepted.body.granted,true);assert.match(accepted.headers.get('set-cookie'),/HttpOnly/i);assert.match(accepted.headers.get('set-cookie'),/Secure/i);cookie=accepted.headers.get('set-cookie').split(';')[0]
   for(const headers of [{dnt:'1'},{'sec-gpc':'1'}]){const r=await call('/api/marketing/consent',{method:'POST',body:{granted:true},headers});assert.equal(r.body.granted,false)}
   const owner=await call('/api/marketing/consent',{actor:'owner',method:'POST',body:{granted:true}});assert.equal(owner.body.granted,false)
  })
  await t.test('browser cannot assert Purchase or values, and consent withdrawal suppresses pending work',async()=>{
   const base={eventName:'PageView',eventId:crypto.randomUUID(),path:'/shop'}
   assert.equal((await call('/api/marketing/events',{method:'POST',body:base})).body.event,null)
   assert.equal((await call('/api/marketing/events',{method:'POST',body:{...base,eventName:'Purchase'},headers:{cookie}})).status,400)
   const r=await call('/api/marketing/events',{method:'POST',body:base,headers:{cookie}});assert.equal(r.status,200);assert.equal(r.body.event.eventId,base.eventId)
   assert.equal((await call('/api/marketing/purchase',{actor:null,method:'POST',body:{orderId:crypto.randomUUID()},headers:{cookie}})).status,401)
   await call('/api/marketing/consent',{method:'POST',body:{granted:false},headers:{cookie}})
   assert.equal((await f.db.query("select count(*)::int n from private.meta_event_outbox where state='suppressed'")).rows[0].n,1)
  })
  await t.test('disabled dispatch has private headers and no provider or worker action',async()=>{const r=await call('/api/internal/marketing/process',{method:'POST',actor:null,body:{}});assert.equal(r.status,404);assert.deepEqual(r.body,{state:'disabled'});assert.match(r.headers.get('cache-control'),/no-store/);assert.equal((await f.db.query('select coalesce(sum(attempts),0)::int n from private.meta_event_outbox')).rows[0].n,0)})
  await t.test('retention requires its own worker secret and sends no provider request',async()=>{
   assert.equal((await call('/api/internal/marketing/retention',{method:'POST',actor:null,body:{}})).status,403)
   const r=await call('/api/internal/marketing/retention',{method:'POST',actor:null,body:{},headers:{authorization:'Bearer '+runtime.metaWorkerSecret}})
   assert.equal(r.status,200);assert.deepEqual(r.body,{scrubbed:0,suppressed:0})
  })
 }finally{await f.close()}
})
