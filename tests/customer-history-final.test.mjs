import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,access,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {scope,assertScope,assertRecovery,assertOwnerApproval,apply} from '../scripts/customer-migration/final-operator.mjs'
import {eligibilityReview} from '../scripts/customer-migration/final-eligibility.mjs'
import {allowedHistoryRoute,extendHistoryIngress} from '../scripts/customer-migration/final-ingress.mjs'
import {digest,importBatchPreserving} from '../scripts/customer-migration/final-db.mjs'
const valid=()=>({format:1,scope,schema:94,batch_count:41,expected_counts:{customers:516,orders:597,items:1789},eligibility:{eligible_customers:513,held_customers:3}})

test('final import cannot add deployment, credentials, current commerce or public activation',()=>{
 assertScope(valid())
 for(const change of [{schema_migrations:1},{application_deployments:1},{auth_creation:1},{password_imports:1},{current_profile_updates:1},{current_commerce_writes:1},{automatic_auth_links:1},{provider_calls:1},{public_signup:true},{public_purchasing:true},{caddy_signals_max:2},{application_restarts:1},{automatic_retry:true},{automatic_rollback:true},{git_push:true}])assert.throws(()=>assertScope({...valid(),scope:{...scope,...change}}))
})
test('expired/future or untested backups do not authorize import',()=>{
 const now=Date.now(),p={recovery:{qualified_utc:new Date(now-1000).toISOString(),authenticated_full_readback:true,native_restoration_and_final_import:true,managed_vault_secret_rows:0}}
 assertRecovery(p,now)
 for(const change of [{qualified_utc:new Date(now-21600001).toISOString()},{qualified_utc:new Date(now+1).toISOString()},{native_restoration_and_final_import:false},{authenticated_full_readback:false},{managed_vault_secret_rows:1}])assert.throws(()=>assertRecovery({recovery:{...p.recovery,...change}},now))
})
test('missing, wrong, false and consumed owner approval stop before any transport',async()=>{
 const work=await mkdtemp(join(tmpdir(),'history-final-approval-')),seal='a'.repeat(64)
 try{
  await writeFile(work+'/final-import-plan.json',JSON.stringify({...valid(),seal}))
  await assert.rejects(apply(work,'b'.repeat(64)),/Exact final history import approval/)
  await assert.rejects(access(work+'/execution-intent.json'))
  await writeFile(work+'/IMPORT-APPROVAL.receipt.json',JSON.stringify({approved:false,plan_sha256:seal,action:'import_customer_history_and_history_routes'}))
  await assert.rejects(apply(work,seal));await assert.rejects(access(work+'/execution-intent.json'))
  await writeFile(work+'/IMPORT-APPROVAL.receipt.json',JSON.stringify({approved:true,plan_sha256:seal,action:'import_customer_history_and_history_routes'}))
  await assertOwnerApproval(work,{seal},seal);await writeFile(work+'/execution-intent.json','{}')
  await assert.rejects(assertOwnerApproval(work,{seal},seal),/Consumed/)
 }finally{await rm(work,{recursive:true,force:true})}
})
test('eligibility separates stable source identities, held changes and future verified signup',()=>{
 const user=(ID,email)=>({ID,user_email:email}),a={encrypted_sha256:'a'.repeat(64),tables:{users:[user('1','one@example.test'),user('2','two@example.test'),user('3','three@example.test'),user('4','four@example.test')]}},b={encrypted_sha256:'b'.repeat(64),tables:{users:[user('1','one@example.test'),user('2','older@example.test'),user('4','four@example.test')]}}
 const target={users:[{id:'current',email:'one@example.test',confirmed:true,admin_member:false}],profiles:[{id:'current',is_active:true,is_internal:false}]}
 const prepared={payload:{source_sha256:a.encrypted_sha256,customers:a.tables.users.map(u=>({legacy_id:u.ID,email:u.user_email})),orders:[],items:[]}}
 const r=eligibilityReview(a,b,target,prepared);assert.deepEqual(r.eligible_legacy_ids,['1','4']);assert.deepEqual(r.held_legacy_ids,['2','3']);assert.equal(r.summary.eligible_current_verified,1);assert.equal(r.summary.eligible_needing_verified_signup,1)
 for(const change of [{admin_member:true},{anonymous:true},{confirmed:false},{banned_until:new Date(Date.now()+60000).toISOString()}])assert.equal(eligibilityReview(a,b,{...target,users:[{...target.users[0],...change}]},prepared).rows[0].eligible,false)
 assert.equal(eligibilityReview(a,b,{...target,users:[...target.users,{...target.users[0],id:'duplicate'}]},prepared).rows[0].held_reason,'duplicate_current_email')
})
test('only list, exact reviewed-source detail and POST claim are added to existing matcher',()=>{
 const source='11111111-1111-5111-a111-111111111111',text="store.test {\n @customer_access expression `method('GET') && path('/login')`\n reverse_proxy @customer_access 127.0.0.1:3000\n}\n",r=extendHistoryIngress(text,source)
 assert.equal(r.changed_lines,1);assert.equal(r.text.split('\n').filter((x,i)=>x!==text.split('\n')[i]).length,1);assert.ok(allowedHistoryRoute('GET','/api/account/history/'+source+'/1',source))
 for(const [method,path]of [['POST','/api/account/history'],['GET','/api/account/history/claim'],['GET','/api/account/history/'+source+'/0'],['GET','/api/account/history/22222222-2222-5222-a222-222222222222/1'],['POST','/api/checkout'],['GET','/api/account/addresses']])assert.equal(allowedHistoryRoute(method,path,source),false)
 assert.throws(()=>extendHistoryIngress(r.text,source),/already changed/);assert.throws(()=>extendHistoryIngress(text,'bad'))
})
test('canonical authority digest preserves date values and ignores object key ordering only',()=>{
 assert.equal(digest({a:new Date('2026-01-01Z'),b:1}),digest({b:1,a:'2026-01-01T00:00:00.000Z'}));assert.notEqual(digest({a:new Date('2026-01-01Z')}),digest({a:new Date('2026-02-01Z')}))
})
test('failed current-data preservation rolls back its history batch without commit',async()=>{
 const calls=[];let projections=0
 const db={query:async(sql)=>{calls.push(sql);if(sql.startsWith('select public.customer_history_import_batch'))return {rows:[{receipt:{customers:1}}]};if(sql.includes('jsonb_agg(row_data'))return {rows:[{schema:'public',name:'customer_profiles',count:1,sha256:++projections===1?'before':'changed'}]};return {rows:[]}}}
 await assert.rejects(importBatchPreserving(db,{sourceId:'s',sourceKey:'k',sourceSha256:'a'.repeat(64),tables:[{schema:'public',name:'customer_profiles',columns:['id']}]},{id:'b',payload:{}}),/current Auth/)
 assert.equal(calls.at(-1),'rollback');assert.ok(!calls.includes('commit'))
})
