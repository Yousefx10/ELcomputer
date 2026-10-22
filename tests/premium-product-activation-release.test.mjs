import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,readdir,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {randomUUID} from 'node:crypto'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {argumentsFor} from '../scripts/premium-product-release/activation-operator.mjs'
import {assertCommittedState,committedReleaseEvidence} from '../scripts/premium-product-release/activation-approval.mjs'
import {hash,productMigration,applyMigration,checkDatabase,compareOriginal} from '../scripts/premium-product-release/database.mjs'
import {approvalState,digest} from '../scripts/live-sales-release/operator.mjs'
import {json as certificateJson} from '../scripts/lib/cleanBaseline.mjs'
import {createEmailNativeDatabase,emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'
import {createProductSaveFixture} from './helpers/productSaveFixture.mjs'
const run=promisify(execFile)
test('application-only activation preserves consumed executors and requires a full new seal',async()=>{
 for(const file of ['operator.mjs','database.mjs','remote.py','application-scope.json','recovery-operator.mjs','recovery-approval.mjs'])assert.equal(hash(await readFile('scripts/premium-product-release/'+file)),hash((await run('git',['show','a2b0637:scripts/premium-product-release/'+file],{encoding:'buffer'})).stdout))
 for(const args of [[],['apply','plan'],['apply','plan','--approved','short'],['apply','plan','--force','a'.repeat(64)]])assert.throws(()=>argumentsFor(args))
 assert.equal(argumentsFor(['apply','plan','--approved','a'.repeat(64)]).approval,'a'.repeat(64))
 const source=await readFile('scripts/premium-product-release/activation-operator.mjs','utf8');assert.doesNotMatch(source,/applyMigration|readOnly:\s*false/);assert.match(source,/migrations:\[\],database_writes:0/)
})
test('application-only remote fault matrix passes without SSH, network, systemd or SQL',async()=>{
 const {stdout,stderr}=await run('/usr/bin/python3',['-B','tests/premium_product_activation_test.py']);assert.match(stdout+stderr,/Ran 9 tests/);assert.match(stdout+stderr,/OK/)
})
test('owned schema89 read-only activation permits only established telemetry and Auth activity',{skip:!emailNativeAvailable,timeout:120000},async t=>{
 const db=await createEmailNativeDatabase({stopBefore:productMigration});let owner
 try{
  const f=await createProductSaveFixture({database:db});await f.save(f.body({is_published:true}));await f.save(f.body())
  await db.query("update public.site_settings set footer_style='modern',footer_modern_config=$1,payment_cash_enabled=true,payment_card_enabled=true,payment_instapay_enabled=true where key='default'",[{version:1,brand:{description:'Retained footer content'}}])
  const files=[];for(const filename of(await readdir('supabase/migrations')).filter(n=>n.endsWith('.sql')).sort()){const text=await readFile('supabase/migrations/'+filename,'utf8');files.push({filename,text,sha256:hash(text),version:filename.slice(0,14),name:filename.slice(15,-4)})}
  const release={history:files.slice(0,88),pending:files.slice(88),certificate_history:files.slice(0,82).map(m=>({statements_sha256:hash(certificateJson([m.text]))}))}
  await db.exec('create schema supabase_migrations authorization postgres;create table supabase_migrations.schema_migrations(version text primary key,statements text[],name text);alter table supabase_migrations.schema_migrations owner to postgres')
  for(const m of release.history)await db.query('insert into supabase_migrations.schema_migrations values($1,$2,$3)',[m.version,[m.text],m.name])
  for(const schema of ['public','private','catalog_private']){
   for(const r of(await db.query("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=$1 and c.relkind='r'",[schema])).rows)await db.exec('alter table '+schema+'."'+r.relname+'" owner to postgres')
   for(const r of(await db.query("select p.oid::regprocedure::text signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=$1 and p.prokind='f'",[schema])).rows)await db.exec('alter function '+r.signature+' owner to postgres')
   await db.exec('alter schema '+schema+' owner to postgres')
  }
  await db.exec('grant usage on schema auth,storage to postgres;grant select on all tables in schema auth,storage to postgres')
  owner=await db.connect('postgres');assert.equal((await owner.query('select rolsuper from pg_roles where rolname=current_user')).rows[0].rolsuper,false)

  const observe=async()=>{await owner.query('begin isolation level repeatable read read only');try{const result=await checkDatabase(owner,release,{after:true});await owner.query('commit');return result}catch(e){await owner.query('rollback');throw e}}
  // The owned minimal Auth fixture omits the hosted activity timestamps.
  await db.exec('alter table auth.users add column last_sign_in_at timestamptz, add column updated_at timestamptz')
  await owner.query('begin isolation level repeatable read read only');const initial=await checkDatabase(owner,release);await owner.query('commit')
  const seal='a'.repeat(64),receipt=await applyMigration(owner,release,{seal,approval:seal}),sourcePlan={migration_sha256:release.pending[0].sha256,database:initial},beforeActivity=await observe();let stable
  await t.test('a fresh read-only connection observes the committed ledger without rerunning SQL',async()=>{
   assert.equal(beforeActivity.history.length,89);assert.equal(beforeActivity.read_only,'on');assert.doesNotThrow(()=>assertCommittedState(beforeActivity,receipt,sourcePlan))
   await owner.query('begin read only');await assert.rejects(()=>owner.query("update public.site_settings set site_name=site_name"),e=>e.code==='25006');await owner.query('rollback')
   assert.deepEqual(approvalState(await observe()),approvalState(beforeActivity))
  })
  await t.test('real postcommit analytics growth reproduces the old failure and passes the established policy',async()=>{
   const session=randomUUID(),visitor=randomUUID()
   await db.query('insert into public.store_analytics_sessions(id,visitor_id) values($1,$2)',[session,visitor])
   await db.query("insert into public.store_analytics_events(event_id,session_id,visitor_id,event_name,path) values($1,$2,$3,'page_view','/owned-fixture')",[randomUUID(),session,visitor])
   await assert.rejects(()=>compareOriginal(owner,initial.protected_tables,{authSecurity:initial.auth_security}),/store_analytics_events/)
   stable=await observe();const telemetry=assertCommittedState(stable,receipt,sourcePlan);assert.equal(telemetry.length,2);assert.ok(telemetry.every(v=>v.count===1))
  })
  await t.test('every other table, all schema/security fields and Auth identity remain bound',()=>{
   for(const table of stable.protected_tables){
    if(table.schema==='public'&&['store_analytics_events','store_analytics_sessions'].includes(table.name))continue
    const changed={...stable,protected_tables:stable.protected_tables.map(v=>v===table?{...v,count:v.count+1,sha256:'f'.repeat(64)}:v)}
    assert.throws(()=>assertCommittedState(changed,receipt,sourcePlan),undefined,table.schema+'.'+table.name+' remains protected')
   }
   for(const key of ['history','controls','pdc','access','auth_security','schema'])assert.throws(()=>assertCommittedState({...stable,[key]:{}},receipt,sourcePlan))
   for(const mode of ['off',null,undefined])assert.throws(()=>assertCommittedState({...stable,read_only:mode},receipt,sourcePlan),/must be read-only/)
   const telemetry=stable.protected_tables.find(v=>v.name==='store_analytics_events')
   assert.throws(()=>assertCommittedState({...stable,protected_tables:stable.protected_tables.map(v=>v===telemetry?{...v,columns:[...v.columns,'unexpected']}:v)},receipt,sourcePlan))
   assert.throws(()=>assertCommittedState({...stable,schema:{...stable.schema,relations:stable.schema.relations.slice(1)}},receipt,sourcePlan))
  })
  await t.test('the existing Auth activity projection permits timestamps but rejects identity changes',async()=>{
   await db.query('update auth.users set last_sign_in_at=now(),updated_at=now() where id=$1',[f.actors.owner]);stable=await observe();assert.doesNotThrow(()=>assertCommittedState(stable,receipt,sourcePlan))
   const changed={...stable,auth_security:{...stable.auth_security,sha256:'f'.repeat(64)}};assert.throws(()=>assertCommittedState(changed,receipt,sourcePlan))
  })
  await t.test('committed predecessor evidence rejects tampering, altered artifacts and prior activation',async()=>{
   const root=await mkdtemp(join(tmpdir(),'pdp-activation-proof-')),stage=join(root,'prepared-recovery'),save=async(name,value)=>writeFile(join(root,name),JSON.stringify(value))
   try{
    await mkdir(stage);await mkdir(join(root,'recovery-artifact-browser'));const archive=Buffer.from('Owned archive evidence'),entries=[]
    const qualification={result:'PASS',application_commit:'owned-commit',evidence_sha256:{}};await save('qualification.json',qualification)
    const plan={...sourcePlan,format:2,before:{current:'/owned/releases/previous'},application_commit:'owned-commit',release_id:'b'.repeat(16),tools:{},archive_sha256:hash(archive),inventory_sha256:digest(entries),qualification:{file:join(root,'qualification.json'),sha256:hash(JSON.stringify(qualification))}};plan.seal=digest(plan)
    await save('prepared-recovery/plan.json',plan);await save('prepared-recovery/execution-intent.json',{plan_sha256:plan.seal,automatic_retry:false})
    await save('prepared-recovery/STOP.json',{result:'STOP',phase:'schema89 private candidate',error_type:'AssertionError',code:'ERR_ASSERTION',automatic_retry:false,automatic_rollback:false})
    await save('prepared-recovery/migration-before-commit.json',receipt);await save('prepared-recovery/migration-committed.json',receipt)
    await save('SCHEMA89-STOP-DIAGNOSIS.json',{result:'READ_ONLY_FAILURE_REPRODUCED',plan:plan.seal,migration_committed:true,activation_attempted:false,steps:[{result:'FAIL',phase:'compareOriginal135',short_message:'Existing row changed: "public"."store_analytics_events"'}]})
    await save('SCHEMA89-PRESERVATION-VERIFICATION.json',{result:'PASS_PROTECTED_STATE_PRESERVED',source_seal:plan.seal,all135_original_tables_verified_at_commit:true,all_non_telemetry_data_matches_commit:true})
    await save('schema89-stopped-runtime.json',plan.before);await save('schema89-stopped-database.json',stable);await save('schema89-stopped-http.json',{})
    await save('recovery-artifact-browser/browser-report.json',{checks:Array(266).fill('owned'),errors:[],external:[],restFailures:[]});await save('recovery-artifact-browser/dashboard-report.json',{})
    await save('FINAL-RECOVERY-PREPARATION-RECEIPT.json',{seal:plan.seal,result:'READY_FOR_FINAL_OWNER_APPROVAL',evidence_sha256:{'recovery-artifact-browser/browser-report.json':hash(await readFile(join(root,'recovery-artifact-browser/browser-report.json')))}})
    await writeFile(join(stage,'release.tar.gz'),archive);await save('prepared-recovery/inventory.json',entries)
    assert.equal((await committedReleaseEvidence(join(stage,'plan.json'))).result,'SCHEMA89_COMMITTED_ACTIVATION_NOT_ATTEMPTED')
    for(const name of ['completed.json','runtime-after-activation.json','remote-candidate89.json','database-preactivation.json']){await save('prepared-recovery/'+name,{});await assert.rejects(()=>committedReleaseEvidence(join(stage,'plan.json')),/unexpected candidate/);await rm(join(stage,name))}
    await writeFile(join(stage,'release.tar.gz'),'Altered');await assert.rejects(()=>committedReleaseEvidence(join(stage,'plan.json')));await writeFile(join(stage,'release.tar.gz'),archive)
    await save('recovery-artifact-browser/browser-report.json',{checks:[],errors:[],external:[],restFailures:[]});await assert.rejects(()=>committedReleaseEvidence(join(stage,'plan.json')),/Qualified artifact evidence changed/)
   }finally{await rm(root,{recursive:true,force:true})}
  })
  await t.test('actual protected settings drift still blocks activation after legitimate analytics activity',async()=>{
   await db.query("update public.site_settings set payment_bank_transfer_enabled=true where key='default'");const changed=await observe();assert.throws(()=>assertCommittedState(changed,receipt,sourcePlan),/Protected committed state changed/)
  })
 }finally{await owner?.end();await db.close()}
})
