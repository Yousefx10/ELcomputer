import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createEmailHttpFixture } from './helpers/emailHttpFixture.mjs'
import { EMAIL_KEY_CANARY,WEBHOOK_CANARY,emailFixtureRuntime } from './helpers/emailFixture.mjs'
import { emailRpc } from '../server/utils/email/core.js'
import { processEmailQueue } from '../server/utils/email/service.js'

test('actual Email HTTP handlers enforce RBAC, privacy, confirmations and webhook Bearer authentication',async t=>{
 const f=await createEmailHttpFixture(),{url,close}=await f.start()
 const call=async(path,actor='owner',method='GET',body,headers={})=>{
  const response=await fetch(url+path,{method,headers:{...(actor?{authorization:'Bearer '+actor}:{}),'content-type':'application/json',...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})})
  const data=await response.json();assert.equal(response.headers.get('cache-control'),'private, no-store');assert.doesNotMatch(JSON.stringify(data),new RegExp(EMAIL_KEY_CANARY+'|'+WEBHOOK_CANARY+'|_encrypted|html_body|text_body|unsubscribe_hash|correlation'))
  return {status:response.status,data}
 }
 try{
  await t.test('anonymous/customers/inactive/limited staff cannot access private surfaces',async()=>{
   for(const actor of [null,'customer','inactive'])for(const path of ['/api/admin-email/settings','/api/admin-email/templates','/api/admin-email/history','/api/admin-email/preferences?recipient=x@email.example.invalid'])assert.ok([401,403].includes((await call(path,actor)).status))
   assert.equal((await call('/api/admin-email/settings','sender')).status,403)
   assert.equal((await call('/api/admin-email/history','viewer')).status,403)
   assert.equal((await call('/api/admin-email/settings','viewer','PATCH',{revision:0})).status,403)
   assert.equal((await call('/api/admin-email/send','viewer','POST',{})).status,403)
   assert.equal((await call('/api/admin-email/templates','history','POST',{})).status,403)
   assert.equal((await call('/api/admin-email/settings','viewer')).status,200)
   assert.equal((await call('/api/webhooks/brevo',null,'POST',{})).status,404)
  })
  await f.activate();await f.saveTemplate(f.template());await f.saveTemplate(f.template('marketing'))
  await t.test('sender sees transactional templates; saved secret is presence-only; preview cannot be tampered',async()=>{
   const settings=(await call('/api/admin-email/settings')).data.settings;assert.equal(settings.api_key_configured,true);assert.equal(settings.encryption_ready,true)
   const templates=(await call('/api/admin-email/templates','sender')).data.templates;assert.equal(templates.length,1);assert.equal(templates[0].classification,'transactional')
   assert.equal((await call('/api/admin-email/templates','owner','POST',{...f.template('marketing'),version:1,classification:'transactional'})).status,409)
   assert.equal((await call('/api/admin-email/preview','sender','POST',f.input({template_key:'fixture_marketing',classification:'transactional',values:{reference:'X',customer_name:'Buyer',message:'Fixture'}}))).status,400)
   assert.equal((await call('/api/admin-email/preview','sender','POST',f.input({recipient:['one@email.example.invalid','two@email.example.invalid']}))).status,400)
   const input=f.input(),preview=await call('/api/admin-email/preview','sender','POST',input);assert.equal(preview.status,200)
   const send={...input,receipt:preview.data.receipt,confirmed:true,essential_confirmed:true}
   assert.equal((await call('/api/admin-email/send','sender','POST',{...send,recipient:'changed@email.example.invalid'})).status,409)
   assert.equal((await call('/api/admin-email/send','sender','POST',{...send,essential_confirmed:false})).status,409)
   const queued=await call('/api/admin-email/send','sender','POST',send);assert.equal(queued.status,200);assert.equal(queued.data.state,'queued')
   const reused=await call('/api/admin-email/send','sender','POST',send);assert.equal(reused.data.reused,true);assert.equal(reused.data.id,queued.data.id)
   assert.equal((await call('/api/internal/email/process',null,'POST',{limit:1})).status,401)
   await f.unthrottle();const worker=await call('/api/internal/email/process',null,'POST',{limit:1},{'x-email-worker-secret':emailFixtureRuntime.emailWorkerSecret});assert.equal(worker.status,200);assert.equal(f.providerCalls.length,1);assert.equal((await f.message(queued.data.id)).state,'accepted')
  })
  await t.test('secured webhook persists matching delivery, hard bounce and replay; wrong recipients are ignored',async()=>{
   const m=(await f.db.query("select * from public.email_messages where state='accepted' limit 1")).rows[0]
   const body={event:'delivered',email:m.recipient,'message-id':'<'+m.provider_message_id+'>',ts_event:Math.floor(Date.now()/1000)}
   assert.equal((await call('/api/webhooks/brevo',null,'POST',body)).status,401)
   assert.equal((await call('/api/webhooks/brevo',null,'POST',body,{authorization:'Bearer bad-token'})).status,401)
   const headers={authorization:'Bearer '+WEBHOOK_CANARY}
   assert.equal((await call('/api/webhooks/brevo',null,'POST',body,headers)).status,200);assert.equal((await call('/api/webhooks/brevo',null,'POST',body,headers)).status,200)
   assert.equal((await f.db.query('select count(*)::int n from public.email_events')).rows[0].n,1)
   await call('/api/webhooks/brevo',null,'POST',{...body,event:'hard_bounce',email:'wrong@email.example.invalid'},headers);assert.equal((await f.message(m.id)).delivery_state,'delivered')
   await call('/api/webhooks/brevo',null,'POST',{...body,event:'hard_bounce',ts_event:body.ts_event+1},headers)
   assert.equal((await f.db.query('select global_reason from public.email_preferences where recipient=$1',[m.recipient])).rows[0].global_reason,'hard_bounce')
   const history=await call('/api/admin-email/history','history');assert.match(history.data.items[0].recipient,/•••/);assert.equal((await call('/api/admin-email/events?id='+m.id,'history')).status,200)
   const oversized=await call('/api/webhooks/brevo',null,'POST',{...body,unused:'x'.repeat(33000)},headers);assert.equal(oversized.status,413)
  })
  await t.test('preference management records consent and enforces stale edits and provider clearance',async()=>{
   const address='preferences@email.example.invalid',lookup=(await call('/api/admin-email/preferences?recipient='+address,'preferences')).data.preference
   assert.equal((await call('/api/admin-email/preferences','sender','POST',{})).status,403)
   const input={recipient:address,marketing_status:'subscribed',provenance:'Explicit fixture consent',global_reason:'manual',clear_safety_confirmed:false,updated_at:lookup.updated_at}
   const saved=await call('/api/admin-email/preferences','preferences','POST',input);assert.equal(saved.status,200);assert.equal(saved.data.preference.marketing_status,'subscribed')
   assert.equal((await call('/api/admin-email/preferences','preferences','POST',input)).status,409)
   const change={...input,updated_at:saved.data.preference.updated_at,global_reason:null};assert.equal((await call('/api/admin-email/preferences','preferences','POST',change)).status,400)
   assert.equal((await call('/api/admin-email/preferences','preferences','POST',{...change,clear_safety_confirmed:true})).status,200)
   assert.equal((await call('/api/email/unsubscribe',null,'POST',{recipient:address,token:'x'.repeat(43)})).status,404)
  })
  await t.test('disabled provider returns unavailable, creates nothing and never calls mock transport',async()=>{
   const input=f.input({recipient:'disabled@email.example.invalid'}),p=(await call('/api/admin-email/preview','sender','POST',input)).data
   await f.configure({is_enabled:false})
   const next=(await call('/api/admin-email/preview','sender','POST',input)).data,prior=(await f.db.query('select count(*)::int n from public.email_messages')).rows[0].n
   const response=await call('/api/admin-email/send','sender','POST',{...input,receipt:next.receipt,confirmed:true,essential_confirmed:true});assert.equal(response.status,503)
   assert.equal((await f.db.query('select count(*)::int n from public.email_messages')).rows[0].n,prior);assert.equal(f.providerCalls.length,1)
  })
 }finally{await close()}
})
