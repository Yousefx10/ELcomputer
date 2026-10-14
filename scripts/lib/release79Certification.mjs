import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {resolve} from 'node:path'
import {catalog,hash,json,verifyBundle} from './cleanBaseline.mjs'

export const release79Id='release-79-v1'
// Filled only after the independent owned compiler produces reviewed artifacts.
export const release79ManifestHash='84a020efb402f6a60e4b53c033cfebf01cc2f132cc28d8c1725f76e438ddbc3f'
export const normal79Files=[
 '20261012160000_quick_setup_installation_bootstrap.sql',
 '20261013120000_atomic_product_saves.sql','20261013140000_media_reference_safety.sql',
 '20261013160000_product_draft_default.sql','20261013180000_product_listing.sql',
 '20261013200000_product_bulk_operations.sql','20261014120000_catalog_transfer.sql',
 '20261014180000_catalog_import.sql','20261014200000_system_reset_compatibility.sql'
]
export const release79Stages=normal79Files.slice(1).map((_,i)=>'migration'+(i+72))
const root=fileURLToPath(new URL('../../',import.meta.url)),directory=new URL('../../supabase/bootstrap/release-79-v1/',import.meta.url)
export const isApplicationInput=name=>/^(app\/|server\/|shared\/|i18n\/|public\/|nuxt\.config\.ts$|package(?:-lock)?\.json$|tsconfig\.json$)/.test(name)
export async function loadRelease79({sourceNames=null}={}){
 const raw=await readFile(new URL('manifest.json',directory));assert.equal(hash(raw),release79ManifestHash,'Unreviewed release certificate')
 const m=JSON.parse(raw);assert.equal(m.format,1);assert.equal(m.version,release79Id);assert.equal(m.last_migration,79)
 const {inventory}=await verifyBundle();assert.deepEqual(m.migrations.slice(0,70).map(({ordinal,...r})=>r),inventory)
 assert.deepEqual(m.migrations.slice(70).map(r=>r.filename),normal79Files)
 assert.equal(hash(await readFile(new URL('../../supabase/bootstrap/clean-v1/manifest.json',import.meta.url))),m.baseline_manifest_sha256)
 assert.equal(hash(await readFile(new URL('../../supabase/bootstrap/portability-v1/manifest.json',import.meta.url))),m.portability_manifest_sha256)
 assert.deepEqual((await readdir(new URL('../../supabase/migrations/',import.meta.url))).filter(n=>n.endsWith('.sql')).sort(),m.migrations.map(r=>r.filename))
 for(const row of m.migrations)assert.equal(hash(await readFile(resolve(root,'supabase/migrations',row.filename))),row.sha256)
 for(const [name,h]of Object.entries(m.artifacts)){assert.match(name,/^[a-z0-9-]+\.json$/);assert.equal(hash(await readFile(new URL(name,directory))),h)}
 if(sourceNames){assert.deepEqual(sourceNames.filter(isApplicationInput).sort(),Object.keys(m.application_inputs).sort());for(const [name,h]of Object.entries(m.application_inputs))assert.equal(hash(await readFile(resolve(root,name))),h)}
 return m
}
export const release79Descriptor=m=>({id:release79Id,certificate_sha256:release79ManifestHash,application_checkpoint:m.application_checkpoint,application_inputs_sha256:hash(json(m.application_inputs)),normal_migrations:m.migrations.slice(70).map(({version,filename,sha256})=>({version,filename,sha256})),last_migration:79})
export function assertRelease79Source(source){
 assert.equal(source?.release?.id,release79Id);assert.equal(source.release.certificate_sha256,release79ManifestHash);assert.equal(source.release.last_migration,79)
 assert.deepEqual(source.release.normal_migrations?.map(r=>r.filename),normal79Files)
}
export async function release79Artifact(m,name){const raw=await readFile(new URL(name,directory));assert.equal(hash(raw),m.artifacts[name]);return JSON.parse(raw)}

// Public definitions use the historical catalog unchanged. Add complete private
// catalogs and effective privileges, including default/column/schema grants.
export async function releaseApplicationCatalog(db){
 const publicCatalog=await catalog(db),privateCatalog={}
 for(const schema of ['private','catalog_private']){
  const result={},q={
   namespace:"select nspname,pg_get_userbyid(nspowner) owner,nspacl::text acl from pg_namespace where nspname=$1",
   relations:"select c.relname name,c.relkind kind,pg_get_userbyid(c.relowner) owner,c.relrowsecurity rls,c.relforcerowsecurity force_rls,c.relacl::text acl,c.reloptions options from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=$1 order by 1",
   columns:"select c.relname relation,a.attnum number,a.attname name,format_type(a.atttypid,a.atttypmod) type,a.attnotnull not_null,a.attacl::text acl,pg_get_expr(d.adbin,d.adrelid) default_expression,a.attidentity identity,a.attgenerated generated from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where n.nspname=$1 and a.attnum>0 and not a.attisdropped order by 1,2",
   constraints:"select c.conrelid::regclass::text relation,c.conname name,c.convalidated validated,pg_get_constraintdef(c.oid) definition from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname=$1 order by 1,2",
   indexes:"select i.indexrelid::regclass::text name,i.indrelid::regclass::text relation,i.indisvalid valid,i.indisready ready,pg_get_indexdef(i.indexrelid) definition from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname=$1 order by 1",
   functions:"select p.oid::regprocedure::text signature,pg_get_userbyid(p.proowner) owner,p.prosecdef security_definer,p.provolatile volatility,p.proconfig configuration,p.proacl::text acl,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=$1 order by 1",
   triggers:"select t.tgrelid::regclass::text relation,t.tgname name,t.tgenabled enabled,pg_get_triggerdef(t.oid) definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname=$1 and not t.tgisinternal order by 1,2",
   policies:"select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname=$1 order by 2,3"
  };for(const [name,sql]of Object.entries(q))result[name]=(await db.query(sql,[schema])).rows;privateCatalog[schema]=result
 }
 const privileges={},queries={
  relations:"select n.nspname schema,c.relname name,c.relacl::text acl from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' order by 1,2",
  columns:"select c.relname relation,a.attname name,a.attacl::text acl from pg_attribute a join pg_class c on c.oid=a.attrelid where c.relnamespace='public'::regnamespace and a.attnum>0 and not a.attisdropped order by 1,2",
  functions:"select p.oid::regprocedure::text signature,p.proacl::text acl from pg_proc p where p.pronamespace='public'::regnamespace order by 1",
  defaults:"select n.nspname schema,pg_get_userbyid(d.defaclrole) role,d.defaclobjtype kind,d.defaclacl::text acl from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace where n.nspname in ('public','private','catalog_private') or d.defaclnamespace=0 order by 1,2,3",
  triggers:"select t.tgrelid::regclass::text relation,t.tgname name,t.tgenabled enabled,pg_get_triggerdef(t.oid) definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','catalog_private') and not t.tgisinternal order by 1,2",
  roles:"select rolname name,rolsuper superuser,rolcreaterole create_role,rolcreatedb create_database,rolinherit inherit,rolbypassrls bypass_rls from pg_roles where rolname in ('anon','authenticated','service_role') order by 1",
  memberships:"select member.rolname member,role.rolname role,m.admin_option from pg_auth_members m join pg_roles member on member.oid=m.member join pg_roles role on role.oid=m.roleid where member.rolname in ('anon','authenticated','service_role') order by 1,2",
  storage_policies:"select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname='storage' and tablename in ('objects','buckets') order by 1,2,3",
  schemas:"select n.nspname schema,r.role,has_schema_privilege(r.role,n.oid,'USAGE') usage,has_schema_privilege(r.role,n.oid,'CREATE') as \"create\" from pg_namespace n cross join (values('anon'),('authenticated'),('service_role')) r(role) where n.nspname in ('public','private','catalog_private') order by 1,2"
 };for(const [name,sql]of Object.entries(queries))privileges[name]=(await db.query(sql)).rows
 return{public:publicCatalog,private:privateCatalog,privileges}
}
