#!/usr/bin/env node
// Approved local packaging repair only. No build, SSH, SQL or provider transport.
import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir,cp,chmod} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFileSync,spawn} from 'node:child_process'
import {createServer} from 'node:net'
import {create as tarCreate} from 'tar'
import {inventory} from '../publish/inventory.mjs'
import {hash} from '../publish/contracts.mjs'
import {canonical} from '../commerce-release/operator.mjs'
import {extractTariffReview} from '../prepare-shipping-tariff-review.mjs'
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),digest=v=>hash(canonical(v)),load=async f=>JSON.parse(await readFile(f,'utf8'))
const save=(f,v)=>writeFile(f,JSON.stringify(v,null,2)+'\n',{flag:'wx',mode:0o600})
export const registryPath='server/chunks/nitro/nitro.mjs'
export function registry(text){
 const start=text.indexOf('const assets = {'),end=text.indexOf('\n};',start)
 assert.ok(start>=0&&end>start,'Unknown compiled registry; do not guess')
 const first=start+'const assets = '.length,last=end+2
 return{first,last,value:JSON.parse(text.slice(first,last))}
}
export function repairedRegistry(text,proposal,entries){
 const r=registry(text),next={...r.value},index=new Map(entries.map(e=>[e.path,e]))
 for(const[key,entry]of Object.entries(proposal.entries)){
  assert.match(key,/^\/_nuxt\/[A-Za-z0-9_./-]+$/);assert.ok(!key.split('/').includes('..'));assert.notEqual(key,'/_nuxt/builds/latest.json')
  assert.ok(!Object.hasOwn(next,key),'Never replace a current registry entry')
  const file=index.get('public'+key);assert.equal(file?.type,'file');assert.equal(file.sha256,entry.sha256)
  assert.equal(entry.metadata.size,file.size);assert.equal(entry.metadata.path,'../public'+key)
  assert.equal(typeof entry.metadata.type,'string');assert.match(entry.metadata.etag,/^"[^"\r\n]+"$/)
  next[key]=entry.metadata
 }
 for(const e of entries.filter(e=>e.type==='file'&&e.path.startsWith('public/_nuxt/')))assert.ok(next['/'+e.path.slice(7)],'Every client file must be served')
 assert.deepEqual(Object.fromEntries(Object.keys(r.value).map(k=>[k,next[k]])),r.value)
 return text.slice(0,r.first)+JSON.stringify(next,null,2)+text.slice(r.last)
}
export function onlyRegistryDelta(before,after){
 assert.deepEqual(after.map(e=>e.path),before.map(e=>e.path),'No missing, duplicate, extra or reordered paths');const old=new Map(before.map(e=>[e.path,e])),changed=[]
 for(const e of after){assert.ok(old.has(e.path));if(canonical(e)!==canonical(old.get(e.path)))changed.push(e.path)}
 assert.deepEqual(changed,[registryPath],'Only the compiled serving registry may change')
}
export async function proposalState(file,approval){
 const p=await load(file),{seal,...body}=p;assert.equal(digest(body),seal);assert.equal(approval,seal,'Exact owner packaging approval required')
 assert.equal(p.status,'PROPOSED_ONLY_REQUIRES_OWNER_APPROVAL_NO_ARTIFACT_CHANGE')
 for(const key of ['production_apply','sql_apply','pricing_or_gate_activation','new_feature','rebuild','credential_change','payment','booking','git_push'])assert.equal(p[key],false)
 assert.equal(Object.keys(p.entries).length,p.missing_registry_entries);return p
}
async function originalState(file,p){
 const a=await load(file),{seal,...body}=a,d=dirname(file);assert.equal(digest(body),seal);assert.equal(seal,p.original_review_seal);assert.equal(a.archive_sha256,p.original_archive_sha256);assert.equal(a.application_commit,p.source_application_commit)
 assert.equal(hash(await readFile(d+'/application.tar.gz')),a.archive_sha256);const entries=await load(d+'/inventory.json');assert.equal(digest(entries),a.inventory_sha256)
 for(const name of ['readback','source/.output'])assert.equal(digest(await inventory(d+'/'+name)),a.inventory_sha256)
 assert.equal(hash(await readFile(d+'/migration91.sql')),a.migrations[0].sha256);assert.equal(hash(await readFile(d+'/owner-draft.import.json')),a.import_sha256)
 for(const[f,sha]of Object.entries(a.tools_sha256))assert.equal(hash(await readFile(repo+'/'+f)),sha)
 return{manifest:a,directory:d,entries}
}
export async function verifyRepairArtifact(directory,a){
 assert.equal(a.format,'shipping-tariff-review/v2');const proof=await load(directory+'/repair-proof.json');assert.equal(hash(await readFile(directory+'/repair-proof.json')),a.packaging_repair.proof_sha256)
 const p=await proposalState(proof.proposal.file,proof.approved_proposal_seal);assert.equal(p.seal,a.packaging_repair.proposal_seal)
 const old=await originalState(proof.original_manifest.file,p);assert.equal(hash(await readFile(proof.original_manifest.file)),proof.original_manifest.sha256)
 for(const[f,sha]of Object.entries(proof.evidence_sha256))assert.equal(hash(await readFile(f)),sha)
 const entries=await load(directory+'/inventory.json');onlyRegistryDelta(old.entries,entries)
 assert.equal(await readFile(directory+'/readback/'+registryPath,'utf8'),repairedRegistry(await readFile(old.directory+'/readback/'+registryPath,'utf8'),p,old.entries))
 for(const key of ['application_commit','base','proposed_schema','migrations','qualification_sha256','import_sha256','retained_assets','entries','business_import_in_deployment','production_application_authorized','production_business_writes_authorized','checkout_change','credential_change','caddy_change'])assert.deepEqual(a[key],old.manifest[key])
 const smoke=await load(directory+'/compiled-smoke.json');assert.equal(smoke.result,'PASS');assert.equal(smoke.archive_sha256,a.archive_sha256);assert.equal(smoke.inventory_sha256,a.inventory_sha256)
 assert.deepEqual(smoke.asset_checks.map(c=>c.path).sort(),entries.filter(e=>e.type==='file'&&e.path.startsWith('public/_nuxt/')).map(e=>'/'+e.path.slice(7)).sort())
 assert.ok(smoke.asset_checks.every(c=>c.status===200&&c.sha256_matches===true))
 assert.equal(smoke.anonymous_checks.length,4);assert.ok(smoke.anonymous_checks.every(c=>c.status===401))
 assert.equal(proof.builds,0);assert.equal(proof.feature_changes,0);assert.equal(proof.production_writes,0);assert.equal(proof.provider_requests,0)
 return{proposal_seal:p.seal,changed_files:[registryPath],added_entries:p.missing_registry_entries}
}
async function qualify(directory,entries,archiveSha,inventorySha){
 const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r))
 const preload=directory+'/offline.cjs';await writeFile(preload,"const original=globalThis.fetch;globalThis.fetch=(url,options)=>{const u=new URL(typeof url==='string'?url:url.url);if(u.hostname!=='127.0.0.1')throw Error('External fetch forbidden during artifact qualification');return original(url,options)};\n",{flag:'wx',mode:0o600})
 const child=spawn(process.execPath,['--require',preload,directory+'/readback/server/index.mjs'],{cwd:directory,env:{PATH:dirname(process.execPath)+':/usr/bin:/bin',HOME:process.env.HOME,LANG:'C',NODE_ENV:'production',HOST:'127.0.0.1',NITRO_HOST:'127.0.0.1',PORT:String(port),NITRO_PORT:String(port),NUXT_PUBLIC_SUPABASE_URL:'https://offline.invalid',NUXT_PUBLIC_SUPABASE_KEY:'offline-fixture',NUXT_PUBLIC_SITE_URL:'https://offline.invalid'},stdio:['ignore','pipe','pipe']})
 const logs=[];child.stdout.on('data',b=>logs.push(b));child.stderr.on('data',b=>logs.push(b));const ended=new Promise((res,rej)=>{child.once('error',rej);child.once('close',res)}),origin='http://127.0.0.1:'+port
 const anonymous_checks=[],asset_checks=[]
 try{
  let ready=false;for(let i=0;i<100;i++){try{const r=await fetch(origin+'/_nuxt/builds/latest.json',{signal:AbortSignal.timeout(1000)});await r.body?.cancel();if(r.status===200){ready=true;break}}catch{}if(child.exitCode!==null)break;await new Promise(r=>setTimeout(r,100))}assert.ok(ready)
  for(const path of ['/api/admin-shipping/companies/00000000-0000-4000-8000-000000000001/tariffs','/api/checkout/controlled'])for(const method of ['GET','POST']){
   const r=await fetch(origin+path,{method,headers:{'content-type':'application/json'},...(method==='POST'?{body:'{}'}:{}),signal:AbortSignal.timeout(5000)});await r.body?.cancel();assert.equal(r.status,401);if(path.includes('/tariffs'))assert.equal(r.headers.get('cache-control'),'private, no-store');anonymous_checks.push({path,method,status:r.status})
  }
  const files=entries.filter(e=>e.type==='file'&&e.path.startsWith('public/_nuxt/'));let next=0
  await Promise.all(Array.from({length:8},async()=>{while(next<files.length){const e=files[next++],path='/'+e.path.slice(7),r=await fetch(origin+path,{signal:AbortSignal.timeout(10000)}),bytes=Buffer.from(await r.arrayBuffer());assert.equal(r.status,200,path);assert.equal(hash(bytes),e.sha256,path);asset_checks.push({path,status:r.status,sha256_matches:true})}}))
  asset_checks.sort((a,b)=>a.path.localeCompare(b.path));return{result:'PASS',archive_sha256:archiveSha,inventory_sha256:inventorySha,anonymous_checks,asset_checks,provider_requests:0,hosted_connections:0,database_writes:0}
 }finally{child.kill('SIGTERM');const timeout=setTimeout(()=>child.kill('SIGKILL'),3000);try{await ended}finally{clearTimeout(timeout)}await writeFile(directory+'/compiled-server.log',Buffer.concat(logs),{flag:'wx',mode:0o600})}
}
export async function repair({spec:specFile,directory,approval}){
 assert.equal(process.version,'v22.23.1');assert.ok(!directory.startsWith(repo+'/'));const s=await load(specFile),p=await proposalState(s.proposal,approval),old=await originalState(s.original_manifest,p)
 const base=await load(s.accepted_plan),{seal:baseSeal,...baseBody}=base;assert.equal(digest(baseBody),baseSeal);assert.equal(baseSeal,old.manifest.base.seal)
 assert.equal(hash(await readFile(s.accepted_archive)),p.baseline_archive_sha256);assert.equal(base.archive_sha256,p.baseline_archive_sha256);assert.equal(digest(await inventory(s.accepted_output)),base.inventory_sha256)
 const baseRegistry=registry(await readFile(s.accepted_output+'/'+registryPath,'utf8')).value
 for(const[key,value]of Object.entries(p.entries)){if(value.origin==='accepted deployed serving index')assert.deepEqual(value.metadata,baseRegistry[key]);else assert.ok(!baseRegistry[key])}
 execFileSync('git',['diff','--quiet',p.source_application_commit,'--','app','server','public','i18n','supabase','package.json','package-lock.json','nuxt.config.ts','tsconfig.json'],{cwd:repo})
 await mkdir(directory,{mode:0o700});await save(directory+'/owner-packaging-approval.json',{proposal_seal:approval,scope:'Local packaging repair, qualification and read-only deployment preparation only',production_apply:false,approved_owner_message:'Approve local tariff packaging repair and reseal only. Proposal: '+approval})
 await mkdir(directory+'/source',{mode:0o700});await cp(old.directory+'/source/.output',directory+'/source/.output',{recursive:true,verbatimSymlinks:true,errorOnExist:true,force:false});const output=directory+'/source/.output'
 assert.equal(digest(await inventory(output)),old.manifest.inventory_sha256)
 const original=await readFile(output+'/'+registryPath,'utf8'),updated=repairedRegistry(original,p,old.entries);await writeFile(output+'/'+registryPath,updated)
 const entries=await inventory(output);onlyRegistryDelta(old.entries,entries);await save(directory+'/inventory.json',entries)
 await tarCreate({cwd:directory+'/source',file:directory+'/application.tar.gz',gzip:true,portable:true,noMtime:true,follow:false,onWriteEntry:e=>{if(e.type==='SymbolicLink')e.stat.mode=(e.stat.mode&~0o7777)|0o755}},['.output']);await chmod(directory+'/application.tar.gz',0o600)
 await extractTariffReview(directory+'/application.tar.gz',directory+'/inventory.json',directory+'/readback',directory+'/archive-readback.log');assert.equal(digest(await inventory(directory+'/readback')),digest(entries))
 const archiveSha=hash(await readFile(directory+'/application.tar.gz')),inventorySha=digest(entries);await save(directory+'/compiled-smoke.json',await qualify(directory,entries,archiveSha,inventorySha))
 for(const name of ['migration91.sql','owner-draft.import.json','build-reuse.json'])await cp(old.directory+'/'+name,directory+'/'+name,{errorOnExist:true,force:false})
 const evidence=[s.proposal,specFile,s.original_manifest,s.accepted_plan,s.accepted_archive,old.directory+'/inventory.json',directory+'/owner-packaging-approval.json']
 const proof={result:'PASS',proposal:{file:s.proposal,sha256:hash(await readFile(s.proposal))},approved_proposal_seal:approval,original_manifest:{file:s.original_manifest,sha256:hash(await readFile(s.original_manifest))},changed_files:[registryPath],added_entries:p.missing_registry_entries,builds:0,feature_changes:0,production_writes:0,provider_requests:0,evidence_sha256:Object.fromEntries(await Promise.all(evidence.map(async f=>[f,hash(await readFile(f))])))};await save(directory+'/repair-proof.json',proof)
 const{seal:oldSeal,...oldBody}=old.manifest
 const manifest={...oldBody,format:'shipping-tariff-review/v2',archive_sha256:archiveSha,inventory_sha256:inventorySha,compiled_smoke_sha256:hash(await readFile(directory+'/compiled-smoke.json')),packaging_repair:{proposal_seal:approval,original_review_seal:oldSeal,proof_sha256:hash(await readFile(directory+'/repair-proof.json'))},tools_sha256:{...old.manifest.tools_sha256,'scripts/shipping-tariff-release/repair.mjs':hash(await readFile(fileURLToPath(import.meta.url)))}}
 manifest.seal=digest(manifest);await save(directory+'/review-manifest.json',manifest);await verifyRepairArtifact(directory,manifest);await originalState(s.original_manifest,p)
 console.log(JSON.stringify({result:'REPAIRED_AND_RESEALED_LOCAL_ONLY',seal:manifest.seal,archive_sha256:archiveSha,entries:entries.length,registry_entries_added:p.missing_registry_entries,static_http_checks:(await load(directory+'/compiled-smoke.json')).asset_checks.length,original_unchanged:true,rebuilds:0,production_writes:0}));return manifest
}
export function argumentsForRepair(a){if(a.length===5&&a[0]==='repair'&&a[3]==='--approved'&&/^[a-f0-9]{64}$/.test(a[4]))return{spec:resolve(a[1]),directory:resolve(a[2]),approval:a[4]};throw Error('Use repair SPEC NEW_DIRECTORY --approved EXACT_PROPOSAL_SEAL')}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{await repair(argumentsForRepair(process.argv.slice(2)))}catch(e){console.error('LOCAL_REPAIR_STOP: '+e.message);process.exitCode=1}}
