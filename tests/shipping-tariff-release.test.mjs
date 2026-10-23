import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,writeFile} from 'node:fs/promises'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {argumentsFor} from '../scripts/shipping-tariff-release/operator.mjs'
import {migrations,applyMigration,checkDatabase,assertPreserved,assertTariffOnlyDelta,tariffDelta,schemaState,hash} from '../scripts/shipping-tariff-release/database.mjs'
import {createEmailNativeDatabase,emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'
import {json as certificateJson} from '../scripts/lib/cleanBaseline.mjs'
import {createProductSaveFixture} from './helpers/productSaveFixture.mjs'
const run=promisify(execFile),artifact=JSON.parse(await readFile('../modular-commerce-planning-20261023/review-3/review-manifest.json'))
test('fresh release rejects missing approval before SQL and preserves sealed application and historical operators',async()=>{
 for(const f of ['operator.mjs','database.mjs','remote.py'])assert.equal(hash(await readFile('scripts/controlled-purchase-release/'+f)),hash((await run('git',['show','4f36702:scripts/controlled-purchase-release/'+f],{encoding:'buffer'})).stdout))
 for(const a of [[],['apply','plan'],['apply','plan','--force','a'.repeat(64)],['apply','plan','--approved','bad']])assert.throws(()=>argumentsFor(a))
 assert.equal(argumentsFor(['apply','plan','--approved','a'.repeat(64)]).approval,'a'.repeat(64))
 let queries=0;await assert.rejects(()=>applyMigration({query(){queries++}},null,{approval:'b'.repeat(64),seal:'a'.repeat(64)}));assert.equal(queries,0)
 const r=await migrations(process.cwd(),artifact);assert.equal(r.history.length,90);assert.equal(r.pending.length,1);assert.equal(r.pending[0].sha256,artifact.migrations[0].sha256)
 await run('git',['diff','--exit-code',artifact.application_commit,'--','app','server','public','i18n','supabase','nuxt.config.ts','package.json','package-lock.json'])
})
test('remote filesystem, proof, scope and restart fault matrix fails closed without external services',async()=>{
 const {stdout,stderr}=await run('/usr/bin/python3',['-B','tests/shipping_tariff_release_test.py']);assert.match(stdout+stderr,/Ran 8 tests/);assert.match(stdout+stderr,/OK/)
})
test('native migration guard rolls back a lost commit boundary, rejects drift and repeat execution, and preserves business state',{skip:!emailNativeAvailable,timeout:180000},async()=>{
 const r=await migrations(process.cwd(),artifact),db=await createEmailNativeDatabase({stopBefore:r.pending[0].filename});let owner
 try{
  await createProductSaveFixture({database:db});r.certificate_history=r.history.slice(0,82).map(m=>({statements_sha256:hash(certificateJson([m.text]))}))
  await db.exec('create schema supabase_migrations authorization postgres;create table supabase_migrations.schema_migrations(version text primary key,statements text[],name text);alter table supabase_migrations.schema_migrations owner to postgres')
  for(const m of r.history)await db.query('insert into supabase_migrations.schema_migrations values($1,$2,$3)',[m.version,[m.text],m.name])
  for(const s of ['public','private','catalog_private']){
   for(const t of(await db.query("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=$1 and c.relkind='r'",[s])).rows)await db.exec('alter table '+s+'."'+t.relname+'" owner to postgres')
   for(const f of(await db.query("select p.oid::regprocedure::text signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=$1 and p.prokind='f'",[s])).rows)await db.exec('alter function '+f.signature+' owner to postgres')
   await db.exec('alter schema '+s+' owner to postgres')
  }
  await db.exec('grant usage on schema auth,storage to postgres;grant select on all tables in schema auth,storage to postgres');owner=await db.connect('postgres')
  const before=await checkDatabase(owner,r),seal='a'.repeat(64)
  // Qualify the exact SQL delta independently, then roll it back before testing apply.
  await owner.query('begin');await owner.query(r.pending[0].text.replace(/^([\s\S]*?)(?=begin;)/i,'').replace(/^begin;\s*/i,'').replace(/commit;\s*$/i,''));const expected=tariffDelta(await schemaState(owner));await owner.query('rollback')
  await assert.rejects(()=>applyMigration(owner,r,{approval:seal,seal,expectedDelta:expected,beforeCommit:()=>{throw Error('owned interrupted commit')}}),/owned interrupted commit/)
  assert.deepEqual(await checkDatabase(owner,r),before)
  const tampered=structuredClone(before);tampered.controls.payment_card_enabled=!tampered.controls.payment_card_enabled;assert.throws(()=>assertPreserved(tampered,before))
  await assert.rejects(()=>applyMigration(owner,r,{approval:seal,seal,expectedDelta:{...expected,functions:[]}}));assert.deepEqual(await checkDatabase(owner,r),before)
  const receipt=await applyMigration(owner,r,{approval:seal,seal,expectedDelta:expected});assert.equal(receipt.schema,91);assert.equal(receipt.business_data_writes,0)
  const after=await checkDatabase(owner,r,{after:true});assertTariffOnlyDelta(before.schema,after.schema,expected);assertPreserved(after,before)
  for(const field of ['columns','constraints','policies','triggers','indexes','relations','functions'])assert.throws(()=>assertTariffOnlyDelta(before.schema,{...after.schema,[field]:[]},expected))
  await assert.rejects(()=>applyMigration(owner,r,{approval:seal,seal,expectedDelta:expected}));assert.equal((await owner.query('select count(*)::int n from supabase_migrations.schema_migrations')).rows[0].n,91)
  if(process.env.TARIFF_RELEASE_DELTA_FILE)await writeFile(process.env.TARIFF_RELEASE_DELTA_FILE,JSON.stringify({schema_delta:expected,migration_sha256:r.pending[0].sha256,native_version:db.version},null,2)+'\n',{flag:'wx',mode:0o600})
 }finally{await owner?.end();await db.close()}
})
