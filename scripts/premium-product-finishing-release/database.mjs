// Schema89 is already deployed. This release has no database mutation path.
import assert from 'node:assert/strict'
import {schemaState,snapshot,verifyAccess,hash} from '../footer-release/database.mjs'
import {migrations as deployedMigrations} from '../premium-product-release/database.mjs'
import {connect as deployedConnect} from '../commerce-release/database.mjs'
import {authSecurityFingerprint} from '../live-sales-release/auth.mjs'
import {json as certificateJson} from '../lib/cleanBaseline.mjs'
export {hash,schemaState,snapshot}
export const applicationCommit='64c3e681d198d6275f58772b06d140f30485bfa0'
export const previousApplicationCommit='a2e47a53b016051500180876b25feb2420d7038d'
export const connect=target=>deployedConnect(target,{readOnly:true})
export async function migrations(repo){const r=await deployedMigrations(repo);return {history:[...r.history,...r.pending],certificate_history:r.certificate_history}}
export async function checkDatabase(db,release){
 const read_only=(await db.query('show transaction_read_only')).rows[0].transaction_read_only;assert.equal(read_only,'on','App-only release requires read-only SQL')
 const history=(await db.query('select version,name,statements from supabase_migrations.schema_migrations order by version')).rows
 assert.equal(history.length,89);assert.deepEqual(history.map(({version,name})=>({version,name})),release.history.map(({version,name})=>({version,name})))
 for(let i=0;i<82;i++)assert.equal(hash(certificateJson(history[i].statements)),release.certificate_history[i].statements_sha256)
 for(const m of release.history.slice(82))assert.deepEqual(history.find(r=>r.version===m.version).statements,[m.text])
 // Availability flags remain exact approved data. Runtime/Caddy hold all live commerce.
 const controls=(await db.query("select payment_cash_enabled,payment_card_enabled,payment_paypal_enabled,payment_bank_transfer_enabled,payment_instapay_enabled,erp_mode from public.site_settings where key='default'")).rows
 assert.equal(controls.length,1);assert.equal(controls[0].erp_mode,'built_in');for(const [key,value]of Object.entries(controls[0]))if(key.endsWith('_enabled'))assert.equal(typeof value,'boolean')
 const pdc=(await db.query("select is_enabled,auto_create_labels,reverse_enabled from public.shipping_provider_settings where id='pdc'")).rows;assert.deepEqual(pdc,[{is_enabled:false,auto_create_labels:false,reverse_enabled:false}])
 const schema=await schemaState(db),protected_tables=await snapshot(db)
 assert.ok(schema.relations.filter(r=>r.kind==='r').every(r=>r.owner==='postgres'))
 const column=schema.columns.find(c=>c.schema==='public'&&c.table_name==='site_settings'&&c.name==='footer_modern_config');assert.ok(column);assert.equal(column.type,'jsonb');assert.equal(column.not_null,false);assert.equal(column.default_value,null)
 const constraint=schema.constraints.find(c=>c.schema==='public'&&c.table_name==='site_settings'&&c.name==='site_settings_modern_footer_config_check');assert.ok(constraint?.validated);assert.match(constraint.definition,/65536/)
 for(const name of ['public.payment_attempts','public.shipping_order_jobs','public.shipping_claim_jobs','private.pdc_dispatches'])assert.equal(protected_tables.find(t=>t.schema+'.'+t.name===name)?.count,0)
 // Current saved Modern JSON is valid production content, including non-NULL.
 // Its complete bytes and all settings are bound by the original row projection.
 const presentation_style=(await db.query("select product_page_style from public.site_settings where key='default'")).rows[0].product_page_style;assert.ok(['classic','premium'].includes(presentation_style))
 return {presentation_style,history:history.map(({version,name})=>({version,name})),controls:controls[0],pdc,protected_tables,schema,auth_security:await authSecurityFingerprint(db),access:await verifyAccess(db),read_only}
}

// Only the two already approved telemetry tables may advance. All business,
// catalog, Auth security, schema, ACL/RLS, settings and metadata remain bound.
export function assertPreserved(current,before,project) {
 assert.deepEqual(project(current),project(before),'Protected production state changed')
 for(const name of ['store_analytics_events','store_analytics_sessions']) {
  const old=before.protected_tables.find(t=>t.schema==='public'&&t.name===name),now=current.protected_tables.find(t=>t.schema==='public'&&t.name===name)
  assert.ok(old&&now&&now.count>=old.count,'Analytics history shrank')
 }
}
