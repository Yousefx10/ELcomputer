import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,rm,access} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {assertScope,assertFreshBackup,apply} from '../scripts/inactive-history-release/operator.mjs'
import {scope,pendingVersions,comparableState,canonicalSchema} from '../scripts/inactive-history-release/database.mjs'
const valid=()=>({format:11,scope,schema_version:94,migrations:pendingVersions.map(version=>({version})),database_writes:'schema_only',historical_import:false,claims:false,signup:false,provider_requests:0,git_push:false,nuxt_restarts_max:1,automatic_retry:false,automatic_rollback:false})

test('inactive deployment rejects imports, activation, provider calls and migration substitution',()=>{
 assertScope(valid())
 for(const changed of [{historical_import:true},{claims:true},{signup:true},{provider_requests:1},{git_push:true},{nuxt_restarts_max:2},{automatic_retry:true},{automatic_rollback:true},{schema_version:93},{migrations:[{version:'20261025120000'}]},{database_writes:'business_data'}])assert.throws(()=>assertScope({...valid(),...changed}))
})
test('recovery age is bounded and an untested backup cannot qualify',()=>{
 const now=Date.now(),p={backup_verified_utc:new Date(now-1000).toISOString(),backup_qualification:{authenticated_full_readback:true,local_application_auth_restore:true}}
 assertFreshBackup(p,now)
 for(const changed of [{backup_verified_utc:new Date(now-6*3600000-1).toISOString()},{backup_verified_utc:new Date(now+1).toISOString()},{backup_qualification:{authenticated_full_readback:true,local_application_auth_restore:false}}])assert.throws(()=>assertFreshBackup({...p,...changed},now))
})
test('read-only session mode is normalized without ignoring order or identity changes',()=>{
 const p={read_only:'on',protected_tables:[{schema:'public',name:'customer_orders',columns:['id'],count:1,sha256:'original'}],auth_security:{sha256:'identities'}}
 assert.deepEqual(comparableState(p),comparableState({...p,read_only:'off'}))
 assert.notDeepEqual(comparableState(p),comparableState({...p,auth_security:{sha256:'changed'}}))
 assert.notDeepEqual(comparableState(p),comparableState({...p,protected_tables:[{...p.protected_tables[0],count:2}]}))
})
test('catalog ordering is normalized without ignoring a changed function definition',()=>{
 const a={functions:[{signature:'a()',definition:'one'},{signature:'b()',definition:'two'}]}
 assert.deepEqual(canonicalSchema(a),canonicalSchema({functions:[...a.functions].reverse()}))
 assert.notDeepEqual(canonicalSchema(a),canonicalSchema({functions:[a.functions[0],{...a.functions[1],definition:'changed'}]}))
})
test('an absent or wrong owner seal stops before intent creation or any transport',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'inactive-history-approval-'))
 try{
  await writeFile(dir+'/plan.json',JSON.stringify({...valid(),seal:'a'.repeat(64)}))
  await assert.rejects(apply(dir,null),/Exact separate deployment approval/)
  await assert.rejects(apply(dir,'b'.repeat(64)),/Exact separate deployment approval/)
  await assert.rejects(access(dir+'/execution-intent.json'))
 }finally{await rm(dir,{recursive:true,force:true})}
})
