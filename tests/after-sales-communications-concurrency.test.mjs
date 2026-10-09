import test from 'node:test'
import assert from 'node:assert/strict'
import { createEmailNativeDatabase,emailNativeAvailable,nativeWaitFor } from './helpers/emailNativeDatabase.mjs'
import { createClaimCommunicationsFixture } from './helpers/claimCommunicationsFixture.mjs'
import { smsDatabaseClient } from './helpers/smsDatabase.mjs'
import { processClaimCommunications } from '../server/utils/afterSalesCommunications.js'
import { emailRpc } from '../server/utils/email/core.js'

test('native PostgreSQL Claims milestone atomicity, concurrent intent/queue identity and final authorization',{skip:!emailNativeAvailable,timeout:60000},async t=>{
 const database=await createEmailNativeDatabase(),f=await createClaimCommunicationsFixture({database})
 try{
  await f.enable();await f.enableCommunications()
  const workers=await Promise.all([database.connect('service_role'),database.connect('service_role'),database.connect('service_role')]),clients=workers.map(c=>smsDatabaseClient(c)),blocker=await database.connect()
  const blocked=count=>nativeWaitFor(async()=>Number((await database.query("select count(*) n from pg_stat_activity where pid=any($1::int[]) and wait_event_type='Lock'",[workers.map(c=>c.processID)])).rows[0].n)===count)
  const review=async()=>{const item=await f.purchase(),c=await f.create(f.body(item));await f.action(c.id,'review');return c}
  const approve=(worker,c,revision)=>worker.query("select public.after_sales_claim_staff_action($1,$2,$3,'approve','{\"text\":\"Native approval\"}') result",[f.owner,c.id,revision])
  let c
  await t.test('uncommitted milestone and both intents are invisible; rollback erases all three',async()=>{
   c=await review();const revision=(await f.detail(c.id)).claim.revision
   await workers[0].query('begin');await approve(workers[0],c,revision)
   assert.equal((await f.intents(c.id)).length,0);assert.equal((await f.detail(c.id)).claim.status,'under_review')
   assert.equal((await workers[0].query('select count(*)::int n from public.after_sales_communications where claim_id=$1',[c.id])).rows[0].n,2)
   await workers[0].query('rollback');assert.equal((await f.intents(c.id)).length,0)
  })
  await t.test('independent staff sessions racing the same revision commit one event and two intents',async()=>{
   const revision=(await f.detail(c.id)).claim.revision
   await blocker.query('begin');await blocker.query('select id from public.after_sales_claims where id=$1 for update',[c.id])
   const pending=Promise.allSettled(workers.map(w=>approve(w,c,revision)));await blocked(3);await blocker.query('commit')
   const results=await pending;assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,2)
   assert.equal((await f.intents(c.id)).length,2);assert.equal((await database.query("select count(*)::int n from public.after_sales_claim_events where claim_id=$1 and event_type='approve'",[c.id])).rows[0].n,1)
  })
  await t.test('concurrent preparers take one lease and central queue/linkage commits once',async()=>{
   await blocker.query('begin');await blocker.query("select id from public.email_provider_settings where id='brevo' for update")
   const pending=clients.map(client=>processClaimCommunications(client,{channel:'email'}));await blocked(3);await blocker.query('commit')
   const results=await Promise.all(pending);assert.equal(results.reduce((n,r)=>n+r.processed.length,0),1)
   const rows=await f.intents(c.id),row=rows.find(r=>r.channel==='email');assert.equal(row.status,'queued');assert.ok(row.email_message_id)
   assert.equal((await database.query('select count(*)::int n from public.email_messages where idempotency_key=$1',[row.id])).rows[0].n,1)
   await f.prepare('sms');await f.dispatch('sms');await f.dispatch('email')
  })
  await t.test('same persisted information request re-emitted concurrently still captures once per channel',async()=>{
   const request=await review();await f.action(request.id,'request_information',{text:'Native request.'})
   // Native sessions exercise the same authoritative request identity; this owner-only
   // helper is invoked by the canonical action in production, never by a browser.
   const ownerClients=await Promise.all([database.connect(),database.connect()])
   await Promise.all(ownerClients.map(async w=>{await w.query("begin;set local app.after_sales_claim_write='on'");await w.query("select public.after_sales_claim_emit($1,$2,'staff','request_information','',true)",[request.id,f.owner]);await w.query('commit')}))
   const rows=await f.intents(request.id);assert.equal(rows.length,2);assert.equal(new Set(rows.map(r=>r.occurrence_id)).size,1)
   await f.prepare('email');await f.prepare('sms');await f.dispatch('email');await f.dispatch('sms');await f.customerAction(request.id,'respond')
  })
  await t.test('central enqueue and intent linkage failure roll back together; bounded retry creates one queue row',async()=>{
   const next=await review();await f.action(next.id,'approve')
   await database.exec("create function public.claim_fixture_link_fail() returns trigger language plpgsql as $$begin if new.status='queued' then raise exception 'fixture linkage outage';end if;return new;end$$;create trigger claim_fixture_link_fail before update on public.after_sales_communications for each row execute function public.claim_fixture_link_fail()")
   await f.prepare('email');const row=(await f.intents(next.id)).find(r=>r.channel==='email')
   assert.equal(row.status,'pending');assert.equal(row.email_message_id,null);assert.equal((await database.query('select count(*)::int n from public.email_messages where idempotency_key=$1',[row.id])).rows[0].n,0)
   await database.exec('drop trigger claim_fixture_link_fail on public.after_sales_communications;drop function public.claim_fixture_link_fail()')
   await f.fixtureWrite('update public.after_sales_communications set available_at=clock_timestamp() where id=$1',[row.id]);await f.prepare('email')
   assert.equal((await database.query('select count(*)::int n from public.email_messages where idempotency_key=$1',[row.id])).rows[0].n,1)
   await f.prepare('sms');await f.dispatch('sms');await f.dispatch('email')
  })
  await t.test('Claims settings disable committed before waiting SMS final check prevents POST and preserves accepted history',async()=>{
   const next=await review();await f.action(next.id,'approve');await f.prepare('email');await f.dispatch('email');await f.prepare('sms');await f.unthrottle()
   const job=(await workers[0].query('select to_jsonb(public.sms_claim()) result')).rows[0].result
   const revision=(await database.query("select config_revision from public.sms_provider_settings where id='vodafone'")).rows[0].config_revision
   assert.equal((await workers[0].query('select public.sms_begin_dispatch($1,$2,$3) result',[job.id,job.lease_token,revision])).rows[0].result,true)
   await blocker.query('begin');await blocker.query("select id from public.sms_provider_settings where id='vodafone' for update");await blocker.query("select id from public.email_provider_settings where id='brevo' for update")
   const pending=workers[0].query('select public.sms_check_dispatch($1,$2,$3) result',[job.id,job.lease_token,revision]);await blocked(1)
   const s=await f.settings('approved');await blocker.query('select public.after_sales_communication_configure($1,$2)',[f.owner,{purpose:'approved',revision:s.revision,is_enabled:false,sms_enabled:false,email_enabled:false,sms_template_en:null,sms_template_ar:null,email_template_en:null,email_template_ar:null,sms_sender:'',email_sender:''}]);await blocker.query('commit')
   assert.equal((await pending).rows[0].result,false)
   await workers[0].query("select public.sms_finish($1,$2,'{\"status\":\"failed\",\"category\":\"configuration\"}')",[job.id,job.lease_token])
   const email=(await f.intents(next.id)).find(r=>r.channel==='email');assert.equal(email.status,'queued');assert.equal((await database.query('select state from public.email_messages where id=$1',[email.email_message_id])).rows[0].state,'accepted')
   await f.configure('approved')
  })
  await t.test('Claims settings disable committed before waiting Email dispatch suppresses central delivery',async()=>{
   const next=await review();await f.action(next.id,'approve');await f.prepare('email');await f.unthrottle();const lease=await emailRpc(f.client,'claim')
   const row=(await f.intents(next.id)).find(r=>r.channel==='email');assert.equal(lease.id,row.email_message_id)
   await blocker.query('begin');await blocker.query("select id from public.sms_provider_settings where id='vodafone' for update");await blocker.query("select id from public.email_provider_settings where id='brevo' for update")
   const pending=emailRpc(clients[0],'dispatch',{id:lease.id,work_token:lease.work_token});await blocked(1)
   const s=await f.settings('approved');await blocker.query("select public.after_sales_communication_configure($1,$2)",[f.owner,{purpose:'approved',revision:s.revision,is_enabled:false,sms_enabled:false,email_enabled:false,sms_template_en:null,sms_template_ar:null,email_template_en:null,email_template_ar:null,sms_sender:'',email_sender:''}]);await blocker.query('commit')
   assert.equal((await pending).allowed,false);assert.equal((await database.query('select state from public.email_messages where id=$1',[lease.id])).rows[0].state,'suppressed')
   assert.equal((await f.detail(next.id)).claim.status,'approved')
  })
  await t.test('private RLS/grants and canonical write guards deny browser and direct service mutations',async()=>{
   const browser=await database.connect('authenticated')
   for(const sql of ['select * from public.after_sales_communications','select * from public.after_sales_communication_settings',"select public.after_sales_communication_take('email')","select public.email_command_before_claim_communications('claim','{}',null)"])await assert.rejects(()=>browser.query(sql),/permission denied/)
   await assert.rejects(()=>workers[0].query("update public.after_sales_communication_settings set is_enabled=true"),/permission denied/)
   await assert.rejects(()=>database.query("update public.after_sales_communications set recipient='forged'"),/Canonical claim communication required/)
   const history=await f.rpc('after_sales_communication_history',{p_actor:f.owner,p_claim:c.id,p_page:1});assert.equal(history.items.length,2);assert.doesNotMatch(JSON.stringify(history),/purchase-contact|01012345678|payload|work_token|template_snapshot|Native approval/)
   await assert.rejects(()=>f.rpc('after_sales_communication_history',{p_actor:f.customer,p_claim:c.id,p_page:1}))
  })
 }finally{await database.close()}
})
