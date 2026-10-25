// Additive, approval-bound 91 -> 94 only. Never imports history or changes gates.
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {connect,snapshot} from '../commerce-release/database.mjs'
import {schemaState} from '../footer-release/database.mjs'
import {authSecurityFingerprint} from '../live-sales-release/auth.mjs'
import {compareOriginal} from '../live-sales-release/database.mjs'
import {approvalState} from '../live-sales-release/operator.mjs'
export {connect,compareOriginal,approvalState}
export const hash=value=>createHash('sha256').update(value).digest('hex')
const sorted=v=>Array.isArray(v)?v.map(sorted):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sorted(v[k])])):v
export const digest=value=>hash(JSON.stringify(sorted(value)))
const orderRows=rows=>[...rows].sort((a,b)=>{const x=JSON.stringify(sorted(a)),y=JSON.stringify(sorted(b));return x<y?-1:x>y?1:0})
// Catalog rows are sets. Use binary canonical ordering rather than either
// server's locale; preserve every property, definition and column ordinal.
export const canonicalSchema=schema=>Object.fromEntries(Object.entries(schema).map(([k,rows])=>[k,orderRows(rows)]))
export const comparableState=state=>{const {read_only,...stable}=approvalState(state);return stable}
export const pendingVersions=['20261024150000','20261024160000','20261025120000']
export const scope=Object.freeze({milestone:'inactive_beta_customer_history',schema_before:91,schema_after:94,historical_import:false,claims:false,runtime_change:false,caddy_change:false,provider_calls:false,public_checkout:false,signup:false})

export async function releaseInputs(repo,frozen){
 const names=(await readdir(repo+'/supabase/migrations')).filter(n=>n.endsWith('.sql')).sort()
 assert.equal(names.length,94);assert.deepEqual(names,frozen.migrations.map(m=>m.filename))
 const files=[]
 for(const m of frozen.migrations){const text=await readFile(repo+'/supabase/migrations/'+m.filename,'utf8');assert.equal(hash(text),m.sha256,'Migration drift');files.push({...m,text,name:m.filename.slice(15,-4)})}
 const pending=files.slice(91);assert.deepEqual(pending.map(m=>m.version),pendingVersions)
 for(const m of pending){assert.equal((m.text.match(/^begin;\s*$/gmi)||[]).length,1);assert.equal((m.text.match(/^commit;\s*$/gmi)||[]).length,1)}
 return {files,pending}
}

export async function historyAccess(db){
 const tables=(await db.query("select c.relname name,c.relrowsecurity rls,pg_get_userbyid(c.relowner) owner from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='customer_history_private' and c.relkind='r' order by 1")).rows
 assert.deepEqual(tables.map(t=>t.name),['batches','customers','items','orders','sources'])
 for(const t of tables){assert.equal(t.rls,true);assert.equal(t.owner,'postgres');assert.equal((await db.query('select count(*)::int n from customer_history_private.'+t.name)).rows[0].n,0,'History import is excluded')}
 for(const role of ['anon','authenticated','service_role']){
  assert.equal((await db.query("select has_schema_privilege($1,'customer_history_private','USAGE') allowed",[role])).rows[0].allowed,false)
  for(const table of tables)for(const privilege of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE'])assert.equal((await db.query('select has_table_privilege($1,$2,$3) allowed',[role,'customer_history_private.'+table.name,privilege])).rows[0].allowed,false)
 }
 const functions=['customer_history_import_batch(uuid,text,text,uuid,jsonb)','customer_history_claim(uuid)','customer_history_read(uuid,uuid,text,integer)','customer_history_hide_source(uuid,text)','commerce_release_backorder(uuid,uuid)','commerce_expire_unpaid_card_orders(integer)']
 for(const f of functions)for(const role of ['anon','authenticated','service_role'])assert.equal((await db.query("select has_function_privilege($1,$2,'EXECUTE') allowed",[role,'public.'+f])).rows[0].allowed,role==='service_role','RPC authorization drift')
 return {private_rls_and_grants:'PASS',history_tables_empty:true,public_rpc_service_only:true}
}

export async function databaseState(db,release,{after=false}={}){
 const history=(await db.query('select version,name,statements from supabase_migrations.schema_migrations order by version')).rows
 assert.deepEqual(history.map(r=>r.version),release.files.slice(0,after?94:91).map(r=>r.version),'Unexpected migration lineage')
 if(after)for(const m of release.pending){const row=history.find(r=>r.version===m.version);assert.equal(row.name,m.name);assert.deepEqual(row.statements,[m.text])}
 else assert.equal((await db.query("select to_regnamespace('customer_history_private') present")).rows[0].present,null,'History is already installed')
 const vaultPresent=(await db.query("select to_regclass('vault.secrets') present")).rows[0].present
 const vaultRows=vaultPresent?(await db.query('select count(*)::int n from vault.secrets')).rows[0].n:0
 return {history,schema:canonicalSchema(await schemaState(db)),protected_tables:orderRows(await snapshot(db)),auth_security:await authSecurityFingerprint(db),managed_vault_secret_rows:vaultRows,...(after?{history_access:await historyAccess(db)}:{}),read_only:(await db.query('show transaction_read_only')).rows[0].transaction_read_only}
}

// Protect the same original-column projections across added defaults. Managed
// Auth activity timestamps and ordinary telemetry use established approval rules.
export async function applySchema(db,release,plan,{beforeCommit=async()=>{}}={}){
 let begun=false
 try {
  await db.query('begin');begun=true
  await db.query("set local lock_timeout='5s';set local statement_timeout='60s'")
  assert.equal((await db.query("select pg_try_advisory_xact_lock(hashtextextended('elcomputer-system-reset',0)) locked")).rows[0].locked,true)
  const initial=await databaseState(db,release)
  assert.deepEqual(comparableState(initial),comparableState(plan.database),'Pre-migration target changed')
  const before=await snapshot(db,{lock:true}),locked=await databaseState(db,release)
  assert.deepEqual(comparableState(locked),comparableState(plan.database))
  for(const m of release.pending){
   assert.equal(hash(m.text),m.sha256)
   await db.query(m.text.replace(/^begin;\s*$/im,'').replace(/^commit;\s*$/im,''))
   await db.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',[m.version,m.name,[m.text]])
  }
  const preservation=await compareOriginal(db,before,{authSecurity:locked.auth_security}),after=await databaseState(db,release,{after:true})
  assert.deepEqual(after.history.slice(0,91),initial.history,'Old ledger changed')
  assert.deepEqual(after.auth_security,initial.auth_security)
  assert.deepEqual(after.schema,plan.expected_after_schema,'Unexpected 91-to94 schema change')
  const receipt={schema:94,migrations_applied:3,business_data_writes:0,history_rows:0,claims:0,preservation:'PASS',protected_tables:before.length,auth_security_unchanged:true,auth_activity:preservation,history_access:after.history_access,after_schema_sha256:digest(after.schema)}
  await beforeCommit(receipt)
  await db.query('commit');begun=false
  return receipt
 } catch(error){if(begun)await db.query('rollback').catch(()=>{});throw error}
}
