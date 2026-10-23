#!/usr/bin/env node
// A fresh tariff-only release. Never builds, rewrites the artifact, or imports tariffs.
import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir,access} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFile,spawn} from 'node:child_process'
import {promisify} from 'node:util'
import {inventory} from '../publish/inventory.mjs'
import {digest,stable,publicHealth} from '../live-sales-release/operator.mjs'
import {hash,migrations,connect,checkDatabase,assertPreserved,applyMigration,approvalState,assertTariffOnlyDelta} from './database.mjs'
import {backup,saveActivationReceipt} from '../footer-release/operator.mjs'
export {digest,approvalState}
const run=promisify(execFile),here=dirname(fileURLToPath(import.meta.url)),repo=resolve(here,'../..'),load=async f=>JSON.parse(await readFile(f,'utf8'))
export const scope={milestone:'shipping_tariff_drafts',schema:'90 to 91',database_writes:true,business_import:false,payment_availability_change:false,runtime_change:false,caddy_change:false,provider_calls:false,public_checkout:false,signup:false}
const save=(f,v)=>writeFile(f,JSON.stringify(v,null,2)+'\n',{flag:'wx',mode:0o600})
const cleanEnv=()=>({PATH:dirname(process.execPath)+':/usr/local/bin:/usr/bin:/bin',HOME:process.env.HOME,LANG:'C',NODE_ENV:'production'})
const exited=c=>new Promise((res,rej)=>{c.once('error',rej);c.once('close',res)})
export function argumentsFor(args){
 if(args.length===3&&args[0]==='prepare')return{mode:'prepare',spec:resolve(args[1]),directory:resolve(args[2])}
 if(args.length===2&&args[0]==='check')return{mode:'check',plan:resolve(args[1])}
 if(args.length===4&&args[0]==='apply'&&args[2]==='--approved'&&/^[a-f0-9]{64}$/.test(args[3]))return{mode:'apply',plan:resolve(args[1]),approval:args[3]}
 throw Error('Use prepare SPEC NEW_DIRECTORY, check PLAN, or apply PLAN --approved EXACT_DIGEST')
}
const shell=s=>"'"+String(s).replaceAll("'","'\\''")+"'"
function sshArgs(t){assert.match(t.host,/^[a-zA-Z0-9.-]+$/);return ['-T','-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','-o','HostKeyAlgorithms=ssh-ed25519','-o','UserKnownHostsFile='+t.known_hosts,'-o','ConnectionAttempts=1','-o','ConnectTimeout=12','-o','ServerAliveInterval=10','-o','ServerAliveCountMax=2','-o','ControlMaster=no','-i',t.identity]}
export function remoteCommand(){return 'python3 -c '+shell('import sys,json; q=json.load(sys.stdin); sys.argv=["shipping-tariff-remote.py",q["mode"],json.dumps(q)]; exec(compile(q["source"],"shipping-tariff-remote.py","exec"))')}
export async function remote(plan,mode,{approved=null,database=null}={}){
 if(!['inspect','assets','recovery'].includes(mode))assert.equal(approved,plan.seal,'No implicit remote mutation')
 const child=spawn('ssh',[...sshArgs(plan.target),'root@'+plan.target.host,remoteCommand()],{env:cleanEnv(),stdio:['pipe','pipe','pipe'],timeout:180000})
 child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({source:await readFile(here+'/remote.py','utf8'),plan,mode,approved,database}))
 const output=[];let size=0;child.stdout.on('data',b=>{size+=b.length;if(size>128*1024*1024)child.kill('SIGTERM');else output.push(b)});child.stderr.resume()
 assert.equal(await exited(child),0,'Pinned remote '+mode+' failed; preserve evidence, no retry');assert.ok(size<=128*1024*1024)
 return JSON.parse(Buffer.concat(output))
}
export async function toolHashes(){
 const names=(await run('git',['ls-files','scripts'],{cwd:repo})).stdout.trim().split('\n').filter(n=>/\.(mjs|py)$/.test(n))
 names.push('scripts/shipping-tariff-release/operator.mjs','scripts/shipping-tariff-release/database.mjs','scripts/shipping-tariff-release/remote.py','tests/shipping-tariff-release.test.mjs','tests/shipping_tariff_release_test.py','docs/operations/backup-envelope.mjs')
 return Object.fromEntries(await Promise.all([...new Set(names)].sort().map(async f=>[f,hash(await readFile(repo+'/'+f))])))
}
async function applicationInputs(commit){
 const roots=['app','server','public','i18n','package.json','package-lock.json','nuxt.config.ts','tsconfig.json']
 await run('git',['diff','--quiet',commit,'--',...roots],{cwd:repo})
 const names=(await run('git',['ls-tree','-r','--name-only',commit,'--',...roots],{cwd:repo,maxBuffer:8e6})).stdout.trim().split('\n').sort()
 const actual=(await run('git',['ls-files','--cached','--others','--exclude-standard','--',...roots],{cwd:repo,maxBuffer:8e6})).stdout.trim().split('\n').sort();assert.deepEqual(actual,names)
 return Object.fromEntries(await Promise.all(names.map(async n=>[n,hash(await readFile(repo+'/'+n))])))
}
async function authState(t){const c=await load(t.credentials_file),r=await fetch('https://'+t.project_ref+'.supabase.co/auth/v1/settings',{headers:{apikey:c.anon_key},signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);const v=await r.json();assert.equal(v.disable_signup,true);assert.equal(v.mailer_autoconfirm,false);return {disable_signup:true,mailer_autoconfirm:false}}
export async function databaseState(t,release,{after=false}={}){const db=await connect(t);try{await db.query('begin isolation level repeatable read read only');const s=await checkDatabase(db,release,{after});assert.equal(s.read_only,'on');await db.query('commit');return s}finally{await db.end()}}
async function artifactState(file,t){
 const a=await load(file),{seal,...body}=a;assert.equal(digest(body),seal);assert.equal(a.format,'shipping-tariff-review/v1');assert.equal(a.result,'SEALED_LOCAL_REVIEW_ARTIFACT');assert.equal(a.proposed_schema,91);assert.equal(a.business_import_in_deployment,false)
 const d=dirname(file);assert.equal(hash(await readFile(d+'/application.tar.gz')),a.archive_sha256);assert.equal(digest(await load(d+'/inventory.json')),a.inventory_sha256)
 const c=await load(t.credentials_file);for(const p of ['readback','source/.output'])assert.equal(digest(await inventory(d+'/'+p,{secrets:[c.database_password,c.service_role_key]})),a.inventory_sha256)
 assert.equal(hash(await readFile(d+'/migration91.sql')),a.migrations[0].sha256);assert.equal(hash(await readFile(d+'/owner-draft.import.json')),a.import_sha256)
 const qFile=resolve(d,'../source-qualification-3.json'),q=await load(qFile);assert.equal(hash(await readFile(qFile)),a.qualification_sha256);assert.equal(q.result,'PASS');assert.equal(q.application_commit,a.application_commit);assert.equal(q.typecheck,'PASS');assert.equal(q.unique_checks,96)
 for(const[f,sha]of Object.entries(q.evidence_sha256))assert.equal(hash(await readFile(f)),sha)
 const smoke=await load(d+'/compiled-smoke.json');assert.equal(hash(await readFile(d+'/compiled-smoke.json')),a.compiled_smoke_sha256);assert.equal(smoke.result,'PASS')
 assert.match(await readFile(d+'/build.log','utf8'),/Build complete!/)
 for(const[f,sha]of Object.entries(a.tools_sha256))assert.equal(hash(await readFile(repo+'/'+f)),sha)
 return a
}
async function verifyBackup(p,w){
 const proof=await load(w+'/backup-verification.json');assert.deepEqual(proof,p.backup_evidence)
 for(const[n,v]of [['database-before.dump',proof.database],['runtime-recovery.tar.gz',proof.runtime]]){
  assert.equal(hash(await readFile(w+'/'+n+'.enc')),v.encryptedSha256)
  const r=JSON.parse((await run(process.execPath,[p.backup.envelope,'verify',p.backup.key,w+'/'+n+'.enc'],{env:cleanEnv(),timeout:180000})).stdout);assert.equal(r.authenticatedDecryption,true);assert.equal(r.plaintextSha256,v.plaintextSha256)
 }
}
async function livePrepared(p,r){assert.deepEqual(stable(await remote(p,'inspect')),stable(p.before));assertPreserved(await databaseState(p.target,r),p.database);assert.deepEqual(await authState(p.target),p.auth);await publicHealth(p)}
export async function prepare(o){
 assert.equal(process.version,'v22.23.1');assert.equal((await run('git',['status','--porcelain'],{cwd:repo})).stdout,'')
 const s=await load(o.spec),accepted=await load(s.accepted_plan),{seal:oldSeal,...old}=accepted;assert.equal(digest(old),oldSeal)
 const a=await artifactState(s.artifact,accepted.target);assert.equal(a.base.seal,oldSeal);assert.equal(a.base.target_sha256,digest(accepted.target));assert.equal(a.base.release,accepted.release_id);assert.equal(a.base.application_commit,accepted.application_commit)
 const r=await migrations(repo,a),app=await applicationInputs(a.application_commit),tools=await toolHashes(),g=await load(s.guard_qualification);assert.equal(g.result,'PASS');assert.equal(g.migration_sha256,r.pending[0].sha256);assert.ok(g.tests>=5)
 for(const[f,sha]of Object.entries(g.evidence_sha256))assert.equal(hash(await readFile(f)),sha)
 const w=o.directory;await mkdir(w,{mode:0o700});const base={target:accepted.target,release_id:'preflight',archive_bytes:0},before=await remote(base,'inspect')
 assert.equal(before.current,accepted.target.root+'/releases/'+accepted.release_id);assert.deepEqual(before.verified,{archive_sha256:accepted.archive_sha256,commit:accepted.application_commit,plan_sha256:oldSeal});assert.deepEqual(before.recovery_files['/etc/caddy/Caddyfile'],accepted.before.recovery_files['/etc/caddy/Caddyfile'])
 const db=await databaseState(accepted.target,r),auth=await authState(accepted.target);assert.deepEqual(db.schema,accepted.database.schema,'Accepted schema90 drift');assert.deepEqual(db.controls,accepted.database.controls)
 await save(w+'/runtime-before.json',before);await save(w+'/database-before.json',db);await save(w+'/auth-before.json',auth);await save(w+'/http-before.json',await publicHealth(base))
 for(const[n,v]of Object.entries(before.assets))assert.equal(hash(await readFile(dirname(s.artifact)+'/readback/public/_nuxt/'+n)),v.sha256,'Sealed artifact must retain every current immutable asset')
 const b=accepted.backup,backup_evidence=await backup({...base,before,backup:b},w)
 const files=[s.artifact,s.guard_qualification,s.accepted_plan,s.specification||o.spec,accepted.target.credentials_file,accepted.target.database.ca_file,accepted.target.identity,accepted.target.known_hosts,b.key,b.envelope,b.pg_dump,dirname(b.pg_dump)+'/pg_restore',dirname(s.artifact)+'/build.log',resolve(dirname(s.artifact),'../source-qualification-3.json')]
 const p={format:9,created_utc:new Date().toISOString(),application_commit:a.application_commit,application_inputs:app,release_id:a.archive_sha256.slice(0,16),archive_sha256:a.archive_sha256,archive_bytes:(await readFile(dirname(s.artifact)+'/application.tar.gz')).length,inventory_sha256:a.inventory_sha256,schema_version:91,database_writes:1,migration_sha256:r.pending[0].sha256,migrations:r.pending.map(({filename,version,name,sha256})=>({filename,version,name,sha256})),artifact:{file:s.artifact,seal:a.seal},guard_qualification:{file:s.guard_qualification,sha256:hash(await readFile(s.guard_qualification))},expected_delta:g.schema_delta,target:accepted.target,before,database:db,database_state_sha256:digest(approvalState(db)),auth,tools,backup:b,backup_evidence,protected_inputs:Object.fromEntries(await Promise.all([...new Set(files)].map(async f=>[f,hash(await readFile(f))]))),scope,automatic_retry:false,automatic_rollback:false,rollback:{application_only:true,previous_release:before.current,preserve_schema:91,preserve_newer_data:true,requires_separate_review:true,automatic:false},accepted_plan:{file:s.accepted_plan,seal:oldSeal}}
 await livePrepared(p,r);assert.deepEqual(await toolHashes(),tools);assert.deepEqual(await applicationInputs(a.application_commit),app)
 p.seal=digest(p);await save(w+'/plan.json',p);console.log(JSON.stringify({result:'PREPARED_FOR_OWNER_REVIEW',seal:p.seal,release:p.release_id,schema_from:90,schema_to:91,retained_assets:Object.keys(before.assets).length,production_writes:0,provider_calls:0,rebuilds:0}))
}
export async function localPrepared(file){
 assert.equal(process.version,'v22.23.1');assert.equal((await run('git',['status','--porcelain'],{cwd:repo})).stdout,'');const p=await load(file),{seal,...body}=p;assert.equal(digest(body),seal);assert.equal(p.format,9);assert.equal(p.schema_version,91);assert.equal(p.database_writes,1);assert.deepEqual(p.scope,scope)
 assert.deepEqual(await toolHashes(),p.tools);assert.deepEqual(await applicationInputs(p.application_commit),p.application_inputs);const a=await artifactState(p.artifact.file,p.target);assert.equal(a.seal,p.artifact.seal);assert.equal(p.archive_sha256,a.archive_sha256);assert.equal(p.inventory_sha256,a.inventory_sha256);assert.equal(p.application_commit,a.application_commit);assert.equal(p.release_id,a.archive_sha256.slice(0,16))
 const r=await migrations(repo,a);assert.deepEqual(p.migrations,r.pending.map(({filename,version,name,sha256})=>({filename,version,name,sha256})));assert.equal(p.migration_sha256,r.pending[0].sha256);assert.equal(p.database_state_sha256,digest(approvalState(p.database)))
 for(const[f,sha]of Object.entries(p.protected_inputs))assert.equal(hash(await readFile(f)),sha)
 const g=await load(p.guard_qualification.file);assert.equal(hash(await readFile(p.guard_qualification.file)),p.guard_qualification.sha256);assert.equal(g.result,'PASS');assert.deepEqual(g.schema_delta,p.expected_delta);for(const[f,sha]of Object.entries(g.evidence_sha256))assert.equal(hash(await readFile(f)),sha)
 const w=dirname(file);await verifyBackup(p,w);for(const n of ['execution-intent.json','STOP.json','completed.json']){try{await access(w+'/'+n);throw Error('Execution already attempted; never repeat')}catch(e){if(e.code!=='ENOENT')throw e}}return{plan:p,release:r,work:w}
}
export async function check(o){const{plan:p,release:r}=await localPrepared(o.plan);await livePrepared(p,r);console.log(JSON.stringify({result:'READ_ONLY_CHECK_PASS',seal:p.seal,release:p.release_id,schema_from:90,schema_to:91,production_writes:0,provider_calls:0}))}
export async function apply(o){
 const{plan:p,release:r,work:w}=await localPrepared(o.plan);assert.equal(o.approval,p.seal,'Exact tariff-only owner approval required')
 await save(w+'/execution-intent.json',{plan_sha256:p.seal,approved_utc:new Date().toISOString(),automatic_retry:false});let phase='preflight';const heartbeat=setInterval(()=>console.log(JSON.stringify({phase,status:'running'})),15000)
 try{
  await livePrepared(p,r);phase='fresh encrypted recovery';await mkdir(w+'/execution',{mode:0o700});await backup(p,w+'/execution')
  phase='remote staging';await save(w+'/remote-prepare.json',await remote(p,'prepare',{approved:p.seal}));const scp=sshArgs(p.target).filter(x=>x!=='-T'),stage='/var/lib/shipping-tariff-releases/'+p.release_id,artifact=dirname(p.artifact.file)
  await run('scp',[...scp,artifact+'/application.tar.gz','root@'+p.target.host+':'+stage+'/release.tar.gz'],{env:cleanEnv(),timeout:180000,maxBuffer:2e6});await run('scp',[...scp,artifact+'/inventory.json','root@'+p.target.host+':'+stage+'/inventory.json'],{env:cleanEnv(),timeout:180000,maxBuffer:2e6})
  for(const step of ['stage','candidate90']){phase=step;await save(w+'/remote-'+step+'.json',await remote(p,step,{approved:p.seal}))}
  phase='migration91';const db=await connect(p.target,{readOnly:false});try{const receipt=await applyMigration(db,r,{approval:o.approval,seal:p.seal,expectedDelta:p.expected_delta,beforeMigration:s=>assertPreserved(s,p.database),beforeCommit:v=>save(w+'/migration-commit-intent.json',v)});await save(w+'/migration-committed.json',receipt)}finally{await db.end()}
  phase='candidate91';await save(w+'/remote-candidate91.json',await remote(p,'candidate91',{approved:p.seal}))
  phase='read-only preactivation preservation';const pre=await databaseState(p.target,r,{after:true});assertPreserved(pre,p.database);assertTariffOnlyDelta(p.database.schema,pre.schema,p.expected_delta);await save(w+'/database-preactivation.json',pre)
  phase='activation';await saveActivationReceipt(w,await remote(p,'activate',{approved:p.seal,database:{plan_sha256:p.seal,schema:91,migration_sha256:p.migration_sha256,preservation:'PASS',read_only:true,migrations_applied:1,business_data_writes:0,state_sha256:digest(approvalState(pre))}}))
  phase='public verification';await save(w+'/http-after.json',await publicHealth(p));assert.deepEqual(await authState(p.target),p.auth)
  const tariffResponse=await fetch(p.target.origin+'/api/admin-shipping/companies/00000000-0000-4000-8000-000000000000/tariffs',{signal:AbortSignal.timeout(15000),redirect:'manual'});assert.equal(tariffResponse.status,401)
  phase='database preservation';const after=await databaseState(p.target,r,{after:true});assertPreserved(after,p.database);assertTariffOnlyDelta(p.database.schema,after.schema,p.expected_delta);await save(w+'/database-after.json',after)
  await save(w+'/completed.json',{result:'PASS',plan:p.seal,release:p.release_id,schema:91,migrations_applied:1,business_data_writes:0,provider_calls:0,rebuilds:0,public_checkout:false,signup:false,completed_utc:new Date().toISOString()});console.log(JSON.stringify({result:'DEPLOY_PASS',seal:p.seal,release:p.release_id,schema:91}))
 }catch(e){await save(w+'/STOP.json',{result:'STOP',phase,error_type:e.name,code:e.code,automatic_retry:false,automatic_rollback:false});throw Error('STOP in '+phase+'. Preserve evidence. No retry or rollback.')}finally{clearInterval(heartbeat)}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{const o=argumentsFor(process.argv.slice(2));await({prepare,check,apply}[o.mode])(o)}catch(e){console.error(JSON.stringify({result:'STOP',error_type:e.name,message:e.message?.startsWith('STOP in ')?e.message:'Tariff release guard failed. Inspect private evidence; no production retry.'}));process.exitCode=1}}
