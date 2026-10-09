import test from 'node:test'
import assert from 'node:assert/strict'
import { createClaimCommunicationsFixture } from './helpers/claimCommunicationsFixture.mjs'
import { processClaimCommunications } from '../server/utils/afterSalesCommunications.js'
import { processSmsQueue } from '../server/utils/sms/service.js'
import { emailRpc } from '../server/utils/email/core.js'

test('Claims communication content limits, revocation and audit durability remain channel-local',async t=>{
 const f=await createClaimCommunicationsFixture()
 const reviewing=async()=>{const item=await f.purchase(),c=await f.create(f.body(item));await f.action(c.id,'review');return c}
 try{
  await f.enable();await f.enableCommunications()
  await t.test('long SMS source is terminally skipped while safe Email succeeds',async()=>{
   const old=f.templates.sms.approved
   await f.db.query('update public.sms_templates set text_ar=$1 where id=$2',['ا'.repeat(900)+' {{claim_reference}} {{claim_url}}',old.id]);await f.configure('approved')
   const c=await reviewing();await f.action(c.id,'approve');await f.prepare('sms');await f.prepare('email');await f.dispatch('email')
   const rows=await f.intents(c.id);assert.equal(rows.find(r=>r.channel==='sms').reason,'segment_limit');assert.equal(rows.find(r=>r.channel==='email').status,'queued');assert.equal((await f.detail(c.id)).claim.status,'approved')
   await f.db.query('update public.sms_templates set text_ar=$1 where id=$2',[old.text_ar,old.id]);await f.configure('approved')
  })
  await t.test('customer-facing request may contain markup/newlines but cannot inject a header; SMS still succeeds',async()=>{
   const old=f.templates.email.more_information
   await f.fixtureWrite('update public.email_templates set subject_ar=$1 where key=$2',['{{claim_reference}} {{request_text}}',old.key]);await f.configure('more_information')
   const c=await reviewing();await f.action(c.id,'note',{text:'PRIVATE-CONTENT-CANARY'});await f.action(c.id,'request_information',{text:'Please provide the item details.\nBcc: forged@example.invalid'})
   await f.prepare('sms');await f.prepare('email');await f.dispatch('sms')
   const rows=await f.intents(c.id);assert.equal(rows.find(r=>r.channel==='email').reason,'invalid_template');assert.equal(rows.find(r=>r.channel==='sms').status,'queued');assert.doesNotMatch(f.calls.sms.at(-1).messages[0].body,/Bcc|PRIVATE-CONTENT/)
   await f.fixtureWrite('update public.email_templates set subject_ar=$1 where key=$2',[old.subject_ar,old.key]);await f.configure('more_information')
  })
  await t.test('missing stored SMS credentials prevent activation; Email works and skipped SMS never revives',async()=>{
   await f.db.exec('update public.sms_provider_settings set is_enabled=false,account_id_encrypted=null');await assert.rejects(()=>f.db.exec('update public.sms_provider_settings set is_enabled=true'),/check constraint/)
   const c=await reviewing();await f.action(c.id,'approve');assert.equal((await f.intents(c.id)).find(r=>r.channel==='sms').reason,'provider_disabled');await f.prepare('email');await f.dispatch('email')
   await f.providers();await f.prepare('sms');assert.equal((await f.intents(c.id)).find(r=>r.channel==='sms').reason,'provider_disabled')
  })
  await t.test('binding approval revocation cancels both queued channels before provider submission',async()=>{
   const c=await reviewing();await f.action(c.id,'approve');await f.prepare('sms');await f.prepare('email');const before={sms:f.calls.sms.length,email:f.calls.email.length}
   await f.db.query('update public.admin_users set is_active=false where id=$1',[f.owner]);await f.dispatch('sms');await f.dispatch('email');await f.db.query('update public.admin_users set is_active=true where id=$1',[f.owner])
   assert.deepEqual({sms:f.calls.sms.length,email:f.calls.email.length},before);assert.equal((await f.detail(c.id)).claim.status,'approved')
   const rows=await f.intents(c.id);assert.equal((await f.db.query('select error_category from public.email_messages where id=$1',[rows.find(r=>r.channel==='email').email_message_id])).rows[0].error_category,'approver_revoked')
  })
  await t.test('settings audit persistence is atomic and cannot silently approve bindings',async()=>{
   const before=await f.settings('approved')
   await f.db.exec("create function public.claim_fixture_audit_fail() returns trigger language plpgsql as $$begin raise exception 'fixture audit failure';end$$;create trigger claim_fixture_audit_fail before insert on public.admin_activity_logs for each row execute function public.claim_fixture_audit_fail()")
   await assert.rejects(()=>f.configure('approved',{is_enabled:false}),/fixture audit failure/);assert.deepEqual(await f.settings('approved'),before)
   await f.db.exec('drop trigger claim_fixture_audit_fail on public.admin_activity_logs;drop function public.claim_fixture_audit_fail()')
  })
  await t.test('uncertain Vodafone submission remains central uncertain and is never automatically resubmitted',async()=>{
   const c=await reviewing();await f.action(c.id,'approve');await f.prepare('sms');await f.prepare('email');await f.dispatch('email');await f.unthrottle();let attempts=0
   const provider={submit:async(_s,_k,_b,_m,_t,before)=>{await before();attempts++;throw Error('Fixture connection lost after dispatch')}}
   await processSmsQueue(f.client,{provider});await f.unthrottle();await processSmsQueue(f.client,{provider})
   assert.equal(attempts,1);const row=(await f.intents(c.id)).find(r=>r.channel==='sms');assert.equal((await f.db.query('select status from public.sms_batches where id=$1',[row.sms_batch_id])).rows[0].status,'uncertain');assert.equal((await f.detail(c.id)).claim.status,'approved')
  })
  await t.test('abandoned preparation lease recovers with a new token and rejects stale worker completion',async()=>{
   const c=await reviewing();await f.action(c.id,'approve')
   const first=await f.rpc('after_sales_communication_take',{p_channel:'email'});assert.ok(first)
   await f.fixtureWrite("update public.after_sales_communications set started_at=clock_timestamp()-interval '3 minutes' where id=$1",[first.id])
   const second=await f.rpc('after_sales_communication_take',{p_channel:'email'});assert.equal(second.id,first.id);assert.notEqual(second.work_token,first.work_token)
   await f.rpc('after_sales_communication_finish',{p_id:first.id,p_token:first.work_token,p_reason:'invalid_template'})
   await assert.rejects(()=>f.rpc('after_sales_communication_enqueue',{p_id:first.id,p_token:first.work_token,p_channel:'email',p_payload:{}}),/retry conflict/)
   assert.equal((await f.intents(c.id)).find(r=>r.id===second.id).work_token,second.work_token)
   await f.rpc('after_sales_communication_finish',{p_id:second.id,p_token:second.work_token,p_reason:'storage_error'});await f.fixtureWrite('update public.after_sales_communications set available_at=clock_timestamp() where id=$1',[second.id]);await f.prepare('email');await f.dispatch('email')
   assert.equal((await f.db.query('select count(*)::int n from public.email_messages where idempotency_key=$1',[second.id])).rows[0].n,1)
  })
  await t.test('worker authorization lost after preparation prevents enqueue and permits bounded authorized recovery',async()=>{
   await f.prepare('sms');await f.dispatch('sms');const c=await reviewing();await f.action(c.id,'approve');let checks=0
   const authorize=()=>{if(++checks>1)throw Object.assign(Error('Fixture worker revoked.'),{statusCode:401})}
   await assert.rejects(()=>processClaimCommunications(f.client,{channel:'sms',authorize}),e=>e.statusCode===401)
   const row=(await f.intents(c.id)).find(r=>r.channel==='sms');assert.equal(row.status,'pending');assert.equal(row.sms_batch_id,null);assert.equal(row.attempts,1);assert.equal((await f.detail(c.id)).claim.status,'approved')
   await f.fixtureWrite('update public.after_sales_communications set available_at=clock_timestamp() where id=$1',[row.id]);await f.prepare('sms');await f.prepare('email');await f.dispatch('sms');await f.dispatch('email')
   assert.equal((await f.intents(c.id)).find(r=>r.channel==='sms').status,'queued')
  })
  await t.test('recipient provider safety restrictions use existing Email suppression only',async()=>{
   const pref=(await f.db.query("select updated_at from public.email_preferences where recipient='purchase-contact@email.example.invalid'")).rows[0];await emailRpc(f.client,'preference',{recipient:'purchase-contact@email.example.invalid',marketing_status:'unknown',global_reason:'manual',provenance:'Fixture safety restriction',updated_at:new Date(pref.updated_at).toISOString()},f.owner)
   const c=await reviewing();await f.action(c.id,'approve');await f.prepare('email');await f.prepare('sms');await f.dispatch('sms')
   const rows=await f.intents(c.id);assert.equal(rows.find(r=>r.channel==='email').reason,'recipient_restricted');assert.equal(rows.find(r=>r.channel==='sms').status,'queued')
  })
 }finally{await f.db.close()}
})
