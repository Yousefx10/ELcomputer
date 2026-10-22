import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {resolve} from 'node:path'
import {argumentsFor,approvalState} from '../scripts/footer-refinement-release/operator.mjs'
import {migrations,hash,checkDatabase,snapshot,schemaState} from '../scripts/footer-refinement-release/database.mjs'
import {json as certificateJson} from '../scripts/lib/cleanBaseline.mjs'
import {createEmailNativeDatabase,emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'
import {createProductSaveFixture} from './helpers/productSaveFixture.mjs'
const repo=resolve('.'),run=promisify(execFile)
test('completed executors remain exact and new CLI requires an explicit full seal',async()=>{
 for(const name of ['scripts/footer-release/operator.mjs','scripts/footer-release/database.mjs','scripts/footer-release/remote.py','scripts/commerce-release/operator.mjs','scripts/live-sales-release/operator.mjs'])assert.equal(hash(await readFile(name)),hash((await run('git',['show','e685b38:'+name],{encoding:'buffer'})).stdout))
 for(const args of [[],['apply','plan'],['apply','plan','--approved','short'],['apply','plan','--yes','a'.repeat(64)]])assert.throws(()=>argumentsFor(args))
 assert.equal(argumentsFor(['apply','plan','--approved','a'.repeat(64)]).approval,'a'.repeat(64))
 const source=await readFile('scripts/footer-refinement-release/operator.mjs','utf8');assert.doesNotMatch(source,/applyMigration\(|readOnly:false|phase='migration/)
})
test('schema88 app-only release is read-only and preserves populated Modern settings',{skip:!emailNativeAvailable,timeout:120000},async t=>{
 const db=await createEmailNativeDatabase();let owner
 try{
  const fixture=await createProductSaveFixture({database:db});await fixture.save(fixture.body());const release=await migrations(repo),history=[]
  await db.exec('create schema supabase_migrations authorization postgres;create table supabase_migrations.schema_migrations(version text primary key,statements text[],name text);alter table supabase_migrations.schema_migrations owner to postgres')
  for(const m of release.history){await db.query('insert into supabase_migrations.schema_migrations values($1,$2,$3)',[m.version,[m.text],m.name]);history.push({...m,statements_sha256:hash(certificateJson([m.text]))})}
  const localRelease={...release,certificate_history:history.slice(0,82)}
  for(const schema of ['public','private','catalog_private']){
   for(const r of(await db.query("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=$1 and c.relkind='r'",[schema])).rows)await db.exec('alter table '+schema+'."'+r.relname+'" owner to postgres')
   for(const r of(await db.query("select p.oid::regprocedure::text signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=$1 and p.prokind='f'",[schema])).rows)await db.exec('alter function '+r.signature+' owner to postgres')
   await db.exec('alter schema '+schema+' owner to postgres')
  }
  await db.exec('grant usage on schema auth,storage to postgres;grant select on all tables in schema auth,storage to postgres')
  owner=await db.connect('postgres');assert.equal((await owner.query('select rolsuper from pg_roles where rolname=current_user')).rows[0].rolsuper,false)
  await db.query("update public.site_settings set footer_modern_config=$1 where key='default'",[JSON.stringify({version:1,brand:{description:'Existing saved footer'}})])
  const before=await snapshot(owner),schema=await schemaState(owner);let acceptedState
  await t.test('read-only check accepts current non-NULL Modern settings',async()=>{
   await owner.query('begin isolation level repeatable read read only');const state=await checkDatabase(owner,localRelease);acceptedState=state;assert.equal(state.history.length,88);assert.equal(state.read_only,'on');await owner.query('commit')
   assert.deepEqual(await snapshot(owner),before);assert.deepEqual(await schemaState(owner),schema)
  })
  await t.test('the actual transaction rejects a settings write',async()=>{
   await owner.query('begin read only');await assert.rejects(()=>owner.query("update public.site_settings set footer_modern_config=null"),e=>e.code==='25006');await owner.query('rollback');assert.deepEqual(await snapshot(owner),before)
  })
  await t.test('availability drift cannot match the previously approved state',async()=>{
   await db.exec('update public.site_settings set payment_card_enabled=true');const enabledBefore=await snapshot(owner);await owner.query('begin read only');const current=await checkDatabase(owner,localRelease);assert.equal(current.controls.payment_card_enabled,true);assert.throws(()=>assert.deepEqual(approvalState(current),approvalState(acceptedState)));await owner.query('commit');assert.deepEqual(await snapshot(owner),enabledBefore);await db.exec('update public.site_settings set payment_card_enabled=false')
  })
  await t.test('unknown schema history is rejected without DDL or history writes',async()=>{
   const stableBefore=await snapshot(owner);await owner.query('begin read only');await assert.rejects(()=>checkDatabase(owner,{...localRelease,history:localRelease.history.slice(0,-1)}));await owner.query('rollback');assert.deepEqual(await snapshot(owner),stableBefore);assert.deepEqual(await schemaState(owner),schema)
  })
 }finally{await owner?.end();await db.close()}
})
