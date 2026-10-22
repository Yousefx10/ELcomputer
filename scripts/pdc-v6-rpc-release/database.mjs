// Narrow schema89 ->90: restore two original service-only RPC grants.
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import {hash,connect as guardedConnect,snapshot} from '../commerce-release/database.mjs'
import {schemaState,verifyAccess} from '../footer-release/database.mjs'
import {compareOriginal} from '../live-sales-release/database.mjs'
import {authSecurityFingerprint} from '../live-sales-release/auth.mjs'
import {approvalState as baseProjection} from '../live-sales-release/operator.mjs'
import {json as certificateJson} from '../lib/cleanBaseline.mjs'
export {hash,snapshot,schemaState}
export const applicationCommit='82ec667c03cbea1e350ddef92eaaddf3335aafed'
export const previousApplicationCommit='d01649a36c1725b290050b99d20066a05778bdfa'
export const migrationCommit='1403cc5f1fed049a24112b449b6489aa3f22b211'
export const migrationFile='20261022150000_pdc_lookup_rpc_access.sql'
export const connect=(target,{readOnly=true}={})=>guardedConnect(target,{readOnly})
const rpcNames=['shipping_claim_pdc_lookup()','shipping_claim_pdc_refresh(uuid)']
const normalizeSignature=s=>s.replace(/^public\./,'')
const isRpc=f=>f.schema==='public'&&rpcNames.includes(normalizeSignature(f.signature))
const expectedAcl=(owner,after)=>'{'+owner+'=X/'+owner+(after?',service_role=X/'+owner:'')+'}'
export async function migrations(repo){
 const pinned=(commit,file)=>execFileSync('git',['show',commit+':supabase/migrations/'+file],{cwd:repo,encoding:'buffer',maxBuffer:8e6})
 const names=execFileSync('git',['ls-tree','-r','--name-only',applicationCommit,'supabase/migrations'],{cwd:repo,encoding:'utf8'}).trim().split('\n').map(p=>p.split('/').at(-1)).sort();assert.equal(names.length,89)
 assert.deepEqual((await readdir(repo+'/supabase/migrations')).filter(n=>n.endsWith('.sql')).sort(),[...names,migrationFile])
 const files=[];for(const filename of [...names,migrationFile]){const text=await readFile(repo+'/supabase/migrations/'+filename,'utf8');assert.equal(hash(text),hash(pinned(filename===migrationFile?migrationCommit:applicationCommit,filename)));files.push({filename,text,sha256:hash(text),version:filename.slice(0,14),name:filename.slice(15,-4)})}
 const certificate=JSON.parse(await readFile(repo+'/supabase/bootstrap/release-82-v1/manifest.json'));for(let i=0;i<82;i++){assert.equal(files[i].filename,certificate.migrations[i].filename);assert.equal(files[i].sha256,certificate.migrations[i].sha256)}
 return {history:files.slice(0,89),pending:files.slice(89),certificate_history:certificate.history}
}
export function assertGrantOnly(before,after){
 for(const name of rpcNames){const a=before.functions.find(f=>isRpc(f)&&normalizeSignature(f.signature)===name),b=after.functions.find(f=>isRpc(f)&&normalizeSignature(f.signature)===name);assert.ok(a&&b);assert.equal(a.acl,expectedAcl(a.owner,false));assert.equal(b.acl,expectedAcl(a.owner,true));assert.deepEqual({...b,acl:a.acl},a)}
 assert.deepEqual({...after,functions:after.functions.map(f=>isRpc(f)?before.functions.find(old=>old.schema===f.schema&&old.signature===f.signature):f)},before,'Only two original server EXECUTE grants may change; no RLS/table/function/data rewrite')
}
export function approvalState(value){return baseProjection({...value,history:value.history.slice(0,89),read_only:'on',schema:{...value.schema,functions:value.schema.functions.map(f=>isRpc(f)?{...f,acl:expectedAcl(f.owner,false)}:f)}})}
export function assertPreserved(current,before){assert.deepEqual(approvalState(current),approvalState(before));for(const name of ['store_analytics_events','store_analytics_sessions']){const a=before.protected_tables.find(t=>t.name===name&&t.schema==='public'),b=current.protected_tables.find(t=>t.name===name&&t.schema==='public');assert.ok(a&&b&&b.count>=a.count)}}
export async function checkDatabase(db,release,{after=false}={}){
 const read_only=(await db.query('show transaction_read_only')).rows[0].transaction_read_only
 const history=(await db.query('select version,name,statements from supabase_migrations.schema_migrations order by version')).rows
 const expected=[...release.history,...(after?release.pending:[])];assert.equal(history.length,after?90:89);assert.deepEqual(history.map(({version,name})=>({version,name})),expected.map(({version,name})=>({version,name})))
 for(let i=0;i<82;i++)assert.equal(hash(certificateJson(history[i].statements)),release.certificate_history[i].statements_sha256)
 for(const m of expected.slice(82))assert.deepEqual(history.find(r=>r.version===m.version).statements,[m.text])
 // Availability flags remain exact approved data. Runtime/Caddy hold all live commerce.
 const controls=(await db.query("select payment_cash_enabled,payment_card_enabled,payment_paypal_enabled,payment_bank_transfer_enabled,payment_instapay_enabled,erp_mode from public.site_settings where key='default'")).rows
 assert.equal(controls.length,1);assert.equal(controls[0].erp_mode,'built_in');for(const [key,value]of Object.entries(controls[0]))if(key.endsWith('_enabled'))assert.equal(typeof value,'boolean')
 const pdc=(await db.query("select is_enabled,auto_create_labels,reverse_enabled from public.shipping_provider_settings where id='pdc'")).rows;assert.deepEqual(pdc,[{is_enabled:false,auto_create_labels:false,reverse_enabled:false}])
 const schema=await schemaState(db),protected_tables=await snapshot(db)
 assert.ok(schema.relations.filter(r=>r.kind==='r').every(r=>r.owner==='postgres'))
 for(const name of rpcNames){const fn=schema.functions.find(f=>isRpc(f)&&normalizeSignature(f.signature)===name);assert.ok(fn);assert.equal(fn.acl,expectedAcl(fn.owner,after),'Unexpected PDC RPC ACL');assert.match(fn.definition,/SECURITY DEFINER/);assert.match(fn.definition,/search_path TO ''/)}
 const column=schema.columns.find(c=>c.schema==='public'&&c.table_name==='site_settings'&&c.name==='footer_modern_config');assert.ok(column);assert.equal(column.type,'jsonb');assert.equal(column.not_null,false);assert.equal(column.default_value,null)
 const constraint=schema.constraints.find(c=>c.schema==='public'&&c.table_name==='site_settings'&&c.name==='site_settings_modern_footer_config_check');assert.ok(constraint?.validated);assert.match(constraint.definition,/65536/)
 for(const name of ['public.payment_attempts','public.shipping_order_jobs','public.shipping_claim_jobs','private.pdc_dispatches'])assert.equal(protected_tables.find(t=>t.schema+'.'+t.name===name)?.count,0)
 // Current saved Modern JSON is valid production content, including non-NULL.
 // Its complete bytes and all settings are bound by the original row projection.
 const presentation_style=(await db.query("select product_page_style from public.site_settings where key='default'")).rows[0].product_page_style;assert.ok(['classic','premium'].includes(presentation_style))
 return {presentation_style,history:history.map(({version,name})=>({version,name})),controls:controls[0],pdc,protected_tables,schema,auth_security:await authSecurityFingerprint(db),access:await verifyAccess(db),read_only}
}

export async function applyMigration(db,release,{approval,seal,beforeMigration=()=>{},beforeCommit=()=>{}}={}){
 assert.match(seal||'',/^[a-f0-9]{64}$/);assert.equal(approval,seal,'Exact final owner approval required for the two RPC grants');let begun=false
 try{
  await db.query('begin');begun=true;await db.query("set local lock_timeout='5s';set local statement_timeout='90s'")
  assert.equal((await db.query("select pg_try_advisory_xact_lock(hashtextextended('elcomputer-system-reset',0)) locked")).rows[0].locked,true)
  const initial=await checkDatabase(db,release),before=await snapshot(db,{lock:true}),locked=await checkDatabase(db,release);assertPreserved(locked,initial);await beforeMigration(locked)
  assert.equal(release.pending.length,1);const m=release.pending[0];assert.equal(m.filename,migrationFile);assert.equal(hash(m.text),m.sha256)
  assert.equal((m.text.match(/^begin;$/gmi)||[]).length,1);assert.equal((m.text.match(/^commit;$/gmi)||[]).length,1)
  const sql=m.text.replace(/^([\s\S]*?)(?=begin;)/i,'').replace(/^begin;\s*/i,'').replace(/commit;\s*$/i,'');assert.doesNotMatch(sql,/^\s*(begin|commit|rollback)\s*;/gmi)
  await db.query(sql);await db.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',[m.version,m.name,[m.text]])
  const preservation=await compareOriginal(db,before,{authSecurity:locked.auth_security}),after=await checkDatabase(db,release,{after:true});assertGrantOnly(locked.schema,after.schema);assertPreserved(after,locked)
  const receipt={schema:90,migration:m.sha256,preserved_tables:before.length,preservation,allowed_schema_delta:'two_service_role_execute_grants_only',business_data_writes:0,after}
  await beforeCommit(receipt);await db.query('commit');begun=false;return receipt
 }catch(e){if(begun)await db.query('rollback').catch(()=>{});throw e}
}
