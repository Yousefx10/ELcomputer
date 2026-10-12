import test from 'node:test'
import assert from 'node:assert/strict'
import { createEmailNativeDatabase, emailNativeAvailable, nativeWaitFor } from './helpers/emailNativeDatabase.mjs'
import { createSetupFixture } from './helpers/setupFixture.mjs'
import { smsDatabaseClient } from './helpers/smsDatabase.mjs'
import { readQuickSetupProgress, mutateQuickSetup } from '../server/utils/quickSetupProgress.js'

test('native PostgreSQL setup commands serialize owner, configuration and audit boundaries', { skip: !emailNativeAvailable, timeout: 60000 }, async t => {
 const database=await createEmailNativeDatabase(),f=await createSetupFixture({database})
 try {
  const workers=await Promise.all([database.connect('service_role'),database.connect('service_role'),database.connect('service_role')]),clients=workers.map(c=>smsDatabaseClient(c)),blocker=await database.connect()
  const blocked=count=>nativeWaitFor(async()=>Number((await database.query("select count(*) n from pg_stat_activity where pid=any($1::int[]) and wait_event_type='Lock'",[workers.map(c=>c.processID)])).rows[0].n)===count)
  const get=()=>readQuickSetupProgress(f.client,f.runtime)
  await t.test('three independently blocked writes with one expected revision commit once',async()=>{
   await blocker.query('begin');await blocker.query('select * from public.quick_setup_state where singleton for update')
   const s=await get(),input={action:'selection',key:'brevo',selected:true,revision:s.setup.revision}
   const pending=Promise.allSettled(clients.map(c=>mutateQuickSetup(c,f.runtime,f.actors.owner,input)))
   await blocked(3);await blocker.query('commit');const results=await pending
   assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
   assert.ok(results.filter(r=>r.status==='rejected').every(r=>r.reason.statusCode===409))
   assert.equal((await get()).setup.revision,s.setup.revision+1)
   assert.equal((await database.query('select count(*)::int n from public.quick_setup_events')).rows[0].n,1)
  })
  await t.test('configuration committed ahead of the counter lock rejects old evidence atomically',async()=>{
   const s=await get(),binding=s.items.find(i=>i.id==='branding').evidence.basisToken
   await blocker.query('begin');await blocker.query("select * from public.quick_setup_revisions where domain='branding' for update")
   const pending=Promise.allSettled([mutateQuickSetup(clients[0],f.runtime,f.actors.owner,{action:'capture',key:'branding',revision:s.setup.revision,basisToken:binding})])
   await blocked(1);await blocker.query("update public.site_settings set site_name='Native configuration change' where key='default'");await blocker.query('commit')
   const [result]=await pending;assert.equal(result.status,'rejected');assert.equal(result.reason.statusCode,409)
   assert.equal((await get()).setup.revision,s.setup.revision)
   assert.equal((await database.query('select count(*)::int n from public.quick_setup_events')).rows[0].n,1)
  })
  await t.test('owner revocation committed before owner authorization prevents the waiting command',async()=>{
   const s=await get();await blocker.query('begin');await blocker.query('select * from public.admin_users where id=$1 for update',[f.actors.owner])
   const pending=Promise.allSettled([mutateQuickSetup(clients[0],f.runtime,f.actors.owner,{action:'selection',key:'vodafone',selected:true,revision:s.setup.revision})])
   await blocked(1);await blocker.query('update public.admin_users set is_active=false where id=$1',[f.actors.owner]);await blocker.query('commit')
   const [result]=await pending;assert.equal(result.status,'rejected');assert.equal(result.reason.statusCode,403)
   assert.equal((await get()).setup.revision,s.setup.revision);await database.query('update public.admin_users set is_active=true where id=$1',[f.actors.owner])
  })
  await t.test('audit failure rolls back both state revision and verification history',async()=>{
   const s=await get();await database.exec("create function public.setup_fixture_audit_failure() returns trigger language plpgsql as $$begin if new.action_key like 'settings.quick_setup.%' then raise exception 'fixture audit outage';end if;return new;end$$;create trigger setup_fixture_audit_failure before insert on public.admin_activity_logs for each row execute function public.setup_fixture_audit_failure()")
   await assert.rejects(()=>mutateQuickSetup(clients[0],f.runtime,f.actors.owner,{action:'selection',key:'vodafone',selected:true,revision:s.setup.revision}),e=>e.statusCode===503)
   assert.equal((await get()).setup.revision,s.setup.revision);assert.equal((await database.query('select count(*)::int n from public.quick_setup_events')).rows[0].n,1)
   await database.exec('drop trigger setup_fixture_audit_failure on public.admin_activity_logs;drop function public.setup_fixture_audit_failure()')
  })
  await t.test('service role can read private metadata but cannot write tables or browser roles invoke commands',async()=>{
   const result=await workers[0].query('select revision from public.quick_setup_state');assert.equal(result.rows.length,1)
   await assert.rejects(()=>workers[0].query('update public.quick_setup_state set revision=revision+1'),/permission denied/)
   for(const role of ['anon','authenticated']){const c=await database.connect(role);await assert.rejects(()=>c.query('select * from public.quick_setup_snapshot'),/permission denied/);await assert.rejects(()=>c.query('select public.quick_setup_mutate($1,$2)',[f.actors.owner,{action:'selection',key:'brevo',selected:true,revision:1}]),/permission denied/)}
  })
 }finally{await database.close()}
})
