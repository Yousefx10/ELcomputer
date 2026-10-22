import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,readdir,mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {argumentsFor} from '../scripts/premium-product-finishing-release/operator.mjs'
import {assertPreserved,checkDatabase,hash} from '../scripts/premium-product-finishing-release/database.mjs'
import {approvalState} from '../scripts/live-sales-release/operator.mjs'
import {json as certificateJson} from '../scripts/lib/cleanBaseline.mjs'
import {createEmailNativeDatabase,emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'
import {createProductSaveFixture} from './helpers/productSaveFixture.mjs'
import {retainClientAssets} from '../scripts/premium-product-finishing-release/assets.mjs'
const run=promisify(execFile)
test('retained client assets merge after build without replacing new bytes or following links',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pdp-retained-assets-')),source=join(root,'source'),output=join(root,'output')
 try{
  await mkdir(source);await mkdir(output);await writeFile(join(source,'old.js'),'old');await writeFile(join(source,'same.js'),'same');await writeFile(join(output,'same.js'),'same');await writeFile(join(output,'new.js'),'new')
  await retainClientAssets(source,output,{'old.js':{sha256:hash('old')},'same.js':{sha256:hash('same')}})
  assert.equal(await readFile(join(output,'old.js'),'utf8'),'old');assert.equal(await readFile(join(output,'new.js'),'utf8'),'new')
  await writeFile(join(output,'old.js'),'different new bytes');await assert.rejects(retainClientAssets(source,output,{'old.js':{sha256:hash('old')}}),/collision/);assert.equal(await readFile(join(output,'old.js'),'utf8'),'different new bytes')
  await assert.rejects(retainClientAssets(source,output,{'../escape.js':{sha256:hash('old')}}))
  await symlink(join(source,'same.js'),join(source,'linked.js'));await assert.rejects(retainClientAssets(source,output,{'linked.js':{sha256:hash('same')}}))
 }finally{await rm(root,{recursive:true,force:true})}
})
test('finishing release preserves consumed operators and requires its own final exact approval',async()=>{
 for(const file of ['activation-operator.mjs','activation-approval.mjs','activation-remote.py','database.mjs','operator.mjs','remote.py','recovery-operator.mjs','recovery-approval.mjs'])assert.equal(hash(await readFile('scripts/premium-product-release/'+file)),hash((await run('git',['show','fe3b495:scripts/premium-product-release/'+file],{encoding:'buffer'})).stdout))
 for(const args of [[],['apply','plan'],['apply','plan','--force','a'.repeat(64)],['apply','plan','--approved','short']])assert.throws(()=>argumentsFor(args))
 assert.equal(argumentsFor(['seal','candidate','qualification']).mode,'seal')
 assert.equal(argumentsFor(['apply','plan','--approved','a'.repeat(64)]).approval,'a'.repeat(64))
 const source=await readFile('scripts/premium-product-finishing-release/operator.mjs','utf8');assert.doesNotMatch(source,/applyMigration|readOnly:\s*false/);assert.match(source,/candidate-plan\.json/);assert.match(source,/qualification\.archive_sha256,candidate\.archive_sha256/);assert.match(source,/assert\.equal\(plan\.format,4\)/)
})
test('owned finishing remote fault matrix rejects consumed formats, altered proofs, writes and retries',async()=>{
 const {stdout,stderr}=await run('/usr/bin/python3',['-B','tests/premium_product_finishing_release_test.py']);assert.match(stdout+stderr,/Ran 9 tests/);assert.match(stdout+stderr,/OK/)
})
test('schema89 app release accepts authored Premium data while preserving every protected projection',{skip:!emailNativeAvailable,timeout:120000},async()=>{
 const db=await createEmailNativeDatabase();let owner
 try{
  const f=await createProductSaveFixture({database:db});await f.save(f.body({is_published:true}))
  await db.query("update public.site_settings set product_page_style='premium',product_page_config=$1,footer_style='modern',footer_modern_config=$2,payment_cash_enabled=true,payment_card_enabled=true,payment_instapay_enabled=true where key='default'",[{sections:{included:true}},{version:1,brand:{description:'Retained authored content'}}])
  await db.query("insert into catalog_private.product_presentations(product_id,content,revision) values($1,$2,1)",[f.productId||f.published||((await db.query('select id from public.products limit 1')).rows[0].id),{videos:[],related:[],compatible:[]}])
  const files=[];for(const filename of(await readdir('supabase/migrations')).filter(n=>n.endsWith('.sql')).sort()){const text=await readFile('supabase/migrations/'+filename,'utf8');files.push({filename,text,sha256:hash(text),version:filename.slice(0,14),name:filename.slice(15,-4)})}
  const release={history:files,certificate_history:files.slice(0,82).map(m=>({statements_sha256:hash(certificateJson([m.text]))}))}
  await db.exec('create schema supabase_migrations authorization postgres;create table supabase_migrations.schema_migrations(version text primary key,statements text[],name text);alter table supabase_migrations.schema_migrations owner to postgres')
  for(const m of files)await db.query('insert into supabase_migrations.schema_migrations values($1,$2,$3)',[m.version,[m.text],m.name])
  for(const schema of ['public','private','catalog_private']){
   for(const r of(await db.query("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=$1 and c.relkind='r'",[schema])).rows)await db.exec('alter table '+schema+'."'+r.relname+'" owner to postgres')
   for(const r of(await db.query("select p.oid::regprocedure::text signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=$1 and p.prokind='f'",[schema])).rows)await db.exec('alter function '+r.signature+' owner to postgres')
  }
  await db.exec('alter schema catalog_private owner to postgres;alter schema public owner to postgres;alter schema private owner to postgres');
  await db.exec('grant usage on schema auth,storage to postgres;grant select on all tables in schema auth,storage to postgres')
  owner=await db.connect('postgres')
  const observe=async()=>{await owner.query('begin isolation level repeatable read read only');try{const value=await checkDatabase(owner,release);await owner.query('commit');return value}catch(error){await owner.query('rollback');throw error}}
  const before=await observe();assert.equal(before.presentation_style,'premium');assert.equal(before.history.length,89)
  assertPreserved(await observe(),before,approvalState)
  const telemetry=before.protected_tables.find(t=>t.name==='store_analytics_events'),grown={...before,protected_tables:before.protected_tables.map(t=>t===telemetry?{...t,count:t.count+1,sha256:'a'.repeat(64)}:t)}
  assert.doesNotThrow(()=>assertPreserved(grown,before,approvalState));assert.throws(()=>assertPreserved(before,grown,approvalState),/shrank/)
  for(const table of before.protected_tables){if(table.schema==='public'&&['store_analytics_events','store_analytics_sessions'].includes(table.name))continue
   assert.throws(()=>assertPreserved({...before,protected_tables:before.protected_tables.map(t=>t===table?{...t,count:t.count+1,sha256:'f'.repeat(64)}:t)},before,approvalState),undefined,table.schema+'.'+table.name)
  }
  for(const key of ['schema','auth_security','controls','pdc','access','history','presentation_style','read_only'])assert.throws(()=>assertPreserved({...before,[key]:null},before,approvalState))
  await owner.query('begin read only');await assert.rejects(()=>owner.query('update public.site_settings set site_name=site_name'),e=>e.code==='25006');await owner.query('rollback')
 }finally{await owner?.end();await db.close()}
})
