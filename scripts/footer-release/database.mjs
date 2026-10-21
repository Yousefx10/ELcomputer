// Independently bound 87 -> 88. Historical release operators stay immutable.
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import {hash,connect,snapshot} from '../commerce-release/database.mjs'
import {compareOriginal,verifyAccess} from '../live-sales-release/database.mjs'
import {authSecurityFingerprint} from '../live-sales-release/auth.mjs'
import {json as certificateJson} from '../lib/cleanBaseline.mjs'
export {hash,connect,snapshot,compareOriginal,verifyAccess}
export const applicationCommit='8181953a7678b36fd4643d1ce52a0b96f65d8136'
export const footerMigration='20261021190000_modern_footer_configuration.sql'
export const footerMigrationHash='4ebb4fc58ccd274116ab8c5f3a254cb3e1270489cf556f61abace0cbcc2db331'
const quote=s=>'"'+s.replaceAll('"','""')+'"'
export async function migrations(repo){
  const names=execFileSync('git',['ls-tree','-r','--name-only',applicationCommit,'supabase/migrations'],{cwd:repo,encoding:'utf8'}).trim().split('\n').map(p=>p.split('/').at(-1)).sort()
  assert.equal(names.length,88);assert.equal(names.at(-1),footerMigration)
  assert.deepEqual((await readdir(repo+'/supabase/migrations')).filter(n=>n.endsWith('.sql')).sort(),names,'Unknown migration; never run a generic push')
  const certificate=JSON.parse(await readFile(repo+'/supabase/bootstrap/release-82-v1/manifest.json'))
  const files=[]
  for(const filename of names){const text=await readFile(repo+'/supabase/migrations/'+filename,'utf8'),pinned=execFileSync('git',['show',applicationCommit+':supabase/migrations/'+filename],{cwd:repo,encoding:'buffer',maxBuffer:8e6});assert.equal(hash(text),hash(pinned));files.push({filename,text,sha256:hash(text),version:filename.slice(0,14),name:filename.slice(15,-4)})}
  for(let i=0;i<82;i++){assert.equal(files[i].filename,certificate.migrations[i].filename);assert.equal(files[i].sha256,certificate.migrations[i].sha256)}
  assert.equal(files.at(-1).sha256,footerMigrationHash)
  return {history:files.slice(0,87),pending:files.slice(87),certificate_history:certificate.history}
}
export async function schemaState(db){
  const relations=(await db.query(`select n.nspname schema,c.relname name,c.relkind kind,c.relrowsecurity rls,c.relforcerowsecurity force_rls,
    pg_get_userbyid(c.relowner) owner,c.relacl::text acl from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','private','catalog_private') and c.relkind in ('r','v','m','S') order by 1,2`)).rows
  const columns=(await db.query(`select n.nspname schema,c.relname table_name,a.attname name,a.attnum ordinal,format_type(a.atttypid,a.atttypmod) type,
    a.attnotnull not_null,a.attgenerated generated,a.attidentity identity,pg_get_expr(d.adbin,d.adrelid) default_value,col_description(c.oid,a.attnum) comment
    from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
    left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum where n.nspname in ('public','private','catalog_private')
    and c.relkind in ('r','v','m') and a.attnum>0 and not a.attisdropped order by 1,2,a.attnum`)).rows
  const constraints=(await db.query(`select n.nspname schema,c.relname table_name,k.conname name,k.contype type,k.convalidated validated,
    pg_get_constraintdef(k.oid,true) definition from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','private','catalog_private') order by 1,2,3`)).rows
  const policies=(await db.query("select * from pg_policies where schemaname in ('public','private','catalog_private') order by schemaname,tablename,policyname")).rows
  const functions=(await db.query(`select n.nspname schema,p.oid::regprocedure::text signature,pg_get_userbyid(p.proowner) owner,p.proacl::text acl,
    pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private','catalog_private') and p.prokind='f' order by 1,2`)).rows
  const triggers=(await db.query(`select n.nspname schema,c.relname table_name,t.tgname name,pg_get_triggerdef(t.oid,true) definition
    from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','catalog_private') and not t.tgisinternal order by 1,2,3`)).rows
  const indexes=(await db.query("select * from pg_indexes where schemaname in ('public','private','catalog_private') order by schemaname,tablename,indexname")).rows
  return {relations,columns,constraints,policies,functions,triggers,indexes}
}
export function assertAdditive(before,after){
  const columns=after.columns.filter(c=>c.schema==='public'&&c.table_name==='site_settings'&&c.name==='footer_modern_config')
  assert.equal(columns.length,1);assert.equal(columns[0].type,'jsonb');assert.equal(columns[0].not_null,false);assert.equal(columns[0].default_value,null)
  assert.equal(columns[0].generated,'');assert.equal(columns[0].identity,'');assert.match(columns[0].comment,/NULL inherits legacy values/)
  const added=after.constraints.filter(c=>c.schema==='public'&&c.table_name==='site_settings'&&c.name==='site_settings_modern_footer_config_check')
  assert.equal(added.length,1);assert.equal(added[0].type,'c');assert.equal(added[0].validated,true)
  assert.match(added[0].definition,/footer_modern_config IS NULL/);assert.match(added[0].definition,/65536/)
  assert.deepEqual({...after,columns:after.columns.filter(c=>!columns.includes(c)),constraints:after.constraints.filter(c=>!added.includes(c))},before,'Unrelated schema/ACL/function/index drift')
}
export async function checkDatabase(db,release,{after=false}={}){
  const history=(await db.query('select version,name,statements from supabase_migrations.schema_migrations order by version')).rows,expected=[...release.history,...(after?release.pending:[])]
  assert.deepEqual(history.map(({version,name})=>({version,name})),expected.map(({version,name})=>({version,name})))
  for(let i=0;i<82;i++)assert.equal(hash(certificateJson(history[i].statements)),release.certificate_history[i].statements_sha256,'Historical statement drift')
  for(const m of expected.slice(82))assert.deepEqual(history.find(r=>r.version===m.version).statements,[m.text])
  const controls=(await db.query("select payment_cash_enabled,payment_card_enabled,payment_paypal_enabled,payment_bank_transfer_enabled,payment_instapay_enabled,erp_mode from public.site_settings where key='default'")).rows
  assert.equal(controls.length,1);assert.equal(controls[0].erp_mode,'built_in');for(const[k,v]of Object.entries(controls[0]))if(k.endsWith('_enabled'))assert.equal(v,false)
  const pdc=(await db.query("select is_enabled,auto_create_labels,reverse_enabled from public.shipping_provider_settings where id='pdc'")).rows;assert.deepEqual(pdc,[{is_enabled:false,auto_create_labels:false,reverse_enabled:false}])
  const protected_tables=await snapshot(db),schema=await schemaState(db)
  assert.ok(schema.relations.filter(r=>r.kind==='r').every(r=>r.owner==='postgres'))
  for(const name of ['public.payment_attempts','public.shipping_order_jobs','public.shipping_claim_jobs','private.pdc_dispatches'])assert.equal(protected_tables.find(r=>r.schema+'.'+r.name===name)?.count,0,'Outstanding provider work')
  assert.equal(schema.columns.some(c=>c.schema==='public'&&c.table_name==='site_settings'&&c.name==='footer_modern_config'),after)
  if(after)assert.equal((await db.query('select count(*)::int n from public.site_settings where footer_modern_config is not null')).rows[0].n,0,'Release must not configure footer content')
  return {history:history.map(({version,name})=>({version,name})),controls:controls[0],pdc,protected_tables,schema,auth_security:await authSecurityFingerprint(db),access:await verifyAccess(db),read_only:(await db.query('show transaction_read_only')).rows[0].transaction_read_only}
}
export async function applyMigration(db,release,{beforeMigration=()=>{},beforeCommit=()=>{}}={}){
  let begun=false
  try{
    await db.query('begin');begun=true;await db.query("set local lock_timeout='5s';set local statement_timeout='60s'")
    assert.equal((await db.query("select pg_try_advisory_xact_lock(hashtextextended('elcomputer-system-reset',0)) locked")).rows[0].locked,true)
    await checkDatabase(db,release);const before=await snapshot(db,{lock:true}),locked=await checkDatabase(db,release)
    await beforeMigration(locked)
    const m=release.pending[0];assert.equal(release.pending.length,1);assert.equal(m.sha256,footerMigrationHash);assert.equal(hash(m.text),m.sha256)
    assert.doesNotMatch(m.text,/^\s*(?:begin|commit|rollback|insert|update|delete|grant|revoke)\b/gmi)
    await db.query(m.text);await db.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',[m.version,m.name,[m.text]])
    const preservation=await compareOriginal(db,before,{authSecurity:locked.auth_security}),after=await checkDatabase(db,release,{after:true})
    assertAdditive(locked.schema,after.schema);assert.deepEqual(after.auth_security,locked.auth_security)
    const receipt={before,auth_security:locked.auth_security,history:after.history,preservation,preserved_tables:before.length,additive_schema:'PASS',existing_acl_rls_functions_triggers_indexes:'unchanged',access:after.access}
    await beforeCommit(receipt);await db.query('commit');begun=false;return receipt
  }catch(error){if(begun)await db.query('rollback').catch(()=>{});throw error}
}
