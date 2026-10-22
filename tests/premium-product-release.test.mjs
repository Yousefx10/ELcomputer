import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {argumentsFor} from '../scripts/premium-product-release/operator.mjs'
import {hash,migrations,productMigration,applyMigration,checkDatabase,snapshot,assertAdditive,schemaState} from '../scripts/premium-product-release/database.mjs'
import {json as certificateJson} from '../scripts/lib/cleanBaseline.mjs'
import {createEmailNativeDatabase,emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'
import {createProductSaveFixture} from './helpers/productSaveFixture.mjs'
const run=promisify(execFile)
test('PDP release requires a new full seal and leaves every historical executor unchanged',async()=>{
 for(const path of ['scripts/footer-refinement-release/operator.mjs','scripts/footer-refinement-release/database.mjs','scripts/footer-refinement-release/remote.py','scripts/footer-release/operator.mjs','scripts/footer-release/database.mjs','scripts/footer-release/remote.py'])assert.equal(hash(await readFile(path)),hash((await run('git',['show','69952dd:'+path],{encoding:'buffer'})).stdout))
 for(const args of [[],['apply','plan'],['apply','plan','--approved','short'],['apply','plan','--force','a'.repeat(64)]])assert.throws(()=>argumentsFor(args))
 assert.equal(argumentsFor(['apply','plan','--approved','a'.repeat(64)]).approval,'a'.repeat(64))
 await assert.rejects(()=>applyMigration({query:()=>{throw Error('SQL must not run')}},{},{seal:'a'.repeat(64),approval:'b'.repeat(64)}),/Exact final reviewed seal/)
})
test('owned remote phases reject wrong approval, scope, corrupt output and uncommitted SQL',async()=>{
 const {stdout,stderr}=await run('/usr/bin/python3',['-B','tests/premium_product_release_test.py']);assert.match(stdout+stderr,/Ran 6 tests/);assert.match(stdout+stderr,/OK/)
})
test('new release binds all 88 unchanged predecessors and only the reviewed migration89',async()=>{
 const release=await migrations(process.cwd());assert.equal(release.history.length,88);assert.equal(release.pending.length,1);assert.equal(release.pending[0].filename,productMigration)
})
test('guarded migration89 preserves all old data and schema under a non-superuser owner',{skip:!emailNativeAvailable,timeout:120000},async t=>{
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
  const initial=await checkDatabase(owner,release),before=await snapshot(owner),seal='a'.repeat(64)
  await t.test('failed precommit verification rolls back DDL and ledger together',async()=>{
   await assert.rejects(()=>applyMigration(owner,release,{seal,approval:seal,beforeCommit:()=>{throw Error('Owned precommit stop')}}),/Owned precommit stop/)
   assert.deepEqual(await snapshot(owner),before);assert.deepEqual(await schemaState(owner),initial.schema);await checkDatabase(owner,release)
  })
  await t.test('one approved transaction keeps Classic and all previous settings, products and permissions',async()=>{
   const receipt=await applyMigration(owner,release,{seal,approval:seal});assert.equal(receipt.schema,89);assert.equal(receipt.additive_schema,'PASS');assert.equal(receipt.classic_default,true)
   const after=await checkDatabase(owner,release,{after:true});assertAdditive(initial.schema,after.schema);assert.deepEqual(after.controls,initial.controls)
   assert.equal((await owner.query("select product_page_style from public.site_settings where key='default'")).rows[0].product_page_style,'classic')
   const changed=structuredClone(after.schema);changed.functions.find(f=>f.signature.includes('catalog_media_delete(')).definition+='\n-- unrelated'
   assert.throws(()=>assertAdditive(initial.schema,changed),/Only the reviewed/)
   await assert.rejects(()=>applyMigration(owner,release,{seal,approval:seal}),/89 !== 88/)
  })
 }finally{await owner?.end();await db.close()}
})
