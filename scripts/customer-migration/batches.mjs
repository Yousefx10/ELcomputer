import {createHash} from 'node:crypto'
export const historyDigest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
export const historyUuid=value=>{const h=historyDigest(value);return h.slice(0,8)+'-'+h.slice(8,12)+'-5'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32)}

export function historyBatches(prepared){
 if(prepared.status!=='DRY_RUN_READY_FOR_REVIEW'||historyDigest(prepared.payload)!==prepared.payload_sha256)throw Error('Historical review is not qualified')
 const batches=[],payload=prepared.payload
 for(let i=0;i<payload.customers.length;i+=50)batches.push({customers:payload.customers.slice(i,i+50),orders:[],items:[]})
 let batch={customers:[],orders:[],items:[]}
 for(const order of payload.orders){
  const items=payload.items.filter(i=>i.order_legacy_id===order.legacy_id)
  if(items.length>300)throw Error('Order needs a separately reviewed larger-item policy')
  if(batch.orders.length&&(batch.orders.length>=20||batch.items.length+items.length>300||Buffer.byteLength(JSON.stringify({...batch,orders:[...batch.orders,order],items:[...batch.items,...items]}))>1000000)){batches.push(batch);batch={customers:[],orders:[],items:[]}}
  batch.orders.push(order);batch.items.push(...items)
 }
 if(batch.orders.length)batches.push(batch)
 if(batches.some(b=>Buffer.byteLength(JSON.stringify(b))>1000000))throw Error('Historical record exceeds batch bound')
 return batches.map((payload,index)=>({id:historyUuid([prepared.payload_sha256,index]),payload}))
}

export function authorizeHistoryImport(approval,manifest){
 if(approval?.approved!==true||approval.action!=='import_customer_history'||approval.target_project_ref!==manifest.target_project_ref
  ||approval.source_key!==manifest.source_key||approval.source_sha256!==manifest.source_sha256
  ||approval.private_review_sha256!==manifest.private_review_sha256||approval.payload_sha256!==manifest.payload_sha256)throw Error('Exact customer-history import approval required')
 if(!approval.backup?.authenticated_restore_verified||approval.backup.project_ref!==manifest.target_project_ref
  ||!Number.isFinite(Date.parse(approval.backup.verified_utc))||Date.now()-Date.parse(approval.backup.verified_utc)>6*3600000
  ||Date.parse(approval.backup.verified_utc)>Date.now()||!/^[a-f0-9]{64}$/.test(approval.backup.encrypted_sha256||''))throw Error('Fresh reviewed encrypted recovery evidence required')
 return true
}
