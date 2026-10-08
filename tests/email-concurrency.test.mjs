import test from 'node:test'
import assert from 'node:assert/strict'
import { createEmailNativeDatabase,emailNativeAvailable,nativeWaitFor } from './helpers/emailNativeDatabase.mjs'
import { createEmailFixture } from './helpers/emailFixture.mjs'
import { smsDatabaseClient } from './helpers/smsDatabase.mjs'
import { createEmailService,emailDigest,previewManualEmail,processEmailQueue } from '../server/utils/email/service.js'
import { emailRpc } from '../server/utils/email/core.js'
import { normalizeBrevoEvent } from '../server/utils/email/events.js'

test('native PostgreSQL independent-session email concurrency and final authorization',{skip:!emailNativeAvailable,timeout:60000},async t=>{
 const database=await createEmailNativeDatabase(),f=await createEmailFixture({database}),service=createEmailService(f.client)
 try{
  assert.ok(Number.parseInt(database.version,10)>=14)
  await f.activate();await f.saveTemplate(f.template('marketing'))
  const workers=await Promise.all([database.connect('service_role'),database.connect('service_role'),database.connect('service_role')]),clients=workers.map(c=>smsDatabaseClient(c)),blocker=await database.connect()
  const hold=async()=>{await blocker.query('begin');await blocker.query("select id from public.email_provider_settings where id='brevo' for update")}
  const blocked=count=>nativeWaitFor(async()=>Number((await database.query("select count(*) n from pg_stat_activity where pid=any($1::int[]) and wait_event_type='Lock'",[workers.map(c=>c.processID)])).rows[0].n)===count)
  let id,work
  await t.test('concurrent enqueue creates one content-bound durable intent',async()=>{
   const input=f.input();await hold()
   const pending=clients.map(c=>createEmailService(c).sendTransactional(input))
   await blocked(3);await blocker.query('commit');const values=await Promise.all(pending)
   assert.equal(values.filter(v=>!v.reused).length,1);assert.equal(new Set(values.map(v=>v.id)).size,1);id=values[0].id
   await assert.rejects(()=>createEmailService(clients[0]).sendTransactional({...input,body:'Different'}))
  })
  await t.test('concurrent claims create exactly one lease and attempt',async()=>{
   await f.unthrottle();await hold();const pending=clients.map(c=>emailRpc(c,'claim'))
   await blocked(3);await blocker.query('commit');const values=await Promise.all(pending)
   assert.equal(values.filter(Boolean).length,1);work=values.find(Boolean)
   assert.equal(work.id,id);assert.equal((await database.query('select count(*)::int n from public.email_attempts where message_id=$1',[id])).rows[0].n,1)
   assert.equal((await emailRpc(clients[0],'dispatch',{id})).allowed,false)
   assert.equal((await emailRpc(clients[0],'finish',{id,state:'failed'})).matched,false)
  })
  await t.test('racing dispatch calls authorize one POST boundary',async()=>{
   await hold();const pending=clients.map(c=>emailRpc(c,'dispatch',{id,work_token:work.work_token}))
   await blocked(3);await blocker.query('commit');const values=await Promise.all(pending)
   assert.equal(values.filter(v=>v.allowed).length,1)
   await emailRpc(f.client,'finish',{id,work_token:work.work_token,state:'accepted',provider_message_id:'native@relay.example.invalid',http_status:201})
  })
  await t.test('callback replay racing in independent transactions persists once',async()=>{
   const m=await f.message(id),event={...normalizeBrevoEvent({event:'delivered',email:m.recipient,'message-id':m.provider_message_id,ts_event:Math.floor(Date.now()/1000)}),config_revision:(await f.settings()).revision}
   await hold();const pending=clients.map(c=>emailRpc(c,'event',event))
   await blocked(3);await blocker.query('commit');const values=await Promise.all(pending)
   assert.equal(values.filter(v=>!v.replayed).length,1);assert.equal((await database.query('select count(*)::int n from public.email_events')).rows[0].n,1)
  })
  await t.test('callback waiting behind token revocation cannot record or suppress',async()=>{
   const m=await f.message(id),event={...normalizeBrevoEvent({event:'spam',email:m.recipient,'message-id':m.provider_message_id,ts_event:Math.floor(Date.now()/1000)}),config_revision:(await f.settings()).revision}
   await hold();const pending=Promise.allSettled([emailRpc(clients[0],'event',event)]);await blocked(1)
   const settings=await f.settings();await emailRpc(smsDatabaseClient(blocker),'settings',{revision:settings.revision,config:{...settings.config,webhook_enabled:false}},f.actors.owner)
   await blocker.query('commit');assert.equal((await pending)[0].status,'rejected')
   assert.equal((await database.query('select global_reason from public.email_preferences where recipient=$1',[m.recipient])).rows[0].global_reason,null)
  })
  await t.test('disable committed ahead of a waiting dispatch suppresses it',async()=>{
   await f.configure({is_enabled:true});await f.unthrottle();const queued=await service.sendTransactional(f.input()),lease=await emailRpc(f.client,'claim')
   await hold();const pending=emailRpc(clients[0],'dispatch',{id:lease.id,work_token:lease.work_token});await blocked(1)
   const settings=await f.settings();await emailRpc(smsDatabaseClient(blocker),'settings',{revision:settings.revision,config:{...settings.config,is_enabled:false}},f.actors.owner)
   await blocker.query('commit');assert.equal((await pending).allowed,false);assert.equal((await f.message(queued.id)).state,'suppressed')
   await f.configure({is_enabled:true});await f.unthrottle();assert.equal(await emailRpc(f.client,'claim'),null)
  })
  await t.test('staff revocation committed ahead of dispatch suppresses the manual intent',async()=>{
   const input=f.input(),preview=await previewManualEmail(f.client,input,f.actors.sender)
   const queued=await service.sendTransactional({...input,receipt:preview.receipt,confirmed:true,essential_confirmed:true},{actor:f.actors.sender}),lease=await emailRpc(f.client,'claim')
   await hold();const pending=emailRpc(clients[0],'dispatch',{id:lease.id,work_token:lease.work_token});await blocked(1)
   await blocker.query("update public.admin_users set is_active=false where id=$1",[f.actors.sender]);await blocker.query('commit')
   assert.equal((await pending).allowed,false);assert.equal((await f.message(queued.id)).error_category,'staff_permission')
  })
  await t.test('unsubscribe committed ahead of dispatch blocks marketing alone',async()=>{
   const input=f.input({recipient:'native-consent@email.example.invalid',sender:'marketing@email.example.invalid',template_key:'fixture_marketing',values:{reference:'X',customer_name:'Buyer',message:'Fixture'}})
   await emailRpc(f.client,'preference',{recipient:input.recipient,marketing_status:'subscribed',provenance:'Fixture consent',updated_at:null,global_reason:null},f.actors.owner)
   const queued=await service.sendMarketing(input),m=await f.message(queued.id),lease=await emailRpc(f.client,'claim'),token=m.text_body.match(/#([A-Za-z0-9_-]{43})/)[1]
   await hold();const pending=emailRpc(clients[0],'dispatch',{id:lease.id,work_token:lease.work_token});await blocked(1)
   await emailRpc(smsDatabaseClient(blocker),'unsubscribe',{token_hash:emailDigest(token)});await blocker.query('commit')
   assert.equal((await pending).allowed,false);assert.equal((await service.sendTransactional(f.input({recipient:m.recipient}))).state,'queued')
  })
  await t.test('crashed expired lease stays uncertain after recovery and cannot be reclaimed',async()=>{
   const lease=await emailRpc(f.client,'claim');assert.equal((await emailRpc(f.client,'dispatch',{id:lease.id,work_token:lease.work_token})).allowed,true)
   await f.fixtureWrite("update public.email_messages set started_at=clock_timestamp()-interval '3 minutes' where id=$1",[lease.id])
   assert.equal(await emailRpc(clients[0],'claim'),null);assert.equal((await f.message(lease.id)).state,'uncertain')
   assert.equal((await emailRpc(clients[1],'dispatch',{id:lease.id,work_token:lease.work_token})).allowed,false)
   assert.equal((await emailRpc(clients[2],'finish',{id:lease.id,work_token:lease.work_token,state:'accepted',provider_message_id:'late@relay.example.invalid'})).matched,false)
  })
  await t.test('provider acceptance followed by failed durable completion never resubmits',async()=>{
   const queued=await service.sendTransactional(f.input());await f.unthrottle();let calls=0
   const provider={submit:async(_s,_k,_m,before)=>{await before();calls++;return {state:'accepted',provider_message_id:'commit-failure@relay.example.invalid',http_status:201}}}
   await database.exec("create function public.email_fixture_finish_failure() returns trigger language plpgsql as $$begin if new.state='accepted' then raise exception 'fixture completion outage';end if;return new;end$$;create trigger email_fixture_finish_failure before update on public.email_attempts for each row execute function public.email_fixture_finish_failure()")
   await assert.rejects(()=>processEmailQueue(f.client,{provider}))
   const m=await f.message(queued.id);assert.equal(m.state,'processing');assert.equal(m.provider_message_id,null);assert.ok(m.dispatched_at)
   await database.exec('drop trigger email_fixture_finish_failure on public.email_attempts;drop function public.email_fixture_finish_failure()')
   await f.fixtureWrite("update public.email_messages set started_at=clock_timestamp()-interval '3 minutes' where id=$1",[m.id]);await f.unthrottle()
   assert.deepEqual(await processEmailQueue(clients[0],{provider}),[]);assert.equal((await f.message(m.id)).state,'uncertain');assert.equal(calls,1)
  })
 }finally{await database.close()}
})
