import test from 'node:test'
import assert from 'node:assert/strict'
import { createClaimsHttpFixture } from './helpers/claimsHttpFixture.mjs'
import { attachClaimCommunicationsFixture,communicationRuntime } from './helpers/claimCommunicationsFixture.mjs'

test('actual Claims communications HTTP RBAC, controls, worker authentication and privacy',async t=>{
 const f=await attachClaimCommunicationsFixture(await createClaimsHttpFixture({communications:true}));f.setCommunicationProviders({sms:f.smsProvider,email:f.emailProvider})
 const server=await f.start(),call=async(path,actor='owner',body=null,headers={})=>{
  const response=await fetch(server.url+path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+actor,'content-type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});return{status:response.status,headers:response.headers,data:await response.json()}
 }
 try{
  await f.enable();await f.providers();await f.createTemplates()
  const path='/api/admin-after-sales/communications'
  await t.test('settings require dedicated roles; default-off catalog exposes no private configuration',async()=>{
   for(const actor of ['buyer','stranger','anonymous','disabled','viewer','reviewer','booker'])assert.equal((await call(path,actor)).status,403,actor)
   for(const actor of ['owner','communicationsViewer','communicationsManager']){const r=await call(path,actor);assert.equal(r.status,200);assert.ok(r.data.settings.every(s=>!s.is_enabled&&!s.sms_enabled&&!s.email_enabled));assert.doesNotMatch(JSON.stringify(r.data),/encrypted|api_key|work_token|approvals|fixture-private/)}
  })
  await t.test('unrelated central templates cannot crowd Claims bindings out of the bounded catalog',async()=>{
   await f.db.query("insert into public.sms_templates(code,name,category,text_en,text_ar,traffic_type) select 'aaa_fixture_'||n,'Unrelated fixture','manual','Fixture','نص تجريبي','notification' from generate_series(1,201) n")
   await f.fixtureWrite("insert into public.email_templates(key,name,category,classification,subject_en,subject_ar,body_en,body_ar,updated_by) select 'aaa_fixture_'||n,'Unrelated fixture','manual','transactional','Fixture','نص تجريبي','Fixture','نص تجريبي',$1 from generate_series(1,201) n",[f.owner])
   const catalog=await call(path,'communicationsViewer');assert.equal(catalog.status,200);assert.equal(catalog.data.sms.templates.length,7);assert.equal(catalog.data.email.templates.length,7)
  })
  await t.test('bindings are purpose-bound, stale-safe, audited and reusable after save',async()=>{
   let s=(await call(path)).data.settings.find(s=>s.purpose==='approved');delete s.updated_at
   const enabled={...s,is_enabled:true,sms_enabled:true,email_enabled:true,sms_template_en:f.templates.sms.approved.id,sms_template_ar:f.templates.sms.approved.id,email_template_en:f.templates.email.approved.key,email_template_ar:f.templates.email.approved.key}
   assert.equal((await call(path,'communicationsViewer',enabled)).status,403)
   for(const extra of [{recipient:'forged@email.example.invalid'},{html:'<b>Override</b>'},{subject:'Override'},{sender:'evil'}])assert.equal((await call(path,'communicationsManager',{...enabled,...extra})).status,400)
   assert.equal((await call(path,'communicationsManager',{...enabled,email_template_en:f.templates.email.rejected.key})).status,400)
   const saved=await call(path,'communicationsManager',enabled);assert.equal(saved.status,200);assert.equal(saved.data.setting.revision,1)
   assert.equal((await call(path,'communicationsManager',enabled)).status,409)
   const again={...saved.data.setting};delete again.updated_at;assert.equal((await call(path,'communicationsManager',again)).status,200)
   assert.equal((await f.db.query("select count(*)::int n from public.admin_activity_logs where action_key='claims.communication.settings'")).rows[0].n,2)
  })
  const item=await f.purchase(),claim=await f.create(f.body(item));await f.action(claim.id,'review');await f.action(claim.id,'note',{text:'COMMUNICATION-PRIVATE-CANARY'});await f.action(claim.id,'approve')
  await t.test('worker routes prepare through central services and replays do not send twice',async()=>{
   for(const channel of ['sms','email']){
    const route='/api/internal/'+channel+'/process',secret=communicationRuntime[channel+'WorkerSecret']
    assert.equal((await call(route,'buyer',{limit:1})).status,401)
    await f.unthrottle();const r=await call(route,'buyer',{limit:1},{['x-'+channel+'-worker-secret']:secret});assert.equal(r.status,200);assert.equal(r.data.claimEvents.processed.length,1)
    await f.unthrottle();assert.equal((await call(route,'buyer',{limit:1},{['x-'+channel+'-worker-secret']:secret})).status,200)
   }
   assert.equal(f.calls.sms.length,1);assert.equal(f.calls.email.length,1);assert.equal((await f.detail(claim.id)).claim.status,'approved')
  })
  await t.test('staff history is masked and private; customer timeline stays authoritative',async()=>{
   const history='/api/admin-after-sales/claims/'+claim.id+'/communications'
   for(const actor of ['buyer','stranger','viewer','reviewer'])assert.equal((await call(history,actor)).status,403)
   const r=await call(history,'communicationsViewer');assert.equal(r.status,200);assert.equal(r.data.items.length,2);assert.ok(r.data.items.every(i=>i.queue_state==='accepted'||i.queue_state==='submitted'))
   assert.doesNotMatch(JSON.stringify(r.data),/COMMUNICATION-PRIVATE-CANARY|purchase-contact|01012345678|payload|work_token|fingerprint|secret|encrypted/)
   const customer=await call('/api/account/after-sales/claims/'+claim.id,'buyer');assert.equal(customer.status,200);assert.doesNotMatch(JSON.stringify(customer.data),/COMMUNICATION-PRIVATE-CANARY|after_sales_communications|queue_state|sms_batch_id|email_message_id/)
   assert.equal((await call('/api/account/after-sales/claims/'+claim.id,'stranger')).status,404)
   assert.equal((await call('/api/account/after-sales/claims/'+claim.id+'/communications','buyer')).status,404)
   assert.equal((await call(history+'?page=0','owner')).status,400)
  })
 }finally{await server.close()}
})
