import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,writeFile,mkdtemp,rm,realpath} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {resolve} from 'node:path'
import {registry,repairedRegistry,registryPath,onlyRegistryDelta,proposalState,argumentsForRepair} from '../scripts/shipping-tariff-release/repair.mjs'
import {artifactState,digest} from '../scripts/shipping-tariff-release/operator.mjs'
const data={type:'text/javascript',etag:'"owned"',size:3,path:'../public/_nuxt/old.js'}
const proposal={entries:{'/_nuxt/old.js':{metadata:data,sha256:'a'.repeat(64)}}}
const entries=[{path:'public/_nuxt/old.js',type:'file',size:3,sha256:'a'.repeat(64)}]
const current={'/_nuxt/new.js':{type:'text/javascript'},'/_nuxt/builds/latest.json':{size:5,etag:'"new-build"'}}
const text='/* original executable prefix */\nconst assets = '+JSON.stringify(current,null,2)+';\n/* original executable suffix */'
test('approved additions preserve executable prefix, suffix and all current metadata including latest pointer',()=>{
 const updated=repairedRegistry(text,proposal,entries),r=registry(updated);assert.deepEqual(r.value,{...current,'/_nuxt/old.js':data})
 assert.equal(updated.slice(0,r.first),text.slice(0,registry(text).first));assert.equal(updated.slice(r.last),text.slice(registry(text).last))
 assert.deepEqual(registry(text).value,current)
})
test('collisions, escaped or incorrect paths, changed hashes and incomplete coverage fail before packaging',()=>{
 for(const p of [{entries:{'/_nuxt/new.js':proposal.entries['/_nuxt/old.js']}},{entries:{'/_nuxt/../old.js':proposal.entries['/_nuxt/old.js']}},{entries:{'/_nuxt/old.js':{...proposal.entries['/_nuxt/old.js'],metadata:{...data,path:'../server/index.mjs'}}}},{entries:{'/_nuxt/old.js':{...proposal.entries['/_nuxt/old.js'],sha256:'b'.repeat(64)}}},{entries:{}}])assert.throws(()=>repairedRegistry(text,p,entries))
 assert.throws(()=>repairedRegistry('unrecognized registry',proposal,entries))
})
test('only one registry file can differ; missing, duplicate or modified application files fail',()=>{
 const before=[{path:registryPath,sha256:'old'},{path:'server/index.mjs',sha256:'index'},{path:'server/other.mjs',sha256:'other'}],after=[{...before[0],sha256:'new'},...before.slice(1)]
 onlyRegistryDelta(before,after)
 for(const bad of [[...after,{path:'extra'}],[after[0],after[1],after[1]],[after[0],{...after[1],sha256:'changed'},after[2]],before])assert.throws(()=>onlyRegistryDelta(before,bad))
})
test('proposal tampering, different approval and broader scope are rejected',async()=>{
 const d=await mkdtemp(tmpdir()+'/tariff-repair-approval-')
 try{
  const p={status:'PROPOSED_ONLY_REQUIRES_OWNER_APPROVAL_NO_ARTIFACT_CHANGE',entries:{},missing_registry_entries:0,...Object.fromEntries(['production_apply','sql_apply','pricing_or_gate_activation','new_feature','rebuild','credential_change','payment','booking','git_push'].map(k=>[k,false]))};p.seal=digest(p);await writeFile(d+'/p.json',JSON.stringify(p));await proposalState(d+'/p.json',p.seal)
  await assert.rejects(()=>proposalState(d+'/p.json','b'.repeat(64)))
  p.payment=true;await writeFile(d+'/p.json',JSON.stringify(p));await assert.rejects(()=>proposalState(d+'/p.json',p.seal))
  delete p.seal;p.seal=digest(p);await writeFile(d+'/p.json',JSON.stringify(p));await assert.rejects(()=>proposalState(d+'/p.json',p.seal))
  for(const a of [[],['repair','spec','new'],['repair','spec','new','--force','a'.repeat(64)]])assert.throws(()=>argumentsForRepair(a))
 }finally{await rm(d,{recursive:true,force:true})}
})
test('exact repaired artifact passes provenance, approval, unchanged build and full serving guards',{skip:!process.env.TARIFF_REPAIRED_MANIFEST},async()=>{
 const d=await mkdtemp(tmpdir()+'/tariff-repair-readback-')
 try{await writeFile(d+'/credentials.json',JSON.stringify({database_password:'not-a-real-secret-artifact-probe',service_role_key:'not-another-real-secret-probe'}));const a=await artifactState(resolve(process.env.TARIFF_REPAIRED_MANIFEST),{credentials_file:d+'/credentials.json'});assert.equal(a.format,'shipping-tariff-review/v2');assert.equal(a.packaging_repair.proposal_seal,'ee0da9bb58b65c7a6b0ea505adc82bcde05cc674cb36c7e79d5feae565b249fa')}finally{await rm(d,{recursive:true,force:true})}
})
