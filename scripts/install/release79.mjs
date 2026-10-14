// Exact compatibility extension; historical71 schema/receipt authority remains.
import assert from 'node:assert/strict'
import {loadRelease79,release79Descriptor,assertRelease79Source,releaseApplicationCatalog,release79Artifact,release79Stages} from '../lib/release79Certification.mjs'
import {hash,json} from '../lib/cleanBaseline.mjs'
import {ensure,fail} from './contracts.mjs'
import {verifySchema,verifyInstalledData,verifyBuckets,readJournal,assertJournal,readHistory} from './verify.mjs'
export {release79Stages}
export const release79Plan=plan=>plan.engine===2
export const releaseObservation=platform=>({...platform.identity,release_security:platform.securityIdentity})
export async function certificateFor(plan){
 try{assertRelease79Source(plan.source);const m=await loadRelease79();assert.deepEqual(plan.source.release,release79Descriptor(m));return m}catch{fail('source_changed')}
}
export async function assertFresh79(platform){
 ensure(!(await platform.db.query("select to_regnamespace('catalog_private') present")).rows[0].present,'target_occupied')
 ensure((await platform.db.query("select count(*)::int n from pg_policies where schemaname='storage' and tablename in ('objects','buckets')")).rows[0].n===0,'target_occupied')
 const ext=platform.identity.platform_extensions.find(e=>e.name==='pg_trgm')
 if(ext)ensure(ext.version==='1.6'&&ext.schema==='extensions','platform_unavailable')
 const capability=(await platform.db.query("select trusted from pg_available_extension_versions where name='pg_trgm' and version='1.6'")).rows[0]
 ensure(capability?.trusted===true,'platform_unavailable')
}
export async function releaseHistory(plan,rows,{partial=false}={}){
 const m=await certificateFor(plan)
 ensure(rows.length<=79&&(partial||rows.length>=71),'history_uncertain')
 // Baseline adoption can resume a missing subset, but execution71–79 must be a
 // contiguous prefix. Every nonempty retained statement digest is certified.
 for(const row of rows){const expected=m.history.find(r=>r.version===row.version);ensure(expected&&row.name===expected.name&&Array.isArray(row.statements)&&hash(json(row.statements))===expected.statements_sha256,'history_uncertain')}
 ensure(new Set(rows.map(r=>r.version)).size===rows.length,'history_uncertain')
 if(!partial)ensure(rows.every((r,i)=>r.version===m.history[i].version),'history_uncertain')
 return rows.length
}
export async function verifyReleaseSchema(platform,plan,version){
 if(version<71){await verifySchema(platform,70);return}
 const m=await certificateFor(plan)
 try{
  const managed=(await platform.db.query("select n.nspname schema,c.relname name,pg_get_userbyid(c.relowner) owner,c.relacl::text acl,c.relrowsecurity rls,c.relforcerowsecurity force_rls,pg_has_role(current_user,c.relowner,'MEMBER') operator_member from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname,c.relname) in (('auth','users'),('storage','objects'),('storage','buckets'),('realtime','messages')) order by 1,2")).rows
  const publicNamespace=(await platform.db.query("select pg_get_userbyid(nspowner) owner,nspacl::text acl from pg_namespace where nspname='public'")).rows[0]
  assert.deepEqual(managed.map(({acl,...r})=>r),plan.observation.managed_objects)
  assert.deepEqual({public_namespace:publicNamespace,managed_acls:managed.map(({schema,name,acl})=>({schema,name,acl}))},plan.observation.release_security)
  const actual=await releaseApplicationCatalog(platform.db),expected=await release79Artifact(m,'schema-'+version+'.json'),platformExtensions=plan.observation.platform_extensions
  const ext=m.application_extension,plpgsql=actual.public.extensions.find(e=>e.name==='plpgsql'),union=[...platformExtensions,plpgsql]
  if(version>=75&&!platformExtensions.some(e=>e.name===ext.name))union.push(ext)
  assert.deepEqual(actual.public.extensions,union.sort((a,b)=>a.name.localeCompare(b.name)))
  actual.public.extensions=actual.public.extensions.filter(e=>e.name==='plpgsql'||version>=75&&e.name===ext.name)
  assert.deepEqual(actual,expected,'Complete release schema/security drift')
 }catch{fail('target_changed')}
}
export async function verifyReleaseData(platform,plan,{version,owner}){
 const proof=await verifyInstalledData(platform,plan,{owner,storage:true})
 // The legacy seed/owner policy stays intact; new private metadata starts empty.
 const tables=(await platform.db.query("select tablename from pg_tables where schemaname='catalog_private' order by tablename")).rows
 for(const {tablename}of tables)ensure((await platform.db.query('select count(*)::int n from catalog_private."'+tablename+'"')).rows[0].n===0,'target_changed')
 const journal=await readJournal(platform.db);assertJournal(journal,plan,{complete:true});ensure(journal.auth_subject===owner,'owner_unavailable')
 return{...proof,covered_versions:70,migration71:true,normal_versions:plan.source.release.normal_migrations.slice(0,version-70).map(r=>r.version),last_migration:version,release_certificate_sha256:plan.source.release.certificate_sha256,buckets:6,owner_created:true,bootstrap_sealed:true}
}
export async function matchReleaseTarget(platform,plan){
 if(!release79Plan(plan)){assert.deepEqual(platform.identity,plan.observation);return}
 const actual=structuredClone(releaseObservation(platform)),before=plan.observation.platform_extensions,added=actual.platform_extensions.filter(e=>!before.some(b=>b.name===e.name))
 if(added.length){
  const rows=await readHistory(platform.db);await releaseHistory(plan,rows)
  ensure(rows.length>=75&&added.length===1&&JSON.stringify(added[0])===JSON.stringify({name:'pg_trgm',version:'1.6',schema:'extensions'}),'target_changed')
  actual.platform_extensions=actual.platform_extensions.filter(e=>e.name!=='pg_trgm')
 }
 try{assert.deepEqual(actual,plan.observation)}catch{fail('target_changed')}
}
export async function observeReleaseOwner(platform,plan,{complete=false}={}){
 const rows=await readHistory(platform.db),version=await releaseHistory(plan,rows),journal=await readJournal(platform.db)
 assertJournal(journal,plan,{complete:true});await verifyReleaseSchema(platform,plan,version)
 const proof=await verifyReleaseData(platform,plan,{version,owner:journal.auth_subject})
 const users=await platform.client.auth.admin.listUsers({page:1,perPage:2});ensure(!users.error&&users.data.users.length===1&&users.data.users[0].id===journal.auth_subject,'owner_unavailable')
 ensure(!complete||version===79,'history_uncertain')
 return{stage:version===79?'complete':version===71?'owner':'migration'+version,status:version===79?'complete':'verified',...proof}
}
