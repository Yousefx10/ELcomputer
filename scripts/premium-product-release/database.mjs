// Independently sealed 88 -> 89. Previous release operators remain immutable.
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import {connect as guardedConnect,hash,snapshot} from '../commerce-release/database.mjs'
import {schemaState} from '../footer-release/database.mjs'
import {compareOriginal,verifyAccess} from '../live-sales-release/database.mjs'
import {authSecurityFingerprint} from '../live-sales-release/auth.mjs'
import {json as certificateJson} from '../lib/cleanBaseline.mjs'
export {hash,snapshot,schemaState,compareOriginal}
export const applicationCommit='a2e47a53b016051500180876b25feb2420d7038d'
export const previousApplicationCommit='3b9816472157b3f45feaa43ac087115eef730384'
export const productMigration='20261022100000_premium_product_pages.sql'
export const connect=(target,options={})=>guardedConnect(target,{readOnly:options.readOnly!==false})
const privateTables=['product_presentations','product_video_assets','product_presentation_receipts']
const newFunctions=['catalog_private.pdp_editor(uuid,boolean)','catalog_product_presentation(uuid,uuid)','catalog_save_product_presentation(uuid,uuid,uuid,bigint,jsonb)','catalog_product_presentation_status(uuid,uuid)','catalog_register_product_video(uuid,uuid,uuid,text,bigint,text,numeric)','get_product_presentation(uuid)','get_public_product_video(uuid)']
const signature=value=>value.replace(/^public\./,'')
export async function migrations(repo){
 const names=execFileSync('git',['ls-tree','-r','--name-only',applicationCommit,'supabase/migrations'],{cwd:repo,encoding:'utf8'}).trim().split('\n').map(p=>p.split('/').at(-1)).sort()
 assert.equal(names.length,89);assert.equal(names.at(-1),productMigration)
 assert.deepEqual((await readdir(repo+'/supabase/migrations')).filter(n=>n.endsWith('.sql')).sort(),names,'Unknown migration; generic push is prohibited')
 const certificate=JSON.parse(await readFile(repo+'/supabase/bootstrap/release-82-v1/manifest.json')),files=[]
 for(const filename of names){const text=await readFile(repo+'/supabase/migrations/'+filename,'utf8'),pinned=execFileSync('git',['show',applicationCommit+':supabase/migrations/'+filename],{cwd:repo,encoding:'buffer',maxBuffer:8e6});assert.equal(hash(text),hash(pinned));files.push({filename,text,sha256:hash(text),version:filename.slice(0,14),name:filename.slice(15,-4)})}
 const previous=execFileSync('git',['ls-tree','-r','--name-only',previousApplicationCommit,'supabase/migrations'],{cwd:repo,encoding:'utf8'}).trim().split('\n').map(p=>p.split('/').at(-1)).sort();assert.deepEqual(names.slice(0,88),previous)
 for(const m of files.slice(0,88))assert.equal(m.sha256,hash(execFileSync('git',['show',previousApplicationCommit+':supabase/migrations/'+m.filename],{cwd:repo,encoding:'buffer',maxBuffer:8e6})))
 for(let i=0;i<82;i++){assert.equal(files[i].filename,certificate.migrations[i].filename);assert.equal(files[i].sha256,certificate.migrations[i].sha256)}
 return {history:files.slice(0,88),pending:files.slice(88),certificate_history:certificate.history}
}
const privateObject=row=>row.schema==='catalog_private'&&privateTables.includes(row.table_name||row.name)
const mediaAddition="  -- Authored labels may contain managed image URLs.\n  if exists(select 1 from catalog_private.product_presentations r,\n    lateral catalog_private.media_references(to_jsonb(r)) x where x=p_path) then\n    raise exception 'MEDIA_REFERENCED';\n  end if;\n"
export function assertAdditive(before,after){
 const columns=after.columns.filter(c=>c.schema==='public'&&c.table_name==='site_settings'&&['product_page_style','product_page_config'].includes(c.name));assert.deepEqual(columns.map(c=>c.name),['product_page_style','product_page_config']);assert.equal(columns[0].type,'text');assert.equal(columns[0].not_null,true);assert.equal(columns[0].default_value,"'classic'::text");assert.equal(columns[1].type,'jsonb');assert.equal(columns[1].not_null,false);assert.equal(columns[1].default_value,null)
 const constraints=after.constraints.filter(c=>c.schema==='public'&&c.table_name==='site_settings'&&['site_settings_product_page_style_check','site_settings_product_page_config_check'].includes(c.name));assert.equal(constraints.length,2);assert.ok(constraints.every(c=>c.validated));assert.ok(constraints.some(c=>/32768/.test(c.definition)))
 const addedRelations=after.relations.filter(privateObject);assert.deepEqual(addedRelations.map(r=>r.name).sort(),[...privateTables].sort());assert.ok(addedRelations.every(r=>r.kind==='r'&&r.rls&&!r.force_rls&&r.owner==='postgres'))
 const functions=after.functions.filter(row=>newFunctions.includes(signature(row.signature)));assert.equal(functions.length,newFunctions.length);assert.ok(functions.every(f=>f.owner==='postgres'&&/SECURITY DEFINER/.test(f.definition)&&/search_path TO ''/.test(f.definition)))
 const oldMedia=before.functions.find(f=>signature(f.signature)==='catalog_media_delete(uuid,text,boolean)'),newMedia=after.functions.find(f=>signature(f.signature)==='catalog_media_delete(uuid,text,boolean)');assert.ok(oldMedia&&newMedia)
 const anchor="  if p_finish and current_state <> 'deleting' then raise exception 'MEDIA_DELETE_NOT_RESERVED'; end if;";assert.ok(oldMedia.definition.includes(anchor));assert.deepEqual(newMedia,{...oldMedia,definition:oldMedia.definition.replace(anchor,mediaAddition+anchor)},'Only the reviewed new reference scan may extend existing media deletion')
 const oldReset=before.functions.find(f=>signature(f.signature)==='catalog_private.reset_assert_coverage()'),newReset=after.functions.find(f=>signature(f.signature)==='catalog_private.reset_assert_coverage()');assert.ok(oldReset&&newReset)
 const resetAnchor="'product_revisions','product_save_receipts','media_paths','product_bulk_receipts','import_jobs','import_items'";assert.ok(oldReset.definition.includes(resetAnchor));assert.deepEqual(newReset,{...oldReset,definition:oldReset.definition.replace(resetAnchor,resetAnchor+",'product_presentations','product_video_assets','product_presentation_receipts'")},'Only the three reviewed private tables may extend reset coverage')
 const stripped={...after,relations:after.relations.filter(r=>!privateObject(r)),columns:after.columns.filter(r=>!privateObject(r)&&!columns.includes(r)),constraints:after.constraints.filter(r=>!privateObject(r)&&!constraints.includes(r)),policies:after.policies.filter(r=>!privateObject(r)),functions:after.functions.filter(r=>!functions.includes(r)).map(r=>r===newMedia?oldMedia:r===newReset?oldReset:r),triggers:after.triggers.filter(r=>!privateObject(r)),indexes:after.indexes.filter(r=>!(r.schemaname==='catalog_private'&&privateTables.includes(r.tablename)))}
 assert.deepEqual(stripped,before,'Unrelated schema, ACL, RLS, trigger, index or function drift')
}
export async function checkDatabase(db,release,{after=false}={}){
 const history=(await db.query('select version,name,statements from supabase_migrations.schema_migrations order by version')).rows,expected=[...release.history,...(after?release.pending:[])]
 assert.equal(history.length,after?89:88);assert.deepEqual(history.map(({version,name})=>({version,name})),expected.map(({version,name})=>({version,name})))
 for(let i=0;i<82;i++)assert.equal(hash(certificateJson(history[i].statements)),release.certificate_history[i].statements_sha256)
 for(const m of expected.slice(82))assert.deepEqual(history.find(r=>r.version===m.version).statements,[m.text])
 const controls=(await db.query("select payment_cash_enabled,payment_card_enabled,payment_paypal_enabled,payment_bank_transfer_enabled,payment_instapay_enabled,erp_mode from public.site_settings where key='default'")).rows;assert.equal(controls.length,1);assert.equal(controls[0].erp_mode,'built_in');for(const[k,v]of Object.entries(controls[0]))if(k.endsWith('_enabled'))assert.equal(typeof v,'boolean')
 const pdc=(await db.query("select is_enabled,auto_create_labels,reverse_enabled from public.shipping_provider_settings where id='pdc'")).rows;assert.deepEqual(pdc,[{is_enabled:false,auto_create_labels:false,reverse_enabled:false}])
 const schema=await schemaState(db),protected_tables=await snapshot(db);assert.ok(schema.relations.filter(r=>r.kind==='r').every(r=>r.owner==='postgres'))
 for(const name of ['public.payment_attempts','public.shipping_order_jobs','public.shipping_claim_jobs','private.pdc_dispatches'])assert.equal(protected_tables.find(r=>r.schema+'.'+r.name===name)?.count,0)
 assert.equal(schema.columns.some(c=>c.schema==='public'&&c.table_name==='site_settings'&&c.name==='product_page_style'),after)
 if(after){
  assert.equal((await db.query("select count(*)::int n from public.site_settings where product_page_style<>'classic' or product_page_config is not null")).rows[0].n,0,'Release never selects Premium or configures content')
  for(const table of privateTables){assert.equal((await db.query('select count(*)::int n from catalog_private.'+table)).rows[0].n,0);for(const role of ['anon','authenticated','service_role'])for(const privilege of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE'])assert.equal((await db.query('select has_table_privilege($1,$2,$3) allowed',[role,'catalog_private.'+table,privilege])).rows[0].allowed,false)}
  for(const fn of newFunctions)for(const role of ['anon','authenticated','service_role']){const isPublic=fn.startsWith('get_'),isService=!fn.startsWith('catalog_private.')&&!isPublic;assert.equal((await db.query("select has_function_privilege($1,$2,'EXECUTE') allowed",[role,fn])).rows[0].allowed,isPublic||isService&&role==='service_role')}
 }
 return {history:history.map(({version,name})=>({version,name})),controls:controls[0],pdc,protected_tables,schema,auth_security:await authSecurityFingerprint(db),access:await verifyAccess(db),read_only:(await db.query('show transaction_read_only')).rows[0].transaction_read_only}
}
export async function applyMigration(db,release,{approval,seal,beforeMigration=()=>{},beforeCommit=()=>{}}={}){
 assert.match(seal||'',/^[a-f0-9]{64}$/);assert.equal(approval,seal,'Exact final reviewed seal required for production SQL');let begun=false
 try{
  await db.query('begin');begun=true;await db.query("set local lock_timeout='5s';set local statement_timeout='60s'")
  assert.equal((await db.query("select pg_try_advisory_xact_lock(hashtextextended('elcomputer-system-reset',0)) locked")).rows[0].locked,true)
  await checkDatabase(db,release);const before=await snapshot(db,{lock:true}),locked=await checkDatabase(db,release);await beforeMigration(locked)
  assert.equal(release.pending.length,1);const m=release.pending[0];assert.equal(m.filename,productMigration);assert.equal(hash(m.text),m.sha256);assert.equal((m.text.match(/^BEGIN;$/gmi)||[]).length,1);assert.equal((m.text.match(/^COMMIT;$/gmi)||[]).length,1)
  const sql=m.text.replace(/^BEGIN;\s*/i,'').replace(/COMMIT;\s*$/i,'');assert.doesNotMatch(sql,/^\s*(BEGIN|COMMIT|ROLLBACK)\s*;/gmi)
  await db.query(sql);await db.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',[m.version,m.name,[m.text]])
  const preservation=await compareOriginal(db,before,{authSecurity:locked.auth_security}),after=await checkDatabase(db,release,{after:true});assertAdditive(locked.schema,after.schema);assert.deepEqual(after.auth_security,locked.auth_security);assert.deepEqual(after.controls,locked.controls)
  const receipt={schema:89,migration:m.sha256,before,auth_security:locked.auth_security,preservation,preserved_tables:before.length,additive_schema:'PASS',classic_default:true,existing_schema:'Preserved; only media-reference and reset-coverage extensions',after}
  await beforeCommit(receipt);await db.query('commit');begun=false;return receipt
 }catch(error){if(begun)await db.query('rollback').catch(()=>{});throw error}
}
