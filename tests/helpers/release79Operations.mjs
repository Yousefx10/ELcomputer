// Synthetic merchant fixtures are created only AFTER fresh certification.
// HTTP handlers and Auth/Storage/PostgREST/PG services are actual native services.
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {createResetPlatform} from './systemResetPlatform.mjs'
import {releaseApplicationCatalog} from '../../scripts/lib/release79Certification.mjs'
import {systemResetScopes} from '../../server/utils/systemResetScopes.js'
import {TABLES,guideRows} from '../../server/utils/catalogTransferContract.js'
import {writeCsv} from '../../server/utils/catalogTransferCsv.js'
import {writeXlsx} from '../../server/utils/catalogTransferXlsx.js'
const scalar=async(f,q,args=[])=>(await f.db.query(q,args)).rows[0]?.value
const managedSecurity=async f=>(await f.db.query("select n.nspname schema,c.relname name,pg_get_userbyid(c.relowner) owner,c.relacl::text acl,c.relrowsecurity rls,c.relforcerowsecurity force_rls from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname,c.relname) in (('auth','users'),('storage','objects'),('storage','buckets'),('realtime','messages')) order by 1,2")).rows
const foreignKeys=async f=>{
 const keys=(await f.db.query("select c.conname,c.conrelid::regclass::text child,c.confrelid::regclass::text parent,array(select attname::text from unnest(c.conkey) with ordinality k(n,o) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.n order by o) src,array(select attname::text from unnest(c.confkey) with ordinality k(n,o) join pg_attribute a on a.attrelid=c.confrelid and a.attnum=k.n order by o) dst from pg_constraint c join pg_namespace n on n.oid=c.connamespace where c.contype='f' and n.nspname in ('public','private','catalog_private')")).rows
 for(const k of keys){const where=k.src.map(x=>'c."'+x+'" is not null').join(' and '),join=k.src.map((x,i)=>'c."'+x+'"=p."'+k.dst[i]+'"').join(' and ');assert.equal(await scalar(f,'select count(*)::int value from '+k.child+' c where '+where+' and not exists(select 1 from '+k.parent+' p where '+join+')'),0,k.conname)}
}
const rpc=async(f,name,args)=>{const r=await f.service.rpc(name,args);assert.equal(r.error,null,JSON.stringify(r.error));return r.data}
export async function exerciseInstalledRelease79(lab,t,applicationSource){
 assert.ok(applicationSource,'Exact release79 application source required')
 const f=await createResetPlatform({installedLab:lab,applicationSource}),warehouse=randomUUID(),results=[]
 const seal=await scalar(f,'select to_jsonb(s) value from private.installation_bootstrap s'),schema=await releaseApplicationCatalog(f.db),managed=await managedSecurity(f),history=(await f.db.query('select * from supabase_migrations.schema_migrations order by version')).rows
 const tables=()=>{const x={...Object.fromEntries(Object.keys(TABLES).map(k=>[k,[]])),Guide:guideRows()};x.Products.push({product_key:'new1',title:'Owned post-install fixture',slug:'owned-'+randomUUID(),price:'10.00',selling_mode:'normal'});x.Variants.push({product_key:'new1',entity_key:'v1',name:'Default',code:'DEFAULT',is_active:true});return x}
 const stage=async(format='csv')=>{
  const bytes=format==='csv'?writeCsv(tables()):writeXlsx(tables()),r=await f.call('/api/admin-products/transfer/import?'+new URLSearchParams({format,job_id:randomUUID(),warehouse_id:warehouse}),{method:'POST',body:bytes,headers:{'content-type':'application/octet-stream'}})
  assert.equal(r.response.status,200,JSON.stringify(r.body));const job=r.body.job;assert.ok(job)
  assert.equal((await f.call('/api/admin-products/transfer/import/approve',{method:'POST',body:{job_id:job.id,review_hash:job.review_hash,publish:false}})).response.status,200)
  return{bytes,job,format}
 }
 const product=async()=>{const r=await f.call('/api/admin-products',{method:'POST',body:{request_id:randomUUID(),title:'Owned post-install product',slug:'owned-'+randomUUID(),price:'20.00',is_serialized:true,primary_warehouse_id:warehouse,variants:[{name:'Default',code:'DEFAULT'}]}});assert.equal(r.response.status,200,JSON.stringify(r.body));return r.body}
 try{
  await f.db.query("insert into public.commerce_warehouses(id,name) values($1,'Owned synthetic warehouse')",[warehouse])
  await t.test('migration79 installation: actual Draft creation, atomic revision, listing and durable bulk receipt',async()=>{
   const p=await product();assert.equal(await scalar(f,'select is_published value from public.products where id=$1',[p.id]),false)
   const snap=await rpc(f,'catalog_product_edit_snapshot',{p_admin_id:f.actors.owner,p_product_id:p.id}),request=randomUUID()
   const command={request_id:request,expected_revision:snap.revision,title:'Owned saved fixture',slug:snap.product.slug,price:'21.00',is_serialized:true,primary_warehouse_id:warehouse,variants:snap.variants}
   const saved=await f.call('/api/admin-products/'+p.id,{method:'PATCH',body:command});assert.equal(saved.response.status,200,JSON.stringify(saved.body))
   assert.equal((await f.call('/api/admin-products/'+p.id,{method:'PATCH',body:command})).response.status,200)
   const after=await rpc(f,'catalog_product_edit_snapshot',{p_admin_id:f.actors.owner,p_product_id:p.id});assert.ok(after.revision>snap.revision)
   const list=await f.call('/api/admin-products/list?q=Owned');assert.equal(list.response.status,200,JSON.stringify(list.body));assert.ok(JSON.stringify(list.body).includes(p.id))
   const bulk={request_id:randomUUID(),operation:'draft',items:[{id:p.id,expected_revision:after.revision}]}
   const first=await f.call('/api/admin-products/bulk',{method:'POST',body:bulk}),again=await f.call('/api/admin-products/bulk',{method:'POST',body:bulk});assert.equal(first.response.status,200,JSON.stringify(first.body));assert.equal(again.response.status,200);assert.equal(again.body.replayed,true)
   for(const format of['csv','xlsx']){
    const exported=await f.call('/api/admin-products/transfer/export',{method:'POST',body:{format,scope:'selected',ids:[p.id]}});assert.equal(exported.response.status,200);assert.ok(exported.body.length)
    const preview=await f.call('/api/admin-products/transfer/preview?format='+format,{method:'POST',body:exported.body,headers:{'content-type':'application/octet-stream'}});assert.equal(preview.response.status,200,JSON.stringify(preview.body))
    const pending=await stage(format),applied=await f.call('/api/admin-products/transfer/import/apply?'+new URLSearchParams({format,job_id:pending.job.id,review_hash:pending.job.review_hash}),{method:'POST',body:pending.bytes,headers:{'content-type':'application/octet-stream'}});assert.equal(applied.response.status,200,JSON.stringify(applied.body));assert.equal(applied.body.counts.pending,0);assert.equal(applied.body.counts.succeeded,1)
   }
   // The quote initializes without activating a payment method or provider.
   await f.db.query('update public.products set is_published=true where id=$1',[p.id])
   const item={id:p.id,variant_id:after.variants[0].id,quantity:1},quote=await f.call('/api/checkout/quote',{method:'POST',actor:'customer',body:{items:[item]}});assert.equal(quote.response.status,200,JSON.stringify(quote.body));assert.equal(quote.body.orderValue,21)
   assert.equal((await f.call('/api/checkout/quote',{method:'POST',actor:'customer',body:{items:[item],payment_method:'cash'}})).response.status,400)
   assert.ok((await f.browser.storage.from('admin-documents').upload('denied.pdf',Buffer.from('fixture'),{contentType:'application/pdf'})).error)
  })
  for(const scope of systemResetScopes)await t.test('migration79 installed target: '+scope.key+' reset',async()=>{
   const pending=['products','full'].includes(scope.key)?await stage():null
   await mkdir(f.uploads+'/products',{recursive:true});await writeFile(f.uploads+'/products/captured.png','synthetic captured public bytes')
   for(const bucket of['admin-documents','support-attachments','chat-attachments','order-packing-videos','shipping-labels','after-sales-evidence']){
    const name='captured-'+scope.key+(bucket==='order-packing-videos'?'.webm':'.pdf'),mime=bucket==='order-packing-videos'?'video/webm':'application/pdf'
    // Evidence permits images only. Use its allowed image fixture MIME.
    const r=await f.service.storage.from(bucket).upload(bucket==='after-sales-evidence'?name.replace('.pdf','.png'):name,Buffer.from('synthetic private bytes'),{contentType:bucket==='after-sales-evidence'?'image/png':mime});assert.equal(r.error,null)
   }
   // Explicit synthetic clock advance for this single-lab eight-scope rehearsal.
   // The production five-attempt limiter remains unchanged and is tested elsewhere.
   await f.db.query("update public.system_reset_attempts set window_started_at=clock_timestamp()-interval '16 minutes' where owner_id=$1",[f.actors.owner])
   const reset=await f.reset(scope.key);assert.equal(reset.response.status,200,JSON.stringify(reset.body));assert.equal(reset.body.status,'completed')
   assert.deepEqual(await releaseApplicationCatalog(f.db),schema)
   assert.deepEqual(await managedSecurity(f),managed)
   assert.deepEqual((await f.db.query('select * from supabase_migrations.schema_migrations order by version')).rows,history)
   assert.deepEqual(await scalar(f,'select to_jsonb(s) value from private.installation_bootstrap s'),seal)
   assert.equal((await f.service.auth.getUser(f.tokens.owner)).error,null)
   assert.equal((await f.authClient().auth.signInWithPassword({email:lab.owner.email,password:lab.owner.password})).error,null)
   await foreignKeys(f)
   assert.equal((await f.call('/api/admin-chat/settings')).response.status,200);assert.equal((await f.call('/api/chat/status',{actor:null})).body.enabled,false)
   assert.equal((await f.call('/api/analytics/events',{actor:null,method:'POST',body:{events:[{eventId:randomUUID(),eventName:'page_view',path:'/'}]}})).response.status,200)
   if(pending){const status=await rpc(f,'catalog_import_status',{p_admin_id:f.actors.owner,p_job_id:pending.job.id});assert.equal(status.closed_reason,'reset');assert.equal(status.counts.pending,0)}
   if(scope.mediaFiles)await assert.rejects(()=>readFile(f.uploads+'/products/captured.png'),/ENOENT/)
   if(scope.key==='full'){
    assert.equal(await scalar(f,'select count(*)::int value from storage.objects'),0)
    assert.equal(await scalar(f,'select count(*)::int value from auth.users'),1)
    assert.equal(await scalar(f,'select is_enabled value from public.shipping_provider_settings'),false)
    assert.equal(await scalar(f,'select is_enabled value from public.chat_settings'),false)
    await f.db.query("insert into public.commerce_warehouses(id,name) values($1,'After reset synthetic warehouse')",[warehouse]);await product()
    // Business-order persistence is a synthetic SQL fixture with no payment,
    // ERP/shipping worker or external provider activation.
    await f.db.query("insert into public.customer_orders(first_name,phone,street_address,city,governorate) values('Owned fixture','123','Synthetic','Cairo','Cairo')")
   }
   results.push({scope:scope.key,passed:true,schema_history_seal_preserved:true})
  })
  return results
 }finally{await f.close()}
}
