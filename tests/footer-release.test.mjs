import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {tmpdir} from 'node:os'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {argumentsFor,digest,remoteCommand,approvalState} from '../scripts/footer-release/operator.mjs'
import {migrations,hash,applyMigration,checkDatabase,snapshot,schemaState,assertAdditive,footerMigrationHash} from '../scripts/footer-release/database.mjs'
import {json as certificateJson} from '../scripts/lib/cleanBaseline.mjs'
import {createEmailNativeDatabase,emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'
import {createProductSaveFixture} from './helpers/productSaveFixture.mjs'
const run=promisify(execFile),repo=resolve('.')
test('footer release selects only approved88 and preserves all historical source bytes',async()=>{
 const r=await migrations(repo);assert.equal(r.history.length,87);assert.equal(r.pending.length,1);assert.equal(r.pending[0].sha256,footerMigrationHash)
 for(const name of ['scripts/commerce-release/operator.mjs','scripts/commerce-release/database.mjs','scripts/live-sales-release/operator.mjs','scripts/live-sales-release/database.mjs','scripts/live-sales-release/remote.py'])assert.equal(hash(await readFile(name)),hash((await run('git',['show','8181953:'+name],{encoding:'buffer'})).stdout))
})
test('new approval is exact and neither read-only mode nor partial CLI can mutate',async()=>{
 for(const args of [[],['apply'],['apply','plan'],['apply','plan','--approved','short'],['apply','plan','--yes','a'.repeat(64)],['check','plan','--approved','a'.repeat(64)]])assert.throws(()=>argumentsFor(args))
 assert.equal(argumentsFor(['apply','plan','--approved','a'.repeat(64)]).approval,'a'.repeat(64))
 const source=await readFile('scripts/footer-release/remote.py','utf8')
 const script=`import sys,json
source=${JSON.stringify(source)}
namespace={'__name__':'owned_test'};exec(compile(source,'footer-remote.py','exec'),namespace)
namespace['paths']=lambda p: (_ for _ in ()).throw(RuntimeError('mutation reached'))
for mode in ['prepare','stage','candidate','activate']:
 sys.argv=['remote',mode,json.dumps({'plan':{}})]
 try:namespace['main']();raise AssertionError('Accepted missing seal')
 except KeyError:pass
print('PASS')`
 assert.equal((await run('python3',['-B','-c',script])).stdout.trim(),'PASS')
})
test('structured SSH transport preserves sealed large plans and shell metacharacters',async()=>{
 const command=remoteCommand(),dir=await mkdtemp(join(tmpdir(),'footer-command-'))
 try{const payload={mode:'inspect',plan:{text:'$(touch '+dir+'/must-not-exist)',large:'x'.repeat(300000)},source:'import json,sys;p=json.loads(sys.argv[2]);assert len(p["plan"]["large"])==300000;print("PASS")'}
 // Exercise the actual structured transport through a pipe.
 const {spawn}=await import('node:child_process');const c=spawn('/bin/sh',['-c',command],{stdio:['pipe','pipe','pipe']}),out=[];c.stdout.on('data',b=>out.push(b));c.stderr.resume();const done=new Promise(res=>c.once('close',res));c.stdin.end(JSON.stringify(payload));assert.equal(await done,0);assert.equal(Buffer.concat(out).toString().trim(),'PASS');await assert.rejects(()=>readFile(dir+'/must-not-exist'))
 }finally{await rm(dir,{recursive:true,force:true})}
})
test('actual87->88 non-superuser transaction is additive and rollback leaves87 usable',{skip:!emailNativeAvailable,timeout:120000},async t=>{
 const db=await createEmailNativeDatabase({stopBefore:'20261021190000'});let owner
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
  const before=await snapshot(owner),schema=await schemaState(owner)
  await t.test('late failure rolls back complete DDL/history and all rows',async()=>{await assert.rejects(()=>applyMigration(owner,localRelease,{beforeCommit:()=>{throw Error('owned late failure')}}),/owned late failure/);assert.deepEqual(await snapshot(owner),before);assert.deepEqual(await schemaState(owner),schema);assert.equal((await checkDatabase(owner,localRelease)).history.length,87)})
  await t.test('locked pre-migration drift fails before DDL',async()=>{await assert.rejects(()=>applyMigration(owner,localRelease,{beforeMigration:()=>{throw Error('owned drift')}}),/owned drift/);assert.equal((await checkDatabase(owner,localRelease)).history.length,87)})
  await t.test('enabled gate rejects release without schema change',async()=>{await db.exec('update public.site_settings set payment_card_enabled=true');await assert.rejects(()=>applyMigration(owner,localRelease));await db.exec('update public.site_settings set payment_card_enabled=false');assert.deepEqual(await schemaState(owner),schema)})
  await t.test('one migration changes only the nullable column/check/comment',async()=>{const r=await applyMigration(owner,localRelease);assert.equal(r.history.length,88);assert.equal(r.additive_schema,'PASS');assert.equal(r.preserved_tables,before.length);assertAdditive(schema,await schemaState(owner));assert.equal((await checkDatabase(owner,localRelease,{after:true})).history.length,88)})
  await t.test('old partial settings save and select-star remain compatible with88',async()=>{await owner.query("update public.site_settings set footer_modern_config=$1 where key='default'",[JSON.stringify({version:1,brand:{description:'New configuration'}})]);const data=(await owner.query("select * from public.site_settings where key='default'")).rows[0];assert.equal(data.footer_modern_config.version,1);await owner.query("insert into public.site_settings(key,copyright_text) values('default','Old UI save') on conflict(key) do update set copyright_text=excluded.copyright_text");assert.equal((await owner.query("select footer_modern_config->'brand'->>'description' description from public.site_settings where key='default'")).rows[0].description,'New configuration');await owner.query("update public.site_settings set footer_modern_config=null where key='default'")})
  await t.test('second attempt and corrupted historical statements fail closed',async()=>{await assert.rejects(()=>applyMigration(owner,localRelease));await assert.rejects(()=>checkDatabase(owner,{...localRelease,certificate_history:release.certificate_history},{after:true}))})
 }finally{await owner?.end();await db.close()}
})
