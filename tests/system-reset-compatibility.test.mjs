import { before, after, beforeEach, afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createProductSaveFixture } from './helpers/productSaveFixture.mjs'
import { createResetDatabase } from './helpers/resetDatabase.mjs'
import { systemResetScopes } from '../server/utils/systemResetScopes.js'
import { finishResetCleanup } from '../server/utils/systemReset.js'

let db,f
const value=async(sql,args=[]) => (await db.query(sql,args)).rows[0]?.value
const files=()=>[{path:'products/reset.png',root:'/tmp/owned-reset-fixture',size:4,modifiedAt:1}]
const begin=async(scope,media=[])=>{
 const run=await value('select public.system_reset_begin($1,$2,$3,$4::jsonb) value',[f.actors.owner,scope,randomUUID(),JSON.stringify(media)])
 // Restore ordinary next-request defaults in the enclosing rollback fixture.
 await db.exec("set constraints all deferred;select set_config('app.serialized_inventory_write','',true)")
 return run
}
const failed=async(action,pattern)=>{await db.exec('savepoint expected');await assert.rejects(action,pattern);await db.exec('rollback to savepoint expected')}
const stage=async()=>{
 const command={fields:{title:'Reviewed fixture',slug:'review-'+randomUUID(),price:'20.00',selling_mode:'normal'},variants:[{key:'v1',id:null,fields:{name:'Default',code:'DEFAULT',is_active:true}}],specifications:[],images:[]},source=randomUUID().replaceAll('-','').repeat(2)
 const job=await value('select public.catalog_import_stage($1,$2,$3,$4,null,$5::jsonb,2) value',[f.actors.owner,randomUUID(),source,f.warehouse,JSON.stringify([{key:'p1',id:null,revision:null,publish:false,graph:{},command}])])
 await value('select public.catalog_import_approve($1,$2,$3,false) value',[f.actors.owner,job.id,job.review_hash])
 return{...job,source,command}
}
const apply=j=>value('select public.catalog_import_apply_item($1,$2,$3,$4,$5,$6::jsonb,null) value',[f.actors.owner,j.id,'p1',j.source,j.review_hash,JSON.stringify(j.command)])
before(async()=>{db=await createResetDatabase()})
after(async()=>{await db?.close()})
beforeEach(async()=>{await db.exec('begin');f=await createProductSaveFixture({database:db})})
afterEach(async()=>{await db.exec('rollback')})

test('migration79 preserves existing public rows, security and the bootstrap seal',async()=>{
 const d=await createResetDatabase({stopBefore:'20261014200000_system_reset_compatibility.sql'})
 try{
  const tables=(await d.query("select tablename from pg_tables where schemaname='public' order by 1")).rows
  const before={};for(const {tablename:t}of tables)before[t]=(await d.query('select to_jsonb(r) row from public."'+t+'" r order by to_jsonb(r)::text')).rows
  const security=await d.query("select n.nspname,c.relname,c.relacl::text,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','catalog_private') and c.relkind='r' order by 1,2")
  const seal=await d.query('select to_jsonb(j) row from private.installation_bootstrap j')
  await d.exec(await readFile(new URL('../supabase/migrations/20261014200000_system_reset_compatibility.sql',import.meta.url),'utf8'))
  assert.deepEqual(await d.query("select n.nspname,c.relname,c.relacl::text,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','catalog_private') and c.relkind='r' order by 1,2"),security)
  assert.deepEqual(await d.query('select to_jsonb(j) row from private.installation_bootstrap j'),seal)
  for(const {tablename:t}of tables){const after=(await d.query('select to_jsonb(r) row from public."'+t+'" r order by to_jsonb(r)::text')).rows;assert.deepEqual(after,before[t],t)}
 }finally{await d.close()}
})

test('media reset clears scalar gallery/SEO fields, advances affected revisions and reserves files',async()=>{
 const input=f.body({image_url:'/uploads/products/reset.png',seo_image_url:'/uploads/products/reset.png'}),p=await f.save(input),snap=await f.snapshot(p.id)
 await db.query("insert into public.product_images(product_id,variant_id,image_url,alt_text) values($1,$2,'/uploads/products/reset.png','Authored alt')",[p.id,snap.variants[0].id])
 const external=await f.save(f.body({image_url:'https://outside.invalid/reset.png'})),externalSnap=await f.snapshot(external.id)
 const run=await begin('media',files()),current=await f.snapshot(p.id)
 assert.equal(current.product.image_url,'');assert.equal(current.product.seo_image_url,'');assert.ok(current.revision>snap.revision)
 assert.equal(await value('select image_url value from public.product_images where product_id=$1',[p.id]),'')
 assert.equal(await value('select alt_text value from public.product_images where product_id=$1',[p.id]),'Authored alt')
 assert.deepEqual(await f.snapshot(external.id),externalSnap)
 assert.equal(await value("select state value from catalog_private.media_paths where path='/uploads/products/reset.png'"),'deleting')
 await failed(()=>f.save({...input,request_id:randomUUID(),expected_revision:snap.revision,variants:snap.variants},{operation:'update',id:p.id}),/changed/)
 await failed(()=>db.query("update public.products set image_url='/uploads/products/reset.png' where id=$1",[p.id]),/unavailable/)
 await failed(()=>value('select public.system_reset_finish($1,$2) value',[f.actors.owner,run.id]),/pending/)
 // SQL-side acknowledgement only; native platform tests unlink actual files.
 await value('select public.system_reset_cleanup_checkpoint($1,$2,$3,$4::jsonb) value',[f.actors.owner,run.id,'media',JSON.stringify(['products/reset.png'])])
 assert.equal(await value("select state value from catalog_private.media_paths where path='/uploads/products/reset.png'"),'deleted')
 assert.equal((await value('select public.system_reset_finish($1,$2) value',[f.actors.owner,run.id])).status,'completed')
})

test('embedded, encoded, external-origin and nested references block rather than erase content',async()=>{
 for(const reference of ['<img src="/uploads/products/reset.png">','/uploads/products/%72eset.png','https://other.invalid/uploads/products/reset.png']){
  const p=await f.save(f.body({description:reference})),before=await f.snapshot(p.id)
  assert.ok((await value('select public.system_reset_media_plan($1,$2::jsonb) value',[f.actors.owner,JSON.stringify(files())])).blockers.length)
  await failed(()=>begin('media',files()),/authored content/);assert.deepEqual(await f.snapshot(p.id),before)
  await db.query('delete from public.products where id=$1',[p.id])
 }
 await db.query("insert into public.site_pages(title,path,content_markdown) values('Fixture page','fixture-page','![Authored](/uploads/products/reset.png)')")
 await failed(()=>begin('media',files()),/authored content/)
 assert.equal(await value('select count(*)::int value from public.system_reset_runs'),0)
})

test('Products/Full close pending reviews and approvals while preserving terminal receipts',async()=>{
 const pending=await stage(),done=await stage();assert.equal((await apply(done)).counts.succeeded,1)
 const terminal=await value('select public.catalog_import_status($1,$2) value',[f.actors.owner,done.id])
 await begin('products')
 const closed=await apply(pending);assert.equal(closed.closed_reason,'reset');assert.equal(closed.counts.pending,0);assert.equal(closed.counts.failed,1)
 assert.equal(await value('select count(*)::int value from public.products'),0)
 assert.deepEqual(await value('select public.catalog_import_status($1,$2) value',[f.actors.owner,done.id]),terminal)
 const newReview=await value('select public.catalog_import_stage($1,$2,$3,$4,$5,$6::jsonb,2) value',[f.actors.owner,randomUUID(),pending.source,f.warehouse,pending.id,JSON.stringify([{key:'p1',id:null,revision:null,publish:false,graph:{},command:pending.command}])])
 assert.equal(newReview.approved,false)
 await failed(()=>apply({...pending,id:newReview.id,review_hash:newReview.review_hash}),/approval/)
 await value('select public.catalog_import_approve($1,$2,$3,false) value',[f.actors.owner,newReview.id,newReview.review_hash])
 assert.equal((await apply({...pending,id:newReview.id,review_hash:newReview.review_hash})).counts.succeeded,1)
})

test('unrelated reset scopes retain pending import authority',async()=>{
 const j=await stage();await begin('analytics');assert.equal((await apply(j)).counts.succeeded,1)
})

test('all scopes retain installation history, private tombstones and schema; Full restores disabled singletons',async()=>{
 for(const scope of systemResetScopes){
  await db.exec('savepoint scope')
  const state=await value('select to_jsonb(s) value from public.quick_setup_state s'),seal=await value('select to_jsonb(s) value from private.installation_bootstrap s')
  const run=await begin(scope.key)
  assert.deepEqual(await value('select to_jsonb(s) value from public.quick_setup_state s'),state)
  assert.deepEqual(await value('select to_jsonb(s) value from private.installation_bootstrap s'),seal)
  if(scope.key==='full'){
   const chat=await value('select to_jsonb(s) value from public.chat_settings s');assert.equal(chat.is_enabled,false);assert.equal(chat.sound_notifications_enabled,false)
   const shipping=await value('select to_jsonb(s) value from public.shipping_provider_settings s');assert.equal(shipping.is_enabled,false);assert.equal(shipping.company_id,null);assert.equal(shipping.product_id,null)
   assert.equal((await value('select public.catalog_import_options($1) value',[f.actors.owner])).length,0)
  }
  assert.equal(run.manifest.format,2);await db.exec('rollback to savepoint scope')
 }
})

test('private/public coverage cannot silently adopt newly added tables',async()=>{
 for(const namespace of ['public','private','catalog_private']){
  await db.exec('savepoint unknown');await db.exec('create table '+namespace+'.unreviewed_reset_data(id integer)')
  await failed(()=>begin('media'),/Unrecognized tables/);await db.exec('rollback to savepoint unknown')
 }
})

test('cleanup validates capture, physical metadata and owner; old pending journals require review',async()=>{
 await db.query("insert into storage.objects(bucket_id,name) values('admin-documents','captured.pdf')")
 const run=await begin('documents')
 await failed(()=>value('select public.system_reset_cleanup_checkpoint($1,$2,$3,$4::jsonb) value',[f.actors.owner,run.id,'documents',JSON.stringify(['other.pdf'])]),/match/)
 await failed(()=>value('select public.system_reset_cleanup_checkpoint($1,$2,$3,$4::jsonb) value',[f.actors.owner,run.id,'documents',JSON.stringify(['captured.pdf'])]),/pending/)
 await failed(()=>db.query("insert into public.documents(name,storage_path) values('New metadata','captured.pdf')"),/reserved by a pending reset/)
 await db.query('update public.system_reset_runs set manifest=manifest-\'format\' where id=$1',[run.id])
 await failed(()=>value('select public.system_reset_finish($1,$2) value',[f.actors.owner,run.id]),/operator review/)
})

test('bounded captures reject oversized work atomically',async()=>{
 await failed(()=>begin('media',Array.from({length:10001},()=>files()[0])),/Invalid reset upload manifest/)
 assert.equal(await value('select count(*)::int value from public.system_reset_runs'),0)
})

test('Full retains minimal completed reset IDs so delayed retries cannot erase new data',async()=>{
 const old=await begin('analytics');await value('select public.system_reset_finish($1,$2) value',[f.actors.owner,old.id])
 await begin('full')
 const tombstone=await value('select to_jsonb(r) value from public.system_reset_runs r where id=$1',[old.id]);assert.equal(tombstone.status,'completed');assert.deepEqual(tombstone.actor,{});assert.deepEqual(tombstone.summary,{})
 const visitor=randomUUID(),session=randomUUID();await db.query('insert into public.store_analytics_sessions(id,visitor_id) values($1,$2)',[session,visitor])
 const retry=await value('select public.system_reset_begin($1,$2,$3) value',[f.actors.owner,'analytics',old.id]);assert.equal(retry.status,'completed');assert.equal(await value('select count(*)::int value from public.store_analytics_sessions'),1)
})

test('partial and lost cleanup acknowledgements preserve checkpoints and avoid repeating accepted work',async()=>{
 const run={id:randomUUID(),scope:'full',status:'cleanup_pending',manifest:{format:2,documents:['a.pdf'],packing:['video.webm'],labels:['label.pdf'],evidence:['evidence.png']},cleanup_progress:{}},calls=[]
 let lost=true
 const client={storage:{from:bucket=>({remove:async paths=>{calls.push([bucket,paths]);return{error:null}}})},rpc:async(name,args)=>{
  if(name==='system_reset_cleanup_checkpoint'){run.cleanup_progress[args.p_kind]=args.p_items;if(lost){lost=false;return{error:{message:'lost acknowledgement'}}}return{data:{status:'cleanup_pending'},error:null}}
  return{data:{status:'completed'},error:null}
 }}
 await assert.rejects(()=>finishResetCleanup({supabaseAdmin:client,run,ownerId:f.actors.owner,uploadsRoot:'/tmp/owned-empty-reset'}),/lost acknowledgement/)
 assert.deepEqual(run.cleanup_progress.documents,['a.pdf'])
 assert.equal((await finishResetCleanup({supabaseAdmin:client,run,ownerId:f.actors.owner,uploadsRoot:'/tmp/owned-empty-reset'})).status,'completed')
 assert.equal(calls.filter(c=>c[0]==='admin-documents').length,1);assert.equal(calls.length,4)
})
