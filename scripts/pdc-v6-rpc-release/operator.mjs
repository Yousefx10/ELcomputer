#!/usr/bin/env node
import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir,access} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFile,spawn} from 'node:child_process'
import {promisify} from 'node:util'
import {toolHashes as artifactTools} from '../pdc-v6-release/operator.mjs'
import {inventory} from '../publish/inventory.mjs'
import {digest,stable,publicHealth} from '../live-sales-release/operator.mjs'
import {applicationCommit,previousApplicationCommit,hash,migrations,connect,checkDatabase,assertPreserved,applyMigration,approvalState} from './database.mjs'
import {backup,saveActivationReceipt} from '../footer-release/operator.mjs'
export {digest,approvalState}
const run=promisify(execFile),here=dirname(fileURLToPath(import.meta.url)),repo=resolve(here,'../..'),load=async file=>JSON.parse(await readFile(file,'utf8'))
const scope={milestone:'pdc_v6_rpc_access',schema:'89 to 90; two original server RPC grants',database_writes:true,payment_availability_change:false,runtime_change:false,caddy_change:false,provider_calls:false,public_checkout:false,signup:false}
const save=(file,value)=>writeFile(file,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600})
const cleanEnv=()=>({PATH:dirname(process.execPath)+':/usr/local/bin:/usr/bin:/bin',HOME:process.env.HOME,LANG:'C',NODE_ENV:'production'})
const exited=child=>new Promise((res,rej)=>{child.once('error',rej);child.once('close',res)})
export function argumentsFor(args){
  if(args.length===4&&args[0]==='prepare-from-artifact')return {mode:'prepare',candidate:resolve(args[1]),qualification:resolve(args[2]),directory:resolve(args[3])}
  if(args.length===2&&args[0]==='check')return {mode:'check',plan:resolve(args[1])}
  if(args.length===4&&args[0]==='apply'&&args[2]==='--approved'&&/^[a-f0-9]{64}$/.test(args[3]))return {mode:'apply',plan:resolve(args[1]),approval:args[3]}
  throw Error('Use prepare-from-artifact CANDIDATE QUALIFICATION NEW_DIRECTORY, check PLAN, or apply PLAN --approved EXACT_DIGEST')
}
const shell=value=>"'"+String(value).replaceAll("'","'\\''")+"'"
function sshArgs(t){assert.match(t.host,/^[a-zA-Z0-9.-]+$/);return ['-T','-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','-o','HostKeyAlgorithms=ssh-ed25519','-o','UserKnownHostsFile='+t.known_hosts,'-o','ConnectionAttempts=1','-o','ConnectTimeout=12','-o','ServerAliveInterval=10','-o','ServerAliveCountMax=2','-o','ControlMaster=no','-i',t.identity]}
export function remoteCommand(){return 'python3 -c '+shell('import sys,json; q=json.load(sys.stdin); sys.argv=["pdc-v6-rpc-remote.py",q["mode"],json.dumps(q)]; exec(compile(q["source"],"pdc-v6-rpc-remote.py","exec"))')}
async function remoteProcess(plan,mode,{approved=null,database=null}={}){
  if(!['inspect','assets','recovery'].includes(mode))assert.equal(approved,plan.seal,'No implicit remote mutation')
  const child=spawn('ssh',[...sshArgs(plan.target),'root@'+plan.target.host,remoteCommand()],{env:cleanEnv(),stdio:['pipe','pipe','pipe'],timeout:180000})
  child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({source:await readFile(here+'/remote.py','utf8'),plan,mode,approved,database}));return child
}
export async function remote(plan,mode,options={}){
  const child=await remoteProcess(plan,mode,options),output=[],errors=[];let size=0
  child.stdout.on('data',b=>{size+=b.length;if(size>128*1024*1024)child.kill('SIGTERM');else output.push(b)});child.stderr.on('data',b=>errors.push(b))
  const code=await exited(child);assert.equal(code,0,'Pinned remote '+mode+' failed; no retry');assert.ok(size<=128*1024*1024)
  const bytes=Buffer.concat(output);return options.bytes?bytes:JSON.parse(bytes)
}
export async function toolHashes(){return {artifact:await artifactTools(),rpc:Object.fromEntries(await Promise.all(['operator.mjs','database.mjs','remote.py','../../tests/pdc-v6-rpc-release.test.mjs','../../tests/pdc_v6_rpc_release_test.py','../../tests/pdc-lookup-rpc-access.test.mjs'].map(async name=>[name,hash(await readFile(resolve(here,name)))])))}}
async function applicationInputs(){
  const changed=(await run('git',['diff','--name-only',previousApplicationCommit,applicationCommit,'--','app','server','public','i18n','supabase','package.json','package-lock.json','nuxt.config.ts','tsconfig.json'],{cwd:repo})).stdout.trim().split('\n').sort()
  assert.deepEqual(changed,['server/api/admin-shipping/lookups.post.js','server/utils/pdcLookups.js'],'Only the reviewed PDC normalizer and lookup caller may change; preserve all PDP/footer/UI code')
  const names=(await run('git',['ls-tree','-r','--name-only',applicationCommit],{cwd:repo,maxBuffer:8e6})).stdout.trim().split('\n').filter(n=>/^(app|server|public|i18n)\//.test(n)||['package.json','package-lock.json','nuxt.config.ts','tsconfig.json'].includes(n))
  const inputs={};for(const name of names){const bytes=await readFile(repo+'/'+name),pinned=(await run('git',['show',applicationCommit+':'+name],{cwd:repo,encoding:'buffer',maxBuffer:8e6})).stdout;assert.equal(hash(bytes),hash(pinned),'Unapproved application change: '+name);inputs[name]=hash(bytes)}
  const actual=(await run('git',['ls-files','--cached','--others','--exclude-standard'],{cwd:repo,maxBuffer:8e6})).stdout.trim().split('\n').filter(n=>/^(app|server|public|i18n)\//.test(n)||['package.json','package-lock.json','nuxt.config.ts','tsconfig.json'].includes(n));assert.deepEqual(actual.sort(),names.sort())
  return inputs
}
async function authState(target){const c=await load(target.credentials_file),r=await fetch('https://'+target.project_ref+'.supabase.co/auth/v1/settings',{headers:{apikey:c.anon_key},signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);const v=await r.json();assert.equal(v.disable_signup,true);assert.equal(v.mailer_autoconfirm,false);return {disable_signup:true,mailer_autoconfirm:false}}
export async function databaseState(target,release,{after=false}={}){const db=await connect(target);try{await db.query('begin isolation level repeatable read read only');assert.equal((await db.query('show transaction_read_only')).rows[0].transaction_read_only,'on');const s=await checkDatabase(db,release,{after});await db.query('commit');return s}finally{await db.end()}}
async function qualification(file,archive,inventoryHash){
 const q=await load(file);assert.equal(q.result,'PASS');assert.equal(q.application_commit,applicationCommit);assert.equal(q.archive_sha256,archive);assert.equal(q.typecheck,'PASS');assert.equal(q.build,'PASS');assert.ok(q.pdc_tests>=161);assert.ok(q.dashboard_checks>=499);assert.equal(q.rpc_access_tests,'PASS');assert.equal(q.release_guard_tests,'PASS')
 const r=await load(q.artifact_replay_report);assert.equal(r.result,'PASS');assert.ok(r.checks>=20);assert.equal(r.archive_sha256,archive);assert.equal(r.inventory_sha256,inventoryHash);assert.equal(r.provider_requests,0);assert.equal(r.hosted_connections,0)
 for(const[f,sha]of Object.entries(q.evidence_sha256))assert.equal(hash(await readFile(f)),sha)
 assert.equal(q.evidence_sha256[q.artifact_replay_report],hash(await readFile(q.artifact_replay_report)));return q
}
async function verifyArtifact(plan){
 const artifact=plan.artifact_directory;assert.equal(hash(await readFile(artifact+'/release.tar.gz')),plan.archive_sha256);assert.equal(digest(await load(artifact+'/inventory.json')),plan.inventory_sha256)
 const c=await load(plan.target.credentials_file);for(const output of ['archive-readback','build-source/.output'])assert.equal(digest(await inventory(artifact+'/'+output,{secrets:[c.database_password,c.service_role_key]})),plan.inventory_sha256)
 const proof=await load(artifact+'/backup-verification.json');assert.deepEqual(proof,plan.backup_evidence)
 for(const[name,value]of [['database-before.dump',proof.database],['runtime-recovery.tar.gz',proof.runtime]]){assert.equal(hash(await readFile(artifact+'/'+name+'.enc')),value.encryptedSha256);const verified=JSON.parse((await run(process.execPath,[plan.backup.envelope,'verify',plan.backup.key,artifact+'/'+name+'.enc'],{env:cleanEnv(),timeout:180000})).stdout);assert.equal(verified.authenticatedDecryption,true);assert.equal(verified.plaintextSha256,value.plaintextSha256)}
}
async function livePrepared(plan,release){assert.deepEqual(stable(await remote(plan,'inspect')),stable(plan.before));assertPreserved(await databaseState(plan.target,release),plan.database);assert.deepEqual(await authState(plan.target),plan.auth);await publicHealth(plan)}
export async function prepare(options){
 assert.equal(process.version,'v22.23.1');assert.equal((await run('git',['status','--porcelain'],{cwd:repo})).stdout,'')
 const candidate=await load(options.candidate),{seal:artifactSeal,...body}=candidate;assert.equal(candidate.format,0);assert.equal(digest(body),artifactSeal);assert.equal(candidate.application_commit,applicationCommit);assert.deepEqual(await artifactTools(),candidate.tools);assert.deepEqual(await applicationInputs(),candidate.application_inputs)
 const artifact=dirname(options.candidate),release=await migrations(repo),q=await qualification(options.qualification,candidate.archive_sha256,candidate.inventory_sha256);assert.equal(q.migration_sha256,release.pending[0].sha256)
 const provisional={...candidate,artifact_directory:artifact};await verifyArtifact(provisional);await livePrepared(provisional,release)
 const database=await databaseState(candidate.target,release);assertPreserved(database,candidate.database);const tools=await toolHashes(),work=options.directory;await mkdir(work,{mode:0o700})
 const plan={...body,format:6,created_utc:new Date().toISOString(),schema_version:90,database_writes:1,migration_sha256:release.pending[0].sha256,migrations:release.pending.map(({filename,version,name,sha256})=>({filename,version,name,sha256})),scope,tools,database,database_state_sha256:digest(approvalState(database)),artifact_directory:artifact,artifact_candidate:{file:options.candidate,sha256:hash(await readFile(options.candidate)),seal:artifactSeal},qualification:{file:options.qualification,sha256:hash(await readFile(options.qualification))},rollback:{application_only:true,previous_release:candidate.before.current,preserve_schema:90,preserve_newer_data:true,requires_separate_review:true,automatic:false}}
 plan.protected_inputs={...plan.protected_inputs,[options.qualification]:plan.qualification.sha256,[options.candidate]:plan.artifact_candidate.sha256};plan.seal=digest(plan);await save(work+'/plan.json',plan)
 console.log(JSON.stringify({result:'PREPARED_FOR_OWNER_REVIEW',seal:plan.seal,release:plan.release_id,schema_from:89,schema_to:90,provider_calls:0,production_writes:0}))
}
async function localPrepared(file){
 assert.equal(process.version,'v22.23.1');assert.equal((await run('git',['status','--porcelain'],{cwd:repo})).stdout,'');const plan=await load(file),{seal,...body}=plan;assert.equal(digest(body),seal);assert.equal(plan.format,6);assert.equal(plan.application_commit,applicationCommit);assert.equal(plan.schema_version,90);assert.equal(plan.database_writes,1);assert.deepEqual(plan.scope,scope)
 assert.deepEqual(await toolHashes(),plan.tools);assert.deepEqual(await applicationInputs(),plan.application_inputs);const release=await migrations(repo);assert.deepEqual(plan.migrations,release.pending.map(({filename,version,name,sha256})=>({filename,version,name,sha256})));assert.equal(plan.migration_sha256,release.pending[0].sha256)
 assert.deepEqual(plan.database.history,release.history.map(({version,name})=>({version,name})));assert.equal(plan.database_state_sha256,digest(approvalState(plan.database)))
 for(const[f,sha]of Object.entries(plan.protected_inputs))assert.equal(hash(await readFile(f)),sha)
 await verifyArtifact(plan);const q=await qualification(plan.qualification.file,plan.archive_sha256,plan.inventory_sha256);assert.equal(q.migration_sha256,release.pending[0].sha256)
 const work=dirname(file);for(const name of ['execution-intent.json','STOP.json','completed.json']){try{await access(work+'/'+name);throw Error('Execution already attempted; never repeat')}catch(e){if(e.code!=='ENOENT')throw e}}return{plan,release,work}
}
export async function check(options){const{plan,release}=await localPrepared(options.plan);await livePrepared(plan,release);console.log(JSON.stringify({result:'READ_ONLY_CHECK_PASS',seal:plan.seal,release:plan.release_id,schema_from:89,schema_to:90,production_writes:0}))}
export async function apply(options){
 const{plan,release,work}=await localPrepared(options.plan);assert.equal(options.approval,plan.seal,'Separate final owner approval of the RPC-grant release required')
 await save(work+'/execution-intent.json',{plan_sha256:plan.seal,approved_utc:new Date().toISOString(),automatic_retry:false});let phase='preflight';const heartbeat=setInterval(()=>console.log(JSON.stringify({phase,status:'running'})),15000)
 try{
  await livePrepared(plan,release);phase='fresh encrypted recovery';await mkdir(work+'/execution',{mode:0o700});await backup(plan,work+'/execution')
  phase='remote staging';await save(work+'/remote-prepare.json',await remote(plan,'prepare',{approved:plan.seal}));const scp=sshArgs(plan.target).filter(x=>!['-T','-n'].includes(x)),stage='/var/lib/pdc-v6-rpc-releases/'+plan.release_id
  await run('scp',[...scp,plan.artifact_directory+'/release.tar.gz',plan.artifact_directory+'/inventory.json','root@'+plan.target.host+':'+stage+'/'],{env:cleanEnv(),timeout:180000,maxBuffer:2e6})
  for(const step of ['stage','candidate89']){phase=step;await save(work+'/remote-'+step+'.json',await remote(plan,step,{approved:plan.seal}))}
  phase='two RPC grants';const db=await connect(plan.target,{readOnly:false});try{const receipt=await applyMigration(db,release,{approval:options.approval,seal:plan.seal,beforeMigration:state=>assertPreserved(state,plan.database),beforeCommit:receipt=>save(work+'/migration-commit-intent.json',receipt)});await save(work+'/migration-committed.json',receipt)}finally{await db.end()}
  phase='candidate90';await save(work+'/remote-candidate90.json',await remote(plan,'candidate90',{approved:plan.seal}))
  phase='read-only preactivation preservation';const before=await databaseState(plan.target,release,{after:true});assertPreserved(before,plan.database);await save(work+'/database-preactivation.json',before)
  phase='activation';await saveActivationReceipt(work,await remote(plan,'activate',{approved:plan.seal,database:{plan_sha256:plan.seal,schema:90,migration_sha256:plan.migration_sha256,preservation:'PASS',read_only:true,migrations_applied:1,state_sha256:digest(approvalState(before))}}))
  phase='public verification';await save(work+'/http-after.json',await publicHealth(plan));assert.deepEqual(await authState(plan.target),plan.auth)
  phase='database preservation';const after=await databaseState(plan.target,release,{after:true});assertPreserved(after,plan.database);await save(work+'/database-after.json',after)
  await save(work+'/completed.json',{result:'PASS',plan:plan.seal,release:plan.release_id,schema:90,migrations_applied:1,business_data_writes:0,provider_calls:0,public_checkout:false,signup:false,completed_utc:new Date().toISOString()});console.log(JSON.stringify({result:'DEPLOY_PASS',seal:plan.seal,release:plan.release_id,schema:90}))
 }catch(e){await save(work+'/STOP.json',{result:'STOP',phase,error_type:e.name,code:e.code,automatic_retry:false,automatic_rollback:false});throw Error('STOP in '+phase+'. Preserve evidence. No retry or rollback.')}finally{clearInterval(heartbeat)}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{const o=argumentsFor(process.argv.slice(2));await({prepare,check,apply}[o.mode])(o)}catch(e){console.error(JSON.stringify({result:'STOP',error_type:e.name,message:e.message?.startsWith('STOP in ')?e.message:'PDC RPC release guard failed; no production retry. Inspect private evidence.'}));process.exitCode=1}}
