import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile, readFile, readdir, rename, unlink } from 'node:fs/promises'
import { createResetPlatform, resetPlatformAvailable } from './helpers/systemResetPlatform.mjs'
import { systemResetScopes } from '../server/utils/systemResetScopes.js'
import { catalog } from '../scripts/lib/cleanBaseline.mjs'
import { saveProduct } from '../server/utils/productSave.js'
import { TABLES,guideRows } from '../server/utils/catalogTransferContract.js'
import { writeCsv } from '../server/utils/catalogTransferCsv.js'
import { createClaimsFixture } from './helpers/claimsFixture.mjs'

const allBuckets=['admin-documents','support-attachments','chat-attachments','order-packing-videos','shipping-labels','after-sales-evidence']
const rpc=async(f,name,args)=>{const r=await f.service.rpc(name,args);assert.equal(r.error,null,JSON.stringify(r.error));return r.data}
const scalar=async(f,q,args=[]) => (await f.db.query(q,args)).rows[0]?.value
const physicalObjects=async(root)=>{const found=[];async function visit(path){let entries;try{entries=await readdir(path,{withFileTypes:true})}catch(e){if(e.code==='ENOENT')return;throw e}for(const e of entries){const p=path+'/'+e.name;if(e.isDirectory())await visit(p);else if(e.isFile())found.push(p)}}await visit(root);return found}
const security=async f=>(await f.db.query("select n.nspname,c.relname,c.relkind,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','catalog_private','storage','auth') and c.relkind in ('r','p','S') order by 1,2")).rows
const assertForeignKeys=async f=>{
 const keys=(await f.db.query("select c.conname,c.conrelid::regclass::text child,c.confrelid::regclass::text parent,array(select attname::text from unnest(c.conkey) with ordinality k(n,o) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.n order by o) src,array(select attname::text from unnest(c.confkey) with ordinality k(n,o) join pg_attribute a on a.attrelid=c.confrelid and a.attnum=k.n order by o) dst from pg_constraint c join pg_namespace n on n.oid=c.connamespace where c.contype='f' and n.nspname in ('public','private','catalog_private')")).rows
 for(const k of keys){const where=k.src.map(x=>'c."'+x+'" is not null').join(' and '),join=k.src.map((x,i)=>'c."'+x+'"=p."'+k.dst[i]+'"').join(' and ');assert.equal(await scalar(f,'select count(*)::int value from '+k.child+' c where '+where+' and not exists(select 1 from '+k.parent+' p where '+join+')'),0,k.conname)}
}
const nativeProduct=async(f,warehouse,extra={}) => {const result=await f.call('/api/admin-products',{method:'POST',body:{request_id:randomUUID(),title:'Owned native product',slug:'native-'+randomUUID(),price:'20.00',is_serialized:true,is_published:false,primary_warehouse_id:warehouse,variants:[{name:'Default',code:'DEFAULT'}],...extra}});assert.equal(result.response.status,200,JSON.stringify(result.body));return result.body}
const importFile=()=>{const t={...Object.fromEntries(Object.keys(TABLES).map(k=>[k,[]])),Guide:guideRows()};t.Products.push({product_key:'new1',title:'Owned native import',slug:'import-'+randomUUID(),price:'10.00',selling_mode:'normal'});t.Variants.push({product_key:'new1',entity_key:'v1',name:'Default',code:'DEFAULT',is_active:true});return writeCsv(t)}

test('all eight reset scopes over actual local Auth, Storage, PostgREST, PostgreSQL and HTTP', {skip:!resetPlatformAvailable,timeout:360000},async t=>{
 for(const scope of systemResetScopes)await t.test(scope.key,async()=>{
  const f=await createResetPlatform()
  try{
   const oldReset=scope.key==='full'?await f.reset('analytics'):null
   if(oldReset)assert.equal(oldReset.response.status,200)
   const warehouse=randomUUID();await f.db.query("insert into public.commerce_warehouses(id,name) values($1,'Owned fixture warehouse')",[warehouse])
  await f.db.query("insert into public.site_settings(key,payment_cash_enabled,erp_mode) values('default',true,'built_in') on conflict(key) do update set payment_cash_enabled=true,erp_mode='built_in'")
   const input={image_url:'/uploads/products/captured.png',seo_image_url:'/uploads/products/captured.png'},p=await nativeProduct(f,warehouse,input)
   const snapshot=await rpc(f,'catalog_product_edit_snapshot',{p_admin_id:f.actors.owner,p_product_id:p.id})
   await mkdir(f.uploads+'/products',{recursive:true});await mkdir(f.uploads+'/unrelated',{recursive:true})
   await writeFile(f.uploads+'/products/captured.png','captured bytes');await writeFile(f.uploads+'/unrelated/keep.png','unrelated bytes');await writeFile(f.uploads+'/products/keep.txt','unrelated text')
   const order=await scalar(f,"insert into public.customer_orders(user_id,first_name,phone,street_address,city,governorate) values($1,'Buyer','123','Fixture','Cairo','Cairo') returning id value",[f.actors.customer])
   const work=await scalar(f,"insert into public.order_packing_work_sessions(admin_user_id,operator_name) values($1,'Fixture owner') returning id value",[f.actors.owner])
   const packing=await scalar(f,"insert into public.order_packing_sessions(order_id,admin_user_id,processor_name,work_session_id) values($1,$2,'Fixture owner',$3) returning id value",[order,f.actors.owner,work])
   await f.db.query("insert into public.order_packing_videos(packing_session_id,work_session_id,order_id,recorded_by,storage_path,file_name,mime_type,size_bytes,status,recording_started_at,recording_ended_at,uploaded_at) values($1,$2,$3,$4,'captured.webm','captured.webm','video/webm',4,'ready',now(),now(),now())",[packing,work,order,f.actors.owner])
   await f.db.query("insert into public.shipping_order_jobs(order_id,state,to_ref,label_storage_path) values($1,'ready',$2,'captured.pdf')",[order,'FIXTURE-'+randomUUID()])
   for(const bucket of allBuckets){const name=bucket==='order-packing-videos'?'captured.webm':bucket==='after-sales-evidence'?'captured.png':'captured.pdf',mime=bucket==='order-packing-videos'?'video/webm':bucket==='after-sales-evidence'?'image/png':'application/pdf';assert.equal((await f.service.storage.from(bucket).upload(name,Buffer.from('owned fixture bytes'),{contentType:mime})).error,null)}
   assert.equal((await f.service.storage.from('shipping-labels').upload('unrelated.pdf',Buffer.from('unrelated bytes'),{contentType:'application/pdf'})).error,null)
   const file=importFile(),staged=await f.call('/api/admin-products/transfer/import?'+new URLSearchParams({format:'csv',job_id:randomUUID(),warehouse_id:warehouse}),{method:'POST',body:file,headers:{'content-type':'application/octet-stream'}})
   assert.equal(staged.response.status,200,JSON.stringify(staged.body));const job=staged.body.job;assert.ok(job,JSON.stringify(staged.body))
   assert.equal((await f.call('/api/admin-products/transfer/import/approve',{method:'POST',body:{job_id:job.id,review_hash:job.review_hash,publish:false}})).response.status,200)
   const state=await scalar(f,'select to_jsonb(s) value from public.quick_setup_state s'),seal=await scalar(f,'select to_jsonb(s) value from private.installation_bootstrap s'),schema=await catalog(f.db),acl=await security(f),buckets=(await f.db.query('select id,public,file_size_limit,allowed_mime_types from storage.buckets order by id')).rows
   const physical=await physicalObjects(f.lab.directory+'/objects');assert.equal(physical.length,7)
   const revisions=(await f.db.query('select domain,revision from public.quick_setup_revisions order by domain')).rows
   assert.equal((await f.call('/api/admin-system-reset',{actor:'editor'})).response.status,403)
   assert.equal((await f.call('/api/admin-system-reset',{actor:'customer'})).response.status,403)
   const result=await f.reset(scope.key);assert.equal(result.response.status,200,JSON.stringify(result.body));assert.equal(result.body.status,'completed')
   assert.deepEqual(await catalog(f.db),schema);assert.deepEqual(await scalar(f,'select to_jsonb(s) value from private.installation_bootstrap s'),seal);assert.deepEqual(await scalar(f,'select to_jsonb(s) value from public.quick_setup_state s'),state)
   assert.deepEqual(await security(f),acl);await assertForeignKeys(f)
   const after=(await f.db.query('select domain,revision from public.quick_setup_revisions order by domain')).rows
   assert.ok(BigInt(after.find(r=>r.domain==='infrastructure').revision)>BigInt(revisions.find(r=>r.domain==='infrastructure').revision))
   if(scope.key==='full')for(let i=0;i<after.length;i++)assert.equal(BigInt(after[i].revision),BigInt(revisions[i].revision)+1n,after[i].domain)
   assert.deepEqual((await f.db.query('select id,public,file_size_limit,allowed_mime_types from storage.buckets order by id')).rows,buckets)
   assert.equal((await f.service.auth.getUser(f.tokens.owner)).error,null)
   // New password login uses the actual Auth service; reset's temporary session
   // signout must not revoke the original browser session above.
   const login=await f.authClient().auth.signInWithPassword({email:f.lab.owner.email,password:f.lab.owner.password});assert.equal(login.error,null)
   const admin=await f.browser.from('admin_users').select('id,role,is_active');assert.equal(admin.error,null);assert.equal(admin.data.find(a=>a.id===f.actors.owner)?.role,'owner')
   assert.equal(await readFile(f.uploads+'/unrelated/keep.png','utf8'),'unrelated bytes');assert.equal(await readFile(f.uploads+'/products/keep.txt','utf8'),'unrelated text')
   if(scope.mediaFiles){await assert.rejects(()=>readFile(f.uploads+'/products/captured.png'),/ENOENT/);assert.equal(await scalar(f,"select state value from catalog_private.media_paths where path='/uploads/products/captured.png'"),'deleted')}
   for(const bucket of allBuckets){const n=await scalar(f,'select count(*)::int value from storage.objects where bucket_id=$1',[bucket]);const removed=scope.key==='full'||scope.key==='documents'&&bucket==='admin-documents'||['orders','commerce'].includes(scope.key)&&['order-packing-videos','shipping-labels'].includes(bucket);assert.equal(n,removed?(bucket==='shipping-labels'&&scope.key!=='full'?1:0):bucket==='shipping-labels'?2:1,bucket)}
   const remaining=await physicalObjects(f.lab.directory+'/objects');assert.equal(remaining.length,scope.key==='full'?0:scope.key==='documents'?6:['orders','commerce'].includes(scope.key)?5:7)
   for(const path of remaining)assert.ok(physical.includes(path),'Captured policy preserves unrelated byte objects')
   if(scope.key==='media'){
    const changed=await rpc(f,'catalog_product_edit_snapshot',{p_admin_id:f.actors.owner,p_product_id:p.id});assert.ok(changed.revision>snapshot.revision);assert.equal(changed.product.seo_image_url,'')
    await assert.rejects(()=>saveProduct(f.service,{id:f.actors.owner},{request_id:randomUUID(),expected_revision:snapshot.revision,title:'Stale fixture',slug:snapshot.product.slug,price:'20.00',is_serialized:true,primary_warehouse_id:warehouse,image_url:input.image_url,variants:snapshot.variants},'update',p.id),e=>e.statusCode===409)
   }
   const status=await rpc(f,'catalog_import_status',{p_admin_id:f.actors.owner,p_job_id:job.id});assert.equal(status.closed_reason,['products','full'].includes(scope.key)?'reset':null)
   if(['products','full'].includes(scope.key)){assert.equal(status.counts.pending,0);assert.equal(status.counts.failed,1)}
   if(['products','full'].includes(scope.key)){
    const old=await f.call('/api/admin-products/transfer/import/apply?'+new URLSearchParams({format:'csv',job_id:job.id,review_hash:job.review_hash}),{method:'POST',body:file,headers:{'content-type':'application/octet-stream'}})
    assert.equal(old.response.status,200,JSON.stringify(old.body));assert.equal(old.body.closed_reason,'reset');assert.equal(old.body.counts.pending,0);assert.equal(await scalar(f,'select count(*)::int value from public.products'),0)
   }
   const chat=await f.call('/api/admin-chat/settings');assert.equal(chat.response.status,200,JSON.stringify(chat.body));assert.equal((await f.call('/api/chat/status',{actor:null})).body.enabled,false)
   const courier=await f.call('/api/admin-shipping/settings');assert.equal(courier.response.status,200,JSON.stringify(courier.body));assert.equal(courier.body.settings.is_enabled,false)
   if(scope.key==='full'){
    assert.equal((await f.service.auth.admin.getUserById(f.actors.customer)).error?.status,404)
    assert.equal(await scalar(f,'select sound_notifications_enabled value from public.chat_settings'),false)
    const settings=Object.fromEntries(Object.entries(chat.body.settings).filter(([k])=>!['updated_at'].includes(k)));settings.welcome_message='Owned configuration after reset'
    assert.equal((await f.call('/api/admin-chat/settings',{method:'PUT',body:{expectedUpdatedAt:chat.body.settings.updated_at,settings}})).response.status,200)
    const configured=await f.call('/api/admin-shipping/settings',{method:'PATCH',body:courier.body.settings});assert.equal(configured.response.status,200,JSON.stringify(configured.body))
    await f.createActor('newcustomer');await f.db.query("insert into public.commerce_warehouses(id,name) values($1,'After reset warehouse')",[warehouse])
   }
   const analytics=await f.call('/api/analytics/events',{actor:null,method:'POST',body:{events:[{eventId:randomUUID(),eventName:'page_view',path:'/'}]}});assert.equal(analytics.response.status,200,JSON.stringify(analytics.body));assert.equal(analytics.body.accepted,1);assert.equal(await scalar(f,'select count(*)::int value from public.store_analytics_sessions'),1)
   const supplier=randomUUID();await f.db.query("insert into public.commerce_crm_accounts(id,name,account_type) values($1,'Owned supplier','supplier')",[supplier])
   const fresh=await nativeProduct(f,warehouse,{is_published:true}),freshSnapshot=await rpc(f,'catalog_product_edit_snapshot',{p_admin_id:f.actors.owner,p_product_id:fresh.id})
   await f.db.query("select set_config('request.jwt.claim.sub',$1,false)",[f.actors.owner])
   await f.db.query('select public.commerce_create_procurement_order($1,$2,$3,null,0,$4::jsonb)',[supplier,warehouse,'OWNED-'+randomUUID(),JSON.stringify([{product_id:fresh.id,variant_id:freshSnapshot.variants[0].id,quantity:1,unit_cost:5}])])
   await f.db.query("insert into public.site_settings(key,payment_cash_enabled,erp_mode) values('default',true,'built_in') on conflict(key) do update set payment_cash_enabled=true,erp_mode='built_in'")
   const cart=randomUUID(),buyer=f.actors.newcustomer||f.actors.customer,orderInput={order_number:'OWNED-'+cart,first_name:'Fixture',last_name:'Buyer',phone:'01012345678',street_address:'Fixture street',city:'Cairo',governorate:'Cairo',payment_method:'cash',locale:'en'}
   const placed=await scalar(f,'select public.commerce_create_customer_order($1,$2::jsonb,$3::jsonb,false,$4) value',[buyer,JSON.stringify(orderInput),JSON.stringify([{product_id:fresh.id,variant_id:freshSnapshot.variants[0].id,quantity:1}]),cart]);assert.ok((placed.order||placed).id)
   await assertForeignKeys(f)
   if(oldReset){
    const old=(await f.db.query('select status,actor,summary from public.system_reset_runs where id=$1',[oldReset.body.id])).rows[0];assert.equal(old.status,'completed');assert.deepEqual(old.actor,{});assert.deepEqual(old.summary,{})
    assert.equal((await f.reset('analytics',{id:oldReset.body.id})).response.status,200);assert.equal(await scalar(f,'select count(*)::int value from public.store_analytics_events'),1)
   }
  }finally{await f.close()}
 })
})

test('actual Media cleanup pauses changed files and resumes the captured operation after review', {skip:!resetPlatformAvailable,timeout:90000},async()=>{
 const f=await createResetPlatform()
 try{
  await mkdir(f.uploads+'/products');await writeFile(f.uploads+'/products/captured.png','original bytes')
  const id=randomUUID();f.lab.loseResponse('POST','/rest/v1/rpc/system_reset_begin')
  const lost=await f.reset('media',{id});assert.ok(lost.response.status>=400)
  assert.equal(await scalar(f,'select status value from public.system_reset_runs where id=$1',[id]),'cleanup_pending')
  assert.equal(await scalar(f,"select state value from catalog_private.media_paths where path='/uploads/products/captured.png'"),'deleting')
  await rename(f.uploads+'/products/captured.png',f.directory+'/original.png');await writeFile(f.uploads+'/products/captured.png','replacement bytes')
  const changed=await f.reset('media',{id});assert.equal(changed.response.status,503);assert.equal(await readFile(f.uploads+'/products/captured.png','utf8'),'replacement bytes')
  // Explicit fixture operator review restores the exact original inode/bytes;
  // application recovery never removes a changed replacement automatically.
  await unlink(f.uploads+'/products/captured.png');await rename(f.directory+'/original.png',f.uploads+'/products/captured.png');await writeFile(f.uploads+'/products/later.png','later bytes')
  const resumed=await f.reset('media',{id});assert.equal(resumed.response.status,200);assert.equal(resumed.body.status,'completed')
  await assert.rejects(()=>readFile(f.uploads+'/products/captured.png'),/ENOENT/);assert.equal(await readFile(f.uploads+'/products/later.png','utf8'),'later bytes')
  assert.equal(await scalar(f,"select state value from catalog_private.media_paths where path='/uploads/products/captured.png'"),'deleted')
 }finally{await f.close()}
})

test('retained Claims block destructive scopes and keep actual evidence bytes', {skip:!resetPlatformAvailable,timeout:90000},async()=>{
 const f=await createResetPlatform()
 try{
  // Claims business rows use the established synthetic business-data fixture;
  // reset authorization and evidence upload/download use actual local services.
  const c=await createClaimsFixture({database:{query:f.db.query.bind(f.db),exec:f.db.query.bind(f.db)}});await c.enable();const item=await c.purchase(),evidence=await c.evidence(item),claim=await c.create(c.body(item,'return',{attachment_ids:[evidence]}))
  const path=await scalar(f,'select storage_path value from public.after_sales_claim_evidence where id=$1',[evidence])
  assert.equal((await f.service.storage.from('after-sales-evidence').upload(path,Buffer.from('protected evidence'),{contentType:'image/png'})).error,null)
  for(const scope of ['orders','commerce','full']){const plan=await f.call('/api/admin-system-reset?scope='+scope);assert.equal(plan.response.status,200);assert.ok(plan.body.plan.blockers.length);const result=await f.reset(scope);assert.ok(result.response.status>=400);assert.equal(await scalar(f,'select count(*)::int value from public.system_reset_runs'),0)}
  assert.equal((await f.service.storage.from('after-sales-evidence').download(path)).error,null);assert.equal((await physicalObjects(f.lab.directory+'/objects')).length,1)
  assert.ok(claim.id||claim.claim?.id);await assertForeignKeys(f)
 }finally{await f.close()}
})

test('actual Storage cleanup recovers lost checkpoint acknowledgement and preserves later uploads', {skip:!resetPlatformAvailable,timeout:90000},async()=>{
 const f=await createResetPlatform()
 try{
  assert.equal((await f.service.storage.from('admin-documents').upload('captured.pdf',Buffer.from('captured'),{contentType:'application/pdf'})).error,null)
  f.lab.loseResponse('POST','/rest/v1/rpc/system_reset_cleanup_checkpoint')
  const id=randomUUID(),first=await f.reset('documents',{id});assert.equal(first.response.status,503)
  const pending=(await f.db.query('select status,cleanup_progress from public.system_reset_runs where id=$1',[id])).rows[0];assert.equal(pending.status,'cleanup_pending');assert.deepEqual(pending.cleanup_progress.documents,['captured.pdf'])
  assert.equal((await f.service.storage.from('admin-documents').upload('later.pdf',Buffer.from('later'),{contentType:'application/pdf'})).error,null)
  const second=await f.reset('documents',{id});assert.equal(second.response.status,200);assert.equal(second.body.status,'completed')
  assert.equal(await scalar(f,"select count(*)::int value from storage.objects where name='later.pdf'"),1)
  assert.equal(await scalar(f,"select count(*)::int value from public.admin_activity_logs where metadata->>'reset_id'=$1",[id]),1)
 }finally{await f.close()}
})

test('actual Storage remove response loss stays pending and retries only the captured names', {skip:!resetPlatformAvailable,timeout:90000},async()=>{
 const f=await createResetPlatform()
 try{
  assert.equal((await f.service.storage.from('admin-documents').upload('captured.pdf',Buffer.from('captured'),{contentType:'application/pdf'})).error,null)
  f.lab.loseResponse('DELETE','/storage/v1/object/admin-documents')
  const id=randomUUID(),lost=await f.reset('documents',{id});assert.equal(lost.response.status,503)
  assert.equal(await scalar(f,'select status value from public.system_reset_runs where id=$1',[id]),'cleanup_pending')
  assert.equal((await physicalObjects(f.lab.directory+'/objects')).length,0)
  assert.equal((await f.service.storage.from('admin-documents').upload('later.pdf',Buffer.from('later'),{contentType:'application/pdf'})).error,null)
  const done=await f.reset('documents',{id});assert.equal(done.response.status,200);assert.equal(done.body.status,'completed')
  assert.equal((await physicalObjects(f.lab.directory+'/objects')).length,1);assert.equal((await f.service.storage.from('admin-documents').download('later.pdf')).error,null)
 }finally{await f.close()}
})
