#!/usr/bin/env node
import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir,readdir,lstat,chmod,access,cp} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFile,spawn} from 'node:child_process'
import {promisify} from 'node:util'
import {create as tarCreate} from 'tar'
import {retainClientAssets} from '../premium-product-finishing-release/assets.mjs'
import {inventory} from '../publish/inventory.mjs'
import {digest,stable,approvalState,publicHealth,validateAssets} from '../live-sales-release/operator.mjs'
import {applicationCommit,previousApplicationCommit,hash,migrations,connect,checkDatabase,assertPreserved} from './database.mjs'
import {backup,saveActivationReceipt} from '../footer-release/operator.mjs'
export {digest,approvalState}
const run=promisify(execFile),here=dirname(fileURLToPath(import.meta.url)),repo=resolve(here,'../..'),load=async file=>JSON.parse(await readFile(file,'utf8'))
const scope={milestone:'controlled_purchase',schema:'90 unchanged',database_writes:false,payment_availability_change:false,runtime_change:false,caddy_change:false,provider_calls:false,public_checkout:false,signup:false}
const save=(file,value)=>writeFile(file,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600})
const cleanEnv=()=>({PATH:dirname(process.execPath)+':/usr/local/bin:/usr/bin:/bin',HOME:process.env.HOME,LANG:'C',NODE_ENV:'production'})
const exited=child=>new Promise((res,rej)=>{child.once('error',rej);child.once('close',res)})
export const createReleaseArchive=(build,file)=>tarCreate({cwd:build,file,gzip:true,portable:true,noMtime:true,follow:false,onWriteEntry:entry=>{if(entry.type==='SymbolicLink')entry.stat.mode=(entry.stat.mode&~0o7777)|0o755}},['.output'])
export function argumentsFor(args){
  if(args.length===3&&args[0]==='prepare')return {mode:'prepare',spec:resolve(args[1]),directory:resolve(args[2])}
  if(args.length===3&&args[0]==='seal')return {mode:'seal',candidate:resolve(args[1]),qualification:resolve(args[2])}
  if(args.length===2&&args[0]==='check')return {mode:'check',plan:resolve(args[1])}
  if(args.length===4&&args[0]==='apply'&&args[2]==='--approved'&&/^[a-f0-9]{64}$/.test(args[3]))return {mode:'apply',plan:resolve(args[1]),approval:args[3]}
  throw Error('Use prepare SPEC NEW_DIRECTORY, seal CANDIDATE QUALIFICATION, check PLAN, or apply PLAN --approved EXACT_DIGEST')
}
const shell=value=>"'"+String(value).replaceAll("'","'\\''")+"'"
function sshArgs(t){assert.match(t.host,/^[a-zA-Z0-9.-]+$/);return ['-T','-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','-o','HostKeyAlgorithms=ssh-ed25519','-o','UserKnownHostsFile='+t.known_hosts,'-o','ConnectionAttempts=1','-o','ConnectTimeout=12','-o','ServerAliveInterval=10','-o','ServerAliveCountMax=2','-o','ControlMaster=no','-i',t.identity]}
export function remoteCommand(){return 'python3 -c '+shell('import sys,json; q=json.load(sys.stdin); sys.argv=["controlled-purchase-remote.py",q["mode"],json.dumps(q)]; exec(compile(q["source"],"controlled-purchase-remote.py","exec"))')}
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
export async function toolHashes(){return Object.fromEntries(await Promise.all(['operator.mjs','database.mjs','remote.py','../premium-product-finishing-release/assets.mjs','../pdc-v6-rpc-release/database.mjs','../footer-release/operator.mjs','../footer-release/database.mjs','../live-sales-release/operator.mjs','../live-sales-release/auth.mjs','../commerce-release/database.mjs','../clean-reinstall/deploy.py','../publish/inventory.mjs','../publish/contracts.mjs','../lib/cleanBaseline.mjs','../../tests/controlled-purchase.test.mjs','../../tests/controlled-purchase-ui.test.mjs','../../tests/controlled-purchase-access.test.py','../controlled-purchase-access/prepare.py','../../tests/controlled-purchase-release.test.mjs','../../tests/controlled_purchase_release_test.py','../../docs/operations/backup-envelope.mjs'].map(async name=>[name,hash(await readFile(resolve(here,name)))])))}
async function applicationInputs(){
  // Schema90 postdates the deployed application commit. Its exact90 SQL files
  // are verified separately by migrations(); this delta covers application code.
  const changed=(await run('git',['diff','--name-only',previousApplicationCommit,applicationCommit,'--','app','server','public','i18n','package.json','package-lock.json','nuxt.config.ts','tsconfig.json'],{cwd:repo})).stdout.trim().split('\n').sort()
  assert.deepEqual(changed,['app/pages/account/controlled-purchase.vue','i18n/locales/ar.json','i18n/locales/en.json','nuxt.config.ts','server/api/checkout/controlled.get.js','server/api/checkout/controlled.post.js','server/utils/controlledPurchase.js','server/utils/payments/index.js','server/utils/payments/paymob.js'],'Only the reviewed controlled purchase inputs may change; preserve PDC, catalog, PDP, footers, Auth and schema')
  const names=(await run('git',['ls-tree','-r','--name-only',applicationCommit],{cwd:repo,maxBuffer:8e6})).stdout.trim().split('\n').filter(n=>/^(app|server|public|i18n)\//.test(n)||['package.json','package-lock.json','nuxt.config.ts','tsconfig.json'].includes(n))
  const inputs={};for(const name of names){const bytes=await readFile(repo+'/'+name),pinned=(await run('git',['show',applicationCommit+':'+name],{cwd:repo,encoding:'buffer',maxBuffer:8e6})).stdout;assert.equal(hash(bytes),hash(pinned),'Unapproved application change: '+name);inputs[name]=hash(bytes)}
  const actual=(await run('git',['ls-files','--cached','--others','--exclude-standard'],{cwd:repo,maxBuffer:8e6})).stdout.trim().split('\n').filter(n=>/^(app|server|public|i18n)\//.test(n)||['package.json','package-lock.json','nuxt.config.ts','tsconfig.json'].includes(n));assert.deepEqual(actual.sort(),names.sort())
  return inputs
}
export async function reuseReviewedBuild(spec,app,build,work){
    const original=resolve(spec.reuse_build.directory);assert.equal(spec.reuse_build.application_commit,applicationCommit)
    assert.equal(hash(await readFile(dirname(original)+'/source.tar')),hash(await readFile(work+'/source.tar')),'Reused source archive must be the exact application commit')
    for(const [name,sha]of Object.entries(app))assert.equal(hash(await readFile(original+'/'+name)),sha,'Reused build source changed')
    assert.equal(digest(await inventory(original+'/.output')),spec.reuse_build.inventory_sha256,'Reused output changed')
    assert.match(await readFile(dirname(original)+'/build.log','utf8'),/Build complete!/)
    await cp(original+'/.output',build+'/.output',{recursive:true,verbatimSymlinks:true,errorOnExist:true,force:false})
    assert.equal(digest(await inventory(build+'/.output')),spec.reuse_build.inventory_sha256)
    await save(work+'/build-reuse.json',{application_commit:applicationCommit,original,inventory_sha256:spec.reuse_build.inventory_sha256,source_archive_sha256:hash(await readFile(work+'/source.tar')),build_log_sha256:hash(await readFile(dirname(original)+'/build.log')),npm_ci_log_sha256:hash(await readFile(dirname(original)+'/npm-ci.log')),rebuilds:0})
}
async function logged(command,args,cwd,file,{timeout=600000,env=cleanEnv()}={}){
  const child=spawn(command,args,{cwd,env,stdio:['ignore','pipe','pipe'],timeout}),chunks=[];child.stdout.on('data',b=>chunks.push(b));child.stderr.on('data',b=>chunks.push(b));const code=await exited(child)
  await writeFile(file,Buffer.concat(chunks),{flag:'wx',mode:0o600});assert.equal(code,0,'Local log retained: '+file)
}
async function authState(target){const c=await load(target.credentials_file),r=await fetch('https://'+target.project_ref+'.supabase.co/auth/v1/settings',{headers:{apikey:c.anon_key},signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);const v=await r.json();assert.equal(v.disable_signup,true);assert.equal(v.mailer_autoconfirm,false);return {disable_signup:true,mailer_autoconfirm:false}}
export async function databaseState(target,release){const db=await connect(target);try{await db.query('begin isolation level repeatable read read only');const s=await checkDatabase(db,release);await db.query('commit');return s}finally{await db.end()}}
export async function prepare(options){
  assert.equal(process.version,'v22.23.1');assert.equal((await run('git',['status','--porcelain'],{cwd:repo})).stdout,'');const spec=await load(options.spec);assert.equal(spec.application_commit,applicationCommit);const work=options.directory;await mkdir(work,{mode:0o700})
  const tools=await toolHashes(),release=await migrations(repo),app=await applicationInputs(),base={target:spec.target,release_id:'preflight',archive_bytes:0}
  const before=await remote(base,'inspect');assert.equal(before.current,spec.target.root+'/releases/'+spec.expected_release);assert.equal(before.recovery_files['/etc/caddy/Caddyfile'].sha256,spec.expected_caddy_sha256)
  const accepted=await load(spec.accepted_release_plan),{seal:acceptedSeal,...acceptedBody}=accepted;assert.equal(digest(acceptedBody),acceptedSeal);assert.equal(hash(await readFile(spec.accepted_release_archive)),accepted.archive_sha256);assert.equal(before.verified.archive_sha256,accepted.archive_sha256);assert.deepEqual(spec.target,accepted.target);assert.equal(accepted.application_commit,previousApplicationCommit);assert.equal(before.verified.commit,accepted.application_commit);assert.equal(before.verified.plan_sha256,acceptedSeal)
  await save(work+'/runtime-before.json',before);const database=await databaseState(spec.target,release),auth=await authState(spec.target)
  assert.equal(hash(await readFile(spec.accepted_receipt)),spec.accepted_receipt_sha256);const acceptedReceipt=await load(spec.accepted_receipt);assert.equal(acceptedReceipt.release,spec.expected_release);assert.equal(acceptedReceipt.schema,90);assert.equal(hash(await readFile(spec.accepted_schema_receipt)),acceptedReceipt.evidence_sha256[spec.accepted_schema_receipt]);assert.deepEqual(database.schema,(await load(spec.accepted_schema_receipt)).schema,'Schema90 changed since accepted deployment');await save(work+'/database-before.json',database);await save(work+'/auth-before.json',auth);await save(work+'/http-before.json',await publicHealth(base))
  const backup_evidence=await backup({...base,before,backup:spec.backup},work)
  const assets=await remote({...base,before},'assets',{bytes:true});await writeFile(work+'/retained-assets.tar.gz',assets,{flag:'wx',mode:0o600});await validateAssets(work+'/retained-assets.tar.gz')
  const build=work+'/build-source';await mkdir(build,{mode:0o700});await logged('git',['archive','--format=tar','--output='+work+'/source.tar',applicationCommit],repo,work+'/source-archive.log');await logged('tar',['-xf',work+'/source.tar','-C',build],repo,work+'/source-extract.log')
  await mkdir(build+'/public',{recursive:true});await logged('tar',['-xzf',work+'/retained-assets.tar.gz','-C',build+'/public'],repo,work+'/retained-assets-extract.log')
  assert.equal((await run(process.execPath,[spec.npm_cli,'--version'],{env:cleanEnv()})).stdout.trim(),'10.9.8');await writeFile(work+'/empty.env','',{flag:'wx',mode:0o600})
  if(spec.reuse_build){
    await reuseReviewedBuild(spec,app,build,work)
  }else{
    await logged(process.execPath,[spec.npm_cli,'ci','--no-audit','--no-fund'],build,work+'/npm-ci.log');assert.equal(hash(await readFile(build+'/package-lock.json')),app['package-lock.json'])
    await logged(process.execPath,[build+'/node_modules/nuxt/bin/nuxt.mjs','build','--dotenv',work+'/empty.env'],build,work+'/build.log')
  }
  const output=build+'/.output',retained=work+'/retained-readback';await mkdir(retained,{mode:0o700});await logged('tar',['-xzf',work+'/retained-assets.tar.gz','-C',retained],repo,work+'/retained-readback.log');await retainClientAssets(retained+'/_nuxt',output+'/public/_nuxt',before.assets); async function modes(path){const s=await lstat(path);if(s.isSymbolicLink())return;if(s.isDirectory()){await chmod(path,0o755);for(const n of await readdir(path))await modes(path+'/'+n)}else await chmod(path,0o644)}await modes(output)
  const c=await load(spec.target.credentials_file),entries=await inventory(output,{secrets:[c.database_password,c.service_role_key]})
  for(const[path,value]of Object.entries(before.assets))assert.equal(hash(await readFile(output+'/public/_nuxt/'+path)),value.sha256,'Retained client asset lost')
  await save(work+'/inventory.json',entries);await createReleaseArchive(build,work+'/release.tar.gz');await chmod(work+'/release.tar.gz',0o600)
  const readbackScript='import importlib.util,json,sys,pathlib; s=importlib.util.spec_from_file_location("extractor",sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);m.extract_release(sys.argv[2],pathlib.Path(sys.argv[3]),json.loads(pathlib.Path(sys.argv[4]).read_text()));print("PASS")'
  await logged('python3',['-B','-c',readbackScript,resolve(here,'../clean-reinstall/deploy.py'),work+'/release.tar.gz',work+'/archive-readback',work+'/inventory.json'],repo,work+'/archive-readback.log')
  assert.equal(digest(await inventory(work+'/archive-readback')),digest(entries));assert.deepEqual(await toolHashes(),tools)
  const qualification=await load(spec.qualification_file);assert.equal(qualification.result,'PASS');assert.equal(qualification.application_commit,applicationCommit);assert.ok(qualification.controlled_tests>=14);assert.ok(qualification.paymob_regression_tests>=27);assert.equal(qualification.regression_qualification,'PASS_NO_NEW_FUNCTIONAL_BLOCKERS');assert.equal(qualification.typecheck,'PASS');assert.equal(qualification.build,'REQUIRED_DURING_PREPARE')
  for(const[file,sha]of Object.entries(qualification.evidence_sha256))assert.equal(hash(await readFile(file)),sha)
  assert.deepEqual(await applicationInputs(),app);const after=await remote(base,'inspect');assert.deepEqual(stable(after),stable(before))
  const afterDb=await databaseState(spec.target,release);assertPreserved(afterDb,database,approvalState);assert.deepEqual(await authState(spec.target),auth)
  await save(work+'/runtime-after.json',after);await save(work+'/database-after-preparation.json',afterDb)
  const archive=await readFile(work+'/release.tar.gz'),protectedFiles=[spec.target.credentials_file,spec.target.database.ca_file,spec.target.identity,spec.target.known_hosts,spec.backup.key,spec.qualification_file,spec.accepted_release_plan,spec.accepted_release_archive,spec.accepted_receipt,spec.accepted_schema_receipt,spec.backup.pg_dump,dirname(spec.backup.pg_dump)+'/pg_restore',spec.npm_cli]
  const plan={format:0,created_utc:new Date().toISOString(),application_commit:applicationCommit,application_inputs:app,release_id:hash(archive).slice(0,16),archive_sha256:hash(archive),archive_bytes:archive.length,inventory_sha256:digest(entries),schema_version:90,database_writes:0,migration_sha256:release.history.at(-1).sha256,presentation_style:database.presentation_style,product_probe_paths:spec.product_probe_paths,product_probe_ids:spec.product_probe_ids,migrations:[],target:spec.target,before,database,database_state_sha256:digest(approvalState(database)),auth,tools,qualification:{file:spec.qualification_file,sha256:hash(await readFile(spec.qualification_file))},accepted_release:{application_commit:accepted.application_commit,archive_sha256:accepted.archive_sha256,plan_sha256:acceptedSeal},archive_readback:{result:'PASS',entries:entries.length},backup:spec.backup,backup_evidence,retained_assets_sha256:hash(assets),protected_inputs:Object.fromEntries(await Promise.all(protectedFiles.map(async file=>[file,hash(await readFile(file))]))),scope,automatic_retry:false,automatic_rollback:false}
  plan.seal=digest(plan);await save(work+'/candidate-plan.json',plan);console.log(JSON.stringify({result:'ARTIFACT_READY_FOR_CONTROLLED_PURCHASE_QUALIFICATION',seal:plan.seal,release:plan.release_id,entries:entries.length,retained_assets:Object.keys(before.assets).length,production_writes:0}))
}
export async function seal(options) {
 const file=options.candidate,work=dirname(file),candidate=await load(file),{seal:oldSeal,...body}=candidate
 assert.equal(digest(body),oldSeal);assert.equal(candidate.format,0);assert.equal(candidate.application_commit,applicationCommit)
 assert.deepEqual(await toolHashes(),candidate.tools);assert.deepEqual(await applicationInputs(),candidate.application_inputs)
 assert.equal(hash(await readFile(work+'/release.tar.gz')),candidate.archive_sha256)
 assert.equal(digest(await inventory(work+'/archive-readback')),candidate.inventory_sha256)
 const qualification=await load(options.qualification);assert.equal(qualification.result,'PASS');assert.equal(qualification.application_commit,applicationCommit);assert.equal(qualification.archive_sha256,candidate.archive_sha256)
 assert.ok(qualification.compiled_controlled_checks>=8);assert.equal(qualification.typecheck,'PASS');assert.equal(qualification.build,'PASS');assert.equal(qualification.regression_qualification,'PASS_NO_NEW_FUNCTIONAL_BLOCKERS');assert.equal(qualification.release_guard_tests,'PASS')
 for(const [file,sha]of Object.entries(qualification.evidence_sha256))assert.equal(hash(await readFile(file)),sha)
 const release=await migrations(repo);await livePrepared(candidate,release)
 const plan={...body,format:8,qualification:{file:options.qualification,sha256:hash(await readFile(options.qualification))},rollback:{application_only:true,previous_release:candidate.before.current,previous_verified:candidate.before.verified,preserve_schema:90,preserve_newer_data:true,requires_separate_review:true,automatic:false}}
 plan.protected_inputs={...plan.protected_inputs,[options.qualification]:hash(await readFile(options.qualification))};plan.seal=digest(plan)
 await save(work+'/plan.json',plan);console.log(JSON.stringify({result:'PREPARED_FOR_OWNER_REVIEW',seal:plan.seal,release:plan.release_id,schema:90,database_writes:0}))
}
async function localPrepared(file,{clean=false}={}){
  assert.equal(process.version,'v22.23.1');const plan=await load(file),{seal,...body}=plan;assert.equal(digest(body),seal);assert.equal(plan.application_commit,applicationCommit);assert.deepEqual(plan.scope,scope)
  assert.deepEqual(await toolHashes(),plan.tools);assert.deepEqual(await applicationInputs(),plan.application_inputs);assert.equal(plan.format,8);assert.equal(plan.schema_version,90);assert.equal(plan.database_writes,0);assert.deepEqual(plan.migrations,[]);assert.equal(plan.database_state_sha256,digest(approvalState(plan.database)))
  if(clean)assert.equal((await run('git',['status','--porcelain'],{cwd:repo})).stdout,'')
  const work=dirname(file),release=await migrations(repo);assert.deepEqual(release.history.map(({version,name})=>({version,name})),plan.database.history)
  for(const[file,digest]of Object.entries(plan.protected_inputs))assert.equal(hash(await readFile(file)),digest)
  assert.equal(hash(await readFile(work+'/release.tar.gz')),plan.archive_sha256);assert.equal(digest(await load(work+'/inventory.json')),plan.inventory_sha256)
  const c=await load(plan.target.credentials_file);assert.equal(digest(await inventory(work+'/build-source/.output',{secrets:[c.database_password,c.service_role_key]})),plan.inventory_sha256)
  assert.equal(hash(await readFile(work+'/retained-assets.tar.gz')),plan.retained_assets_sha256);assert.equal(digest(await inventory(work+'/archive-readback')),plan.inventory_sha256);assert.equal(hash(await readFile(plan.qualification.file)),plan.qualification.sha256);const q=await load(plan.qualification.file);for(const[file,sha]of Object.entries(q.evidence_sha256))assert.equal(hash(await readFile(file)),sha)
  const backupProof=await load(work+'/backup-verification.json');assert.deepEqual(backupProof,plan.backup_evidence)
  for(const[name,proof]of [['database-before.dump',backupProof.database],['runtime-recovery.tar.gz',backupProof.runtime]]){assert.equal(hash(await readFile(work+'/'+name+'.enc')),proof.encryptedSha256);const result=JSON.parse((await run(process.execPath,[plan.backup.envelope,'verify',plan.backup.key,work+'/'+name+'.enc'],{env:cleanEnv(),timeout:180000})).stdout);assert.equal(result.authenticatedDecryption,true);assert.equal(result.plaintextSha256,proof.plaintextSha256)}
  for(const name of ['execution-intent.json','STOP.json','completed.json']){try{await access(work+'/'+name);throw Error('Execution already attempted; never repeat')}catch(e){if(e.code!=='ENOENT')throw e}}
  return {plan,release,work}
}
async function livePrepared(plan,release){assert.deepEqual(stable(await remote(plan,'inspect')),stable(plan.before));assertPreserved(await databaseState(plan.target,release),plan.database,approvalState);assert.deepEqual(await authState(plan.target),plan.auth);await publicHealth(plan)}
export async function check(options){const {plan,release}=await localPrepared(options.plan,{clean:true});await livePrepared(plan,release);console.log(JSON.stringify({result:'READ_ONLY_CHECK_PASS',seal:plan.seal,release:plan.release_id,production_writes:0}))}
export async function apply(options){
  const {plan,release,work}=await localPrepared(options.plan,{clean:true});assert.equal(options.approval,plan.seal,'Final exact owner approval required')
  await save(work+'/execution-intent.json',{plan_sha256:plan.seal,approved_utc:new Date().toISOString(),automatic_retry:false})
  let phase='preflight';const heartbeat=setInterval(()=>console.log(JSON.stringify({phase,status:'running'})),15000)
  try{
    await livePrepared(plan,release);phase='fresh encrypted recovery';const execution=work+'/execution';await mkdir(execution,{mode:0o700});await backup(plan,execution)
    phase='remote staging';await save(work+'/remote-prepare.json',await remote(plan,'prepare',{approved:plan.seal}));const scp=sshArgs(plan.target).filter(x=>!['-T','-n'].includes(x)),stage='/var/lib/controlled-purchase-releases/'+plan.release_id
    await run('scp',[...scp,work+'/release.tar.gz',work+'/inventory.json','root@'+plan.target.host+':'+stage+'/'],{env:cleanEnv(),timeout:180000,maxBuffer:2e6})
    for(const step of ['stage','candidate90']){phase=step;await save(work+'/remote-'+step+'.json',await remote(plan,step,{approved:plan.seal}))}
    phase='read-only preactivation preservation';const beforeActivation=await databaseState(plan.target,release);assertPreserved(beforeActivation,plan.database,approvalState);await save(work+'/database-preactivation.json',beforeActivation)
    phase='activation';await saveActivationReceipt(work,await remote(plan,'activate',{approved:plan.seal,database:{plan_sha256:plan.seal,schema:90,migration_sha256:plan.migration_sha256,preservation:'PASS',database_writes:0,read_only:true,state_sha256:digest(approvalState(beforeActivation))}}))
    phase='public verification';await save(work+'/http-after.json',await publicHealth(plan));assert.deepEqual(await authState(plan.target),plan.auth)
    phase='database preservation';const afterDatabase=await databaseState(plan.target,release);assert.deepEqual(approvalState(afterDatabase),approvalState(plan.database));await save(work+'/database-after.json',afterDatabase)
    await save(work+'/completed.json',{result:'PASS',plan:plan.seal,release:plan.release_id,schema:90,migrations_applied:0,database_writes:0,completed_utc:new Date().toISOString(),public_checkout:false,signup:false,provider_calls:0});console.log(JSON.stringify({result:'DEPLOY_PASS',seal:plan.seal,release:plan.release_id,schema:90}))
  }catch(e){await save(work+'/STOP.json',{result:'STOP',phase,error_type:e.name,code:e.code,automatic_retry:false,automatic_rollback:false});throw Error('STOP in '+phase+'. Preserve evidence. No retry or rollback.')}finally{clearInterval(heartbeat)}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const o=argumentsFor(process.argv.slice(2));await({prepare,seal,check,apply}[o.mode])(o)}catch(e){console.error(JSON.stringify({result:'STOP',error_type:e.name,message:e.message?.startsWith('STOP in ')?e.message:'Controlled purchase release guard failed; no production retry. Inspect private evidence.'}));process.exitCode=1}
}
