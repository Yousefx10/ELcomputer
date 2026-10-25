import test from 'node:test'
import assert from 'node:assert/strict'
import {historyBatches,historyDigest,authorizeHistoryImport} from '../scripts/customer-migration/batches.mjs'

test('bounded batches preserve order/item identity and stable recovery commands',()=>{
 const payload={customers:Array.from({length:51},(_,i)=>({legacy_id:String(i+1)})),orders:Array.from({length:25},(_,i)=>({legacy_id:String(i+1)})),items:Array.from({length:25},(_,i)=>({order_legacy_id:String(i+1)}))}
 const p={status:'DRY_RUN_READY_FOR_REVIEW',payload,payload_sha256:historyDigest(payload)},a=historyBatches(p),b=historyBatches(p)
 assert.deepEqual(a,b);assert.equal(a.length,4);assert.equal(a.reduce((n,b)=>n+b.payload.customers.length,0),51)
 for(const batch of a)for(const item of batch.payload.items)assert.ok(batch.payload.orders.some(o=>o.legacy_id===item.order_legacy_id))
 p.payload.orders.push({legacy_id:'999'});assert.throws(()=>historyBatches(p),/not qualified/)
})
test('wrong target/source/approval and stale recovery evidence deny import',()=>{
 const m={target_project_ref:'fixture',source_key:'legacy',source_sha256:'a'.repeat(64),private_review_sha256:'b'.repeat(64),payload_sha256:'c'.repeat(64)}
 const a={...m,approved:true,action:'import_customer_history',backup:{authenticated_restore_verified:true,project_ref:'fixture',verified_utc:new Date().toISOString(),encrypted_sha256:'d'.repeat(64)}}
 assert.equal(authorizeHistoryImport(a,m),true)
 assert.throws(()=>authorizeHistoryImport({...a,approved:false},m))
 assert.throws(()=>authorizeHistoryImport({...a,target_project_ref:'other'},m))
 assert.throws(()=>authorizeHistoryImport({...a,source_sha256:'e'.repeat(64)},m))
 assert.throws(()=>authorizeHistoryImport({...a,backup:{...a.backup,verified_utc:'2020-01-01T00:00:00Z'}},m))
})
