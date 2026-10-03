import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDaftraInvoice, mapDaftraInventory, readAllDaftraRecords, findUniqueDaftraRecord, syncOrderToDaftra, syncInventoryFromDaftra, processNextDaftraJob, createDaftraJobRequest, verifyDaftraReservationPosting, testAndRecordDaftraConnection } from '../server/utils/daftraSync.js'
import { assertBuiltInErpDomain, assertExternalErpDomain } from '../server/utils/erpOwnership.js'
import { daftraRequest, getDaftraConnectionSummary } from '../server/utils/daftra.js'

// An isolated Supabase transport double, with durable rows across worker retries.
function database(seed={}) {
  const tables=structuredClone(seed),calls=[]
  const db={tables,calls,from(table) {
    tables[table] ||= []
    let operation='select',payload,filters=[],start=0,end=Infinity,one=false
    const query={
      select(){return query},eq(key,value){filters.push(row=>row[key]===value);return query},order(){return query},range(a,b){start=a;end=b;return query},
      maybeSingle(){one=true;return query},single(){one=true;return query},insert(value){operation='insert';payload=value;return query},
      update(value){operation='update';payload=value;return query},upsert(value){operation='upsert';payload=value;return query},
      then(resolve,reject){return Promise.resolve().then(()=>{
        let rows=tables[table].filter(row=>filters.every(filter=>filter(row)))
        if(operation==='insert') {
          if(table==='erp_remote_writes' && tables[table].some(row=>row.operation===payload.operation && row.local_id===payload.local_id)) return {error:{code:'23505'},data:null}
          rows=[{id:`${table}-${tables[table].length}`, ...structuredClone(payload)}];tables[table].push(...rows)
        }
        if(operation==='update') rows.forEach(row=>Object.assign(row,structuredClone(payload)))
        if(operation==='upsert') {
          let row=tables[table].find(row=>row.provider===payload.provider && row.local_entity_type===payload.local_entity_type && row.local_id===payload.local_id)
          if(row) Object.assign(row,structuredClone(payload));else {row={id:`${table}-${tables[table].length}`,...structuredClone(payload)};tables[table].push(row)}
          rows=[row]
        }
        rows=structuredClone(rows.slice(start,end+1))
        return {data:one ? rows[0] || null:rows,error:null}
      }).then(resolve,reject)}
    };return query
  },async rpc(name,args) {
    calls.push({name,args})
    if(name==='claim_daftra_sync_job') {
      const job=tables.erp_sync_jobs?.find(row=>['pending','failed'].includes(row.status) && row.attempts<row.max_attempts)
      if(!job)return {data:[],error:null}
      job.status='processing';job.attempts++;job.lease_token='lease-1';return {data:[structuredClone(job)],error:null}
    }
    if(name==='erp_finish_daftra_job') {
      Object.assign(tables.erp_sync_jobs.find(row=>row.id===args.p_job_id),{status:args.p_success?'completed':'failed',result:args.p_result,last_error:args.p_error})
    }
    return {data:null,error:null}
  }}
  return db
}
function fixture(status='processing') {
  return database({
    site_settings:[{key:'default',erp_mode:'daftra',daftra_connection_status:'error'}],
    customer_orders:[{id:'order-1',user_id:'buyer-1',erp_owner:'daftra',order_number:'WEB-1',status,currency:'EGP',created_at:'2026-10-03T10:00:00Z',total_amount:210,discount_amount:10,payment_fee_amount:20}],
    customer_order_items:[{id:'item-1',order_id:'order-1',product_id:'product-1',product_title:'Mouse',unit_price:100,quantity:2}],
    erp_entity_links:[
      {id:'client-link',provider:'daftra',local_entity_type:'customer_profile',local_id:'buyer-1',external_id:'8'},
      {id:'product-link',provider:'daftra',local_entity_type:'product',local_id:'product-1',external_entity_type:'product',external_id:'4'}
    ],erp_sync_jobs:[{id:'job-1',operation:'order.export',local_id:'order-1',status:'pending',attempts:0,max_attempts:5}],
    erp_remote_writes:[]
  })
}
const remoteInvoice=()=>({id:42,po_number:'WEB-1',client_id:8,currency_code:'EGP',draft:'1',summary_total:'210.00'})
const page=records=>({result:'successful',code:200,data:records,pagination:{page_count:1}})

test('invoice fields preserve absolute discounts and fees without inherited taxes or payments',()=>{
  const db=fixture(),order=db.tables.customer_orders[0],item=db.tables.customer_order_items[0]
  const invoice=buildDaftraInvoice(order,[item],{external_id:'8'},[{external_id:'4'}])
  assert.equal(invoice.Invoice.discount,0);assert.equal(invoice.Invoice.discount_amount,10);assert.equal(invoice.Invoice.draft,1)
  assert.equal(invoice.InvoiceItem[1].unit_price,20)
  assert.ok(invoice.InvoiceItem.every(line=>line.tax1===null && line.tax2===null))
  assert.equal(invoice.InvoicePayment,undefined)
})

test('complete pagination finds later-page matches and rejects ambiguous or incomplete searches',async()=>{
  const request=async(_,options)=>({data:[{Client:{id:options.query.page,email:'buyer@test.invalid'}}],pagination:{page_count:2}})
  assert.equal((await readAllDaftraRecords('/clients.json','Client',{},request)).length,2)
  assert.equal((await findUniqueDaftraRecord('/clients.json','Client',{},row=>row.id===2,request)).id,2)
  await assert.rejects(()=>findUniqueDaftraRecord('/clients.json','Client',{},()=>true,request),/Multiple Daftra records/)
  await assert.rejects(()=>readAllDaftraRecords('/products.json','Product',{},async()=>({data:[]})),/pagination needs manual review/)
})

test('stock mapping rejects ambiguity and invalid balances while preserving zero costs',()=>{
  const products=[{id:'p1',sku:'SKU',is_serialized:false}],variants=[]
  const remote=[{id:1,product_code:'SKU',stock_balance:4,buy_price:0,average_price:50,status:0}]
  assert.equal(mapDaftraInventory(remote,products,variants,[]).rows[0].cost,0)
  assert.equal(mapDaftraInventory([{...remote[0],status:1}],products,variants,[]).rows[0].quantity,0)
  assert.equal(mapDaftraInventory(remote,[...products,{id:'p2',sku:'sku',is_serialized:false}],variants,[]).invalid,1)
  assert.equal(mapDaftraInventory([{...remote[0],stock_balance:null}],products,variants,[]).invalid,1)
  assert.equal(mapDaftraInventory([{...remote[0],stock_balance:2.5}],products,variants,[]).invalid,1)
  assert.equal(mapDaftraInventory(remote,products,variants,[{local_entity_type:'product',local_id:'gone',external_id:'1'}]).invalid,1)
})

test('an outage leaves a failed durable job, keeps Daftra ownership, and never leaks remote errors',async()=>{
  const db=fixture()
  const result=await processNextDaftraJob(db,null,{request:async()=>{throw new Error('remote-private-secret')}})
  assert.equal(result.job.status,'failed');assert.equal(db.tables.site_settings[0].erp_mode,'daftra')
  assert.equal(db.tables.erp_sync_jobs[0].attempts,1)
  assert.ok(!result.job.last_error.includes('remote-private-secret'))
  assert.equal(db.calls.find(call=>call.name==='erp_finish_daftra_job').args.p_delay,60)
})

test('an ambiguous invoice POST cannot cause duplicate creation or automatic issuance',async()=>{
  const db=fixture();let created=null,posts=0,issues=0
  const request=async(path,options={})=>{
    if(path==='/invoices.json' && options.method==='POST') {posts++;created=remoteInvoice();throw new Error('timeout after remote commit')}
    if(path==='/invoices.json') return page(created?[{Invoice:created}]:[])
    if(path.includes('update_draft')) {issues++;return {result:'successful',code:200}}
    throw new Error('Unexpected endpoint')
  }
  assert.equal((await processNextDaftraJob(db,null,{request})).job.status,'failed')
  assert.equal(db.tables.erp_remote_writes[0].state,'submitted')
  const retry=await processNextDaftraJob(db,null,{request})
  assert.equal(retry.job.result.manualRequired,true);assert.equal(posts,1);assert.equal(issues,0)
  assert.equal(db.tables.erp_sync_jobs[0].attempts,5)
  assert.equal(db.tables.erp_entity_links.filter(link=>link.local_entity_type==='customer_order').length,1)
})

test('successful retries reuse invoice mappings and do not issue twice',async()=>{
  const db=fixture();let created=null,posts=0,issues=0
  const request=async(path,options={})=>{
    if(path==='/invoices.json' && options.method==='POST') {posts++;created=remoteInvoice();return {id:42}}
    if(path==='/invoices.json') return page([])
    if(path==='/invoices/42.json') return {data:{Invoice:created}}
    if(path==='/invoices/update_draft/42/0.json') {issues++;created.draft=0;return {result:'successful',code:200}}
    throw new Error('Unexpected endpoint')
  }
  assert.equal((await syncOrderToDaftra(db,'order-1',{request})).daftraInvoiceId,'42')
  await syncOrderToDaftra(db,'order-1',{request})
  assert.equal(posts,1);assert.equal(issues,1)
  assert.equal(db.tables.erp_entity_links.find(link=>link.local_entity_type==='customer_order').metadata.daftraDraft,false)
})

test('wrong totals, client or currency and unavailable mapped invoices prevent issuance',async()=>{
  for(const change of [{summary_total:200},{client_id:9},{currency_code:'USD'}]) {
    const db=fixture();let issues=0
    const request=async(path,options={})=>{
      if(options.method==='POST') return {id:42}
      if(path==='/invoices.json') return page([])
      if(path.includes('update_draft')) {issues++;return {}}
      return {data:{Invoice:{...remoteInvoice(),...change}}}
    }
    await assert.rejects(()=>syncOrderToDaftra(db,'order-1',{request}),/manual review|total differs/)
    assert.equal(issues,0)
  }
  const db=fixture();db.tables.erp_entity_links.push({provider:'daftra',local_entity_type:'customer_order',local_id:'order-1',external_id:'42'})
  let creates=0
  await assert.rejects(()=>syncOrderToDaftra(db,'order-1',{request:async(_,options={})=>{if(options.method==='POST')creates++;throw new Error('Unavailable mapped invoice')}}),/Unavailable/)
  assert.equal(creates,0)
})

test('stock reservations require processed matching invoice transactions',async()=>{
  const db=fixture();db.tables.erp_stock_reservations=[{order_item_id:'item-1',quantity:2}]
  db.tables.erp_entity_links.push({provider:'daftra',local_entity_type:'customer_order',local_id:'order-1',external_id:'42',metadata:{daftraDraft:false}})
  let transaction={product_id:4,order_id:42,source_type:2,transaction_type:2,status:3,quantity:2}
  const request=async path=>{assert.equal(path,'/stock_transactions.json');return page([{StockTransaction:transaction}])}
  await verifyDaftraReservationPosting(db,request)
  assert.equal(db.tables.erp_entity_links.at(-1).metadata.stockVerifiedAt,undefined)
  transaction={...transaction,status:4};await verifyDaftraReservationPosting(db,request)
  assert.ok(db.tables.erp_entity_links.at(-1).metadata.stockVerifiedAt)
  transaction={...transaction,order_id:43};await verifyDaftraReservationPosting(db,request)
  assert.equal(db.tables.erp_entity_links.at(-1).metadata.stockVerifiedAt,undefined)
})

test('a lost lease or worker deadline prevents another remote request',async()=>{
  const db=fixture();let now=0,requests=0
  const request=createDaftraJobRequest(db,{lease_token:'lease'},async()=>{requests++},()=>now)
  await request('/clients.json');now=25*60*1000
  await assert.rejects(()=>request('/invoices.json'),/time limit/);assert.equal(requests,1)
  db.rpc=async()=>({error:{message:'lost'}})
  const lost=createDaftraJobRequest(db,{lease_token:'lease'},async()=>{requests++})
  await assert.rejects(()=>lost('/invoices.json'),/storage is unavailable/);assert.equal(requests,1)
})

test('HTTP transport disables mutation retries and sanitizes unsuccessful tests',async()=>{
  const previous=globalThis.$fetch
  const config={configured:true,accountUrl:'https://example.daftra.com',apiKey:'test-only-key'}
  try {
    globalThis.$fetch=async(_,options)=>{assert.equal(options.retry,0);assert.equal(options.redirect,'error');return {result:'failed',code:401,message:'private-secret'}}
    await assert.rejects(()=>daftraRequest('/clients.json',{config}),error=>!error.message.includes('private-secret'))
    globalThis.$fetch=async()=>({result:'successful',code:200,data:{},pagination:{total_results:0}})
    assert.equal((await getDaftraConnectionSummary(config)).connected,false)
  } finally {globalThis.$fetch=previous}
})

test('server ownership guards reject direct calls without falling back during outages',async()=>{
  const db=fixture()
  await assert.rejects(()=>assertBuiltInErpDomain(db),error=>error.statusCode===409)
  assert.equal((await assertExternalErpDomain(db)).erp_mode,'daftra')
  db.tables.site_settings[0].erp_mode='built_in'
  assert.equal((await assertBuiltInErpDomain(db)).erp_mode,'built_in')
  await assert.rejects(()=>assertExternalErpDomain(db),error=>error.statusCode===409)
  db.tables.site_settings=[]
  await assert.rejects(()=>assertBuiltInErpDomain(db),error=>error.statusCode===503)
})

test('stock refresh is a repeatable cache import that preserves catalog content and retained accounting',async()=>{
  const db=fixture()
  db.tables.products=[{id:'product-1',sku:'SKU',is_serialized:false,title:'Local title',description:'Local content',price:100,cost_price:40,stock_quantity:7}]
  db.tables.product_variants=[]
  const retained=structuredClone(db.tables.products)
  const request=async()=>page([{Product:{id:4,product_code:'SKU',status:0,stock_balance:5,buy_price:0}}])
  for(let i=0;i<2;i++) {
    const result=await syncInventoryFromDaftra(db,{request})
    assert.equal(result.updated,1);assert.equal(result.direction,'daftra_to_elcomputer')
  }
  const writes=db.calls.filter(call=>call.name==='erp_apply_inventory_cache')
  assert.equal(writes.length,2);assert.deepEqual(writes[0].args.p_rows,writes[1].args.p_rows)
  assert.equal(writes[0].args.p_rows[0].cost,0);assert.equal(writes[0].args.p_rows[0].quantity,5)
  assert.deepEqual(db.tables.products,retained)
})

test('unsuccessful responses and unreadable credentials record a failed test without changing ownership',async()=>{
  for(const loadConfig of [async()=>({configured:true}),async()=>{throw new Error('private decryption detail')}]) {
    const db=fixture()
    await assert.rejects(()=>testAndRecordDaftraConnection(db,{
      loadSummary:async()=>({revision:2}),loadConfig,testConnection:async()=>({connected:false})
    }),error=>error.statusCode===502 && !error.message.includes('private'))
    const recorded=db.calls.find(call=>call.name==='erp_record_daftra_test')
    assert.equal(recorded.args.p_revision,2);assert.equal(recorded.args.p_success,false)
    assert.equal(db.tables.site_settings[0].erp_mode,'daftra')
  }
})
