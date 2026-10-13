import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {createProductSaveFixture} from './helpers/productSaveFixture.mjs'
import {createCatalogRestFixture} from './helpers/catalogRestFixture.mjs'
import {createStorageNativeDatabase,storageNativeAvailable} from './helpers/storageNativeDatabase.mjs'
import {emailNativeAvailable,nativeWaitFor} from './helpers/emailNativeDatabase.mjs'
import {productEditorErrors} from '../app/utils/productEditor.js'
import {matchOriginal,requireSavedRow,mergeSectionRows} from '../app/utils/productSection.js'
const migration='20261013160000_product_draft_default.sql'
const migrateTail=async db=>{const dir=new URL('../supabase/migrations/',import.meta.url);for(const name of(await readdir(dir)).filter(n=>n.endsWith('.sql')&&n>'20261011120000_catalog_confidentiality.sql').sort())await db.exec(await readFile(new URL(name,dir),'utf8'))}

test('draft-first saves retain required inputs, retry receipts, revisions and ERP ownership',async t=>{
 const f=await createProductSaveFixture()
 try{
  await t.test('omitted publication creates a draft; editing/publishing requires existing atomic command',async()=>{
   const body=f.body();delete body.is_published
   const saved=await f.save(body);let loaded=await f.snapshot(saved.id)
   assert.equal(loaded.product.is_published,false)
   assert.equal((await f.save(body)).id,saved.id)
   const edit={...body,request_id:randomUUID(),expected_revision:loaded.revision,is_published:true,variants:loaded.variants}
   const published=await f.save(edit,{operation:'update',id:saved.id,actor:'editor'})
   loaded=await f.snapshot(saved.id);assert.equal(loaded.product.is_published,true)
   await assert.rejects(()=>f.save({...edit,request_id:randomUUID(),title:'Stale'},{operation:'update',id:saved.id}),e=>e.statusCode===409)
   const changed=await f.save({...edit,request_id:randomUUID(),expected_revision:published.revision,title:'Published edit'},{operation:'update',id:saved.id})
   assert.equal((await f.snapshot(changed.id)).product.is_published,true)
  })
  await t.test('empty optional references work; a draft still needs explicit price and warehouse',async()=>{
   const input=f.body({category_id:'',brand_id:'',default_supplier_id:''})
   const result=await f.save(input);const p=(await f.snapshot(result.id)).product
   assert.equal(p.category_id,null);assert.equal(p.brand_id,null);assert.equal(p.default_supplier_id,null)
   for(const bad of[{price:''},{price:null},{primary_warehouse_id:''},{variants:[]}]){
    const before=await f.counts();await assert.rejects(()=>f.save(f.body(bad)));assert.deepEqual(await f.counts(),before)
   }
   await f.db.exec("update public.site_settings set erp_mode='daftra' where key='default'")
   const snapshot=await f.snapshot(result.id)
   await assert.rejects(()=>f.save({...input,request_id:randomUUID(),expected_revision:snapshot.revision,primary_warehouse_id:f.otherWarehouse,variants:snapshot.variants},{operation:'update',id:result.id}),e=>e.statusCode===409)
   const ok=await f.save({...input,request_id:randomUUID(),expected_revision:snapshot.revision,variants:snapshot.variants,title:'Daftra content'},{operation:'update',id:result.id})
   assert.equal((await f.snapshot(ok.id)).product.title,'Daftra content')
  })
  await t.test('a genuinely empty catalog stays empty until an active warehouse exists',async()=>{
   await f.db.exec("update public.site_settings set erp_mode='built_in' where key='default'")
   await f.db.exec('delete from public.products; delete from public.categories; delete from public.brands; delete from public.commerce_crm_accounts; delete from public.commerce_warehouses')
   const empty=f.body({primary_warehouse_id:'',category_id:'',brand_id:'',default_supplier_id:''})
   assert.equal((await f.counts()).products,0)
   await assert.rejects(()=>f.save(empty));assert.equal((await f.counts()).products,0)
   const warehouse=randomUUID();await f.db.query("insert into public.commerce_warehouses(id,name,is_active) values($1,'Authored warehouse',true)",[warehouse])
   const saved=await f.save({...empty,primary_warehouse_id:warehouse})
   const p=(await f.snapshot(saved.id)).product
   assert.equal(p.is_published,false);assert.equal(p.stock_quantity,0)
   assert.equal(p.category_id,null);assert.equal(p.brand_id,null);assert.equal(p.default_supplier_id,null)
  })
 }finally{await f.db.close()}
})

test('early field validation never coerces missing prices or fractional inventory',()=>{
 const valid={title:'Authored title',slug:'authored-title',price:'12.50',old_price:'',sku:'00001',is_serialized:true,primary_warehouse_id:randomUUID(),variants:[{}]}
 assert.deepEqual(productEditorErrors(valid),{})
 for(const price of['',null,true,'12.345','NaN',undefined])assert.equal(productEditorErrors({...valid,price}).price,'price')
 for(const stock_quantity of['',-1,1.2,2147483648])assert.equal(productEditorErrors({...valid,is_serialized:false,stock_quantity}).stock_quantity,'stock_quantity')
 assert.equal(productEditorErrors({...valid,sku:'bad\nSKU'}).sku,'sku')
 assert.equal(productEditorErrors({...valid,primary_warehouse_id:''}).primary_warehouse_id,'warehouse')
})

test('separately saved rows preserve other drafts and reject empty/RLS-filtered saves',()=>{
 const draft={id:'b',value:'Typed',original:'Old'}
 assert.deepEqual(mergeSectionRows([{id:'a',value:'Saved'},{id:'b',value:'Concurrent'}],[draft],r=>r.value!==r.original,r=>({...r,original:r.value})),[{id:'a',value:'Saved',original:'Saved'},draft])
 assert.deepEqual(mergeSectionRows([], [draft],r=>r.value!==r.original,r=>r),[draft])
 assert.throws(()=>requireSavedRow({data:[],error:null}),e=>e.editorConflict)
 const calls=[];const q={eq(...args){calls.push(args);return q},is(...args){calls.push(args);return q}}
 matchOriginal(q,{value:'A',definition_id:null,aliases:['a,b','quote"','slash\\']})
 assert.deepEqual(calls,[['value','A'],['definition_id',null],['aliases','{"a,b","quote\\\"","slash\\\\"}']])
})

test('migration 74 changes only the future default under a non-superuser owner',{skip:!storageNativeAvailable,timeout:60000},async()=>{
 const db=await createStorageNativeDatabase({stopBefore:migration})
 try{
  const f=await createProductSaveFixture({database:db});const published=await f.save(f.body({is_published:true}));await f.save(f.body())
  const snapshot=async()=>{
   const rows=[];for(const {tablename}of(await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows){rows.push({tablename,...(await db.query(`select count(*)::int n,md5(coalesce(string_agg(to_jsonb(r)::text,chr(10) order by to_jsonb(r)::text),'')) hash from public."${tablename}" r`)).rows[0]})}return rows
  }
  const safeguards=async()=>(await db.query("select c.relname,c.relacl::text,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','storage') and c.relkind='r' order by n.nspname,c.relname")).rows
  const before=await snapshot(),acl=await safeguards(),functions=(await db.query("select pg_get_functiondef('public.catalog_save_product(uuid,uuid,text,uuid,bigint,jsonb,jsonb)'::regprocedure) definition")).rows
  await db.exec(await readFile(new URL('../supabase/migrations/'+migration,import.meta.url),'utf8'))
  assert.deepEqual(await snapshot(),before);assert.deepEqual(await safeguards(),acl)
  assert.deepEqual((await db.query("select pg_get_functiondef('public.catalog_save_product(uuid,uuid,text,uuid,bigint,jsonb,jsonb)'::regprocedure) definition")).rows,functions)
  assert.equal((await db.query('select rolsuper from pg_roles where rolname=current_user')).rows[0].rolsuper,false)
  assert.equal((await f.snapshot(published.id)).product.is_published,true)
  const id=randomUUID();await db.query("insert into public.products(id,title,slug,price,is_serialized,stock_quantity,primary_warehouse_id) values($1,'Default test',$2,1,true,0,$3)",[id,'default-'+id,f.warehouse]);assert.equal((await db.query('select is_published from public.products where id=$1',[id])).rows[0].is_published,false)
 }finally{await db.close()}
})

test('actual PostgREST excludes drafts and protects independent section writes',{skip:!emailNativeAvailable||!process.env.CATALOG_REVIEW_POSTGREST_BIN,timeout:60000},async()=>{
 const f=await createCatalogRestFixture()
 try{
  await migrateTail(f.db)
  await nativeWaitFor(async()=> (await f.request('/specification_definitions?select=id',{actor:'owner'})).status===200)
  const id=randomUUID();await f.db.query("insert into public.products(id,title,slug,price,is_serialized,primary_warehouse_id) values($1,'Draft',$2,25,true,$3)",[id,'draft-'+id,(await f.db.query('select id from public.commerce_warehouses where is_active limit 1')).rows[0].id])
  for(const actor of[null,'customer','inactive'])assert.deepEqual((await f.request('/storefront_products?id=eq.'+id+'&select=id',{actor})).body,[])
  for(const actor of[null,'customer'])assert.deepEqual((await f.request('/products?id=eq.'+id+'&select=id',{actor})).body,[])
  const written=await f.request('/products?id=eq.'+id,{actor:'editor',method:'PATCH',body:{is_published:true}});assert.equal(written.status,204)
  assert.equal((await f.request('/storefront_products?id=eq.'+id+'&select=id')).body[0].id,id)
  const sid=randomUUID();await f.db.query("insert into public.product_specifications(id,product_id,label,value) values($1,$2,'Authored name','Original')",[sid,id])
  const stale='/product_specifications?id=eq.'+sid+'&value=eq.Original'
  assert.equal((await f.request(stale,{actor:'editor',method:'PATCH',body:{value:'First administrator'}})).status,204)
  assert.equal((await f.request(stale,{actor:'owner',method:'PATCH',body:{value:'Stale administrator'}})).status,204)
  assert.equal((await f.db.query('select value from public.product_specifications where id=$1',[sid])).rows[0].value,'First administrator')
  for(const actor of[null,'customer','inactive']){
   const r=await f.request('/product_specifications?id=eq.'+sid,{actor,method:'PATCH',body:{value:'Unauthorized'}})
   assert.ok([204,401,403].includes(r.status))
  }
  assert.equal((await f.db.query('select value from public.product_specifications where id=$1',[sid])).rows[0].value,'First administrator')
  for(const actor of[null,'customer','editor'])assert.notEqual((await f.request('/products?select=cost_price,default_supplier_id,primary_warehouse_id',{actor})).status,200)
 }finally{await f.close()}
})
