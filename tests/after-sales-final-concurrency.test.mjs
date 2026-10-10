import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { createEmailNativeDatabase,emailNativeAvailable,nativeWaitFor } from './helpers/emailNativeDatabase.mjs'
import { createClaimsFixture } from './helpers/claimsFixture.mjs'
import { attachClaimCommunicationsFixture } from './helpers/claimCommunicationsFixture.mjs'

const migrationDirectory=new URL('../supabase/migrations/',import.meta.url)
const first='20261008120000_after_sales_claims_core.sql'

test('native populated checkpoint 63 upgrades through all four migrations and preserves old application contracts',{skip:!emailNativeAvailable,timeout:60000},async t=>{
 const db=await createEmailNativeDatabase({stopBefore:first}),f=await createClaimsFixture({database:db})
 try{
  const historical=await f.checkout(),preorder=await f.checkout({preorder:true,method:'bank_transfer'}),card=await f.checkout({method:'card'})
  await db.query("insert into public.customer_order_items(order_id,product_title,quantity,unit_price,line_total) values($1,'Historical unknown imported item',1,20,20)",[historical.id])
  await f.enable();const purchased=await f.purchase(2)
  const attempt=(await db.query("select public.commerce_claim_payment_attempt($1,$2,'test',1) result",[card.id,f.customer])).rows[0].result.attempt
  await db.query("insert into public.payment_transactions(attempt_id,provider,transaction_id,status) values($1,'paymob','audit-historical-test','pending')",[attempt.id])
  const outbound=(await db.query("insert into public.shipping_order_jobs(order_id,to_ref,awb,state) values($1,$2,'AUDIT-OUTBOUND','ready') returning *",[historical.id,historical.order_number])).rows[0]
  await db.query("select public.shipping_record_pdc_event($1)",[JSON.stringify({ref:outbound.to_ref,awb:outbound.awb,status_id:12,status_name:'Picked Up',status_date:new Date().toISOString(),source:'webhook',event_key:'audit-historical-outbound'})])
  await db.query("insert into public.support_tickets(customer_id,customer_email,subject,order_id,idempotency_key) values($1,'buyer@example.invalid','Existing support case',$2,$3)",[f.customer,historical.id,randomUUID()])
  await db.query("insert into public.chat_conversations(customer_id,contact_name,contact_email,creation_key,order_id) values($1,'Fixture customer','buyer@example.invalid',$2,$3)",[f.customer,randomUUID(),historical.id])
  const tables=(await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows.map(r=>r.tablename)
  const columns=Object.fromEntries(await Promise.all(tables.map(async table=>[table,(await db.query("select column_name from information_schema.columns where table_schema='public' and table_name=$1 order by ordinal_position",[table])).rows.map(r=>r.column_name)])))
  const snapshot=async()=>Object.fromEntries(await Promise.all(tables.map(async table=>[table,(await db.query('select (select jsonb_object_agg(k,v) from jsonb_each(to_jsonb(t)) e(k,v) where k=any($1::text[])) row from public."'+table+'" t order by to_jsonb(t)::text',[columns[table]])).rows.map(r=>r.row)])))
  const before=await snapshot(),functions=(await db.query("select proname,pg_get_function_identity_arguments(oid) args,prosrc from pg_proc where pronamespace='public'::regnamespace and proname not in ('default_admin_permissions','system_reset_plan') order by oid")).rows
  const authBefore=(await db.query('select to_jsonb(t) row from auth.users t order by id')).rows
  const objectsBefore=(await db.query('select to_jsonb(t) row from storage.objects t order by id')).rows
  const bucketsBefore=(await db.query('select to_jsonb(t) row from storage.buckets t order by id')).rows
  const unvalidatedBefore=(await db.query("select conrelid::regclass::text relation,conname from pg_constraint where connamespace='public'::regnamespace and not convalidated order by relation,conname")).rows
  const migrations=(await readdir(migrationDirectory)).filter(n=>n.endsWith('.sql')).sort()
  assert.equal(migrations.length,67);assert.equal(migrations.filter(n=>n<first).length,63)
  await t.test('64, 65, 66 and 67 apply in order over populated native data without changing old columns',async()=>{
   for(const name of migrations.filter(n=>n>=first))await db.exec(await readFile(new URL(name,migrationDirectory),'utf8'))
   assert.deepEqual(await snapshot(),before)
   assert.deepEqual((await db.query('select to_jsonb(t) row from auth.users t order by id')).rows,authBefore)
   assert.deepEqual((await db.query('select to_jsonb(t) row from storage.objects t order by id')).rows,objectsBefore)
   assert.deepEqual((await db.query("select to_jsonb(t) row from storage.buckets t where id<>'after-sales-evidence' order by id")).rows,bucketsBefore)
   for(const fn of functions){
    const renamed=fn.proname==='shipping_record_pdc_event'?'shipping_record_pdc_event_outbound':fn.proname==='sms_check_dispatch'?'sms_check_dispatch_before_claim_communications':fn.proname
    assert.equal((await db.query('select prosrc from pg_proc where pronamespace=$1::regnamespace and proname=$2 and pg_get_function_identity_arguments(oid)=$3',['public',renamed,fn.args])).rows[0].prosrc,fn.prosrc,fn.proname)
   }
   assert.deepEqual((await db.query("select conrelid::regclass::text relation,conname from pg_constraint where connamespace='public'::regnamespace and not convalidated order by relation,conname")).rows,unvalidatedBefore)
  })
  await t.test('new tables have no historical claims, shipments, mail or sendable channel backlog',async()=>{
   for(const table of ['after_sales_claims','after_sales_claim_events','after_sales_claim_information','after_sales_claim_evidence','shipping_claim_jobs','email_messages','email_attempts','email_events','after_sales_communications'])assert.equal((await db.query('select count(*)::int n from public.'+table)).rows[0].n,0,table)
   assert.equal((await db.query('select count(*)::int n from public.after_sales_communication_settings where is_enabled or sms_enabled or email_enabled')).rows[0].n,0)
   assert.equal((await db.query("select reverse_enabled from public.shipping_provider_settings where id='pdc'")).rows[0].reverse_enabled,false)
   assert.equal((await db.query("select (config->>'is_enabled')::boolean enabled from public.email_provider_settings where id='brevo'")).rows[0].enabled,false)
   assert.ok(Object.entries((await db.query('select public.default_admin_permissions() p')).rows[0].p).filter(([k])=>k.startsWith('claims.')||k.startsWith('email.')).every(([,v])=>v===false))
  })
  await t.test('old checkout, preorder, owned policy, outbound tracking and Order/PDC SMS signatures still work',async()=>{
   assert.equal((await f.checkout()).payment_status,'pending')
   assert.equal((await f.checkout({preorder:true,method:'bank_transfer'})).is_preorder,true)
   assert.ok((await f.rpc('after_sales_claim_items',{p_customer:f.customer,p_order:historical.id})).items.length)
   const result=(await db.query('select public.shipping_record_pdc_event($1) r',[JSON.stringify({ref:outbound.to_ref,awb:outbound.awb,status_id:12,status_name:'Picked Up',status_date:new Date().toISOString(),source:'webhook',event_key:'audit-historical-outbound'})])).rows[0].r
   assert.equal(result.duplicate,true)
   assert.equal((await db.query('select awb from public.shipping_order_jobs where id=$1',[outbound.id])).rows[0].awb,'AUDIT-OUTBOUND')
   for(const name of ['sms_enqueue','sms_claim','sms_begin_dispatch','sms_check_dispatch','sms_finish','sms_claim_order_event'])assert.ok((await db.query("select 1 from pg_proc where pronamespace='public'::regnamespace and proname=$1",[name])).rows.length,name)
   assert.equal((await db.query('select after_sales_policy_version_id from public.customer_order_items where id=$1',[purchased.id])).rows[0].after_sales_policy_version_id,purchased.after_sales_policy_version_id)
   assert.ok(preorder.id)
  })
  console.log(JSON.stringify({audit:'native checkpoint upgrade',version:db.version,migrations:4,preservedTables:tables.length,preservedFunctions:functions.length,populatedTables:Object.values(before).filter(r=>r.length).length,preexistingUnvalidatedConstraints:unvalidatedBefore}))
 }finally{await db.close()}
})

test('native final integration races serialize quantities, evidence, reverse acceptance and milestone persistence',{skip:!emailNativeAvailable,timeout:60000},async t=>{
 const db=await createEmailNativeDatabase(),f=await attachClaimCommunicationsFixture(await createClaimsFixture({database:db}))
 try{
  await f.enable();await f.enableCommunications();await f.reverseConfigure()
  const workers=await Promise.all([db.connect('service_role'),db.connect('service_role'),db.connect('service_role')]),blocker=await db.connect()
  const wait=count=>nativeWaitFor(async()=>Number((await db.query("select count(*) n from pg_stat_activity where pid=any($1::int[]) and wait_event_type='Lock'",[workers.map(w=>w.processID)])).rows[0].n)===count)
  const barrier=async(item,operations)=>{
   await blocker.query('begin');await blocker.query('select id from public.customer_order_items where id=$1 for update',[item.id])
   const results=Promise.allSettled(operations());await wait(workers.length);await blocker.query('commit');return results
  }
  const approved=async()=>{const item=await f.purchase(),c=await f.create(f.body(item));await f.action(c.id,'review');await f.action(c.id,'approve');return {...c,item}}
  await t.test('cross-type independent customer sessions cannot reserve more units than purchased',async()=>{
   const item=await f.purchase(2),inputs=[f.body(item,'return',{quantity:2}),f.body(item,'warranty'),f.body(item,'return')]
   const results=await barrier(item,()=>workers.map((w,i)=>w.query('select public.after_sales_claim_create($1,$2) r',[f.customer,inputs[i]])))
   assert.ok(results.some(r=>r.status==='fulfilled'));assert.ok(results.some(r=>r.status==='rejected'))
   assert.ok((await db.query("select coalesce(sum(quantity),0)::int n from public.after_sales_claims where item_id=$1 and status not in ('rejected','cancelled')",[item.id])).rows[0].n<=2)
  })
  await t.test('submission racing removal cannot attach tombstoned evidence',async()=>{
   const item=await f.purchase(),evidence=await f.evidence(item),input=f.body(item,'return',{attachment_ids:[evidence]})
   const results=await barrier(item,()=>[
    workers[0].query('select public.after_sales_claim_create($1,$2) r',[f.customer,input]),
    workers[1].query('select public.after_sales_claim_finish_evidence($1,$2,true) r',[f.customer,evidence]),
    workers[2].query('select public.after_sales_claim_create($1,$2) r',[f.customer,input])
   ])
   const e=(await db.query('select * from public.after_sales_claim_evidence where id=$1',[evidence])).rows[0]
   assert.ok(results.some(r=>r.status==='rejected'))
   if(e.claim_id)assert.equal(e.removed_at,null);else assert.ok(e.removed_at)
   assert.equal((await db.query('select count(*)::int n from public.after_sales_claims where item_id=$1',[item.id])).rows[0].n,e.claim_id?1:0)
  })
  let c,work
  await t.test('three staff booking sessions using one request commit one ASREV job',async()=>{
   c=await approved();const revision=(await f.detail(c.id)).claim.revision,key=randomUUID(),input=f.input()
   const results=await barrier(c.item,()=>workers.map(w=>w.query('select public.shipping_claim_schedule($1,$2,$3,$4,$5,true) r',[f.owner,c.id,revision,key,input])))
   assert.ok(results.every(r=>r.status==='fulfilled'));assert.equal(new Set(results.map(r=>r.value.rows[0].r.id)).size,1)
   assert.equal((await db.query('select count(*)::int n from public.shipping_claim_jobs where claim_id=$1',[c.id])).rows[0].n,1)
  })
  await t.test('concurrent independent workers lease a reverse booking once',async()=>{
   const results=await barrier(c.item,()=>workers.map(w=>w.query('select public.shipping_claim_take(true,25) r')))
   const jobs=results.flatMap(r=>r.value.rows[0].r);assert.equal(jobs.length,1);work=jobs[0]
  })
  await t.test('an outbox insert outage rolls back accepted AWB/status; reference recovery commits once after repair',async()=>{
   await db.exec("create function public.final_audit_outbox_fail() returns trigger language plpgsql as $$begin raise exception 'audit outbox outage';end$$;create trigger final_audit_outbox_fail before insert on public.after_sales_communications for each row execute function public.final_audit_outbox_fail()")
   await assert.rejects(()=>f.finish(work,'created','AUDIT-NATIVE-REVERSE'),/audit outbox outage/)
   assert.equal((await f.job(work.id)).awb,null);assert.equal((await f.detail(c.id)).claim.status,'approved')
   await db.exec('drop trigger final_audit_outbox_fail on public.after_sales_communications;drop function public.final_audit_outbox_fail()')
   const results=await barrier(c.item,()=>workers.map(w=>w.query("select public.shipping_claim_finish($1,$2,'created',$3,'AUDIT-NATIVE-REVERSE',null) r",[work.id,work.token,work.to_ref])))
   assert.ok(results.every(r=>r.status==='fulfilled'))
   assert.equal((await f.intents(c.id)).filter(r=>r.purpose==='pickup_scheduled').length,2)
  })
  await t.test('webhook/reconciliation overlap advances Received once and older/97 observations cannot regress it',async()=>{
   const j=await f.job(work.id),date=new Date(Date.now()+1000).toISOString(),update=f.event(j,5,{status_date:date,observed_at:date,event_key:'audit-native-delivered'})
   const results=await barrier(c.item,()=>workers.map((w,i)=>w.query('select public.shipping_record_pdc_event($1) r',[{...update,source:i?'reconciliation':'webhook'}])))
   assert.ok(results.every(r=>r.status==='fulfilled'));assert.equal((await f.detail(c.id)).claim.status,'received')
   assert.equal((await f.intents(c.id)).filter(r=>r.purpose==='received').length,2)
   await f.record(f.event(j,97,{status_date:new Date(Date.now()+2000).toISOString()}))
   await f.record(f.event(j,12,{status_date:new Date(Date.now()-1000).toISOString()}))
   assert.equal((await f.detail(c.id)).claim.status,'received')
   assert.equal((await db.query("select count(*)::int n from public.sms_order_events where event_type like 'pdc_%'")).rows[0].n,0)
  })
  await t.test('shared native AWB lock prevents collisions across outbound and two reverse bookings',async()=>{
   const claims=[await approved(),await approved()]
   for(const claim of claims)await f.schedule(claim.id)
   const jobs=await f.take(),order=await f.checkout(),awb='AUDIT-NATIVE-SHARED-AWB'
   await blocker.query('begin');await blocker.query("select pg_advisory_xact_lock(hashtextextended('pdc:awb:'||$1,0))",[awb])
   const outboundSession=await db.connect()
   const pending=Promise.allSettled([
    ...jobs.map((job,i)=>workers[i].query("select public.shipping_claim_finish($1,$2,'created',$3,$4,null) r",[job.id,job.token,job.to_ref,awb])),
    outboundSession.query("insert into public.shipping_order_jobs(order_id,to_ref,awb,state) values($1,$2,$3,'ready')",[order.id,order.order_number,awb])
   ])
   try{await nativeWaitFor(async()=>Number((await db.query("select count(*) n from pg_stat_activity where pid=any($1::int[]) and wait_event_type='Lock'",[[workers[0].processID,workers[1].processID,outboundSession.processID]])).rows[0].n)===3)}finally{await blocker.query('commit')}
   const results=await pending
   assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.code==='23505').length,2)
   assert.equal((await db.query('select (select count(*) from public.shipping_order_jobs where awb=$1)+(select count(*) from public.shipping_claim_jobs where awb=$1) n',[awb])).rows[0].n,'1')
  })
  await t.test('all integrated private tables/RPCs and restrictive Storage boundaries deny native browser roles',async()=>{
   const browser=await db.connect('authenticated'),tables=['after_sales_claims','after_sales_claim_events','after_sales_claim_information','after_sales_claim_evidence','shipping_claim_jobs','email_provider_settings','email_templates','email_preferences','email_messages','email_attempts','email_events','after_sales_communication_settings','after_sales_communications']
   for(const table of tables){
    const privileges=(await db.query("select relrowsecurity,has_table_privilege('anon',oid,'SELECT') anon,has_table_privilege('authenticated',oid,'SELECT') browser,has_table_privilege('service_role',oid,'INSERT,UPDATE,DELETE') direct_write from pg_class where oid=$1::regclass",['public.'+table])).rows[0]
    assert.deepEqual(privileges,{relrowsecurity:true,anon:false,browser:false,direct_write:false},table)
    await assert.rejects(()=>browser.query('select * from public.'+table),/permission denied/)
   }
   const functions=(await db.query("select proname,proconfig,has_function_privilege('anon',oid,'EXECUTE') anon,has_function_privilege('authenticated',oid,'EXECUTE') browser from pg_proc where pronamespace='public'::regnamespace and prosecdef and (proname like 'after_sales_claim_%' or proname like 'after_sales_communication_%' or proname='after_sales_capture_communication' or proname like 'shipping_claim_%' or proname in ('shipping_record_claim_pdc_event','email_command','email_command_before_claim_communications','sms_check_dispatch','sms_check_dispatch_before_claim_communications'))")).rows
   assert.ok(functions.length>35);assert.ok(functions.every(r=>!r.anon&&!r.browser&&r.proconfig.includes('search_path=""')))
   await db.exec("grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;create policy final_audit_broad_storage on storage.objects for all to authenticated using(true) with check(true)")
   await db.query("insert into storage.objects(bucket_id,name) values('after-sales-evidence','fixture/private.png'),('shipping-labels','claims/fixture/private.pdf'),('public-fixture','allowed.png')")
   assert.deepEqual((await browser.query('select name from storage.objects order by name')).rows,[{name:'allowed.png'}])
   for(const bucket of ['after-sales-evidence','shipping-labels'])await assert.rejects(()=>browser.query('insert into storage.objects(bucket_id,name) values($1,$2)',[bucket,bucket==='shipping-labels'?'claims/forged.pdf':'forged.png']),/row-level security/)
  })
  console.log(JSON.stringify({audit:'native final integration races',version:db.version,independentWorkerSessions:workers.length,observedLockBarriers:7}))
 }finally{await db.close()}
})
