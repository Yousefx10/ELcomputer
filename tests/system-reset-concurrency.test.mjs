import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createStorageNativeDatabase, storageNativeAvailable } from './helpers/storageNativeDatabase.mjs'
import { createProductSaveFixture } from './helpers/productSaveFixture.mjs'
import { nativeWaitFor } from './helpers/emailNativeDatabase.mjs'
import {readFile} from 'node:fs/promises'

test('migration79 is additive under actual non-superuser execution and preserves old pending evidence', {skip:!storageNativeAvailable,timeout:60000},async()=>{
 const db=await createStorageNativeDatabase({stopBefore:'20261014200000_system_reset_compatibility.sql'})
 try{
  const f=await createProductSaveFixture({database:db}),id=randomUUID()
  assert.equal((await db.query('select rolsuper from pg_roles where rolname=current_user')).rows[0].rolsuper,false)
  await db.query("insert into public.system_reset_runs(id,owner_id,scope,status,actor,summary,manifest) values($1,$2,'documents','cleanup_pending','{}','{}','{\"documents\":[\"old.pdf\"]}')",[id,f.actors.owner])
  const snapshot=async()=>{
   const result={};for(const {schema,table}of(await db.query("select schemaname schema,tablename as table from pg_tables where schemaname in ('public','private','catalog_private') order by 1,2")).rows)
    result[schema+'.'+table]=(await db.query('select to_jsonb(r) row from "'+schema+'"."'+table+'" r order by to_jsonb(r)::text')).rows.map(r=>{if(table==='system_reset_runs')delete r.row.cleanup_progress;return r.row})
   return result
  }
  const rows=await snapshot(),acl=(await db.query("select n.nspname,c.relname,c.relacl::text,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','catalog_private') and c.relkind='r' order by 1,2")).rows
  await db.query(await readFile(new URL('../supabase/migrations/20261014200000_system_reset_compatibility.sql',import.meta.url),'utf8'))
  assert.deepEqual(await snapshot(),rows);assert.deepEqual((await db.query("select n.nspname,c.relname,c.relacl::text,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','catalog_private') and c.relkind='r' order by 1,2")).rows,acl)
  await assert.rejects(()=>db.query('select public.system_reset_finish($1,$2)',[f.actors.owner,id]),/operator review/)
 }finally{await db.close()}
})

test('native reset serializes imports and media writers without reopening approval or references', {skip:!storageNativeAvailable,timeout:60000},async t=>{
 const db=await createStorageNativeDatabase({stopBefore:null})
 try{
  const f=await createProductSaveFixture({database:db}),owner=f.actors.owner
  const a=await db.connect('postgres'),b=await db.connect('postgres')
  const query=async(client,sql,args=[]) => (await client.query(sql,args)).rows[0]?.result
  const key="hashtextextended('elcomputer-system-reset',0)"
  const command={fields:{title:'Native review',slug:'native-'+randomUUID(),price:'10.00'},variants:[{key:'v1',id:null,fields:{name:'Default',code:'DEFAULT',is_active:true}}],specifications:[],images:[]},source='a'.repeat(64)
  const stage=async()=>{
   const j=await query(db,'select public.catalog_import_stage($1,$2,$3,$4,null,$5::jsonb,2) result',[owner,randomUUID(),source,f.warehouse,JSON.stringify([{key:'p1',id:null,revision:null,publish:false,graph:{},command}])])
   await query(db,'select public.catalog_import_approve($1,$2,$3,false) result',[owner,j.id,j.review_hash]);return j
  }
  const job=await stage()
  await t.test('a running import lease stops reset before any deletion',async()=>{
   await a.query('begin;select pg_advisory_xact_lock_shared('+key+')')
   await assert.rejects(()=>query(db,"select public.system_reset_begin($1,'products',$2) result",[owner,randomUUID()]),/catalog operation/)
   assert.equal((await query(db,'select public.catalog_import_status($1,$2) result',[owner,job.id])).counts.pending,1)
   await a.query('rollback')
  })
  await t.test('approval waiting behind reset cannot apply after its commit',async()=>{
   await a.query('begin;select pg_advisory_xact_lock('+key+')')
   const pending=Promise.allSettled([query(b,'select public.catalog_import_apply_item($1,$2,$3,$4,$5,$6::jsonb,null) result',[owner,job.id,'p1',source,job.review_hash,JSON.stringify(command)])])
   await nativeWaitFor(async()=>Number((await db.query("select count(*) n from pg_stat_activity where pid=$1 and wait_event_type='Lock'",[b.processID])).rows[0].n)===1)
   await query(a,"select public.system_reset_begin($1,'products',$2) result",[owner,randomUUID()]);await a.query('commit')
   const [r]=await pending;assert.equal(r.status,'fulfilled');assert.equal(r.value.closed_reason,'reset');assert.equal(r.value.counts.pending,0)
   assert.equal((await db.query('select count(*)::int n from public.products')).rows[0].n,0)
  })
  await t.test('a media writer after reset commit cannot restore a captured URL',async()=>{
   const p=await f.save(f.body({image_url:'/uploads/products/native.png',category_id:null,brand_id:null})),snapshot=await f.snapshot(p.id)
   const old=(await db.query('select id from public.system_reset_runs where status=\'cleanup_pending\'')).rows[0].id
   await query(db,'select public.system_reset_finish($1,$2) result',[owner,old])
   const run=await query(db,"select public.system_reset_begin($1,'media',$2,$3::jsonb) result",[owner,randomUUID(),JSON.stringify([{path:'products/native.png',root:'/tmp/owned-native-reset',size:1,modifiedAt:1}])])
   await assert.rejects(()=>b.query("update public.products set image_url='/uploads/products/native.png' where id=$1",[p.id]),/unavailable/)
   await assert.rejects(()=>f.save({...f.body(),request_id:randomUUID(),expected_revision:snapshot.revision,variants:snapshot.variants},{operation:'update',id:p.id}),e=>e.statusCode===409)
   assert.equal((await f.snapshot(p.id)).product.image_url,'')
   assert.equal(run.manifest.format,2)
  })
  await t.test('service/browser roles cannot bypass private engines; browser roles cannot finish cleanup',async()=>{
   for(const role of ['anon','authenticated','service_role']){
    const c=await db.connect(role)
    await assert.rejects(()=>c.query('select catalog_private.system_reset_begin_legacy($1,$2,$3)',[owner,'full',randomUUID()]),e=>e.code==='42501')
    if(role!=='service_role')await assert.rejects(()=>c.query('select public.system_reset_finish($1,$2)',[owner,randomUUID()]),e=>e.code==='42501')
   }
  })
 }finally{await db.close()}
})
