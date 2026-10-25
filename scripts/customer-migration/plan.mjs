import {createHash} from 'node:crypto'

export const normalizeEmail = value => String(value || '').trim().toLowerCase()
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const id = value => /^[1-9][0-9]{0,17}$/.test(String(value || '')) ? String(value) : null
const clean = value => {if(value===null||value===undefined)return null;const text=String(value);if(text.length>2000)throw Error('Historical field exceeds approved bound');return text}
const utc = value => !value || String(value).startsWith('0000-') ? null : /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(value) ? value.replace(' ','T')+'Z' : null
const emailValid = value => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const metaMap = (rows, key) => {
 const result = new Map(), duplicates = new Set(), variants=new Map()
 for(const row of rows){const owner=String(row[key]),values=result.get(owner)||{},k=owner+':'+row.meta_key,list=variants.get(k)||[];if(!list.includes(row.meta_value))list.push(row.meta_value);variants.set(k,list);if(Object.hasOwn(values,row.meta_key)&&values[row.meta_key]!==row.meta_value)duplicates.add(k);if(!Object.hasOwn(values,row.meta_key))values[row.meta_key]=row.meta_value;result.set(owner,values)}
 return {result,duplicates,variants}
}
const address = (meta,prefix) => Object.fromEntries(['first_name','last_name','company','address_1','address_2','city','state','postcode','country','email','phone'].filter(k=>Object.hasOwn(meta,prefix+k)).map(k=>[k,clean(meta[prefix+k])]))
const roleNames = raw => [...String(raw||'').matchAll(/s:\d+:"([a-z_]+)";b:1;/g)].map(m=>m[1])

export function planCustomerMigration(source, target, review = {}) {
 if(source.format!==1 || !/^[a-f0-9]{64}$/.test(source.encrypted_sha256))throw Error('Invalid authenticated source')
 if(!Array.isArray(target.users)||!Array.isArray(target.profiles))throw Error('A current target snapshot is required')
 if(review.source_sha256 && review.source_sha256!==source.encrypted_sha256)throw Error('Review source changed')
 const t=source.tables,exceptions=[],customers=[],orders=[],items=[],candidates=[]
 const usersMeta=metaMap(t.usermeta||[],'user_id'),postMeta=metaMap(t.postmeta||[],'post_id'),hposMeta=metaMap(t.wc_orders_meta||[],'order_id'),itemMeta=metaMap(t.woocommerce_order_itemmeta||[],'order_item_id')
 const targetEmails=new Map(),legacyEmails=new Map()
 for(const user of target.users){const email=normalizeEmail(user.email),list=targetEmails.get(email)||[];list.push(user);targetEmails.set(email,list)}
 for(const row of t.users||[]){const email=normalizeEmail(row.user_email),list=legacyEmails.get(email)||[];list.push(row);legacyEmails.set(email,list)}
 const approvals = new Set((review.claim_customer_ids||[]).map(String))
 if(approvals.size && (review.source_sha256!==source.encrypted_sha256 || !/^[a-f0-9]{64}$/.test(review.evidence_sha256||'') || !review.reviewed_at || !Number.isFinite(Date.parse(review.reviewed_at))))throw Error('Explicit source-bound claim review evidence required')
 for(const user of t.users||[]){
  const legacyId=id(user.ID),meta=usersMeta.result.get(legacyId)||{},email=normalizeEmail(user.user_email),roles=roleNames(meta[source.table_prefix+'capabilities'])
  const issue=!legacyId?'invalid_customer_id':!emailValid(email)?'invalid_email':legacyEmails.get(email).length!==1?'duplicate_legacy_email':String(user.user_status||'0')!=='0'?'disabled_legacy_user':roles.some(r=>r!=='customer')?'privileged_legacy_user':!roles.includes('customer')?'unknown_legacy_role':null
  if(issue){exceptions.push({kind:issue,customer_id:legacyId});continue}
  const targets=targetEmails.get(email)||[]
  if(targets.length>1)exceptions.push({kind:'duplicate_target_email',customer_id:legacyId})
  if(targets.some(u=>u.admin_member))exceptions.push({kind:'target_staff_collision',customer_id:legacyId})
  const eligible=targets.length<=1&&!targets.some(u=>u.admin_member||u.anonymous)
  if(approvals.has(legacyId)&&!eligible)throw Error('Ineligible reviewed identity')
  const customer={legacy_id:legacyId,email,profile:{first_name:clean(meta.first_name),last_name:clean(meta.last_name),display_name:clean(user.display_name)},billing_address:address(meta,'billing_'),shipping_address:address(meta,'shipping_'),claim_approved:approvals.has(legacyId),review_evidence:approvals.has(legacyId)?review.evidence_sha256:null}
  customers.push(customer)
  candidates.push({legacy_id:legacyId,action:targets.length===0?'ordinary_verified_signup_then_reviewed_claim':targets.length===1&&targets[0].confirmed&&eligible?'preserve_existing_uuid_review_claim':'manual_identity_review',existing_auth_id:targets.length===1?targets[0].id:null,claim_approved:customer.claim_approved})
 }
 if([...approvals].some(value=>!customers.some(c=>c.legacy_id===value)))throw Error('Unknown reviewed customer')
 const options=Object.fromEntries((t.options||[]).map(row=>[row.option_name,row.option_value]))
 const datastore=options.woocommerce_custom_orders_table_enabled==='yes'?'hpos':'posts'
 if(!Object.hasOwn(options,'woocommerce_custom_orders_table_enabled'))exceptions.push({kind:'datastore_setting_missing'})
 const authoritative=datastore==='hpos'?(t.wc_orders||[]):(t.posts||[])
 const addresses=new Map()
 for(const row of t.wc_order_addresses||[]){const key=String(row.order_id)+':'+row.address_type;if(addresses.has(key))throw Error('Duplicate order address');addresses.set(key,row)}
 const customerIds=new Set(customers.map(c=>c.legacy_id)),orderIds=new Set()
 const rawOrders=new Map(authoritative.map(row=>[String(datastore==='hpos'?row.id:row.ID),row]))
 const operations=new Map((t.wc_order_operational_data||[]).map(row=>[String(row.order_id),row]))
 for(const row of authoritative){
  const legacyId=id(datastore==='hpos'?row.id:row.ID);if(!legacyId)throw Error('Invalid order ID');if(orderIds.has(legacyId))throw Error('Duplicate source order');orderIds.add(legacyId)
  const meta=(datastore==='hpos'?hposMeta:postMeta).result.get(legacyId)||{},kind=datastore==='hpos'?row.type:row.post_type
  let customerId=id(datastore==='hpos'?row.customer_id:meta._customer_user)
  const parentId=id(datastore==='hpos'?row.parent_order_id:row.post_parent)
  if(!customerId&&kind==='shop_order_refund'&&parentId&&rawOrders.has(parentId))customerId=id(datastore==='hpos'?rawOrders.get(parentId).customer_id:postMeta.result.get(parentId)?._customer_user)
  if(!['shop_order','shop_order_refund'].includes(kind))throw Error('Unsupported order type')
  const total=String(datastore==='hpos'?row.total_amount:meta._order_total),currency=String(datastore==='hpos'?row.currency:meta._order_currency)
  if(!/^-?\d{1,12}(?:\.\d{1,6})?$/.test(total)||!/^[A-Z]{3}$/.test(currency)){exceptions.push({kind:'invalid_order_money',order_id:legacyId});continue}
  const metadata=datastore==='hpos'?hposMeta:postMeta,dateKeys=['_date_paid','_paid_date','_date_completed','_completed_date']
  const conflicts=[...metadata.duplicates].filter(k=>k.startsWith(legacyId+':'))
  if(conflicts.some(k=>!dateKeys.some(field=>k===legacyId+':'+field))){exceptions.push({kind:'conflicting_order_metadata',order_id:legacyId});continue}
  if(conflicts.length)exceptions.push({kind:'historical_date_conflict_preserved',order_id:legacyId})
  const dateVariants=Object.fromEntries(dateKeys.map(k=>[k,metadata.variants.get(legacyId+':'+k)||[]]))
  const singleDate=k=>dateVariants[k].length===1?dateVariants[k][0]:null
  if(customerId&&!customerIds.has(customerId))exceptions.push({kind:'excluded_or_missing_order_customer',order_id:legacyId,customer_id:customerId})
  const billing=datastore==='hpos'?addresses.get(legacyId+':billing')||{}:address(meta,'_billing_'),shipping=datastore==='hpos'?addresses.get(legacyId+':shipping')||{}:address(meta,'_shipping_')
  const safeAddress = value => Object.fromEntries(Object.entries(value).filter(([k])=>!['id','order_id','address_type'].includes(k)))
  const events=meta._elc_pdc_events?JSON.parse(meta._elc_pdc_events):[];if(!Array.isArray(events)||events.length>10000)throw Error('Invalid historical events')
  orders.push({legacy_id:legacyId,customer_legacy_id:customerId&&customerIds.has(customerId)?customerId:null,original_customer_legacy_id:customerId,kind,parent_legacy_id:parentId,status:clean(datastore==='hpos'?row.status:row.post_status),currency,total,created_at:utc(datastore==='hpos'?row.date_created_gmt:row.post_date_gmt),payment_method:clean(datastore==='hpos'?row.payment_method:meta._payment_method),payment_title:clean(datastore==='hpos'?row.payment_method_title:meta._payment_method_title),transaction_reference:clean(datastore==='hpos'?row.transaction_id:meta._transaction_id),paid_at_original:clean((datastore==='hpos'?operations.get(legacyId)?.date_paid_gmt:null)||singleDate('_date_paid')||singleDate('_paid_date')),completed_at_original:clean((datastore==='hpos'?operations.get(legacyId)?.date_completed_gmt:null)||singleDate('_date_completed')||singleDate('_completed_date')),date_variants:dateVariants,billing_address:safeAddress(billing),shipping_address:safeAddress(shipping),refund_amount:clean(meta._refund_amount),refund_reason:clean(meta._refund_reason),shipping_reference:clean(meta._elc_pdc_ref),shipping_awb:clean(meta._elc_pdc_awb),fulfillment_events:events})
 }
 const acceptedIds=new Set(orders.map(o=>o.legacy_id))
 for(const row of t.woocommerce_order_items||[]){
  const owner=String(row.order_id);if(!acceptedIds.has(owner))continue
  const legacyId=id(row.order_item_id);if(!legacyId)throw Error('Invalid item ID')
  const meta=itemMeta.result.get(legacyId)||{}
  if([...itemMeta.duplicates].some(k=>k.startsWith(legacyId+':'))){exceptions.push({kind:'conflicting_item_metadata',item_id:legacyId});continue}
  const kind=row.order_item_type
  if(!['line_item','shipping','fee','tax','coupon'].includes(kind)){exceptions.push({kind:'unsupported_item_kind',item_id:legacyId});continue}
  const quantity=kind==='line_item'?String(meta._qty):null
  if(kind==='line_item'&&!/^-?\d+(?:\.\d{1,6})?$/.test(quantity)){exceptions.push({kind:'invalid_item_quantity',item_id:legacyId});continue}
  items.push({legacy_id:legacyId,order_legacy_id:owner,kind,title:clean(row.order_item_name),quantity,product_legacy_id:id(meta._product_id),variant_legacy_id:id(meta._variation_id),subtotal:clean(meta._line_subtotal),total:clean(meta._line_total??meta.total??meta.cost??meta.discount_amount),tax:clean(meta._line_tax??meta.tax_amount)})
 }
 const blocking=new Set(['datastore_setting_missing','invalid_customer_id','invalid_order_money','conflicting_order_metadata','conflicting_item_metadata','unsupported_item_kind','invalid_item_quantity'])
 const summary={customers:customers.length,registered_orders:orders.filter(o=>o.customer_legacy_id).length,unlinked_orders:orders.filter(o=>!o.customer_legacy_id).length,guest_orders:orders.filter(o=>!o.original_customer_legacy_id).length,excluded_registered_orders:orders.filter(o=>o.original_customer_legacy_id&&!o.customer_legacy_id).length,orders:orders.filter(o=>o.kind==='shop_order').length,refund_records:orders.filter(o=>o.kind==='shop_order_refund').length,items:items.length,fulfillment_events:orders.reduce((n,o)=>n+o.fulfillment_events.length,0),claim_approvals:customers.filter(c=>c.claim_approved).length,identity_actions:Object.fromEntries([...new Set(candidates.map(c=>c.action))].map(k=>[k,candidates.filter(c=>c.action===k).length])),exceptions:Object.fromEntries([...new Set(exceptions.map(e=>e.kind))].map(k=>[k,exceptions.filter(e=>e.kind===k).length])),password_hash_types:source.password_hash_types}
 const payload={format:1,source_sha256:source.encrypted_sha256,datastore,customers,orders,items}
 return {format:1,status:exceptions.some(e=>blocking.has(e.kind))?'REVIEW_REQUIRED':'DRY_RUN_READY_FOR_REVIEW',payload,summary,candidates,exceptions,payload_sha256:hash(payload),live_side_effects:0,auth_users_created:0,passwords_imported:0,profile_updates:0}
}

export function compareSnapshots(current, older) {
 const index = source => new Map((source.tables.users||[]).map(u=>[String(u.ID),u]))
 const a=index(current),b=index(older)
 return {current_users:a.size,older_users:b.size,shared_ids:[...a.keys()].filter(k=>b.has(k)).length,new_ids:[...a.keys()].filter(k=>!b.has(k)).length,missing_ids:[...b.keys()].filter(k=>!a.has(k)).length,email_changes:[...a].filter(([k,v])=>b.has(k)&&normalizeEmail(v.user_email)!==normalizeEmail(b.get(k).user_email)).length,snapshots_must_not_be_unioned:true}
}
