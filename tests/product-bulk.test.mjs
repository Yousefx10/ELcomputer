import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile,readdir } from 'node:fs/promises'
import { productBulkCommand,productBulkResult } from '../app/utils/productBulk.js'
import { createProductSaveHttpFixture } from './helpers/productSaveHttpFixture.mjs'
import { createProductSaveFixture } from './helpers/productSaveFixture.mjs'
import { createEmailNativeDatabase,emailNativeAvailable,nativeWaitFor } from './helpers/emailNativeDatabase.mjs'
import { createCatalogRestFixture } from './helpers/catalogRestFixture.mjs'
import { createStorageNativeDatabase,storageNativeAvailable } from './helpers/storageNativeDatabase.mjs'
import { smsDatabaseClient } from './helpers/smsDatabase.mjs'
const migration='20261013200000_product_bulk_operations.sql'
const command=async(f,ids,operation='publish',reference_id=null)=>({request_id:randomUUID(),operation,reference_id,items:await Promise.all(ids.map(async id=>({id,expected_revision:(await f.snapshot(id)).revision})))})
const rpc=(f,c,client=f.client,actor='owner')=>client.rpc('catalog_bulk_products',{p_admin_id:f.actors[actor],p_request_id:c.request_id,p_operation:c.operation,p_reference_id:c.reference_id,p_items:c.items})
const http=(f,c,actor='owner')=>f.call('/api/admin-products/bulk',{method:'POST',body:c,actor})

test('bulk commands and acknowledgements reject ambiguity and malformed counts',()=>{
 const c={request_id:randomUUID(),operation:'publish',reference_id:null,items:[{id:randomUUID(),expected_revision:0}]}
 for(const bad of [{...c,operation:'delete'},{...c,operation:'price'},{...c,reference_id:randomUUID()},{...c,operation:'category'},{...c,items:[]},{...c,items:Array(26).fill(c.items[0])},{...c,items:[...c.items,...c.items]},{...c,items:[{id:'bad',expected_revision:0}]},{...c,items:[{...c.items[0],expected_revision:1.2}]},{...c,items:[{...c.items[0],expected_revision:-1}]},{...c,items:[{...c.items[0],expected_revision:Number.MAX_SAFE_INTEGER+1}]},{...c,stock_quantity:3},{...c,items:[{...c.items[0],price:0}]}]) assert.throws(()=>productBulkCommand(bad))
 const result={request_id:c.request_id,operation:c.operation,replayed:false,succeeded:1,unchanged:0,conflicted:0,failed:0,items:[{id:c.items[0].id,status:'succeeded',reason:null,revision:1}]}
 assert.equal(productBulkResult(result,c),result)
 for(const bad of [{...result,succeeded:2},{...result,items:[]},{...result,items:[{...result.items[0],revision:null}]},{...result,items:[{...result.items[0],id:randomUUID()}]},{...result,items:[{...result.items[0],reason:'failed'}]}])assert.throws(()=>productBulkResult(bad,c))
})

test('actual bulk HTTP: sparse actions, publishing, atomic failures, retries and authorization',async t=>{
 const f=await createProductSaveHttpFixture();try{
 const first=await f.save(f.body()), second=await f.save(f.body({is_published:true})), third=await f.save(f.body({selling_mode:'coming_soon'}))
 await t.test('same-snapshot list revision is the edit revision',async()=>{const r=await f.call('/api/admin-products/list');for(const p of r.body.items)assert.equal(p.revision,(await f.snapshot(p.id)).revision)})
 await t.test('publish returns exact changed and unchanged counts without other changes',async()=>{
  const before=(await f.db.query('select to_jsonb(p)-\'is_published\'-\'updated_at\' row from public.products p order by id')).rows
  const variants=(await f.db.query('select to_jsonb(v) row from public.product_variants v order by id')).rows
  const c=await command(f,[first.id,second.id]);const r=await http(f,c);assert.equal(r.response.status,200,JSON.stringify(r.body));productBulkResult(r.body,c);assert.equal(r.body.succeeded,1);assert.equal(r.body.unchanged,1);assert.equal(r.body.conflicted,0);assert.equal(r.body.failed,0)
  assert.deepEqual((await f.db.query('select to_jsonb(p)-\'is_published\'-\'updated_at\' row from public.products p order by id')).rows,before)
  assert.deepEqual((await f.db.query('select to_jsonb(v) row from public.product_variants v order by id')).rows,variants)
  assert.equal(r.response.headers.get('cache-control'),'private, no-store')
  const counts=await f.counts();const again=await http(f,c);assert.equal(again.body.replayed,true);assert.deepEqual({...again.body,replayed:false},r.body);assert.deepEqual(await f.counts(),counts)
  const status=await f.call('/api/admin-products/bulk?request_id='+c.request_id);assert.deepEqual(status.body.result,again.body)
  const other=await f.call('/api/admin-products/bulk?request_id='+c.request_id,{actor:'editor'});assert.equal(other.body.result,null)
  const reused=await http(f,{...c,operation:'draft'});assert.equal(reused.response.status,400);assert.equal(reused.body.data.productBulkError,'request_reused')
 })
 await t.test('draft, category and brand assignments change only the requested field',async()=>{
  await f.db.query("insert into public.categories(id,name,slug) values($1,'Other category','other-category')",[f.otherCategory=randomUUID()]);await f.db.query("insert into public.brands(id,name,slug) values($1,'Other brand','other-brand')",[f.otherBrand=randomUUID()])
  for(const [operation,reference,field,value] of [['draft',null,'is_published',false],['category',f.otherCategory,'category_id',f.otherCategory],['brand',f.otherBrand,'brand_id',f.otherBrand]]){
   const before=(await f.snapshot(first.id)).product,c=await command(f,[first.id],operation,reference),r=await http(f,c,'editor');assert.equal(r.response.status,200);assert.equal(r.body.succeeded,1)
   const after=(await f.snapshot(first.id)).product;assert.equal(after[field],value);for(const key of Object.keys(before).filter(k=>![field,'updated_at'].includes(k)))assert.deepEqual(after[key],before[key],key)
  }
  for(const kind of ['category','brand']){const target=randomUUID(),c=await command(f,[first.id],kind,target),before=await f.snapshot(first.id),r=await http(f,c);assert.equal(r.response.status,200);assert.equal(r.body.failed,1);assert.equal(r.body.items[0].reason,'reference');await f.db.query('insert into public.'+(kind==='category'?'categories':'brands')+'(id,name,slug) values($1,$2,$3)',[target,'Restored reference','restored-'+target]);const retry=await http(f,c);assert.equal(retry.body.replayed,true);assert.equal(retry.body.failed,1);assert.deepEqual(await f.snapshot(first.id),before)}
  assert.equal((await http(f,await command(f,[first.id],'category'))).response.status,400)
 })
 await t.test('incomplete, conflicted, missing and unchanged rows have honest partial results',async()=>{
  await f.db.query("update public.products set title='' where id=$1",[third.id]);const c=await command(f,[first.id,second.id,third.id]);c.items.find(p=>p.id===first.id).expected_revision=0;c.items.push({id:randomUUID(),expected_revision:0})
  const r=await http(f,c);assert.equal(r.response.status,200);productBulkResult(r.body,c);assert.equal(r.body.conflicted,1);assert.equal(r.body.failed,2);assert.equal(r.body.unchanged,1);assert.equal(r.body.items.find(p=>p.id===third.id).reason,'incomplete');assert.equal((await f.snapshot(third.id)).product.is_published,false)
  const hide=await http(f,await command(f,[third.id],'draft'));assert.equal(hide.body.unchanged,1)
  await f.db.query("update public.products set title='Coming soon' where id=$1",[third.id]);const publish=await http(f,await command(f,[third.id]));assert.equal(publish.body.succeeded,1);assert.equal((await f.snapshot(third.id)).product.selling_mode,'coming_soon')
 })
 await t.test('historical invalid prices, identifiers and SKU content cannot publish',async()=>{
  const p=await f.save(f.body());for(const [field,value] of [['price','NaN'],['slug','invalid_slug'],['sku','Invalid\nSKU']]){
   const snapshot=await f.snapshot(p.id);await f.db.query('update public.products set '+field+'=$1 where id=$2',[value,p.id]);const c=await command(f,[p.id]),r=await http(f,c);assert.equal(r.body.failed,1,field);assert.equal(r.body.items[0].reason,'incomplete',field);assert.equal((await f.snapshot(p.id)).product.is_published,false);await f.db.query('update public.products set '+field+'=$1 where id=$2',[snapshot.product[field],p.id])
  }
 })
 await t.test('audit failure rolls back that product and revision while another product commits',async()=>{
  await f.db.query('update public.products set brand_id=null where id=$1',[first.id]);
  await f.db.exec(`create function public.bulk_test_fail_audit() returns trigger language plpgsql as $$begin if new.metadata->>'bulk_operation' is not null and new.metadata->>'product_id'='${first.id}' then raise exception 'Private audit failure'; end if;return new;end$$;create trigger bulk_test_audit before insert on public.admin_activity_logs for each row execute function public.bulk_test_fail_audit()`)
  const before=await f.snapshot(first.id),counts=await f.counts(),c=await command(f,[first.id,third.id],'brand',f.otherBrand),r=await http(f,c);assert.equal(r.body.failed,1);assert.equal(r.body.succeeded,1);assert.deepEqual(await f.snapshot(first.id),before);assert.equal((await f.counts()).audits,counts.audits+1);assert.ok(!JSON.stringify(r.body).includes('Private audit'))
  await f.db.exec('drop trigger bulk_test_audit on public.admin_activity_logs;drop function public.bulk_test_fail_audit()')
 })
 await t.test('lost HTTP acknowledgement and original receipt survive newer edits',async()=>{
  const c=await command(f,[first.id],'publish');f.controls.loseResponse=true;await assert.rejects(()=>http(f,c));const snapshot=await f.snapshot(first.id),counts=await f.counts();await f.db.query("update public.products set title='Later edit' where id=$1",[first.id]);const again=await http(f,c);assert.equal(again.body.replayed,true);assert.equal(again.body.items[0].revision,snapshot.revision);assert.equal((await f.snapshot(first.id)).product.title,'Later edit');assert.deepEqual(await f.counts(),counts)
 })
 await t.test('receipt failure rolls back all batch changes and audits',async()=>{
  const c=await command(f,[first.id,second.id],'draft'),before=await Promise.all(c.items.map(p=>f.snapshot(p.id))),counts=await f.counts()
  await f.db.exec("create function catalog_private.bulk_test_fail_receipt() returns trigger language plpgsql as $$begin raise exception 'Receipt unavailable';end$$;create trigger bulk_test_receipt before insert on catalog_private.product_bulk_receipts for each row execute function catalog_private.bulk_test_fail_receipt()")
  try{assert.equal((await http(f,c)).response.status,503);assert.deepEqual(await Promise.all(c.items.map(p=>f.snapshot(p.id))),before);assert.deepEqual(await f.counts(),counts);assert.equal((await f.call('/api/admin-products/bulk?request_id='+c.request_id)).body.result,null)}finally{await f.db.exec('drop trigger bulk_test_receipt on catalog_private.product_bulk_receipts;drop function catalog_private.bulk_test_fail_receipt()')}
  assert.equal((await http(f,c)).response.status,200)
 })
 await t.test('Daftra ownership, selling modes and zero stock remain untouched',async()=>{
  await f.db.exec("update public.site_settings set erp_mode='daftra' where key='default'");const pre=await f.save(f.body({selling_mode:'preorder',price:'10',preorder_active:false,preorder_payment_mode:'deposit',preorder_deposit_percent:25}));const before=await f.snapshot(pre.id);const r=await http(f,await command(f,[pre.id]));assert.equal(r.body.succeeded,1);const after=await f.snapshot(pre.id);for(const field of ['selling_mode','preorder_active','preorder_deposit_percent','stock_quantity','cost_price','primary_warehouse_id','default_supplier_id'])assert.deepEqual(after.product[field],before.product[field],field);assert.deepEqual(after.variants,before.variants);await f.db.exec("update public.site_settings set erp_mode='built_in' where key='default'")
 })
 await t.test('legacy publication preserves aggregate stock and validates an assigned warehouse',async()=>{
  const legacy=randomUUID();await f.db.exec("select set_config('app.serialized_inventory_write','on',false)");try{await f.db.query("insert into public.products(id,title,slug,price,is_serialized,is_published,stock_quantity,primary_warehouse_id) values($1,'Legacy product',$2,10,false,false,0,$3)",[legacy,'legacy-'+legacy,f.otherWarehouse])}finally{await f.db.exec("select set_config('app.serialized_inventory_write','',false)")};await f.db.query('update public.commerce_warehouses set is_active=false where id=$1',[f.otherWarehouse]);const denied=await http(f,await command(f,[legacy]));assert.equal(denied.body.failed,1);assert.equal(denied.body.items[0].reason,'incomplete');assert.equal((await f.snapshot(legacy)).product.is_published,false)
  await f.db.query('update public.products set primary_warehouse_id=null where id=$1',[legacy]);const before=await f.snapshot(legacy),r=await http(f,await command(f,[legacy]));assert.equal(r.body.succeeded,1);const after=await f.snapshot(legacy);assert.equal(after.product.is_serialized,false);assert.equal(after.product.stock_quantity,before.product.stock_quantity);assert.deepEqual(after.variants,before.variants);await f.db.query('update public.commerce_warehouses set is_active=true where id=$1',[f.otherWarehouse])
 })
 await t.test('invalid bodies, viewers, customers, disabled and unauthorized users cannot write',async()=>{
  const c=await command(f,[first.id],'draft'),before=await f.snapshot(first.id);for(const actor of ['viewer','customer','disabled','unknown',null]){const r=await http(f,c,actor);assert.ok([401,403].includes(r.response.status));const check=await f.call('/api/admin-products/bulk?request_id='+c.request_id,{actor});assert.ok([401,403].includes(check.response.status))}
  for(const bad of [{...c,operation:'delete'},{...c,price:0},{...c,items:[...c.items,...c.items]},{...c,items:c.items.map(p=>({...p,expected_revision:1.5}))}])assert.equal((await http(f,bad)).response.status,400)
  await f.db.query("update public.admin_users set permissions='{}' where id=$1",[f.actors.editor]);assert.equal((await http(f,c,'editor')).response.status,403);assert.equal((await rpc(f,c,f.client,'editor')).error.code,'42501');assert.deepEqual(await f.snapshot(first.id),before)
 })
 }finally{await f.close()}
})

test('native bulk commands serialize same-product changes, retries and revocation', {skip:!emailNativeAvailable,timeout:60000},async t=>{
 const database=await createEmailNativeDatabase();try{
 const f=await createProductSaveFixture({database}),workers=await Promise.all([database.connect('service_role'),database.connect('service_role')]),clients=workers.map(smsDatabaseClient),blocker=await database.connect()
 const blocked=count=>nativeWaitFor(async()=>Number((await database.query("select count(*) n from pg_stat_activity where pid=any($1::int[]) and wait_event_type='Lock'",[workers.map(c=>c.processID)])).rows[0].n)===count)
 const product=await f.save(f.body())
 await t.test('two administrators cannot silently overwrite one loaded revision',async()=>{
  const c=await command(f,[product.id],'publish');await blocker.query('begin');await blocker.query('select id from public.products where id=$1 for update',[product.id]);const pending=Promise.all([rpc(f,c,clients[0]),rpc(f,{...c,request_id:randomUUID(),operation:'publish'},clients[1],'editor')]);await blocked(2);await blocker.query('commit');const outcomes=await pending;assert.ok(outcomes.every(r=>!r.error));assert.equal(outcomes.reduce((n,r)=>n+r.data.conflicted,0),1);assert.equal(outcomes.reduce((n,r)=>n+r.data.succeeded+r.data.unchanged,0),1)
 })
 await t.test('identical simultaneous batches commit once and replay once',async()=>{
  const c=await command(f,[product.id],'draft'),counts=await f.counts();await blocker.query('begin');await blocker.query("select pg_advisory_xact_lock(hashtextextended('catalog:bulk:'||$1::text,0))",[c.request_id]);const pending=Promise.all(clients.map(client=>rpc(f,c,client)));await blocked(2);await blocker.query('commit');const r=await pending;assert.ok(r.every(v=>!v.error));assert.equal(r.filter(v=>v.data.replayed).length,1);assert.equal((await f.counts()).audits,counts.audits+1)
 })
 await t.test('revision is rechecked after a full editor commit',async()=>{
  const c=await command(f,[product.id]);await blocker.query('begin');await blocker.query("update public.products set title='Concurrent editor' where id=$1",[product.id]);const pending=rpc(f,c,clients[0]);await blocked(1);await blocker.query('commit');const r=await pending;assert.equal(r.data.conflicted,1);assert.equal((await f.snapshot(product.id)).product.is_published,false)
 })
 await t.test('staff revocation waiting ahead of command denies commit',async()=>{
  const c=await command(f,[product.id]),before=await f.snapshot(product.id);await blocker.query('begin');await blocker.query('select id from public.admin_users where id=$1 for update',[f.actors.editor]);const pending=rpc(f,c,clients[0],'editor');await blocked(1);await blocker.query('update public.admin_users set is_active=false where id=$1',[f.actors.editor]);await blocker.query('commit');assert.equal((await pending).error.code,'42501');assert.deepEqual(await f.snapshot(product.id),before)
 })
 await t.test('category deletion ahead of target lock rejects the whole batch',async()=>{
  const id=randomUUID();await database.query("insert into public.categories(id,name,slug) values($1,'Temporary','temporary')",[id]);const c=await command(f,[product.id],'category',id);await blocker.query('begin');await blocker.query('delete from public.categories where id=$1',[id]);const pending=rpc(f,c,clients[0]);await blocked(1);await blocker.query('commit');const result=await pending;assert.equal(result.error,null);assert.equal(result.data.failed,1);assert.equal(result.data.items[0].reason,'reference');await database.query("insert into public.categories(id,name,slug) values($1,'Restored','restored')",[id]);const retry=await rpc(f,c,clients[1]);assert.equal(retry.data.replayed,true);assert.equal(retry.data.failed,1);assert.notEqual((await f.snapshot(product.id)).product.category_id,id)
 })
 }finally{await database.close()}
})

test('actual PostgREST: migration-only schema reload and private RPC/receipt boundaries',{skip:!emailNativeAvailable,timeout:60000},async()=>{
 const rest=await createCatalogRestFixture();try{
 const dir=new URL('../supabase/migrations/',import.meta.url);for(const name of(await readdir(dir)).filter(n=>n>'20261011120000_catalog_confidentiality.sql'&&n<migration&&n.endsWith('.sql')).sort())await rest.db.exec(await readFile(new URL(name,dir),'utf8'))
 const f=await createProductSaveFixture({database:rest.db});Object.assign(rest.actors,f.actors);const product=await f.save(f.body()),c=await command(f,[product.id]);const input={p_admin_id:f.actors.owner,p_request_id:c.request_id,p_operation:c.operation,p_reference_id:null,p_items:c.items}
 assert.equal((await rest.request('/rpc/catalog_bulk_products',{method:'POST',body:input})).status,404)
 await rest.db.exec(await readFile(new URL(migration,dir),'utf8'));await nativeWaitFor(async()=>(await rest.request('/rpc/catalog_product_bulk_status',{actor:'service',method:'POST',body:{p_admin_id:f.actors.owner,p_request_id:c.request_id}})).status!==404)
 for(const actor of [null,'customer','viewer','editor','owner']){assert.notEqual((await rest.request('/rpc/catalog_bulk_products',{actor,method:'POST',body:input})).status,200);assert.notEqual((await rest.request('/product_bulk_receipts',{actor})).status,200)}
 // The helper's service actor must be explicit JWT service_role, never a staff JWT.
 assert.equal((await rest.db.query("select has_function_privilege('service_role','public.catalog_bulk_products(uuid,uuid,text,uuid,jsonb)','execute') permitted")).rows[0].permitted,true)
 const r=await rest.request('/rpc/catalog_bulk_products',{actor:'service',method:'POST',body:input});assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.body.succeeded,1);const own=await rest.request('/rpc/catalog_product_bulk_status',{actor:'service',method:'POST',body:{p_admin_id:f.actors.owner,p_request_id:c.request_id}});assert.equal(own.body.succeeded,1)
 }finally{await rest.close()}
})

 test('migration 76 preserves business data and grants under non-superuser ownership',{skip:!storageNativeAvailable,timeout:60000},async()=>{
 const db=await createStorageNativeDatabase({stopBefore:migration});try{
 const f=await createProductSaveFixture({database:db});await f.save(f.body());const rows=async()=> (await db.query("select (select jsonb_agg(to_jsonb(p) order by id) from public.products p) products,(select jsonb_agg(to_jsonb(v) order by id) from public.product_variants v) variants,(select jsonb_agg(to_jsonb(s) order by key) from public.site_settings s) settings")).rows[0]
 const grants=async()=>(await db.query("select oid::regclass::text name,relacl::text,relrowsecurity from pg_class where relnamespace='public'::regnamespace and relkind in ('r','v') order by oid")).rows
 const before=await rows(),acl=await grants();assert.equal((await db.query("select rolsuper from pg_roles where rolname=current_user")).rows[0].rolsuper,false)
 await db.exec(await readFile(new URL('../supabase/migrations/'+migration,import.meta.url),'utf8'));assert.deepEqual(await rows(),before);assert.deepEqual(await grants(),acl)
 for(const role of ['anon','authenticated','service_role'])assert.equal((await db.query("select has_table_privilege($1,'catalog_private.product_bulk_receipts','select,insert,update,delete') permitted",[role])).rows[0].permitted,false)
 const c=await command(f,[(await db.query('select id from public.products')).rows[0].id]);const r=await rpc(f,c);assert.equal(r.error,null,JSON.stringify(r.error));assert.equal(r.data.succeeded,1)
 }finally{await db.close()}
 })

test('25-product sparse batch remains bounded in a 10,000-product catalog',{skip:!emailNativeAvailable,timeout:60000},async()=>{
 const db=await createEmailNativeDatabase();try{
 const f=await createProductSaveFixture({database:db});await db.query("with added as (insert into public.products(title,slug,price,is_serialized,is_published,sku,primary_warehouse_id) select 'Bulk catalog '||i,'bulk-large-'||i,10,true,false,'BULK-'||i,$1 from generate_series(1,10000) i returning id) insert into public.product_variants(product_id,name,code,is_active) select id,'Default','DEFAULT',true from added",[f.warehouse])
 const c={request_id:randomUUID(),operation:'publish',reference_id:null,items:(await db.query('select product_id id,revision::float8 expected_revision from catalog_private.product_revisions order by product_id limit 25')).rows}
 const before=(await db.query("select md5(jsonb_agg(to_jsonb(v) order by id)::text) checksum from public.product_variants v")).rows[0].checksum,started=performance.now(),r=await rpc(f,c),ms=Math.round(performance.now()-started);assert.equal(r.error,null,JSON.stringify(r.error));productBulkResult(r.data,c);assert.equal(r.data.succeeded,25);assert.ok(ms<15000);assert.equal((await db.query('select count(*)::int n from public.products where is_published')).rows[0].n,25);assert.equal((await db.query("select md5(jsonb_agg(to_jsonb(v) order by id)::text) checksum from public.product_variants v")).rows[0].checksum,before)
 if(process.env.PRODUCT_BULK_REVIEW_ARTIFACTS){const {mkdir,writeFile}=await import('node:fs/promises');await mkdir(process.env.PRODUCT_BULK_REVIEW_ARTIFACTS,{recursive:true});await writeFile(process.env.PRODUCT_BULK_REVIEW_ARTIFACTS+'/performance.json',JSON.stringify({catalog:10000,selected:25,ms,bytes:JSON.stringify(r.data).length,succeeded:r.data.succeeded},null,2)+'\n')}
 }finally{await db.close()}
})
