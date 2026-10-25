import test from 'node:test'
import assert from 'node:assert/strict'
import {planCustomerMigration,compareSnapshots} from '../scripts/customer-migration/plan.mjs'

const source=()=>({format:1,encrypted_sha256:'a'.repeat(64),table_prefix:'wp_',password_hash_types:{wordpress_bcrypt_sha384:2},tables:{
 users:[{ID:'1',user_email:' Alice@Example.test ',display_name:'Alice',password_hash_kind:'wordpress_bcrypt_sha384'},{ID:'2',user_email:'owner@example.test',display_name:'Owner',password_hash_kind:'wordpress_bcrypt_sha384'}],
 usermeta:[{user_id:'1',meta_key:'wp_capabilities',meta_value:'a:1:{s:8:"customer";b:1;}'},{user_id:'1',meta_key:'billing_address_1',meta_value:'Archived address'},{user_id:'2',meta_key:'wp_capabilities',meta_value:'a:1:{s:13:"administrator";b:1;}'}],
 options:[{option_name:'woocommerce_custom_orders_table_enabled',option_value:'no'}],
 posts:[{ID:'10',post_type:'shop_order',post_parent:'0',post_status:'wc-completed',post_date_gmt:'2025-10-01 12:00:00'},{ID:'11',post_type:'shop_order',post_parent:'0',post_status:'wc-pending',post_date_gmt:'0000-00-00 00:00:00'},{ID:'12',post_type:'shop_order_refund',post_parent:'10',post_status:'wc-completed'}],
 postmeta:[{post_id:'10',meta_key:'_customer_user',meta_value:'1'},{post_id:'11',meta_key:'_customer_user',meta_value:'0'},...['10','11','12'].flatMap(id=>[{post_id:id,meta_key:'_order_total',meta_value:id==='12'?'-10.00':'10.00'},{post_id:id,meta_key:'_order_currency',meta_value:'EGP'}]),{post_id:'11',meta_key:'_billing_email',meta_value:'alice@example.test'}],
 woocommerce_order_items:[{order_item_id:'100',order_id:'10',order_item_type:'line_item',order_item_name:'Original item'}],
 woocommerce_order_itemmeta:[{order_item_id:'100',meta_key:'_qty',meta_value:'1'},{order_item_id:'100',meta_key:'_line_total',meta_value:'10.00'}]
}})
const target=()=>({users:[{id:'11111111-1111-4111-8111-111111111111',email:'alice@example.test',confirmed:true,admin_member:false}],profiles:[{id:'11111111-1111-4111-8111-111111111111',address:'Newer address'}]})

test('dry-run preserves current UUID/profile, excludes staff and never links guest email',()=>{
 const s=source(),t=target(),before=structuredClone(t),p=planCustomerMigration(s,t)
 assert.equal(p.status,'DRY_RUN_READY_FOR_REVIEW');assert.equal(p.summary.customers,1);assert.equal(p.summary.orders,2);assert.equal(p.summary.refund_records,1)
 assert.equal(p.summary.claim_approvals,0);assert.equal(p.payload.orders.find(o=>o.legacy_id==='11').customer_legacy_id,null)
 assert.equal(p.payload.orders.find(o=>o.legacy_id==='12').customer_legacy_id,'1');assert.equal(p.candidates[0].existing_auth_id,t.users[0].id)
 assert.equal(p.payload.orders.find(o=>o.legacy_id==='11').created_at,null);assert.deepEqual(t,before)
 assert.equal(p.auth_users_created,0);assert.equal(p.passwords_imported,0);assert.equal(p.profile_updates,0)
 assert.equal(p.exceptions[0].kind,'privileged_legacy_user')
})
test('source-bound owner review is required before verified-email claims',()=>{
 assert.throws(()=>planCustomerMigration(source(),target(),{claim_customer_ids:['1']}))
 assert.throws(()=>planCustomerMigration(source(),target(),{claim_customer_ids:['1'],evidence_sha256:'c'.repeat(64),reviewed_at:'2026-10-25T00:00:00Z'}))
 assert.throws(()=>planCustomerMigration(source(),target(),{source_sha256:'b'.repeat(64)}))
 const p=planCustomerMigration(source(),target(),{source_sha256:'a'.repeat(64),claim_customer_ids:['1'],evidence_sha256:'c'.repeat(64),reviewed_at:'2026-10-25T00:00:00Z'})
 assert.equal(p.payload.customers[0].claim_approved,true);assert.equal(p.summary.claim_approvals,1)
})
test('duplicate emails and role/target collisions require explicit review; no aliases',()=>{
 const s=source();s.tables.users.push({...s.tables.users[0],ID:'3'});s.tables.usermeta.push({user_id:'3',meta_key:'wp_capabilities',meta_value:'a:1:{s:8:"customer";b:1;}'})
 assert.equal(planCustomerMigration(s,target()).summary.exceptions.duplicate_legacy_email,2)
 const t=target();t.users[0].admin_member=true
 assert.equal(planCustomerMigration(source(),t).summary.exceptions.target_staff_collision,1)
 const aliases=source();aliases.tables.users[0].user_email='alice+old@example.test';assert.equal(planCustomerMigration(aliases,target()).candidates[0].existing_auth_id,null)
})
test('conflicting totals, absent datastore settings and unsafe order values block release',()=>{
 const s=source();s.tables.postmeta.push({post_id:'10',meta_key:'_order_total',meta_value:'99.00'})
 assert.equal(planCustomerMigration(s,target()).status,'REVIEW_REQUIRED')
 const missing=source();missing.tables.options=[];assert.equal(planCustomerMigration(missing,target()).status,'REVIEW_REQUIRED')
 const invalid=source();invalid.tables.postmeta[2].meta_value='NaN';assert.equal(planCustomerMigration(invalid,target()).status,'REVIEW_REQUIRED')
})
test('authoritative HPOS is selected explicitly and snapshots are compared, never unioned',()=>{
 const s=source();s.tables.options[0].option_value='yes';s.tables.wc_orders=[{id:'20',type:'shop_order',status:'wc-completed',customer_id:'1',total_amount:'25.50',currency:'EGP',date_created_gmt:'2025-01-01 01:00:00'}]
 const p=planCustomerMigration(s,target());assert.equal(p.payload.datastore,'hpos');assert.equal(p.payload.orders.length,1);assert.equal(p.payload.orders[0].legacy_id,'20')
 const older=source();older.tables.users[0].user_email='previous@example.test';assert.equal(compareSnapshots(source(),older).email_changes,1)
})
