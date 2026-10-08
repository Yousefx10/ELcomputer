import test from 'node:test'
import assert from 'node:assert/strict'
import { request } from 'node:http'
import { setImmediate as nextTurn } from 'node:timers/promises'
import { createEmailHttpFixture } from './helpers/emailHttpFixture.mjs'
import { WEBHOOK_CANARY,emailFixtureRuntime } from './helpers/emailFixture.mjs'
import { createEmailService,processEmailQueue } from '../server/utils/email/service.js'
import { emailRpc } from '../server/utils/email/core.js'

test('actual HTTP handlers revoke authorization during a bounded request body read',{timeout:30000},async t=>{
 const f=await createEmailHttpFixture(),{url,close}=await f.start()
 const pendingBody=(path,headers,body)=>{
  let resolveResponse,rejectResponse
  const response=new Promise((resolve,reject)=>{resolveResponse=resolve;rejectResponse=reject})
  const req=request(url+path,{method:'POST',headers:{'content-type':'application/json',...headers}},res=>{
   const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolveResponse({status:res.statusCode,body:JSON.parse(Buffer.concat(chunks).toString())}))
  });req.on('error',rejectResponse);req.write('{')
  return {response,complete:()=>req.end(JSON.stringify(body).slice(1))}
 }
 try{
  await f.activate()
  const queued=await createEmailService(f.client).sendTransactional(f.input())
  await f.unthrottle();await processEmailQueue(f.client,{provider:{submit:async(_s,_k,_m,before)=>{await before();return {state:'accepted',provider_message_id:'revocation@relay.example.invalid'}}}})
  const m=await f.message(queued.id),body={event:'hard_bounce',email:m.recipient,'message-id':m.provider_message_id,ts_event:Math.floor(Date.now()/1000)}
  const originalFrom=f.client.from
  let settingsRead
  f.client.from=table=>{
   const query=originalFrom(table)
   if(table==='email_provider_settings'){
    const then=query.then;query.then=(resolve,reject)=>then(value=>{resolve(value);settingsRead?.()},reject)
   }
   return query
  }
  for(const change of [{webhook_enabled:false},{webhook_token:'rotated-webhook-fixture-more-than-32-characters'}]){
   await t.test('in-flight callback rejects '+Object.keys(change)[0],async()=>{
    await f.configure({webhook_token:WEBHOOK_CANARY});await f.configure({webhook_enabled:true})
    let read;const ready=new Promise(resolve=>{read=resolve});settingsRead=read
    const pending=pendingBody('/api/webhooks/brevo',{authorization:'Bearer '+WEBHOOK_CANARY},body)
    await ready;await nextTurn();settingsRead=null
    await f.configure(change);pending.complete()
    assert.equal((await pending.response).status,403)
    assert.equal((await f.db.query('select count(*)::int n from public.email_events')).rows[0].n,0)
    assert.equal((await f.db.query('select global_reason from public.email_preferences where recipient=$1',[m.recipient])).rows[0].global_reason,null)
   })
  }
  await t.test('missing webhook authorization revision fails closed in the service-only RPC',async()=>{
   await assert.rejects(()=>emailRpc(f.client,'event',{recipient:m.recipient,provider_message_id:m.provider_message_id,event_type:'hard_bounce',event_at:new Date().toISOString(),event_key:'a'.repeat(64)}))
  })
  await t.test('worker key rotation while reading a body prevents even a claim',async()=>{
   await f.configure({is_enabled:true,activation_confirmed:true,account_approved:true})
   const work=await createEmailService(f.client).sendTransactional(f.input({recipient:'worker@email.example.invalid'}))
   const original=emailFixtureRuntime.emailWorkerSecret
   const runtime=globalThis.useRuntimeConfig;let authenticated
   const ready=new Promise(resolve=>{authenticated=resolve})
   globalThis.useRuntimeConfig=()=>{authenticated();return runtime()}
   const pending=pendingBody('/api/internal/email/process',{'x-email-worker-secret':original},{limit:1})
   // Authenticate the partial request before rotation; no provider work occurs before its body ends.
   await ready;await nextTurn();emailFixtureRuntime.emailWorkerSecret='rotated-worker-fixture-more-than-32-characters'
   try{pending.complete();assert.equal((await pending.response).status,401);assert.equal((await f.message(work.id)).state,'queued');assert.equal((await f.message(work.id)).attempts,0);assert.equal(f.providerCalls.length,0)}
   finally{emailFixtureRuntime.emailWorkerSecret=original;globalThis.useRuntimeConfig=runtime}
  })
 }finally{await close()}
})
