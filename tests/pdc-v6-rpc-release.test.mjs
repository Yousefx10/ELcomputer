import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {argumentsFor} from '../scripts/pdc-v6-rpc-release/operator.mjs'
import {migrations,applyMigration,checkDatabase,assertGrantOnly,hash} from '../scripts/pdc-v6-rpc-release/database.mjs'
import {createEmailNativeDatabase,emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'
import {json as certificateJson} from '../scripts/lib/cleanBaseline.mjs'
import {createProductSaveFixture} from './helpers/productSaveFixture.mjs'
const run=promisify(execFile)
test('RPC-grant release requires independent approval and preserves the original operators',async()=>{
 for(const dir of ['premium-product-finishing-release','premium-product-release'])for(const file of ['operator.mjs','database.mjs','remote.py'])assert.equal(hash(await readFile('scripts/'+dir+'/'+file)),hash((await run('git',['show','f1e5146:scripts/'+dir+'/'+file],{encoding:'buffer'})).stdout))
 for(const args of [[],['apply','plan'],['apply','plan','--force','a'.repeat(64)],['prepare','spec','work']])assert.throws(()=>argumentsFor(args))
 assert.equal(argumentsFor(['apply','plan','--approved','a'.repeat(64)]).approval,'a'.repeat(64))
 assert.equal(argumentsFor(['prepare-from-artifact','candidate','qualification','work']).mode,'prepare')
 let calls=0;await assert.rejects(()=>applyMigration({query(){calls++}},null,{approval:'b'.repeat(64),seal:'a'.repeat(64)}));assert.equal(calls,0)
 const release=await migrations(process.cwd());assert.equal(release.history.length,89);assert.equal(release.pending.length,1)
})
test('owned RPC-release remote fault matrix fails closed without retry or rollback',async()=>{
 const {stdout,stderr}=await run('/usr/bin/python3',['-B','tests/pdc_v6_rpc_release_test.py']);assert.match(stdout+stderr,/Ran 9 tests/);assert.match(stdout+stderr,/OK/)
})
test('native sealed RPC transaction rolls back an interrupted commit, preserves data/schema, then commits once',{skip:!emailNativeAvailable,timeout:180000},async()=>{
 const release=await migrations(process.cwd()),db=await createEmailNativeDatabase({stopBefore:release.pending[0].filename});let owner
 try{
  await createProductSaveFixture({database:db})
  release.certificate_history=release.history.slice(0,82).map(m=>({statements_sha256:hash(certificateJson([m.text]))}))
  await db.exec('create schema supabase_migrations authorization postgres;create table supabase_migrations.schema_migrations(version text primary key,statements text[],name text);alter table supabase_migrations.schema_migrations owner to postgres')
  for(const m of release.history)await db.query('insert into supabase_migrations.schema_migrations values($1,$2,$3)',[m.version,[m.text],m.name])
  for(const schema of ['public','private','catalog_private']){
   for(const r of(await db.query("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=$1 and c.relkind='r'",[schema])).rows)await db.exec('alter table '+schema+'."'+r.relname+'" owner to postgres')
   for(const r of(await db.query("select p.oid::regprocedure::text signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=$1 and p.prokind='f'",[schema])).rows)await db.exec('alter function '+r.signature+' owner to postgres')
   await db.exec('alter schema '+schema+' owner to postgres')
  }
  await db.exec('grant usage on schema auth,storage to postgres;grant select on all tables in schema auth,storage to postgres');owner=await db.connect('postgres')
  const before=await checkDatabase(owner,release),seal='a'.repeat(64)
  await assert.rejects(()=>applyMigration(owner,release,{approval:seal,seal,beforeCommit:()=>{throw Error('owned interrupted commit')}}),/owned interrupted commit/)
  const rolledBack=await checkDatabase(owner,release);assert.deepEqual(rolledBack,before)
  const receipt=await applyMigration(owner,release,{approval:seal,seal});assert.equal(receipt.schema,90);assert.equal(receipt.business_data_writes,0)
  const after=await checkDatabase(owner,release,{after:true});assertGrantOnly(before.schema,after.schema);assert.deepEqual(after.protected_tables,before.protected_tables);assert.deepEqual(after.auth_security,before.auth_security)
  await assert.rejects(()=>applyMigration(owner,release,{approval:seal,seal}));assert.equal((await owner.query('select count(*)::int n from supabase_migrations.schema_migrations')).rows[0].n,90)
  for(const field of ['columns','constraints','policies','triggers','indexes','relations'])assert.throws(()=>assertGrantOnly(before.schema,{...after.schema,[field]:[]}))
 }finally{await owner?.end();await db.close()}
})
