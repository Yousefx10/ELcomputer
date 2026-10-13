import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { createCatalogRestFixture } from './helpers/catalogRestFixture.mjs'
import { emailNativeAvailable, nativeWaitFor } from './helpers/emailNativeDatabase.mjs'

test('actual PostgREST keeps media deletion private and guards direct staff references', {skip:!emailNativeAvailable||!process.env.CATALOG_REVIEW_POSTGREST_BIN,timeout:60000},async()=>{
  const f=await createCatalogRestFixture()
  try{
    const dir=new URL('../supabase/migrations/',import.meta.url)
    for(const name of(await readdir(dir)).filter(n=>n.endsWith('.sql')&&n>'20261011120000_catalog_confidentiality.sql').sort())await f.db.exec(await readFile(new URL(name,dir),'utf8'))
    const path='/uploads/products/rest-unused.png',body={p_admin_id:f.actors.owner,p_path:path}
    await nativeWaitFor(async()=>[200,400].includes((await f.request('/rpc/catalog_media_delete',{actor:'service',method:'POST',body})).status))
    for(const actor of [null,'customer','editor','owner','inactive']) {
      assert.ok([401,403,404].includes((await f.request('/rpc/catalog_media_delete',{actor,method:'POST',body})).status))
      assert.notEqual((await f.request('/media_paths',{actor})).status,200)
      assert.notEqual((await f.request('/products?select=cost_price,default_supplier_id,primary_warehouse_id',{actor})).status,200)
    }
    const valid=await f.request('/rpc/catalog_media_delete',{actor:'service',method:'POST',body});assert.equal(valid.status,200);assert.equal(valid.body.state,'deleting')
    const forbidden=await f.request('/rpc/catalog_media_delete',{actor:'service',method:'POST',body:{...body,p_admin_id:f.actors.editor}});assert.notEqual(forbidden.status,200)
    const product=(await f.db.query('select id from public.products limit 1')).rows[0].id
    const update=await f.request('/products?id=eq.'+product,{actor:'editor',method:'PATCH',body:{image_url:path}});assert.equal(update.status,400);assert.equal(update.body.message,'This image is unavailable. Choose another image.')
    const safe=await f.request('/products?id=eq.'+product,{actor:'editor',method:'PATCH',body:{image_url:'/uploads/products/ordinary.png'}});assert.equal(safe.status,204)
    const used=await f.request('/rpc/catalog_media_delete',{actor:'service',method:'POST',body:{...body,p_path:'/uploads/products/ordinary.png'}});assert.equal(used.status,400);assert.equal(used.body.message,'MEDIA_REFERENCED')
    const empty=await f.request('/rpc/catalog_media_delete',{actor:'service',method:'POST',body:{...body,p_finish:true}});assert.equal(empty.status,200);assert.equal(empty.body.state,'deleted')
    assert.equal((await f.request('/storefront_products?select=id,title,price')).status,200)
  }finally{await f.close()}
})
