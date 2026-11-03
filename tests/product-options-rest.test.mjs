import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {createCatalogRestFixture} from './helpers/catalogRestFixture.mjs'
import {createProductSaveFixture} from './helpers/productSaveFixture.mjs'
import {emailNativeAvailable,nativeWaitFor} from './helpers/emailNativeDatabase.mjs'
import {prepareProductSave} from '../server/utils/productSave.js'

test('actual PostgREST option fields remain public-only and stale edits release the pool', {skip:!emailNativeAvailable||!process.env.CATALOG_REVIEW_POSTGREST_BIN,timeout:60000},async t=>{
 const rest=await createCatalogRestFixture()
 try{
  for(const name of (await readdir('supabase/migrations')).filter(n=>n.endsWith('.sql')&&n>'20261011120000_catalog_confidentiality.sql').sort())await rest.db.exec(await readFile('supabase/migrations/'+name,'utf8'))
  const f=await createProductSaveFixture({database:rest.db})
  await nativeWaitFor(async()=> (await rest.request('/rpc/catalog_product_save_status',{actor:'service',method:'POST',body:{p_admin_id:f.actors.owner,p_request_id:randomUUID()}})).status===200)
  const body=f.body({is_published:true,variants:[{name:'Owned model',code:'MODEL',sku:'MODEL-'+randomUUID(),sale_price:'249.95',option_values:{model:'Actual configured model',capacity:'32 GB'}}]})
  const command={p_admin_id:f.actors.owner,p_product_id:null,...prepareProductSave(body,'create')}
  const created=await rest.request('/rpc/catalog_save_product',{actor:'service',method:'POST',body:command})
  assert.equal(created.status,200,JSON.stringify(created))
  const id=created.body.id,snapshot=await f.snapshot(id)
  await t.test('the public view exposes option values/prices and excludes private costs',async()=>{
   const rows=await rest.request('/storefront_product_variants?select=id,sku,sale_price,option_values&product_id=eq.'+id)
   assert.equal(rows.status,200);assert.equal(rows.body.length,1);assert.equal(Number(rows.body[0].sale_price),249.95)
   assert.deepEqual(rows.body[0].option_values,{model:'Actual configured model',capacity:'32 GB'})
   assert.notEqual((await rest.request('/product_variants?select=cost_price')).status,200)
   for(const actor of [null,'customer','owner'])assert.notEqual((await rest.request('/rpc/commerce_define_product_variants',{actor,method:'POST',body:{p_product_id:id,p_variants:[],p_admin_id:f.actors.owner}})).status,200)
  })
  const edit={p_admin_id:f.actors.owner,p_product_id:id,...prepareProductSave(f.body({slug:snapshot.product.slug,expected_revision:snapshot.revision,is_published:true,variants:snapshot.variants}),'update')}
  assert.equal((await rest.request('/rpc/catalog_save_product',{actor:'service',method:'POST',body:edit})).status,200)
  await t.test('four stale saves return bounded HTTP409 and leave the real two-slot pool available',async()=>{
   const started=Date.now()
   const replies=await Promise.all(Array.from({length:4},async()=>{
    const response=await fetch(rest.url+'/rpc/catalog_save_product',{method:'POST',headers:{authorization:'Bearer '+rest.token('service'),'content-type':'application/json'},body:JSON.stringify({...edit,p_request_id:randomUUID()}),signal:AbortSignal.timeout(3000)})
    return {status:response.status,body:await response.json()}
   }))
   assert.ok(replies.every(r=>r.status===409&&r.body.code==='PT409'),JSON.stringify(replies))
   assert.ok(Date.now()-started<3000)
   assert.equal((await fetch(rest.url+'/storefront_products?select=id&limit=1',{signal:AbortSignal.timeout(1000)})).status,200)
  })
  await t.test('the recovered accessory editor uses PT409 through actual PostgREST',async()=>{
   await nativeWaitFor(async()=> (await rest.request('/rpc/catalog_product_presentation',{actor:'service',method:'POST',body:{p_admin_id:f.actors.owner,p_product_id:id}})).status===200)
   const command={p_admin_id:f.actors.owner,p_product_id:id,p_request_id:randomUUID(),p_expected_revision:0,p_content:{videos:[],related:[],compatible:[]}}
   const first=await rest.request('/rpc/catalog_save_product_presentation',{actor:'service',method:'POST',body:command})
   assert.equal(first.status,200,JSON.stringify(first))
   const stale=await rest.request('/rpc/catalog_save_product_presentation',{actor:'service',method:'POST',body:{...command,p_request_id:randomUUID()}})
   assert.equal(stale.status,409);assert.equal(stale.body.code,'PT409')
  })
 }finally{await rest.close()}
})
