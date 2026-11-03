import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createEmailNativeDatabase,emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'
import {createProductSaveHttpFixture} from './helpers/productSaveHttpFixture.mjs'

test('actual HTTP option editing keeps receipts, conflicts, permissions and validation', {skip:!emailNativeAvailable,timeout:120000},async t=>{
 const db=await createEmailNativeDatabase()
 const f=await createProductSaveHttpFixture({database:db,extraRoutes:[
  ['get','/api/admin-products/:id/presentation','server/api/admin-products/[id]/presentation.get.js'],
  ['put','/api/admin-products/:id/presentation','server/api/admin-products/[id]/presentation.put.js']
 ]})
 try{
  const body=f.body({is_published:true,variants:[{name:'Owned option',code:'OWNED',sku:'OWNED-'+randomUUID(),sale_price:'180.75',option_values:{model:'Configured option',version:'2'}}]})
  const created=await f.call('/api/admin-products',{method:'POST',body})
  assert.ok([200,201].includes(created.response.status),JSON.stringify(created.body))
  const id=created.body.id,snapshot=(await f.call('/api/admin-products/'+id)).body
  await t.test('HTTP snapshot roundtrips exact authored fields without writing inventory',async()=>{
   assert.deepEqual(snapshot.variants[0].option_values,{model:'Configured option',version:'2'})
   assert.equal(Number(snapshot.variants[0].sale_price),180.75);assert.equal(snapshot.variants[0].stock_quantity,0)
  })
  const edit=f.body({slug:snapshot.product.slug,expected_revision:snapshot.revision,is_published:true,variants:snapshot.variants.map(v=>({...v,sale_price:'199.95'}))})
  await t.test('lost HTTP acknowledgement recovers the same command without duplicate audits',async()=>{
   const before=await f.counts();f.controls.loseResponse=true
   await assert.rejects(f.call('/api/admin-products/'+id,{method:'PATCH',body:edit}))
   const replay=await f.call('/api/admin-products/'+id,{method:'PATCH',body:edit})
   assert.equal(replay.response.status,200);assert.equal(replay.body.replayed,true)
   const after=await f.counts();assert.equal(after.audits,before.audits+1);assert.equal(after.receipts,before.receipts+1)
  })
  await t.test('a stale HTTP edit returns409 and leaves the saved option intact',async()=>{
   const stale=await f.call('/api/admin-products/'+id,{method:'PATCH',body:{...edit,request_id:randomUUID()}})
   assert.equal(stale.response.status,409)
   assert.equal(Number((await f.snapshot(id)).variants[0].sale_price),199.95)
  })
  await t.test('unknown option shapes and stock edits are rejected; viewer cannot edit',async()=>{
   for(const variant of [{name:'Bad',code:'BAD',option_values:{model:12}},{name:'Bad',code:'BAD',option_values:JSON.parse('{"__proto__":"bad"}')},{name:'Bad',code:'BAD',sale_price:'1.234'},{name:'Bad',code:'BAD',quantity:1}]){
    const bad=await f.call('/api/admin-products',{method:'POST',body:f.body({variants:[variant]})});assert.equal(bad.response.status,400)
   }
   assert.equal((await f.call('/api/admin-products/'+id,{actor:'viewer',method:'PATCH',body:edit})).response.status,403)
  })
  await t.test('presentation HTTP accepts curated changes and exposes safe stale409',async()=>{
   const body={request_id:randomUUID(),expected_revision:0,content:{videos:[],related:[],compatible:[]}}
   const saved=await f.call('/api/admin-products/'+id+'/presentation',{method:'PUT',body})
   assert.equal(saved.response.status,200,JSON.stringify(saved.body))
   const stale=await f.call('/api/admin-products/'+id+'/presentation',{method:'PUT',body:{...body,request_id:randomUUID()}})
   assert.equal(stale.response.status,409)
  })
 }finally{await f.close()}
})
