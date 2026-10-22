import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,readdir,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {argumentsFor} from '../scripts/premium-product-release/operator.mjs'
import {hash,migrations,productMigration,applyMigration,checkDatabase,snapshot,assertAdditive,schemaState} from '../scripts/premium-product-release/database.mjs'
import {json as certificateJson} from '../scripts/lib/cleanBaseline.mjs'
import {createEmailNativeDatabase,emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'
import {createProductSaveFixture} from './helpers/productSaveFixture.mjs'
const run=promisify(execFile)
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {assertLockedApprovalState,stoppedReleaseEvidence} from '../scripts/premium-product-release/recovery-approval.mjs'
import {argumentsFor as recoveryArguments} from '../scripts/premium-product-release/recovery-operator.mjs'
import {approvalState,digest} from '../scripts/live-sales-release/operator.mjs'

test('recovery keeps the consumed PDP and footer executors byte-identical',async()=>{
 for(const path of ['scripts/premium-product-release/operator.mjs','scripts/premium-product-release/database.mjs','scripts/premium-product-release/remote.py','scripts/premium-product-release/application-scope.json','scripts/footer-refinement-release/operator.mjs'])assert.equal(hash(await readFile(path)),hash((await run('git',['show','dfb9e8f:'+path],{encoding:'buffer'})).stdout))
 for(const args of [[],['apply','plan'],['apply','plan','--approved','short'],['apply','plan','--force','a'.repeat(64)]])assert.throws(()=>recoveryArguments(args))
 assert.equal(recoveryArguments(['apply','plan','--approved','a'.repeat(64)]).approval,'a'.repeat(64))
})
test('locked approval positively requires both transaction modes and every protected field',()=>{
 const approved={read_only:'on',protected_tables:[],history:[{version:'88'}],controls:{payment_card_enabled:true},pdc:{is_enabled:false},schema:{relations:[]},auth_security:{sha256:'retained'},access:{foundation:'PASS'}},locked={...structuredClone(approved),read_only:'off'}
 assert.doesNotThrow(()=>assertLockedApprovalState(locked,approved))
 for(const value of ['off',undefined,null])assert.throws(()=>assertLockedApprovalState(locked,{...approved,read_only:value}),/observation must be read-only/)
 for(const value of ['on',undefined,null])assert.throws(()=>assertLockedApprovalState({...locked,read_only:value},approved),/write transaction/)
 for(const key of ['protected_tables','history','controls','pdc','schema','auth_security','access']){
  const changed=structuredClone(locked);changed[key]={unexpected:true};assert.throws(()=>assertLockedApprovalState(changed,approved))
  const missing=structuredClone(locked);delete missing[key];assert.throws(()=>assertLockedApprovalState(missing,approved))
 }
 assert.throws(()=>assertLockedApprovalState({...locked,unknown:'drift'},approved))
})
test('replacement plans require complete immutable rollback evidence and reject a prior commit',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pdp-recovery-')),prepared=join(root,'prepared'),write=async(file,value)=>writeFile(join(root,file),JSON.stringify(value))
 try{
  await mkdir(prepared);const database={read_only:'on',protected_tables:[],history:[],auth_security:{}},runtime={current:'/owned/previous'},plan={tools:{},database,before:runtime,release_id:'1'.repeat(16)};plan.seal=digest(plan)
  await write('prepared/plan.json',plan);await write('prepared/execution-intent.json',{plan_sha256:plan.seal,automatic_retry:false})
  await write('prepared/STOP.json',{result:'STOP',phase:'locked additive migration89',error_type:'AssertionError',code:'ERR_ASSERTION',automatic_retry:false,automatic_rollback:false})
  await write('STOP-DIAGNOSIS.json',{result:'CONFIRMED_ROLLED_BACK',consumed_seal:plan.seal,production_schema:88,migration89_present:false,activation_attempted:false,production_matches_approved:true,production_diagnostic_writes:0,synthetic_assertion:{differing_top_level_keys:['read_only']}})
  await write('stopped-runtime.json',runtime);await write('stopped-database.json',database);await write('stopped-http.json',{result:'PASS'})
  const evidence=await stoppedReleaseEvidence(join(prepared,'plan.json'));assert.equal(evidence.seal,plan.seal);assert.equal(Object.keys(evidence.evidence_sha256).length,7)
  for(const file of ['completed.json','migration-before-commit.json','migration-committed.json','runtime-after-activation.json']){await write('prepared/'+file,{});await assert.rejects(()=>stoppedReleaseEvidence(join(prepared,'plan.json')),/unexpected commit/);await rm(join(prepared,file))}
  await write('stopped-database.json',{...database,history:['drift']});await assert.rejects(()=>stoppedReleaseEvidence(join(prepared,'plan.json')))
 }finally{await rm(root,{recursive:true,force:true})}
})
test('replacement callback reproduces the stopped mode guard, rejects real drift and safely migrates an owned fixture',{skip:!emailNativeAvailable,timeout:120000},async t=>{
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
  const initial=await checkDatabase(owner,release),seal='a'.repeat(64);let before=await snapshot(owner)
  await owner.query('begin isolation level repeatable read read only');let approved=await checkDatabase(owner,release);assert.equal(approved.read_only,'on');await owner.query('commit')
  const beforeMigration=locked=>assertLockedApprovalState(locked,approved)
  await t.test('original production callback rejects only the connection mode and leaves no DDL',async()=>{
   await assert.rejects(()=>applyMigration(owner,release,{seal,approval:seal,beforeMigration:locked=>assert.deepEqual(approvalState(locked),approvalState(approved))}),e=>e.code==='ERR_ASSERTION'&&e.actual.read_only==='off'&&e.expected.read_only==='on')
   assert.deepEqual(await snapshot(owner),before);assert.deepEqual(await schemaState(owner),initial.schema)
  })
  await t.test('corrected callback still rejects changed protected payment flags before DDL',async()=>{
   await owner.query("update public.site_settings set payment_bank_transfer_enabled=true where key='default'");const changed=await snapshot(owner)
   await assert.rejects(()=>applyMigration(owner,release,{seal,approval:seal,beforeMigration}),/Locked protected state differs/)
   assert.deepEqual(await snapshot(owner),changed);assert.deepEqual(await schemaState(owner),initial.schema)
   await owner.query("update public.site_settings set payment_bank_transfer_enabled=false where key='default'")
   // Restoring a value still advances updated_at. Take a fresh owned approval;
   // production likewise requires a new snapshot after any business edit.
   before=await snapshot(owner);await owner.query('begin isolation level repeatable read read only');approved=await checkDatabase(owner,release);await owner.query('commit')
  })
  await t.test('failed precommit verification rolls back DDL and ledger together',async()=>{
   await assert.rejects(()=>applyMigration(owner,release,{seal,approval:seal,beforeMigration,beforeCommit:()=>{throw Error('Owned precommit stop')}}),/Owned precommit stop/)
   assert.deepEqual(await snapshot(owner),before);assert.deepEqual(await schemaState(owner),initial.schema);await checkDatabase(owner,release)
  })
  await t.test('one approved transaction keeps Classic and all previous settings, products and permissions',async()=>{
   const receipt=await applyMigration(owner,release,{seal,approval:seal,beforeMigration});assert.equal(receipt.schema,89);assert.equal(receipt.additive_schema,'PASS');assert.equal(receipt.classic_default,true)
   const after=await checkDatabase(owner,release,{after:true});assertAdditive(initial.schema,after.schema);assert.deepEqual(after.controls,initial.controls)
   assert.equal((await owner.query("select product_page_style from public.site_settings where key='default'")).rows[0].product_page_style,'classic')
   const changed=structuredClone(after.schema);changed.functions.find(f=>f.signature.includes('catalog_media_delete(')).definition+='\n-- unrelated'
   assert.throws(()=>assertAdditive(initial.schema,changed),/Only the reviewed/)
   await assert.rejects(()=>applyMigration(owner,release,{seal,approval:seal}),/89 !== 88/)
  })
 }finally{await owner?.end();await db.close()}
})
