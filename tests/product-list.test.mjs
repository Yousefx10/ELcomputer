import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { createProductSaveHttpFixture } from './helpers/productSaveHttpFixture.mjs'
import { createProductSaveFixture } from './helpers/productSaveFixture.mjs'
import { createEmailNativeDatabase, emailNativeAvailable, nativeWaitFor } from './helpers/emailNativeDatabase.mjs'
import { createStorageNativeDatabase, storageNativeAvailable } from './helpers/storageNativeDatabase.mjs'
import { createCatalogRestFixture } from './helpers/catalogRestFixture.mjs'
import { catalogDataSnapshot } from './helpers/catalogFixture.mjs'
import { productListQuery } from '../server/utils/productList.js'
import { productListState, productListParams, productListPath, productListReturnPath } from '../app/utils/productList.js'
import {seedListing} from './helpers/productListFixture.mjs'
const migration = '20261013180000_product_listing.sql'
const tail = async (db,stopBefore=null) => { const dir = new URL('../supabase/migrations/', import.meta.url); for (const file of (await readdir(dir)).filter(n => n.endsWith('.sql') && n > '20261011120000_catalog_confidentiality.sql' && (!stopBefore || n < stopBefore)).sort()) await db.exec(await readFile(new URL(file,dir),'utf8')) }
const sqlList = async (f, input={}) => { const q=productListQuery(input); const {data,error}=await f.client.rpc('catalog_product_list',{p_admin_id:f.actors.owner,p_query:q.q,p_status:q.status,p_category:q.category,p_brand:q.brand,p_mode:q.mode,p_stock:q.stock,p_sort:q.sort,p_page:q.page});assert.equal(error,null,JSON.stringify(error));return data }

test('list query inputs and local return URLs are strictly bounded',()=>{
 for(const query of [{sort:'price;drop table products'},{q:['a','b']},{page:'0'},{page:'1.5'},{page:'40000001'},{category:'none'},{brand:'all'},{stock:'physical'},{mode:'invalid'},{status:'private'},{q:'x'.repeat(121)},{q:'bad\ntext'},{cost_price:'1'}]) assert.throws(()=>productListQuery(query),e=>e.statusCode===400)
 const category=randomUUID();const state=productListState({q:' عربي ',category,status:'drafts',sort:'price_desc',page:'3'})
 assert.equal(state.q,'عربي');assert.deepEqual(productListState(productListParams(state)),state)
 assert.equal(productListReturnPath(productListPath(state)),productListPath(state))
 for(const url of ['https://evil.invalid','//evil.invalid','/dashboard/products/edit/id','/dashboard/products?returnTo=https://evil.invalid','/dashboard/products#bad', ['/dashboard/products']]) assert.equal(productListReturnPath(url),'/dashboard/products')
 assert.deepEqual(productListState({page:'no',stock:'invalid',category:'bad',q:['bad']}),productListState())
})

test('actual listing HTTP search, filters, deterministic pages, empty states and permissions',async t=>{
 const f=await createProductSaveHttpFixture();try{
  let r=await f.call('/api/admin-products/list');assert.equal(r.response.status,200);assert.equal(r.body.catalog_total,0);assert.equal(r.body.total,0);assert.deepEqual(r.body.items,[])
  const {rows,c2,b2}=await seedListing(f)
  const request=async(q={})=>{const r=await f.call('/api/admin-products/list?'+new URLSearchParams(q));assert.equal(r.response.status,200,JSON.stringify(r.body));assert.equal(r.response.headers.get('cache-control'),'private, no-store');return r.body}
  await t.test('English/Arabic title, literal SKU, option SKU and option code search',async()=>{
   for(const [q,id] of [['حاسوب',rows[0].id],['عربي',rows[0].id],['00001-exact-case',rows[1].id],['variant-sku-17',rows[17].id],['code_23',rows[23].id],['product 031',rows[31].id]]){const r=await request({q});assert.equal(r.total,1);assert.equal(r.items[0].id,id)}
   for(const q of ['%','_never_','\\','%27 OR 1=1','not-present'])assert.equal((await request({q})).total,0)
   await f.db.query("insert into public.product_variants(product_id,name,code,sku,is_active) values($1,'Archived option','ARCHIVED','ARCHIVED-SKU-17',false)",[rows[17].id]);const historical=await request({q:'ARCHIVED-SKU-17'});assert.equal(historical.items[0].id,rows[17].id);assert.equal(historical.items[0].option_count,1)
  })
  await t.test('every filter combination has matching counts and rows',async()=>{
   for(const status of ['all','published','drafts'])for(const category of ['',f.category,c2])for(const brand of ['',f.brand,b2])for(const mode of ['all','normal','coming_soon','preorder'])for(const stock of ['all','in_stock','out_of_stock']){
    const expected=rows.filter(p=>(status==='all'||p.is_published===(status==='published'))&&(!category||p.category_id===category)&&(!brand||p.brand_id===brand)&&(mode==='all'||p.selling_mode===mode)&&(stock==='all'||(p.available_quantity>0)===(stock==='in_stock')))
    const actual=await request({status,category,brand,mode,stock});assert.equal(actual.total,expected.length,JSON.stringify({status,category,brand,mode,stock}));assert.ok(actual.items.length<=25);assert.ok(actual.items.every(p=>expected.some(e=>e.id===p.id)))
   }
  })
  await t.test('six sorts, stable tie breaks, final page and out-of-range clamp',async()=>{
   for(const sort of ['newest','oldest','title_asc','title_desc','price_asc','price_desc']){
    const page1=await request({sort}),page2=await request({sort,page:'2'}),again=await request({sort})
    assert.deepEqual(page1.items.map(p=>p.id),again.items.map(p=>p.id));assert.equal(new Set([...page1.items,...page2.items].map(p=>p.id)).size,rows.length)
    const list=[...page1.items,...page2.items];for(let i=1;i<list.length;i++){
     const a=rows.find(r=>r.id===list[i-1].id),b=rows.find(r=>r.id===list[i].id)
     let cmp=sort.includes('title')?a.title.toLowerCase().localeCompare(b.title.toLowerCase(),'en'):sort.includes('price')?Number(a.price)-Number(b.price):new Date(a.created_at)-new Date(b.created_at)
     // PostgreSQL C collation places Arabic after ASCII; mixed-title ordering is checked separately in SQL.
     if(!sort.includes('title')||(!/[\u0600-\u06ff]/.test(a.title)&&!/[\u0600-\u06ff]/.test(b.title))){if(sort==='newest'||sort.endsWith('desc'))cmp=-cmp;assert.ok(cmp<=0);if(cmp===0)assert.ok(a.id<b.id)}
    }
   }
   const clamp=await request({page:'40000000'});assert.equal(clamp.page,2);assert.equal(clamp.items.length,9)
   const none=await request({q:'no-match',page:'9'});assert.equal(none.page,1);assert.equal(none.catalog_total,rows.length);assert.equal(none.total,0)
  })
  await t.test('named view permission permits owner/editor/viewer, rejects customer/revoked/unauthenticated',async()=>{
   for(const actor of ['owner','editor','viewer'])assert.equal((await f.call('/api/admin-products/list',{actor})).response.status,200)
   for(const actor of ['disabled','customer',null])for(const path of ['/api/admin-products/list','/api/admin-products/filter-options?kind=category'])assert.ok([401,403].includes((await f.call(path,{actor})).response.status))
   await f.db.query("update public.admin_users set permissions='{}' where id=$1",[f.actors.viewer]);assert.equal((await f.call('/api/admin-products/list',{actor:'viewer'})).response.status,403)
   await f.db.query('update public.admin_users set is_active=false where id=$1',[f.actors.editor]);assert.equal((await f.call('/api/admin-products/list',{actor:'editor'})).response.status,403)
   const response=JSON.stringify((await request()).items);for(const privateName of ['cost_price','unit_cost','default_supplier_id','primary_warehouse_id','warehouse_id','erp_inventory_cache','serial_number'])assert.ok(!response.includes(privateName))
  })
  await t.test('invalid API filters and safe database errors never expose internals',async()=>{
   for(const q of ['sort=cost_price','page=-1','q=a&q=b','category=invalid','bad=1'])assert.equal((await f.call('/api/admin-products/list?'+q)).response.status,400)
   for(const q of ['kind=products','kind=category&selected=bad','kind=brand&q=a&q=b','kind=category&secret=1'])assert.equal((await f.call('/api/admin-products/filter-options?'+q)).response.status,400)
   const rpc=f.client.rpc;f.client.rpc=()=>{const request=Promise.resolve({error:{code:'XX001',message:'private_cost_supplier_SECRET'}});request.abortSignal=()=>request;return request}
   const failed=await f.call('/api/admin-products/list');assert.equal(failed.response.status,503);assert.ok(!JSON.stringify(failed.body).includes('SECRET'));f.client.rpc=rpc
  })
  await t.test('filter choices remain bounded and selected names survive later pages',async()=>{
   await f.db.exec("insert into public.categories(name,name_ar,slug) select 'Choice '||lpad(i::text,3,'0'),'اختيار '||i,'choice-'||i from generate_series(1,140) i")
   const selected=(await f.db.query("select id from public.categories where slug='choice-140'")).rows[0].id
   let r=await f.call('/api/admin-products/filter-options?kind=category&selected='+selected);assert.equal(r.body.items.length,100);assert.equal(r.body.total,142);assert.equal(r.body.selected.id,selected)
   r=await f.call('/api/admin-products/filter-options?kind=category&q='+encodeURIComponent('اختيار 140'));assert.equal(r.body.items.length,1);assert.equal(r.body.items[0].id,selected)
  })
 }finally{await f.close()}
})

test('listing availability follows primary warehouse, active options and Daftra reservations',async()=>{
 const f=await createProductSaveFixture();try{
  const saved=await f.save(f.body({is_published:true})),snapshot=await f.snapshot(saved.id),variant=snapshot.variants[0].id
  for(const [code,warehouse,status]of [['one',f.warehouse,'in_stock'],['other',f.otherWarehouse,'in_stock'],['damaged',f.warehouse,'damaged']])await f.db.query('insert into public.commerce_serialized_units(unit_code,product_id,variant_id,warehouse_id,status) values($1,$2,$3,$4,$5)',[code,saved.id,variant,warehouse,status])
  assert.equal((await sqlList(f)).items[0].available_quantity,1)
  await f.db.query("insert into public.product_variants(product_id,name,code,is_active) values($1,'Other option','OTHER',true)",[saved.id]);await f.db.query('update public.product_variants set is_active=false where id=$1',[variant]);assert.equal((await sqlList(f)).items[0].available_quantity,0)
  await f.db.query('update public.product_variants set is_active=true where id=$1',[variant])
  await f.db.exec("update public.site_settings set erp_mode='daftra' where key='default'")
  assert.equal((await sqlList(f)).items[0].available_quantity,0)
  await f.db.query("insert into public.erp_inventory_cache(local_entity_type,local_id,product_id,external_id,quantity,cost,fetched_at) values('product_variant',$1,$2,'fixture-remote',4,123.45,now())",[variant,saved.id])
  assert.equal((await sqlList(f)).items[0].available_quantity,1)
  // Reservation is attached to an actual local order item; no provider call.
  await f.db.exec("update public.site_settings set payment_cash_enabled=true where key='default'")
  const order=(await f.db.query("insert into public.customer_orders(order_number,first_name,phone,street_address,city,governorate) values('LIST-RESERVATION','Fixture','100','Fixture','Fixture','Fixture') returning id")).rows[0].id
  const item=(await f.db.query('insert into public.customer_order_items(order_id,product_id,variant_id,product_title,quantity,unit_price,line_total) values($1,$2,$3,\'Fixture\',1,125.50,125.50) returning id',[order,saved.id,variant])).rows[0].id
  await f.db.query("insert into public.erp_stock_reservations(order_item_id,local_entity_type,local_id,quantity) values($1,'product_variant',$2,4)",[item,variant])
  assert.equal((await sqlList(f)).items[0].available_quantity,0)
  assert.equal((await sqlList(f,{stock:'in_stock'})).total,0)
  await f.db.exec("update public.site_settings set erp_mode='built_in' where key='default';select set_config('app.serialized_inventory_write','on',false)")
  const legacy=(await f.db.query("insert into public.products(title,slug,price,is_serialized,is_published,stock_quantity,primary_warehouse_id) values('Historical legacy','listing-legacy',5,false,false,3,$1) returning id",[f.warehouse])).rows[0].id
  await f.db.exec("select set_config('app.serialized_inventory_write','off',false)")
  assert.equal((await sqlList(f)).items.find(p=>p.id===legacy).available_quantity,3)
  await f.db.exec("update public.site_settings set erp_mode='daftra' where key='default'")
  assert.equal((await sqlList(f)).items.find(p=>p.id===legacy).available_quantity,0)
  await f.db.query("insert into public.erp_inventory_cache(local_entity_type,local_id,product_id,external_id,quantity,cost,fetched_at) values('product',$1,$1,'fixture-legacy',2,40,now())",[legacy])
  assert.equal((await sqlList(f)).items.find(p=>p.id===legacy).available_quantity,2)
 }finally{await f.db.close()}
})

test('migration 75 executes as a non-superuser and preserves rows, RLS, grants and business functions',{skip:!storageNativeAvailable},async()=>{
 const db=await createStorageNativeDatabase({stopBefore:migration});try{
  const f=await createProductSaveFixture({database:db});await f.save(f.body({is_published:true}));await f.save(f.body())
  await db.exec('create extension pg_trgm with schema public')
  const extensionBefore=(await db.query("select oid,extnamespace,extversion from pg_extension where extname='pg_trgm'")).rows
  const before=await catalogDataSnapshot(db)
  const security=()=>db.query("select c.oid,c.relname,c.relacl,c.relrowsecurity,c.relforcerowsecurity,(select jsonb_agg(to_jsonb(p) order by p.oid) from pg_policy p where p.polrelid=c.oid) policies from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','v') order by c.oid")
  const functions=()=>db.query("select p.oid,p.prosrc,p.proacl,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','catalog_private') order by p.oid")
  const acl=(await security()).rows,fn=(await functions()).rows
  await db.exec(await readFile(new URL('../supabase/migrations/'+migration,import.meta.url),'utf8'))
  assert.deepEqual(await catalogDataSnapshot(db),before);assert.deepEqual((await security()).rows,acl)
  const after=(await functions()).rows;for(const row of fn)assert.deepEqual(after.find(p=>p.oid===row.oid),row)
  assert.equal((await db.query("select rolsuper from pg_roles where rolname=current_user")).rows[0].rolsuper,false)
  assert.equal((await sqlList(f)).total,2)
  assert.deepEqual((await db.query("select oid,extnamespace,extversion from pg_extension where extname='pg_trgm'")).rows,extensionBefore)
  for(const role of ['anon','authenticated']){const actor=await db.connect(role);await assert.rejects(()=>actor.query('select public.catalog_product_list($1)',[f.actors.owner]),/permission denied/)}
 }finally{await db.close()}
})

test('actual PostgREST denies direct listing RPCs and preserves public drafts/confidentiality',{skip:!emailNativeAvailable||!process.env.CATALOG_REVIEW_POSTGREST_BIN},async()=>{
 const rest=await createCatalogRestFixture();try{await tail(rest.db,migration);const f=await createProductSaveFixture({database:rest.db});Object.assign(rest.actors,f.actors);const draft=await f.save(f.body()),published=await f.save(f.body({is_published:true}));
 assert.equal((await rest.request('/rpc/catalog_product_list',{actor:'service',method:'POST',body:{p_admin_id:f.actors.owner}})).status,404)
 await rest.db.exec(await readFile(new URL('../supabase/migrations/'+migration,import.meta.url),'utf8'))
 await nativeWaitFor(async()=>(await rest.request('/rpc/catalog_product_list',{actor:'service',method:'POST',body:{p_admin_id:f.actors.owner}})).status===200)
 for(const actor of [null,'customer','owner','editor','viewer'])for(const rpc of ['catalog_product_list','catalog_product_filter_options'])assert.ok([401,403,404].includes((await rest.request('/rpc/'+rpc,{actor,method:'POST',body:{p_admin_id:f.actors.owner,...(rpc.includes('options')?{p_kind:'category'}:{})}})).status))
 const staff=await rest.request('/rpc/catalog_product_list',{actor:'service',method:'POST',body:{p_admin_id:f.actors.viewer}});assert.equal(staff.status,200);assert.ok(staff.body.items.some(p=>p.id===draft.id))
 for(const actor of [null,'customer']){const publicRows=await rest.request('/storefront_products?select=id,title,price',{actor});assert.equal(publicRows.status,200);assert.ok(!publicRows.body.some(p=>p.id===draft.id));assert.ok(publicRows.body.some(p=>p.id===published.id));assert.notEqual((await rest.request('/products?select=cost_price,default_supplier_id,primary_warehouse_id',{actor})).status,200)}
 await rest.db.query('update public.admin_users set is_active=false where id=$1',[f.actors.viewer]);assert.equal((await rest.request('/rpc/catalog_product_list',{actor:'service',method:'POST',body:{p_admin_id:f.actors.viewer}})).status,403)
 }finally{await rest.close()}
})

test('10,000-product native catalog has bounded results and indexed substring search',{skip:!emailNativeAvailable},async()=>{
 const db=await createEmailNativeDatabase();try{const f=await createProductSaveFixture({database:db})
 await db.query("with added as (insert into public.products(title,slug,price,is_serialized,is_published,sku,primary_warehouse_id) select 'Large catalog '||lpad(i::text,5,'0'),'large-'||i,10,true,i%2=0,'LARGE-PARENT-'||i,$1 from generate_series(1,10000) i returning id,slug) insert into public.product_variants(product_id,name,code,sku,is_active) select id,'Default','DEFAULT','LARGE-VARIANT-'||substring(slug from 7),true from added",[f.warehouse]);await db.exec('vacuum analyze public.products');await db.exec('vacuum analyze public.product_variants')
 const measured=[];for(const q of [{},{page:'400'},{q:'VARIANT-8123'},{q:'catalog 08123'},{status:'drafts',mode:'normal',stock:'out_of_stock',sort:'price_desc'}]){const started=performance.now(),r=await sqlList(f,q),ms=performance.now()-started;assert.ok(r.items.length<=25);assert.ok(JSON.stringify(r).length<50000);assert.ok(ms<15000);measured.push({query:q,ms:Math.round(ms),total:r.total,rows:r.items.length,bytes:JSON.stringify(r).length})}
 const plan=await db.query("explain (analyze,format json) select id from public.products where lower(title) like '%catalog 08123%'")
 assert.ok(JSON.stringify(plan.rows).includes('catalog_products_title_search_idx'))
 const variantPlan=await db.query("explain (analyze,format json) select product_id from public.product_variants where lower(sku) like '%variant-8123%'")
 assert.ok(JSON.stringify(variantPlan.rows).includes('catalog_variants_sku_search_idx'))
 if(process.env.PRODUCT_LIST_REVIEW_ARTIFACTS){await mkdir(process.env.PRODUCT_LIST_REVIEW_ARTIFACTS,{recursive:true});await writeFile(process.env.PRODUCT_LIST_REVIEW_ARTIFACTS+'/performance.json',JSON.stringify({products:10000,measured,titlePlan:plan.rows,variantPlan:variantPlan.rows},null,2)+'\n')}
 }finally{await db.close()}
})
