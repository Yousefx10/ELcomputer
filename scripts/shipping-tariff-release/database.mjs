// Release tooling only. The sealed application and SQL are immutable inputs.
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { hash, connect, snapshot } from '../commerce-release/database.mjs'
import { schemaState, verifyAccess } from '../footer-release/database.mjs'
import { compareOriginal } from '../live-sales-release/database.mjs'
import { authSecurityFingerprint } from '../live-sales-release/auth.mjs'
import { approvalState as originalProjection } from '../live-sales-release/operator.mjs'
import { json as certificateJson } from '../lib/cleanBaseline.mjs'
export { hash, connect, snapshot, schemaState }
export const migrationFile = '20261023010000_shipping_tariff_drafts.sql'
const tables = ['shipping_tariffs', 'shipping_tariff_revisions']
const signatures = ['private.shipping_tariff_actor(uuid,uuid)', 'private.shipping_tariff_validate(jsonb,boolean)', 'shipping_tariff_read(uuid,uuid,uuid,integer)', 'shipping_tariff_save(uuid,uuid,uuid,uuid,integer,jsonb,boolean)']
const reset = f => f.schema === 'catalog_private' && f.signature === 'catalog_private.reset_assert_coverage()'
const addedText = "'pdc_dispatches','shipping_tariffs','shipping_tariff_revisions'"
const originalText = "'pdc_dispatches'"
const tariffRow = (key, row) => key === 'functions'
  ? signatures.includes(row.signature.replace(/^public\./, ''))
  : (row.schema || row.schemaname) === 'private' && tables.includes(row.table_name || row.tablename || row.name)

export async function migrations(repo, artifact) {
  const names = execFileSync('git', ['ls-tree', '-r', '--name-only', artifact.application_commit, 'supabase/migrations'], { cwd:repo, encoding:'utf8' }).trim().split('\n').map(n => n.split('/').at(-1)).sort()
  assert.equal(names.length, 91); assert.equal(names.at(-1), migrationFile)
  assert.deepEqual((await readdir(repo + '/supabase/migrations')).filter(n => n.endsWith('.sql')).sort(), names)
  const certificate = JSON.parse(await readFile(repo + '/supabase/bootstrap/release-82-v1/manifest.json'))
  const files = []
  for (const filename of names) {
    const bytes = await readFile(repo + '/supabase/migrations/' + filename)
    const pinned = execFileSync('git', ['show', artifact.application_commit + ':supabase/migrations/' + filename], { cwd:repo, encoding:'buffer', maxBuffer:8e6 })
    assert.equal(hash(bytes), hash(pinned), 'Historical/sealed SQL changed')
    files.push({ filename, version:filename.slice(0,14), name:filename.slice(15,-4), text:bytes.toString(), sha256:hash(bytes) })
  }
  for (let i=0; i<82; i++) { assert.equal(files[i].filename, certificate.migrations[i].filename); assert.equal(files[i].sha256, certificate.migrations[i].sha256) }
  assert.equal(files[90].sha256, artifact.migrations[0].sha256)
  return { history:files.slice(0,90), pending:files.slice(90), certificate_history:certificate.history }
}

export const tariffDelta = schema => Object.fromEntries(Object.entries(schema).map(([key, rows]) => [key, rows.filter(row => tariffRow(key,row))]))
export const normalizeDeltaOwner = (delta, owner) => Object.fromEntries(Object.entries(delta).map(([key, rows]) => [key, rows.map(row => ({ ...row,
  ...('owner' in row ? { owner:'postgres' } : {}), ...('acl' in row && row.acl !== null ? { acl:row.acl.replaceAll(owner, 'postgres') } : {})
}))]))
export function stripTariffSchema(schema) {
  return Object.fromEntries(Object.entries(schema).map(([key, rows]) => [key, rows.filter(row => !tariffRow(key,row)).map(row => key === 'functions' && reset(row) ? { ...row, definition:row.definition.replace(addedText,originalText) } : row)]))
}
export function assertTariffOnlyDelta(before, after, expected) {
  assert.deepEqual(tariffDelta(after), expected, 'Only the exact qualified tariff objects may be added')
  assert.equal(expected.relations.length,2); assert.ok(expected.relations.every(r=>r.schema==='private'&&r.kind==='r'&&r.rls&&!r.force_rls))
  assert.equal(expected.functions.length,4); assert.equal(expected.policies.length,0); assert.equal(expected.triggers.length,0)
  const oldReset=before.functions.find(reset), newReset=after.functions.find(reset)
  assert.ok(oldReset && newReset); assert.ok(oldReset.definition.includes(originalText)); assert.ok(!oldReset.definition.includes(addedText))
  assert.equal(newReset.definition,oldReset.definition.replace(originalText,addedText),'Only the exact reset retention registration may change')
  assert.deepEqual(stripTariffSchema(after),before,'Unrelated schema/ACL/RLS/function/index/trigger change')
}
export const approvalState = value => originalProjection({ ...value, read_only:'on', history:value.history.slice(0,90),
  schema:stripTariffSchema(value.schema), protected_tables:value.protected_tables.filter(t=>!(t.schema==='private'&&tables.includes(t.name))) })
export function assertPreserved(current, before) {
  assert.deepEqual(approvalState(current),approvalState(before),'Protected production state changed')
  for(const name of ['store_analytics_events','store_analytics_sessions']){
    const a=before.protected_tables.find(t=>t.schema==='public'&&t.name===name),b=current.protected_tables.find(t=>t.schema==='public'&&t.name===name)
    assert.ok(a&&b&&b.count>=a.count,'Analytics history shrank')
  }
}
export async function tariffAccess(db) {
  for(const table of tables){
    assert.equal((await db.query('select relrowsecurity from pg_class where oid=$1::regclass',['private.'+table])).rows[0].relrowsecurity,true)
    assert.equal((await db.query('select count(*)::int n from private.'+table)).rows[0].n,0,'No tariff import belongs to deployment')
    for(const role of ['anon','authenticated','service_role'])for(const privilege of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE'])assert.equal((await db.query('select has_table_privilege($1,$2,$3) allowed',[role,'private.'+table,privilege])).rows[0].allowed,false)
  }
  for(const signature of signatures)for(const role of ['anon','authenticated','service_role'])assert.equal((await db.query("select has_function_privilege($1,$2,'EXECUTE') allowed",[role,signature])).rows[0].allowed,role==='service_role'&&!signature.startsWith('private.'))
  return 'PASS'
}
export async function checkDatabase(db, release, { after=false }={}) {
  const history=(await db.query('select version,name,statements from supabase_migrations.schema_migrations order by version')).rows
  const expected=[...release.history,...(after?release.pending:[])]
  assert.deepEqual(history.map(({version,name})=>({version,name})),expected.map(({version,name})=>({version,name})))
  for(let i=0;i<82;i++)assert.equal(hash(certificateJson(history[i].statements)),release.certificate_history[i].statements_sha256)
  for(const m of expected.slice(82))assert.deepEqual(history.find(r=>r.version===m.version).statements,[m.text])
  const controls=(await db.query("select payment_cash_enabled,payment_card_enabled,payment_paypal_enabled,payment_bank_transfer_enabled,payment_instapay_enabled,erp_mode from public.site_settings where key='default'")).rows
  assert.equal(controls.length,1);assert.equal(controls[0].erp_mode,'built_in')
  const pdc=(await db.query("select is_enabled,auto_create_labels,reverse_enabled,cod_enabled from public.shipping_provider_settings where id='pdc'")).rows
  assert.deepEqual(pdc,[{is_enabled:false,auto_create_labels:false,reverse_enabled:false,cod_enabled:false}])
  const schema=await schemaState(db),protected_tables=await snapshot(db)
  assert.ok(schema.relations.filter(r=>r.kind==='r').every(r=>r.owner==='postgres'))
  for(const name of ['public.payment_attempts','public.payment_transactions','public.shipping_order_jobs','public.shipping_claim_jobs','private.pdc_dispatches'])assert.equal(protected_tables.find(t=>t.schema+'.'+t.name===name)?.count,0,'Outstanding financial/provider work needs a separate plan')
  if(after)await tariffAccess(db);else assert.equal(tariffDelta(schema).relations.length,0)
  return { history:history.map(({version,name})=>({version,name})), controls:controls[0],pdc,protected_tables,schema,
    presentation_style:(await db.query("select product_page_style from public.site_settings where key='default'")).rows[0].product_page_style,
    auth_security:await authSecurityFingerprint(db),access:await verifyAccess(db),read_only:(await db.query('show transaction_read_only')).rows[0].transaction_read_only }
}
export async function applyMigration(db,release,{approval,seal,expectedDelta,beforeMigration=()=>{},beforeCommit=()=>{}}={}){
  assert.match(seal||'',/^[a-f0-9]{64}$/);assert.equal(approval,seal,'Exact tariff-only owner approval is required')
  let begun=false
  try{
    await db.query('begin');begun=true;await db.query("set local lock_timeout='5s';set local statement_timeout='90s'")
    assert.equal((await db.query("select pg_try_advisory_xact_lock(hashtextextended('elcomputer-system-reset',0)) locked")).rows[0].locked,true)
    const initial=await checkDatabase(db,release),before=await snapshot(db,{lock:true}),locked=await checkDatabase(db,release)
    assertPreserved(locked,initial);await beforeMigration(locked)
    assert.equal(release.pending.length,1);const m=release.pending[0];assert.equal(m.filename,migrationFile);assert.equal(hash(m.text),m.sha256)
    assert.equal((m.text.match(/^begin;$/gmi)||[]).length,1);assert.equal((m.text.match(/^commit;$/gmi)||[]).length,1)
    const sql=m.text.replace(/^([\s\S]*?)(?=begin;)/i,'').replace(/^begin;\s*/i,'').replace(/commit;\s*$/i,'')
    assert.doesNotMatch(sql,/^\s*(begin|commit|rollback)\s*;/gmi)
    await db.query(sql);await db.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',[m.version,m.name,[m.text]])
    const preservation=await compareOriginal(db,before,{authSecurity:locked.auth_security}),after=await checkDatabase(db,release,{after:true})
    assertTariffOnlyDelta(locked.schema,after.schema,expectedDelta);assertPreserved(after,locked)
    const receipt={schema:91,migration_sha256:m.sha256,migrations_applied:1,business_data_writes:0,preserved_tables:before.length,preservation,after}
    await beforeCommit(receipt);await db.query('commit');begun=false;return receipt
  }catch(error){if(begun)await db.query('rollback').catch(()=>{});throw error}
}
