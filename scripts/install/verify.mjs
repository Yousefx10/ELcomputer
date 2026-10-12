import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { catalog, assertCatalogEquivalent, assertPermissionMatrix, verifyCleanData, freshGuard, hash, json } from '../lib/cleanBaseline.mjs'
import { privateInstallationCatalog } from '../lib/installationCertification.mjs'
import { bootstrapMarker } from '../lib/installationBootstrap.mjs'
import { ensure, fail, migration71 } from './contracts.mjs'

const baseline=new URL('../../supabase/bootstrap/clean-v1/',import.meta.url),follow=new URL('../../supabase/bootstrap/portability-v1/',import.meta.url)
const parse=async(url)=>JSON.parse(await readFile(url,'utf8'))
export const buckets=await parse(new URL('storage.json',baseline))
export const expected70=await parse(new URL('expected-schema.json',baseline))
export const permissions70=await parse(new URL('permissions-manifest.json',baseline))
export const expectedPrivate=await parse(new URL('expected-private-schema.json',follow))
export const manifest71=await parse(new URL('manifest.json',follow))
const seeds=await parse(new URL('seed-manifest.json',baseline))
const ident=name=>'"'+name.replaceAll('"','""')+'"'
export async function applicationCatalog(platform) {
  const current=await catalog(platform.db)
  const managed=platform.identity.platform_extensions
  assert.deepEqual(current.extensions.filter(extension=>extension.name!=='plpgsql'),managed,'Platform extensions changed.')
  current.extensions=current.extensions.filter(extension=>extension.name==='plpgsql')
  return current
}
export async function verifySchema(platform,version) {
  try {
    const current=await applicationCatalog(platform)
    if(version===70)assertCatalogEquivalent(current,expected70)
    else{
      assert.equal(hash(json(current)),manifest71.expected_public_catalog_sha256)
      assert.deepEqual(await privateInstallationCatalog(platform.db),expectedPrivate)
      for(const role of ['anon','authenticated','service_role']) {
        assert.equal((await platform.db.query("select has_schema_privilege($1,'private','USAGE') allowed",[role])).rows[0].allowed,false)
        assert.equal((await platform.db.query("select has_table_privilege($1,'private.installation_bootstrap','SELECT') allowed",[role])).rows[0].allowed,false)
        const functions=(await platform.db.query("select oid from pg_proc where pronamespace='private'::regnamespace")).rows
        for(const {oid} of functions)assert.equal((await platform.db.query("select has_function_privilege($1,$2,'EXECUTE') allowed",[role,oid])).rows[0].allowed,false)
        assert.equal((await platform.db.query("select has_function_privilege($1,'public.after_sales_notification_origin()','EXECUTE') allowed",[role])).rows[0].allowed,role==='service_role')
        assert.equal((await platform.db.query("select has_function_privilege($1,'public.installation_https_origin(text)','EXECUTE') allowed",[role])).rows[0].allowed,false)
      }
    }
    await assertPermissionMatrix(platform.db,permissions70)
    return hash(json(current))
  }catch{fail('target_changed')}
}
export async function readHistory(db) {
  if(!(await db.query("select to_regnamespace('supabase_migrations') present")).rows[0].present)return []
  ensure((await db.query("select to_regclass('supabase_migrations.schema_migrations') present")).rows[0].present,'history_uncertain')
  return (await db.query('select version,name,statements from supabase_migrations.schema_migrations order by version')).rows
}
export function validateHistory(rows,inventory,{allow71=false,partial=false}={}) {
  const approved=[...inventory.map(row=>({version:row.version,name:row.name})),...(allow71?[{version:'20261012160000',name:'quick_setup_installation_bootstrap'}]:[])]
  ensure(rows.length<=approved.length && (partial||rows.length===approved.length),'history_uncertain')
  for(const row of rows)ensure(approved.some(item=>item.version===row.version&&item.name===row.name) && Array.isArray(row.statements)&&row.statements.length>0&&row.statements.every(statement=>typeof statement==='string'&&statement.length>0),'history_uncertain')
  ensure(new Set(rows.map(row=>row.version)).size===rows.length,'history_uncertain')
  return inventory.filter(row=>!rows.some(item=>item.version===row.version)).map(row=>row.version)
}
export async function assertFresh(platform) {
  try{
    ensure(!(await platform.db.query("select to_regnamespace('private') present")).rows[0].present,'target_occupied')
    await platform.db.query(freshGuard)
    const users=await platform.client.auth.admin.listUsers({page:1,perPage:2}),bucketList=await platform.client.storage.listBuckets()
    ensure(!users.error&&!bucketList.error&&users.data.users.length===0&&bucketList.data.length===0,'target_occupied')
  }catch{fail('target_occupied')}
}
export async function verifyBaseline(platform,plan) {
  await verifySchema(platform,70)
  try{const clean=await verifyCleanData(platform.db);ensure(clean.installation_id===plan.target.installation_id,'target_changed')}catch{fail('target_changed')}
}
export async function readJournal(db) {
  const present=(await db.query("select to_regclass('private.installation_bootstrap') present")).rows[0].present
  return present?(await db.query('select to_jsonb(j) journal from private.installation_bootstrap j')).rows[0]?.journal:null
}
export function assertJournal(journal,plan,{complete=false}={}) {
  ensure(journal?.installation_id===plan.target.installation_id && ['available','registered','auth_started','complete'].includes(journal.phase),'target_changed')
  if(journal.binding)for(const [key,value] of Object.entries({installation_id:plan.target.installation_id,request_id:plan.owner_request_id,target_digest:plan.plan_digest,project_ref:plan.target.project_ref,site_origin:plan.target.site_origin}))ensure(journal.binding[key]===value,'target_changed')
  if(complete)ensure(journal.phase==='complete','bootstrap_uncertain')
}
export async function verifyInstalledData(platform,plan,{owner=null,pendingSubject=null,storage=false}={}) {
  const db=platform.db,names=(await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows
  const extra={quick_setup_revisions:17,shipping_provider_settings:1,customer_profiles:owner||pendingSubject?1:0,admin_users:owner?1:0,admin_activity_logs:owner?1:0,store_analytics_internal_users:owner?1:0},counts={}
  try{
    for(const {tablename} of names){
      const rows=(await db.query(`select to_jsonb(t) row from public.${ident(tablename)} t`)).rows.map(item=>item.row)
      counts[tablename]=rows.length
      assert.equal(rows.length,extra[tablename]??seeds[tablename]?.length??0)
      if(seeds[tablename]&&!tablename.startsWith('quick_setup_')) {
        const fields=Object.keys(seeds[tablename][0]),project=records=>records.map(row=>Object.fromEntries(fields.map(key=>[key,row[key]]))).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b),'en'))
        assert.deepEqual(project(rows),project(seeds[tablename]))
      }
    }
    const state=(await db.query('select installation_id,revision,selections from public.quick_setup_state')).rows[0]
    assert.equal(state.installation_id,plan.target.installation_id);assert.equal(state.revision,'0');assert.deepEqual(state.selections,{})
    assert.equal((await db.query('select count(*)::int n from public.quick_setup_revisions where revision<>0')).rows[0].n,0)
    const pdc=(await db.query('select * from public.shipping_provider_settings')).rows[0]
    for(const name of ['company_id','product_id','origin_city_id','origin_address','origin_phone','origin_contact_name','access_token_encrypted','webhook_secret_encrypted','cities_synced_at','products_synced_at','lookup_attempted_at','reverse_shipment_type_id','updated_by'])assert.equal(pdc[name],null)
    for(const name of ['is_enabled','auto_create_labels','reverse_enabled'])assert.equal(pdc[name],false)
    for(const [name,value]of Object.entries({id:'pdc',display_name:'PDC Courier',base_url:'https://clientsapi.pdc-eg.com/api/ClientUsers/V6/',api_mode:'production',status_timezone:'Africa/Cairo',shipment_type_id:1,label_template_id:1,allow_open_shipment:false,all_must_valid:true}))assert.equal(pdc[name],value)
    assert.equal(Number(pdc.default_weight_kg),1)
    assert.deepEqual(pdc.cities_cache,[]);assert.deepEqual(pdc.products_cache,[])
    assert.equal((await db.query('select count(*)::int n from storage.objects')).rows[0].n,0)
    assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n,owner||pendingSubject?1:0)
    if(owner||pendingSubject){
      const profile=(await db.query('select id,is_internal from public.customer_profiles')).rows[0]
      assert.equal(profile.id,owner||pendingSubject);if(owner)assert.equal(profile.is_internal,true)
    }
    if(owner){
      const admin=(await db.query('select id,role,is_active,permissions from public.admin_users')).rows[0]
      assert.equal(admin.id,owner);assert.equal(admin.role,'owner');assert.equal(admin.is_active,true)
      assert.equal((await db.query('select user_id from public.store_analytics_internal_users')).rows[0].user_id,owner)
      const keys=Object.keys((await db.query('select public.default_admin_permissions() permissions')).rows[0].permissions).sort()
      assert.deepEqual(Object.keys(admin.permissions).sort(),keys);assert.ok(Object.values(admin.permissions).every(value=>value===true))
      const audit=(await db.query('select action_key,metadata from public.admin_activity_logs')).rows[0]
      assert.equal(audit.action_key,'installation.owner.bootstrap');assert.equal(audit.metadata.installation_id,plan.target.installation_id);assert.equal(audit.metadata.request_id,plan.owner_request_id)
    }
    if(storage)await verifyBuckets(platform,{complete:storage===true});else ensure((await db.query('select count(*)::int n from storage.buckets')).rows[0].n===0,'target_changed')
    return {business_rows:0,non_owner_profiles:0,providers_enabled:0,counts_sha256:hash(json(counts))}
  }catch(error){if(error.code&&error.constructor.name==='InstallationError')throw error;fail(owner?'owner_unavailable':'target_changed')}
}
export async function verifyBuckets(platform,{complete=false}={}) {
  const api=await platform.client.storage.listBuckets();ensure(!api.error,'platform_unavailable')
  const db=(await platform.db.query('select id,name,public,file_size_limit,allowed_mime_types from storage.buckets order by id')).rows
  const normalize=row=>({id:row.id,public:row.public,file_size_limit:Number(row.file_size_limit),allowed_mime_types:row.allowed_mime_types})
  ensure(db.length<=buckets.length && (!complete||db.length===buckets.length),'target_changed')
  for(const row of db) {
    const expected=buckets.find(bucket=>bucket.id===row.id),remote=api.data.find(bucket=>bucket.id===row.id)
    ensure(expected&&remote&&row.name===row.id,'target_changed')
    try{assert.deepEqual(normalize(row),expected);assert.deepEqual(normalize(remote),expected)}catch{fail('target_changed')}
  }
  ensure(api.data.length===db.length,'target_changed')
  ensure((await platform.db.query('select count(*)::int n from storage.objects')).rows[0].n===0,'target_changed')
  return db.map(row=>row.id)
}
export async function pendingIdentity(platform,plan,journal) {
  const response=await platform.client.auth.admin.listUsers({page:1,perPage:2});ensure(!response.error,'platform_unavailable')
  const users=response.data.users
  if(users.length===0)return null
  ensure(journal.phase==='auth_started'&&users.length===1,'bootstrap_uncertain')
  const marker=bootstrapMarker({installation_id:plan.target.installation_id,request_id:plan.owner_request_id,target_digest:plan.plan_digest,project_ref:plan.target.project_ref})
  try{assert.deepEqual(users[0].app_metadata?.elcomputer_bootstrap,marker)}catch{fail('bootstrap_uncertain')}
  return users[0].id
}
