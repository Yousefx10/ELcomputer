import assert from 'node:assert/strict'
import {normalizeEmail} from './plan.mjs'

// This is a source-bound proposal. Only the later exact owner import approval
// authorizes persistence of claim_approved flags. Runtime verification/explicit
// customer claim remains mandatory and no Auth UUID is imported or linked.
export function eligibilityReview(primary,comparison,target,prepared){
 assert.equal(primary.encrypted_sha256,prepared.payload.source_sha256)
 const prior=new Map(comparison.tables.users.map(u=>[String(u.ID),u])),now=new Map(primary.tables.users.map(u=>[String(u.ID),u]))
 const count=(users,field)=>{const m=new Map();for(const u of users){const key=normalizeEmail(u[field]);m.set(key,(m.get(key)||0)+1)}return m}
 const legacyEmails=count(primary.tables.users,'user_email'),olderEmails=count(comparison.tables.users,'user_email'),auth=new Map()
 for(const u of target.users){const key=normalizeEmail(u.email),list=auth.get(key)||[];list.push(u);auth.set(key,list)}
 const profiles=new Map(target.profiles.map(p=>[p.id,p])),rows=[]
 for(const c of prepared.payload.customers){
  const matches=auth.get(c.email)||[],profile=matches.length===1?profiles.get(matches[0].id):null
  let reason=!prior.has(c.legacy_id)?'primary_only_identity':normalizeEmail(prior.get(c.legacy_id).user_email)!==c.email?'changed_registered_email':legacyEmails.get(c.email)!==1||olderEmails.get(c.email)!==1?'duplicate_legacy_email':matches.length>1?'duplicate_current_email':matches.some(u=>u.admin_member)?'current_staff_collision':matches.some(u=>u.anonymous)?'anonymous_current_identity':matches.some(u=>u.banned_until&&Date.parse(u.banned_until)>Date.now())?'banned_current_identity':matches.length===1&&!matches[0].confirmed?'unverified_current_identity':matches.length===1&&(!profile||profile.is_active!==true||profile.is_internal===true)?'inactive_or_internal_current_profile':null
  rows.push({legacy_id:c.legacy_id,registered_email:c.email,eligible:reason===null,held_reason:reason,current_verified_match:reason===null&&matches.length===1,current_auth_id:matches.length===1?matches[0].id:null,customer_orders:prepared.payload.orders.filter(o=>o.customer_legacy_id===c.legacy_id).length})
 }
 const eligible=rows.filter(r=>r.eligible),ids=new Set(eligible.map(r=>r.legacy_id)),held=rows.filter(r=>!r.eligible)
 const records=prepared.payload.orders,eligibleRecords=records.filter(o=>ids.has(o.customer_legacy_id)),heldRecords=records.filter(o=>o.customer_legacy_id&&!ids.has(o.customer_legacy_id))
 const breakdown=rs=>({orders:rs.filter(o=>o.kind==='shop_order').length,refunds:rs.filter(o=>o.kind==='shop_order_refund').length,records:rs.length,items:prepared.payload.items.filter(i=>rs.some(o=>o.legacy_id===i.order_legacy_id)).length,fulfillment_events:rs.reduce((n,o)=>n+o.fulfillment_events.length,0)})
 return {format:1,status:'PROPOSED_ELIGIBILITY_PENDING_EXACT_OWNER_IMPORT_APPROVAL',source_sha256:primary.encrypted_sha256,comparison_sha256:comparison.encrypted_sha256,reviewed_at:new Date().toISOString(),reviewer:'Local source/identity verification; owner authorization pending',policy:'Unique customer-role original registered email stable across both frozen snapshots; no target collision/staff/anonymous/unverified/inactive identity; explicit confirmed-customer runtime claim only',eligible_legacy_ids:eligible.map(r=>r.legacy_id),held_legacy_ids:held.map(r=>r.legacy_id),rows,summary:{importable_customers:rows.length,eligible_customers:eligible.length,held_customers:held.length,eligible_current_verified:eligible.filter(r=>r.current_verified_match).length,eligible_needing_verified_signup:eligible.filter(r=>!r.current_verified_match).length,held_reasons:Object.fromEntries([...new Set(held.map(r=>r.held_reason))].map(k=>[k,held.filter(r=>r.held_reason===k).length])),eligible_records:breakdown(eligibleRecords),held_customer_records:breakdown(heldRecords),unlinked_records:breakdown(records.filter(o=>!o.customer_legacy_id)),eligible_customers_with_orders:eligible.filter(r=>r.customer_orders>0).length,eligible_customers_without_orders:eligible.filter(r=>r.customer_orders===0).length,comparison_only_ids:[...prior.keys()].filter(k=>!now.has(k)).length,duplicate_legacy_emails:[...legacyEmails.values()].filter(n=>n>1).length,duplicate_current_emails:[...auth.values()].filter(v=>v.length>1).length},auth_accounts_created:0,automatic_auth_links:0,production_writes:0}
}
