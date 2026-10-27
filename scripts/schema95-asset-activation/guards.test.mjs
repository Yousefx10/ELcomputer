import test from 'node:test'
import assert from 'node:assert/strict'
import {assertPlan,scope} from './operator.mjs'
import {digest} from '../schema95-beta-release/database.mjs'
const now=Date.now(),valid=()=>({scope,release_id:'81becf54218a8e14',archive_sha256:'81becf54218a8e144137f2bdce7df1eed6bcc07745924c0167fcd7435aae37ff',staged_verified:{plan_sha256:'a510a04dd2d55b0b39c22c1b88437008ecaefbc1cc94ca3872305209840febab'},migration_already_committed:true,recovery_proof:{database:{pg_restore_full_readback:'PASS'},runtime:{full_byte_readback:true}},git_push:false,public_activation:false,production_payment:false,pdc_calls:false,business_settings_change:false,backup_source_utc:new Date(now-1000).toISOString(),expires_utc:new Date(now-1000+6*3600000).toISOString()})
const seal=p=>({...p,seal:digest(p)})
test('new95 recovery scope accepts held commerce and exact staged artifact',()=>assert.doesNotThrow(()=>assertPlan(seal(valid()),now)))
for(const[k,v]of[['migrations',1],['database_writes',1],['auth_change',true],['runtime_change',true],['provider_calls',1],['purchasing',true],['caddy_sigusr1_max',2],['app_restarts_max',2],['automatic_retry',true],['automatic_rollback',true]])test('scope denies '+k+' even with a new matching hash',()=>assert.throws(()=>assertPlan(seal({...valid(),scope:{...scope,[k]:v}}),now)))
for(const k of ['git_push','public_activation','production_payment','pdc_calls','business_settings_change'])test('denies '+k,()=>assert.throws(()=>assertPlan(seal({...valid(),[k]:true}),now)))
test('denies a migration replay or absent successful commit receipt',()=>assert.throws(()=>assertPlan(seal({...valid(),migration_already_committed:false}),now)))
test('denies a changed frozen archive',()=>assert.throws(()=>assertPlan(seal({...valid(),archive_sha256:'0'.repeat(64)}),now)))
test('denies stale recovery',()=>{const p=valid();p.backup_source_utc=new Date(now-6*3600000-1).toISOString();p.expires_utc=new Date(now-1).toISOString();assert.throws(()=>assertPlan(seal(p),now))})
test('denies extending the backup window',()=>assert.throws(()=>assertPlan(seal({...valid(),expires_utc:new Date(now+24*3600000).toISOString()}),now)))
test('denies tampering after sealing',()=>{const p=seal(valid());p.public_activation=true;assert.throws(()=>assertPlan(p,now))})
test('denies a candidate with public listeners',()=>assert.throws(()=>assertPlan(seal({...valid(),scope:{...scope,candidate_loopback_only:false}}),now)))
