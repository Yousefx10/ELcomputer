import { createError } from 'h3'
import { daftraRequest, clearDaftraConfigCache, getDaftraConfig, getDaftraConfigSummary, getDaftraConnectionSummary, unwrapDaftraRecord } from './daftra.js'
import { assertExternalErpDomain, getErpSettings } from './erpOwnership.js'
export { getErpSettings } from './erpOwnership.js'

const ISSUABLE_ORDER_STATUSES = new Set(['processing','in_progress','being_shipped','out_for_delivery','completed','delivered'])
const MANUAL_ORDER_STATUSES = new Set(['cancelled','canceled','returned','refunded'])
const manual = message => createError({ statusCode: 409, statusMessage: message, data: { manualRequired: true } })
const databaseError = () => createError({ statusCode: 503, statusMessage: 'ERP synchronization storage is unavailable.' })
const check = result => { if (result.error) throw databaseError(); return result.data }
export const daftraDraft = value => value === true || value === 1 || value === '1'
export const daftraRetryDelay = attempts => Math.min(3600, 30 * 2 ** Math.min(Math.max(1, attempts), 7))

export async function testAndRecordDaftraConnection(supabaseAdmin, {
  loadConfig=getDaftraConfig,loadSummary=getDaftraConfigSummary,testConnection=getDaftraConnectionSummary
} = {}) {
  clearDaftraConfigCache()
  const credentialSummary=await loadSummary(supabaseAdmin)
  const revision = credentialSummary.revision || 0
  const checkedAt = new Date().toISOString()
  let summary
  try {
    const config = await loadConfig()
    summary = await testConnection(config)
    if (!summary.connected) throw new Error('Unsuccessful connection test.')
  } catch {
    check(await supabaseAdmin.rpc('erp_record_daftra_test', { p_revision: revision, p_success: false, p_checked_at: checkedAt }))
    throw createError({ statusCode: 502, statusMessage: 'Daftra connection test failed.' })
  }
  check(await supabaseAdmin.rpc('erp_record_daftra_test', { p_revision: revision, p_success: true, p_checked_at: checkedAt }))
  return { ...summary, checkedAt }
}

// Never trust a first-page match or an incomplete search as evidence to create.
export async function readAllDaftraRecords(path, wrapper, query = {}, request = daftraRequest) {
  const records = []
  let expectedPages=null
  for (let page = 1; page <= 100; page++) {
    const response = await request(path, { query: { ...query, limit: 100, page } })
    const pages = Number(response?.pagination?.page_count)
    if (!Array.isArray(response?.data) || !Number.isInteger(pages) || pages < 0 || pages > 100) {
      throw manual('Daftra pagination needs manual review.')
    }
    if (expectedPages!==null && pages!==expectedPages) throw manual('Daftra pagination changed. Retry a complete scan.')
    expectedPages=pages
    records.push(...response.data.map(entry => unwrapDaftraRecord(entry, wrapper)))
    if (page >= Math.max(1, pages)) return records
    await new Promise(resolve => setTimeout(resolve, 150))
  }
  throw manual('Daftra pagination needs manual review.')
}
export async function findUniqueDaftraRecord(path, wrapper, query, predicate, request = daftraRequest) {
  const matches = (await readAllDaftraRecords(path, wrapper, query, request)).filter(predicate)
  if (matches.length > 1) throw manual('Multiple Daftra records match. Review the mapping in Daftra.')
  return matches[0] || null
}

async function getEntityLink(db, type, id) {
  return check(await db.from('erp_entity_links').select('*').eq('provider','daftra').eq('local_entity_type',type).eq('local_id',id).maybeSingle())
}
async function saveEntityLink(db, link) {
  return check(await db.from('erp_entity_links').upsert({ ...link, provider:'daftra', last_synced_at:new Date().toISOString(), updated_at:new Date().toISOString() }, { onConflict:'provider,local_entity_type,local_id' }).select('*').single())
}

// A durable intent closes the timeout/crash gap. No second POST after uncertainty.
async function createRemoteRecord(db, operation, localId, path, body, request) {
  const intent = check(await db.from('erp_remote_writes').select('state,external_id').eq('operation',operation).eq('local_id',localId).maybeSingle())
  if (intent) throw manual('Remote creation needs reconciliation before retrying.')
  check(await db.from('erp_remote_writes').insert({ operation, local_id:localId, state:'submitted' }))
  const response = await request(path, { method:'POST', body })
  if (!response?.id) throw manual('Remote creation needs reconciliation before retrying.')
  check(await db.from('erp_remote_writes').update({ state:'confirmed', external_id:String(response.id) }).eq('operation',operation).eq('local_id',localId))
  return response
}

async function ensureClient(db, order, request) {
  const link = await getEntityLink(db,'customer_profile',order.user_id)
  if (link) return link
  const email = String(order.email || '').trim().toLowerCase()
  if (!email || !order.user_id) throw manual('Map this website customer in Daftra before exporting.')
  let client = await findUniqueDaftraRecord('/clients.json','Client',{ keywords:email }, record => String(record.email || '').trim().toLowerCase() === email, request)
  if (!client) client = await createRemoteRecord(db,'client.create',order.user_id,'/clients.json',{
    Client: {
      business_name:[order.first_name,order.last_name].filter(Boolean).join(' ') || email,
      first_name:order.first_name || '', last_name:order.last_name || '', email,
      phone1:order.phone || '', address1:order.street_address || '', city:order.city || '', state:order.governorate || '',
      country_code:'EG', default_currency_code:order.currency || 'EGP', notes:'Created by ELcomputer website.'
    }
  },request)
  if (!client.id) throw manual('Map this website customer in Daftra before exporting.')
  return saveEntityLink(db,{ local_entity_type:'customer_profile', local_id:order.user_id, external_entity_type:'client', external_id:String(client.id), external_number:client.client_number || null, metadata:{ matchedBy:'email' } })
}

async function resolveProduct(db, item, request) {
  const type = item.variant_id ? 'product_variant':'product'
  const localId = item.variant_id || item.product_id
  const link = await getEntityLink(db,type,localId)
  if (link) return link
  const record = check(await db.from(item.variant_id ? 'product_variants':'products').select(item.variant_id ? 'id,sku,code':'id,sku').eq('id',localId).maybeSingle())
  const code = String(record?.sku || record?.code || '').trim()
  if (!code) throw manual('Create and map this item in Daftra before exporting.')
  const product = await findUniqueDaftraRecord('/products.json','Product',{ product_code:code }, p => String(p.product_code || '').trim().toLowerCase() === code.toLowerCase(),request)
  if (!product?.id) throw manual('Create and map this item in Daftra before exporting.')
  return saveEntityLink(db,{ local_entity_type:type,local_id:localId,external_entity_type:'product',external_id:String(product.id),external_number:code,metadata:{ productId:item.product_id,variantId:item.variant_id || null } })
}

export function buildDaftraInvoice(order, items, clientLink, productLinks) {
  const fee = Number(order.payment_fee_amount || 0)
  return {
    Invoice: {
      client_id:Number(clientLink.external_id),po_number:order.order_number,
      name:`Website order ${order.order_number}`,currency_code:order.currency || 'EGP',
      date:String(order.created_at).slice(0,10),issue_date:String(order.created_at).slice(0,10),draft:1,
      discount:0,discount_amount:Number(order.discount_amount || 0),
      notes:`ELcomputer website order ${order.order_number}. Payments require external reconciliation.`
    },
    InvoiceItem: [
      ...items.map((item,index) => ({ item:item.product_title,unit_price:Number(item.unit_price),quantity:Number(item.quantity),
        product_id:Number(productLinks[index].external_id),discount:0,discount_type:2,tax1:null,tax2:null })),
      ...(fee > 0 ? [{ item:'Website payment fee',unit_price:fee,quantity:1,discount:0,discount_type:2,tax1:null,tax2:null }] : [])
    ]
  }
}

export async function syncOrderToDaftra(db, orderId, { request = daftraRequest } = {}) {
  await assertExternalErpDomain(db)
  const order = check(await db.from('customer_orders').select('*').eq('id',orderId).maybeSingle())
  if (!order || order.erp_owner !== 'daftra') throw manual('This order belongs to the retained built-in ERP history.')
  if (order.is_preorder) throw manual('Preorder ERP accounting requires manual Daftra completion.')
  if (MANUAL_ORDER_STATUSES.has(order.status)) throw manual('Complete cancellation or refund accounting manually in Daftra.')
  const items = check(await db.from('customer_order_items').select('id,product_id,variant_id,product_title,unit_price,quantity,line_total').eq('order_id',orderId).order('created_at'))
  if (!items?.length) throw manual('The website order has no items.')
  // Check item mappings before creating a client or invoice.
  const products = []
  for (const item of items) products.push(await resolveProduct(db,item,request))
  const client = await ensureClient(db,order,request)
  let link = await getEntityLink(db,'customer_order',order.id)
  let invoice
  if (link) {
    const response = await request(`/invoices/${encodeURIComponent(link.external_id)}.json`)
    invoice = unwrapDaftraRecord(response?.data,'Invoice')
    if (String(invoice.id) !== String(link.external_id)) throw manual('The mapped Daftra invoice needs manual review.')
  } else {
    invoice = await findUniqueDaftraRecord('/invoices.json','Invoice',{ po_number:order.order_number,recursive:1 }, i => String(i.po_number || '').trim() === order.order_number,request)
    if (!invoice) {
      const created = await createRemoteRecord(db,'invoice.create',order.id,'/invoices.json',buildDaftraInvoice(order,items,client,products),request)
      const response = await request(`/invoices/${encodeURIComponent(created.id)}.json`)
      invoice = unwrapDaftraRecord(response?.data,'Invoice')
    }
  }
  if (!invoice?.id || String(invoice.po_number || '').trim() !== order.order_number
    || String(invoice.client_id) !== String(client.external_id)
    || invoice.currency_code !== (order.currency || 'EGP')) throw manual('The mapped Daftra invoice needs manual review.')
  const draft = daftraDraft(invoice.draft)
  link = await saveEntityLink(db,{ local_entity_type:'customer_order',local_id:order.id,external_entity_type:'invoice',external_id:String(invoice.id),external_number:invoice.no || link?.external_number || null,
    metadata:{ ...(link?.metadata || {}),orderNumber:order.order_number,websiteStatus:order.status,daftraDraft:draft,
      ...(!draft ? { issuedAt:link?.metadata?.issuedAt || new Date().toISOString() } : {}) } })
  if (Math.abs(Number(invoice.summary_total) - Number(order.total_amount)) > 0.01 || !Number.isFinite(Number(invoice.summary_total))) {
    throw manual('Daftra invoice total differs. Review taxes and fees before issuance.')
  }
  if (ISSUABLE_ORDER_STATUSES.has(order.status) && draft) {
    if (items.some(item => item.variant_id)) throw manual('Issue this invoice in Daftra after warehouse and serial review.')
    const intent=check(await db.from('erp_remote_writes').select('state,external_id').eq('operation','invoice.create').eq('local_id',order.id).maybeSingle())
    if (intent?.state!=='confirmed' || String(intent.external_id)!==String(invoice.id)) throw manual('Review the matched invoice in Daftra before issuance.')
    await request(`/invoices/update_draft/${encodeURIComponent(invoice.id)}/0.json`)
    await saveEntityLink(db,{ ...link,metadata:{ ...link.metadata,daftraDraft:false,issuedAt:new Date().toISOString() } })
  }
  return { orderId:order.id,orderNumber:order.order_number,daftraInvoiceId:String(invoice.id),direction:'elcomputer_to_daftra' }
}

async function readLocalRows(db, table, fields, filters = []) {
  const rows = []
  for (let offset=0;offset<100000;offset+=500) {
    let query = db.from(table).select(fields).order(table==='erp_stock_reservations'?'order_item_id':'id').range(offset,offset+499)
    for (const [column,value] of filters) query=query.eq(column,value)
    const batch=check(await query) || []
    rows.push(...batch)
    if (batch.length<500) return rows
  }
  throw manual('The local mapping catalog requires a larger reviewed import.')
}
const codeKey = value => String(value || '').trim().toLowerCase()

// A draft flag or elapsed time cannot prove that inventory was posted.
export async function verifyDaftraReservationPosting(db, request = daftraRequest) {
  const reservations = await readLocalRows(db,'erp_stock_reservations','order_item_id,quantity')
  if (!reservations.length) return
  const [items,links] = await Promise.all([
    readLocalRows(db,'customer_order_items','id,order_id,product_id,variant_id,quantity'),
    readLocalRows(db,'erp_entity_links','id,local_entity_type,local_id,external_id,metadata',[['provider','daftra']])
  ])
  const reservedItems=new Set(reservations.map(row=>row.order_item_id))
  const transactions=new Map()
  for (const invoice of links.filter(link=>link.local_entity_type==='customer_order' && link.metadata?.daftraDraft===false)) {
    const orderItems=items.filter(item=>item.order_id===invoice.local_id && reservedItems.has(item.id))
    if (!orderItems.length) continue
    const expected=new Map()
    for (const item of orderItems) {
      const product=links.find(link=>link.local_entity_type===(item.variant_id?'product_variant':'product') && link.local_id===(item.variant_id || item.product_id))
      if (!product) throw manual('Reserved item mapping needs manual review.')
      expected.set(product.external_id,(expected.get(product.external_id)||0)+Number(item.quantity))
    }
    let verified=true
    for (const [externalId,quantity] of expected) {
      if (!transactions.has(externalId)) transactions.set(externalId,await readAllDaftraRecords('/stock_transactions.json','StockTransaction',{product_id:externalId,source_type:2},request))
      const posted=transactions.get(externalId).filter(row=>String(row.product_id)===String(externalId)
        && String(row.order_id)===String(invoice.external_id) && Number(row.source_type)===2
        && Number(row.transaction_type)===2 && Number(row.status)===4)
        .reduce((total,row)=>total+Math.abs(Number(row.quantity)),0)
      if (!Number.isFinite(posted) || posted<quantity) verified=false
    }
    // Clear old evidence when a permission-scoped scan cannot verify the posting.
    const metadata={...invoice.metadata}
    delete metadata.stockVerifiedAt
    if (verified) metadata.stockVerifiedAt=new Date().toISOString()
    await saveEntityLink(db,{...invoice,metadata})
  }
}

export function mapDaftraInventory(remote, products, variants, links) {
  const candidates = new Map()
  for (const product of products.filter(p=>!p.is_serialized)) {
    const code=codeKey(product.sku);if (!code) continue
    candidates.set(code,[...(candidates.get(code)||[]),{ type:'product',id:product.id,product_id:product.id }])
  }
  for (const variant of variants) {
    const code=codeKey(variant.sku || variant.code);if (!code) continue
    candidates.set(code,[...(candidates.get(code)||[]),{ type:'product_variant',id:variant.id,product_id:variant.product_id }])
  }
  const byExternal = new Map(links.map(link=>[String(link.external_id),link]))
  const productsById=new Map(products.map(p=>[p.id,p]))
  const variantsById=new Map(variants.map(v=>[v.id,v]))
  const remoteCodes=new Map()
  for(const p of remote) { const code=codeKey(p.product_code);remoteCodes.set(code,(remoteCodes.get(code)||0)+1) }
  const rows=[];let unmatched=0;let invalid=0
  const usedLocal=new Set()
  for (const product of remote) {
    const link=byExternal.get(String(product.id))
    const code=codeKey(product.product_code)
    const matches=candidates.get(code)||[]
    const variant=link?.local_entity_type==='product_variant' ? variantsById.get(link.local_id):null
    const standard=link?.local_entity_type==='product' ? productsById.get(link.local_id):null
    const local=link ? variant ? {type:'product_variant',id:variant.id,product_id:variant.product_id}
      : standard && !standard.is_serialized ? {type:'product',id:standard.id,product_id:standard.id}:null
      : matches.length===1 && remoteCodes.get(code)===1 ? matches[0]:null
    if (!local) { if (matches.length>1 || remoteCodes.get(code)>1 || link) invalid++;else unmatched++;continue }
    const quantity=Number(product.stock_balance)
    const cost=Number(product.buy_price ?? product.average_price)
    const key=`${local.type}:${local.id}`
    if (!product.id || product.stock_balance == null || (product.buy_price ?? product.average_price)==null
      || !Number.isInteger(quantity) || !Number.isFinite(cost) || cost<0 || usedLocal.has(key)) { invalid++;continue }
    usedLocal.add(key)
    rows.push({local_entity_type:local.type,local_id:local.id,product_id:local.product_id,external_id:String(product.id),code:product.product_code || null,
      quantity:Number(product.status)===0 ? Math.max(0,quantity):0,cost})
  }
  return {rows,unmatched,invalid}
}

export async function syncInventoryFromDaftra(db, { request = daftraRequest } = {}) {
  await assertExternalErpDomain(db)
  await verifyDaftraReservationPosting(db,request)
  const fetchedAt=new Date().toISOString()
  const remote=await readAllDaftraRecords('/products.json','Product',{with_images:0},request)
  const [products,variants,links]=await Promise.all([
    readLocalRows(db,'products','id,sku,is_serialized'),readLocalRows(db,'product_variants','id,product_id,sku,code',[['is_active',true]]),
    readLocalRows(db,'erp_entity_links','id,local_entity_type,local_id,external_id',[['provider','daftra'],['external_entity_type','product']])
  ])
  const {rows,unmatched,invalid}=mapDaftraInventory(remote,products,variants,links)
  if (invalid) throw manual('Stock mappings or numeric balances require manual review.')
  // Validate the entire scan before applying any batch. Retries upsert the same cache.
  for(let offset=0;offset<rows.length;offset+=100) check(await db.rpc('erp_apply_inventory_cache',{p_rows:rows.slice(offset,offset+100),p_fetched_at:fetchedAt}))
  check(await db.rpc('erp_finalize_inventory_cache',{p_external_ids:rows.map(row=>row.external_id),p_fetched_at:fetchedAt}))
  return {scanned:remote.length,updated:rows.length,unmatched,failed:0,syncedAt:new Date().toISOString(),direction:'daftra_to_elcomputer'}
}

export function createDaftraJobRequest(db, job, request = daftraRequest, now = Date.now) {
  const deadline=now()+25*60*1000
  let lastRequestStarted=null
  return async (path,options) => {
    if (now()>=deadline) throw manual('ERP job time limit reached. Review before retrying.')
    if(lastRequestStarted!==null) await new Promise(resolve=>setTimeout(resolve,Math.max(0,250-(now()-lastRequestStarted))))
    check(await db.rpc('erp_validate_worker_lease',{p_token:job.lease_token}))
    lastRequestStarted=now()
    return request(path,options)
  }
}

export async function processNextDaftraJob(db, jobId = null, { request = daftraRequest, operations = null } = {}) {
  await assertExternalErpDomain(db)
  const claimed=check(await db.rpc('claim_daftra_sync_job',{p_job_id:jobId,p_operations:operations}))
  const job=Array.isArray(claimed)?claimed[0]:claimed
  if (!job) return {processed:false,job:null}
  // Another server instance may have saved credentials since this cache loaded.
  clearDaftraConfigCache()
  try {
    const guardedRequest=createDaftraJobRequest(db,job,request)
    const result=job.operation==='order.export' ? await syncOrderToDaftra(db,job.local_id,{request:guardedRequest})
      : job.operation==='inventory.import' ? await syncInventoryFromDaftra(db,{request:guardedRequest}) : (()=>{throw manual('Unsupported Daftra sync operation.')})()
    check(await db.rpc('erp_finish_daftra_job',{p_job_id:job.id,p_token:job.lease_token,p_success:true,p_result:result,p_error:null,p_delay:0}))
    return {processed:true,job:{...job,status:'completed',result}}
  } catch (error) {
    const manualRequired=error?.data?.manualRequired===true
    const message=manualRequired ? error.statusMessage:'Daftra synchronization failed. Retry when the connection is available.'
    if (manualRequired) check(await db.from('erp_sync_jobs').update({attempts:job.max_attempts}).eq('id',job.id).eq('lease_token',job.lease_token))
    check(await db.rpc('erp_finish_daftra_job',{p_job_id:job.id,p_token:job.lease_token,p_success:false,p_result:{manualRequired},p_error:message,p_delay:daftraRetryDelay(job.attempts)}))
    return {processed:true,job:{...job,status:'failed',last_error:message,result:{manualRequired}}}
  }
}

export async function retryDaftraJob(db, jobId) {
  check(await db.rpc('erp_retry_daftra_job',{p_job_id:jobId}))
  return {id:jobId}
}

export async function processDaftraQueue(db, { limit = 3, inventory = false } = {}) {
  const settings=await getErpSettings(db)
  if (settings.erp_mode!=='daftra') return {processed:0,paused:true}
  if (inventory) check(await db.rpc('erp_queue_inventory_refresh',{}))
  const results=[]
  for(let i=0;i<Math.min(5,Math.max(1,Number(limit)||3));i++) {
    const result=await processNextDaftraJob(db)
    if (!result.processed) break
    results.push({id:result.job.id,status:result.job.status})
    if (result.job.status==='failed' && !result.job.result?.manualRequired) break
  }
  return {processed:results.length,jobs:results}
}
