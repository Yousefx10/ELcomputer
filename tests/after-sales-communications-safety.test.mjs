import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createClaimCommunicationsFixture } from './helpers/claimCommunicationsFixture.mjs'
import { communicationRuntime } from './helpers/claimCommunicationsFixture.mjs'
import { processSmsQueue } from '../server/utils/sms/service.js'
import { processEmailQueue } from '../server/utils/email/service.js'
import { validateClaimCommunicationSetting } from '../server/utils/afterSalesCommunications.js'

const reviewing=async(f,type='return')=>{const item=await f.purchase(),c=await f.create(f.body(item,type));await f.action(c.id,'review');return {...c,item}}
const ready=async f=>{await f.enable();await f.enableCommunications()}
const prepareBoth=async f=>{await f.prepare('sms');await f.prepare('email')}

test('Claims communications preserve reverse identity, strict configuration and channel failure isolation',async t=>{
 const f=await createClaimCommunicationsFixture()
 try{
  await ready(f)
  await t.test('verified pickup acceptance/rebooking and dated receipt notify; tracking and duplicate observations do not',async()=>{
   await f.reverseConfigure();globalThis.useRuntimeConfig=()=>communicationRuntime
   const c=await reviewing(f);await f.action(c.id,'approve');await prepareBoth(f);await f.dispatch('sms');await f.dispatch('email')
   const count=(await f.intents(c.id)).length,first=await f.schedule(c.id),work=(await f.take()).find(j=>j.id===first.id)
   assert.equal((await f.intents(c.id)).length,count)
   await assert.rejects(()=>f.rpc('shipping_claim_finish',{p_job:work.id,p_token:work.token,p_state:'created',p_ref:'wrong',p_awb:'FORGED'}))
   assert.equal((await f.intents(c.id)).length,count)
   await f.finish(work);await f.finish(work);assert.equal((await f.intents(c.id)).length,count+2)
   await prepareBoth(f);await f.dispatch('sms');await f.dispatch('email')
   let job=await f.job(work.id)
   await f.record(f.event(job,12,{status_date:null,source:'reconciliation'}));await f.record(f.event(job,97));assert.equal((await f.intents(c.id)).length,count+2)
   await f.record(f.event(job,8,{status_date:new Date(Date.now()+2500).toISOString()}));assert.equal((await f.job(job.id)).state,'returned')
   const next=await f.schedule(c.id,f.input({previous_job_id:job.id})),second=(await f.take()).find(j=>j.id===next.id)
   await f.finish(second);await f.finish(second);assert.equal((await f.intents(c.id)).filter(r=>r.purpose==='pickup_scheduled').length,4)
   await prepareBoth(f);await f.dispatch('sms');await f.dispatch('email')
   job=await f.job(second.id);await f.record(f.event(job,12));assert.equal((await f.intents(c.id)).length,count+4)
   const delivery=f.event(job,5,{status_date:new Date(Date.now()+3000).toISOString(),observed_at:new Date(Date.now()+4000).toISOString()})
   await f.record(delivery);await f.record(delivery);assert.equal((await f.detail(c.id)).claim.status,'received')
   await prepareBoth(f);await f.dispatch('sms');await f.dispatch('email')
   const rows=await f.intents(c.id);assert.equal(rows.filter(r=>r.purpose==='received').length,2)
   assert.equal(new Set(rows.filter(r=>r.purpose==='pickup_scheduled').map(r=>r.occurrence_id)).size,2)
   assert.equal((await f.db.query("select count(*)::int n from public.sms_order_events where order_id=$1 and event_type like 'pdc_%'",[c.item.order_id])).rows[0].n,0)
   const reference=(await f.detail(c.id)).claim.reference;assert.equal(f.calls.email.filter(m=>m.business_reference===reference).length,4)
   assert.ok(f.calls.sms.filter(x=>x.batch.trigger_source==='claim:pickup_scheduled').length>=2)
   assert.equal((await f.view(c.id,true)).jobs.length,2)
  })
  await t.test('SMS-only, Email-only, event OFF and missing contacts never become later backlog',async()=>{
   for(const mode of ['sms','email','off','no_email','no_phone']){
    await f.configure('approved',{is_enabled:mode!=='off',sms_enabled:mode!=='email',email_enabled:mode!=='sms'})
    const c=await reviewing(f)
    if(mode==='no_email'||mode==='no_phone')await f.db.query('update public.customer_orders set '+(mode==='no_email'?'email':'phone')+"='' where id=$1",[c.item.order_id])
    await f.action(c.id,'approve');await prepareBoth(f);await f.dispatch('sms');await f.dispatch('email')
    const rows=await f.intents(c.id),sms=rows.find(r=>r.channel==='sms'),email=rows.find(r=>r.channel==='email')
    if(mode==='off')assert.ok(rows.every(r=>r.reason==='event_disabled'))
    else if(mode==='sms'){assert.equal(sms.status,'queued');assert.equal(email.reason,'channel_disabled')}
    else if(mode==='email'){assert.equal(email.status,'queued');assert.equal(sms.reason,'channel_disabled')}
    else if(mode==='no_email'){assert.equal(sms.status,'queued');assert.equal(email.reason,'invalid_email')}
    else {assert.equal(email.status,'queued');assert.equal(sms.reason,'invalid_phone')}
    await f.configure('approved');await prepareBoth(f);assert.equal((await f.intents(c.id)).length,2);for(const skipped of rows.filter(r=>r.status==='suppressed'))assert.equal((await f.intents(c.id)).find(r=>r.id===skipped.id).reason,skipped.reason)
   }
  })
  await t.test('provider OFF and missing runtime credentials suppress permanently; purchase contact/locale is immutable in the intent',async()=>{
   await f.db.exec("update public.sms_provider_settings set is_enabled=false")
   await f.fixtureWrite("update public.email_provider_settings set config=jsonb_set(config,'{is_enabled}','false')")
   const c=await reviewing(f);await f.action(c.id,'approve');assert.ok((await f.intents(c.id)).every(r=>r.reason==='provider_disabled'))
   await f.providers();await prepareBoth(f);assert.ok((await f.intents(c.id)).every(r=>r.reason==='provider_disabled'))
   const next=await reviewing(f);await f.db.query("update public.customer_orders set sms_locale='en' where id=$1",[next.item.order_id]);await f.action(next.id,'approve')
   await f.db.query("update public.customer_orders set email='changed@email.example.invalid',phone='01099999999',sms_locale='ar' where id=$1",[next.item.order_id])
   await f.db.query("update public.customer_profiles set email='account@email.example.invalid' where id=$1",[f.customer])
   const captured=await f.intents(next.id);assert.ok(captured.every(r=>r.locale==='en'));assert.equal(captured.find(r=>r.channel==='email').recipient,'purchase-contact@email.example.invalid')
   globalThis.useRuntimeConfig=()=>({...communicationRuntime,credentialsEncryptionKey:''})
   await prepareBoth(f);assert.ok((await f.intents(next.id)).every(r=>r.status==='suppressed'))
   globalThis.useRuntimeConfig=()=>communicationRuntime;await prepareBoth(f);assert.ok((await f.intents(next.id)).every(r=>r.status==='suppressed'))
  })
  await t.test('template edits invalidate approvals, binding saves retire queued messages and strict inputs reject overrides',async()=>{
   const c=await reviewing(f);await f.action(c.id,'approve');await prepareBoth(f)
   await f.db.query("update public.sms_templates set text_en=text_en||' Changed.' where id=$1",[f.templates.sms.approved.id])
   await f.fixtureWrite("update public.email_templates set body_en=body_en||' Changed.',version=version+1 where key=$1",[f.templates.email.approved.key])
   const before={sms:f.calls.sms.length,email:f.calls.email.length};await f.dispatch('sms');await f.dispatch('email');assert.deepEqual({sms:f.calls.sms.length,email:f.calls.email.length},before)
   await f.configure('approved')
   const next=await reviewing(f);await f.action(next.id,'approve');await prepareBoth(f);await f.configure('approved',{is_enabled:false});await f.dispatch('sms');await f.dispatch('email')
   assert.deepEqual({sms:f.calls.sms.length,email:f.calls.email.length},before);assert.ok((await f.intents(next.id)).every(r=>r.reason==='configuration_changed'))
   const setting=await f.settings('approved'),{approvals,capture_started_at,updated_by,updated_at,...body}=setting
   for(const extra of [{recipients:['spam@email.example.invalid']},{subject:'override'},{html:'<b>override</b>'},{sms_sender:'BAD'},{email_sender:'bad@email.example.invalid'}]){
    if('sms_sender' in extra||'email_sender' in extra)await assert.rejects(()=>f.configure('approved',extra))
    else await assert.rejects(()=>validateClaimCommunicationSetting(f.client,{...body,...extra}))
   }
   await f.configure('approved')
   await assert.rejects(()=>f.configure('approved',{email_template_en:f.templates.email.rejected.key}))
   await f.fixtureWrite("update public.email_templates set classification='marketing' where key=$1",[f.templates.email.approved.key]);await assert.rejects(()=>f.configure('approved'))
   await f.fixtureWrite("update public.email_templates set classification='transactional' where key=$1",[f.templates.email.approved.key]);await f.configure('approved')
  })
  await t.test('outbox failure rolls back uncommitted Claim; provider failures and uncertain acceptance never change committed workflow',async()=>{
   const c=await reviewing(f),revision=(await f.detail(c.id)).claim.revision
   await f.db.exec("create function public.claim_fixture_fail() returns trigger language plpgsql as $$begin raise exception 'fixture persistence failure';end$$;create trigger claim_fixture_fail before insert on public.after_sales_communications for each row execute function public.claim_fixture_fail()")
   await assert.rejects(()=>f.action(c.id,'approve'),/fixture persistence failure/);assert.equal((await f.detail(c.id)).claim.status,'under_review');assert.equal((await f.detail(c.id)).claim.revision,revision);assert.equal((await f.intents(c.id)).length,0)
   await f.db.exec('drop trigger claim_fixture_fail on public.after_sales_communications;drop function public.claim_fixture_fail()')
   for(const failing of ['sms','email','both','uncertain']){
    const next=await reviewing(f);await f.action(next.id,'approve');const before=await f.detail(next.id,true);await prepareBoth(f);await f.unthrottle()
    const goodSms=f.smsProvider,goodEmail=f.emailProvider
    const failSms={submit:async(_a,_b,_c,_d,_e,before)=>{await before();return {category:'provider_rejected',definite:true,status:'failed',messages:[{position:0,status:'failed',code:'9'}]}}}
    const failEmail={submit:async(_a,_b,_c,before)=>{await before();return {state:failing==='uncertain'?'uncertain':'failed',error_category:failing==='uncertain'?'transport_uncertain':'provider_rejected',http_status:400}}}
    await processSmsQueue(f.client,{provider:['sms','both'].includes(failing)?failSms:goodSms});await processEmailQueue(f.client,{provider:['email','both','uncertain'].includes(failing)?failEmail:goodEmail})
    assert.deepEqual(await f.detail(next.id,true),before)
    const rows=await f.intents(next.id);assert.ok(rows.every(r=>r.status==='queued'))
    if(failing==='sms')assert.equal((await f.db.query('select state from public.email_messages where id=$1',[rows.find(r=>r.channel==='email').email_message_id])).rows[0].state,'accepted')
    if(failing==='email')assert.equal((await f.db.query('select status from public.sms_batches where id=$1',[rows.find(r=>r.channel==='sms').sms_batch_id])).rows[0].status,'submitted')
    if(failing==='uncertain'){const count=f.calls.email.length;await f.dispatch('email');assert.equal(f.calls.email.length,count)}
   }
  })
  await t.test('short downtime retries safely, caps preparation and expires without replay; new audited resolution changes have new identity',async()=>{
   const c=await reviewing(f);await f.action(c.id,'approve')
   const row=await f.rpc('after_sales_communication_take',{p_channel:'email'});assert.ok(row);await f.rpc('after_sales_communication_finish',{p_id:row.id,p_token:row.work_token,p_reason:'storage_error'})
   assert.equal((await f.intents(c.id)).find(r=>r.id===row.id).status,'pending')
   await f.fixtureWrite('update public.after_sales_communications set available_at=clock_timestamp() where id=$1',[row.id]);await f.prepare('email');await f.dispatch('email')
   const expired=await reviewing(f);await f.action(expired.id,'approve');await f.db.exec('alter table public.after_sales_communications disable trigger after_sales_communications_guard')
   await f.db.query("update public.after_sales_communications set expires_at=clock_timestamp()-interval '1 second' where claim_id=$1",[expired.id]);await f.db.exec('alter table public.after_sales_communications enable trigger after_sales_communications_guard')
   await prepareBoth(f);assert.ok((await f.intents(expired.id)).every(r=>r.reason==='expired'))
   const w=await reviewing(f,'warranty');await f.action(w.id,'approve');await f.action(w.id,'receive');await f.action(w.id,'inspect');await f.action(w.id,'select_resolution',{resolution:'repair',text:'Repair decision.'})
   await f.action(w.id,'select_resolution',{resolution:'repair',text:'Same decision.'});await f.action(w.id,'select_resolution',{resolution:'replacement',text:'Separately audited changed decision.'})
   await f.action(w.id,'select_resolution',{resolution:'repair',text:'Separately audited decision changed back.'});assert.equal((await f.intents(w.id)).filter(r=>r.purpose==='resolution_decided').length,6)
   await prepareBoth(f);await prepareBoth(f);const decisions=(await f.intents(w.id)).filter(r=>r.purpose==='resolution_decided');assert.ok(decisions.slice(0,4).every(r=>r.reason==='superseded'));assert.ok(decisions.slice(4).every(r=>r.status==='queued'))
   const capped=await reviewing(f);await f.action(capped.id,'approve')
   for(let i=0;i<3;i++){const r=await f.rpc('after_sales_communication_take',{p_channel:'email'});assert.ok(r);await f.rpc('after_sales_communication_finish',{p_id:r.id,p_token:r.work_token,p_reason:'storage_error'});await f.fixtureWrite('update public.after_sales_communications set available_at=clock_timestamp() where id=$1',[r.id])}
   assert.equal((await f.intents(capped.id)).find(r=>r.channel==='email').reason,'storage_error')
  })
 }finally{await f.db.close()}
})

test('migration 67 preserves populated 66 business data and creates no historical or provider jobs',async()=>{
 const name='20261009120000_after_sales_communications.sql',f=await createClaimCommunicationsFixture({stopBefore:name})
 try{
  await f.enable();const c=await reviewing(f);await f.action(c.id,'approve');await f.reverseConfigure();await f.schedule(c.id)
  const tables=['products','customer_profiles','customer_orders','customer_order_items','after_sales_policies','after_sales_claims','after_sales_claim_events','after_sales_claim_information','shipping_provider_settings','shipping_claim_jobs','shipping_order_jobs','shipping_webhook_events','sms_templates','sms_provider_settings','sms_batches','sms_messages','sms_order_events','email_provider_settings','email_templates','email_messages','email_events','payment_attempts']
  const snapshot=async()=>Object.fromEntries(await Promise.all(tables.map(async table=>[table,(await f.db.query('select to_jsonb(t) row from public.'+table+' t order by to_jsonb(t)::text')).rows.map(r=>r.row)])))
  const before=await snapshot(),functions=(await f.db.query("select proname,prosrc from pg_proc where pronamespace='public'::regnamespace and proname in ('after_sales_claim_staff_action','shipping_claim_finish','shipping_record_pdc_event','sms_enqueue','sms_finish','email_ready','sms_check_dispatch','email_command')")).rows
  await f.db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));assert.deepEqual(await snapshot(),before)
  for(const fn of functions){const renamed=['sms_check_dispatch','email_command'].includes(fn.proname)?fn.proname+'_before_claim_communications':fn.proname;assert.equal((await f.db.query("select prosrc from pg_proc where pronamespace='public'::regnamespace and proname=$1",[renamed])).rows[0].prosrc,fn.prosrc)}
  assert.equal((await f.db.query('select count(*)::int n from public.after_sales_communications')).rows[0].n,0)
  assert.equal((await f.db.query('select count(*)::int n from public.after_sales_communication_settings where is_enabled or sms_enabled or email_enabled')).rows[0].n,0)
 }finally{await f.db.close()}
})
