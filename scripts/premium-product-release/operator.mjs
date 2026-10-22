#!/usr/bin/env node
import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir,readdir,lstat,chmod,access} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFile,spawn} from 'node:child_process'
import {promisify} from 'node:util'
import {create as tarCreate} from 'tar'
import {inventory} from '../publish/inventory.mjs'
import {digest,stable,approvalState,publicHealth,validateAssets} from '../live-sales-release/operator.mjs'
import {applicationCommit,previousApplicationCommit,hash,migrations,connect,checkDatabase,applyMigration,assertAdditive,compareOriginal} from './database.mjs'
import {backup,saveActivationReceipt} from '../footer-release/operator.mjs'
export {digest,approvalState}
const run=promisify(execFile),here=dirname(fileURLToPath(import.meta.url)),repo=resolve(here,'../..'),load=async file=>JSON.parse(await readFile(file,'utf8'))
const scope={schema:'88 to 89 additive',database_writes:true,payment_availability_change:false,runtime_change:false,caddy_change:false,provider_calls:false,public_checkout:false,signup:false}
const save=(file,value)=>writeFile(file,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600})
const cleanEnv=()=>({PATH:dirname(process.execPath)+':/usr/local/bin:/usr/bin:/bin',HOME:process.env.HOME,LANG:'C',NODE_ENV:'production'})
const exited=child=>new Promise((res,rej)=>{child.once('error',rej);child.once('close',res)})
export function argumentsFor(args){
  if(args.length===3&&args[0]==='prepare')return {mode:'prepare',spec:resolve(args[1]),directory:resolve(args[2])}
  if(args.length===2&&args[0]==='check')return {mode:'check',plan:resolve(args[1])}
  if(args.length===4&&args[0]==='apply'&&args[2]==='--approved'&&/^[a-f0-9]{64}$/.test(args[3]))return {mode:'apply',plan:resolve(args[1]),approval:args[3]}
  throw Error('Use prepare SPEC NEW_DIRECTORY, check PLAN, or apply PLAN --approved EXACT_DIGEST')
}
const shell=value=>"'"+String(value).replaceAll("'","'\\''")+"'"
function sshArgs(t){assert.match(t.host,/^[a-zA-Z0-9.-]+$/);return ['-T','-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','-o','HostKeyAlgorithms=ssh-ed25519','-o','UserKnownHostsFile='+t.known_hosts,'-o','ConnectionAttempts=1','-o','ConnectTimeout=12','-o','ServerAliveInterval=10','-o','ServerAliveCountMax=2','-o','ControlMaster=no','-i',t.identity]}
export function remoteCommand(){return 'python3 -c '+shell('import sys,json; q=json.load(sys.stdin); sys.argv=["premium-product-remote.py",q["mode"],json.dumps(q)]; exec(compile(q["source"],"premium-product-remote.py","exec"))')}
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
export async function toolHashes(){return Object.fromEntries(await Promise.all(['operator.mjs','database.mjs','remote.py','application-scope.json','../footer-refinement-release/operator.mjs','../footer-refinement-release/database.mjs','../footer-refinement-release/remote.py','../footer-release/operator.mjs','../footer-release/database.mjs','../footer-release/remote.py','../live-sales-release/operator.mjs','../live-sales-release/database.mjs','../live-sales-release/auth.mjs','../live-sales-release/remote.py','../commerce-release/database.mjs','../commerce-release/operator.mjs','../commerce-release/remote.py','../clean-reinstall/deploy.py','../publish/inventory.mjs','../publish/contracts.mjs','../lib/cleanBaseline.mjs','../../docs/operations/backup-envelope.mjs'].map(async name=>[name,hash(await readFile(resolve(here,name)))])))}
async function applicationInputs(){
  const changed=(await run('git',['diff','--name-only',previousApplicationCommit,applicationCommit,'--','app','server','public','i18n','supabase','package.json','package-lock.json','nuxt.config.ts','tsconfig.json'],{cwd:repo})).stdout.trim().split('\n').sort()
  assert.deepEqual(changed,await load(here+'/application-scope.json'),'Only the reviewed PDP scope may change');assert.ok(!changed.some(path=>/ModernFooter|modern-footer|layout\/Footer/.test(path)),'Accepted footers are immutable')
  const names=(await run('git',['ls-tree','-r','--name-only',applicationCommit],{cwd:repo,maxBuffer:8e6})).stdout.trim().split('\n').filter(n=>/^(app|server|public|i18n)\//.test(n)||['package.json','package-lock.json','nuxt.config.ts','tsconfig.json'].includes(n))
  const inputs={};for(const name of names){const bytes=await readFile(repo+'/'+name),pinned=(await run('git',['show',applicationCommit+':'+name],{cwd:repo,encoding:'buffer',maxBuffer:8e6})).stdout;assert.equal(hash(bytes),hash(pinned),'Unapproved application change: '+name);inputs[name]=hash(bytes)}
  const actual=(await run('git',['ls-files','--cached','--others','--exclude-standard'],{cwd:repo,maxBuffer:8e6})).stdout.trim().split('\n').filter(n=>/^(app|server|public|i18n)\//.test(n)||['package.json','package-lock.json','nuxt.config.ts','tsconfig.json'].includes(n));assert.deepEqual(actual.sort(),names.sort())
  return inputs
}
async function logged(command,args,cwd,file,{timeout=600000,env=cleanEnv()}={}){
  const child=spawn(command,args,{cwd,env,stdio:['ignore','pipe','pipe'],timeout}),chunks=[];child.stdout.on('data',b=>chunks.push(b));child.stderr.on('data',b=>chunks.push(b));const code=await exited(child)
  await writeFile(file,Buffer.concat(chunks),{flag:'wx',mode:0o600});assert.equal(code,0,'Local log retained: '+file)
}
async function authState(target){const c=await load(target.credentials_file),r=await fetch('https://'+target.project_ref+'.supabase.co/auth/v1/settings',{headers:{apikey:c.anon_key},signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);const v=await r.json();assert.equal(v.disable_signup,true);assert.equal(v.mailer_autoconfirm,false);return {disable_signup:true,mailer_autoconfirm:false}}
export async function databaseState(target,release,{after=false}={}){const db=await connect(target);try{await db.query('begin isolation level repeatable read read only');const s=await checkDatabase(db,release,{after});await db.query('commit');return s}finally{await db.end()}}
export async function prepare(options){
  assert.equal(process.version,'v22.23.1');assert.equal((await run('git',['status','--porcelain'],{cwd:repo})).stdout,'','Commit the reviewed scope before preparing');const spec=await load(options.spec);assert.equal(spec.application_commit,applicationCommit);assert.ok(Array.isArray(spec.product_probe_ids)&&spec.product_probe_ids.length===2&&spec.product_probe_ids.every(id=>/^[a-f0-9-]{36}$/.test(id)));assert.ok(Array.isArray(spec.product_probe_paths)&&spec.product_probe_paths.length===2&&spec.product_probe_paths.every(path=>/^\/(?:ar\/)?products\/[a-z0-9%-]+$/.test(path)));const work=options.directory;await mkdir(work,{mode:0o700})
  const tools=await toolHashes(),release=await migrations(repo),app=await applicationInputs(),base={target:spec.target,release_id:'preflight',archive_bytes:0}
  const before=await remote(base,'inspect');assert.equal(before.current,spec.target.root+'/releases/'+spec.expected_release);assert.equal(before.recovery_files['/etc/caddy/Caddyfile'].sha256,spec.expected_caddy_sha256)
  const accepted=await load(spec.accepted_release_plan),{seal:acceptedSeal,...acceptedBody}=accepted;assert.equal(digest(acceptedBody),acceptedSeal);assert.equal(hash(await readFile(spec.accepted_release_archive)),accepted.archive_sha256);assert.equal(before.verified.archive_sha256,accepted.archive_sha256);assert.deepEqual(spec.target,accepted.target,'Operational target must match the accepted deployment');assert.equal(accepted.application_commit,previousApplicationCommit);assert.equal(before.verified.commit,accepted.application_commit);assert.equal(before.verified.plan_sha256,acceptedSeal)
  await save(work+'/runtime-before.json',before);const database=await databaseState(spec.target,release),auth=await authState(spec.target)
  assert.equal(hash(await readFile(spec.accepted_receipt)),spec.accepted_receipt_sha256);const acceptedReceipt=await load(spec.accepted_receipt);assert.equal(acceptedReceipt.release,spec.expected_release);assert.equal(acceptedReceipt.schema,88);assert.equal(hash(await readFile(spec.accepted_schema_receipt)),acceptedReceipt.evidence_sha256['approved-deployment/database-after-browser.json']);assert.deepEqual(database.schema,(await load(spec.accepted_schema_receipt)).schema,'Schema88 changed since accepted deployment');await save(work+'/database-before.json',database);await save(work+'/auth-before.json',auth);await save(work+'/http-before.json',await publicHealth(base))
  const backup_evidence=await backup({...base,before,backup:spec.backup},work)
  const assets=await remote({...base,before},'assets',{bytes:true});await writeFile(work+'/retained-assets.tar.gz',assets,{flag:'wx',mode:0o600});await validateAssets(work+'/retained-assets.tar.gz')
  const build=work+'/build-source';await mkdir(build,{mode:0o700});await logged('git',['archive','--format=tar','--output='+work+'/source.tar',applicationCommit],repo,work+'/source-archive.log');await logged('tar',['-xf',work+'/source.tar','-C',build],repo,work+'/source-extract.log')
  await mkdir(build+'/public',{recursive:true});await logged('tar',['-xzf',work+'/retained-assets.tar.gz','-C',build+'/public'],repo,work+'/retained-assets-extract.log')
  assert.equal((await run(process.execPath,[spec.npm_cli,'--version'],{env:cleanEnv()})).stdout.trim(),'10.9.8');await writeFile(work+'/empty.env','',{flag:'wx',mode:0o600})
  await logged(process.execPath,[spec.npm_cli,'ci','--no-audit','--no-fund'],build,work+'/npm-ci.log');assert.equal(hash(await readFile(build+'/package-lock.json')),app['package-lock.json'])
  await logged(process.execPath,[build+'/node_modules/nuxt/bin/nuxt.mjs','build','--dotenv',work+'/empty.env'],build,work+'/build.log')
  const output=build+'/.output';async function modes(path){const s=await lstat(path);if(s.isSymbolicLink())return;if(s.isDirectory()){await chmod(path,0o755);for(const n of await readdir(path))await modes(path+'/'+n)}else await chmod(path,0o644)}await modes(output)
  const c=await load(spec.target.credentials_file),entries=await inventory(output,{secrets:[c.database_password,c.service_role_key]})
  for(const[path,value]of Object.entries(before.assets))assert.equal(hash(await readFile(output+'/public/_nuxt/'+path)),value.sha256,'Retained client asset lost')
  await save(work+'/inventory.json',entries);await tarCreate({cwd:build,file:work+'/release.tar.gz',gzip:true,portable:true,noMtime:true,follow:false},['.output']);await chmod(work+'/release.tar.gz',0o600)
  const readbackScript='import importlib.util,json,sys,pathlib; s=importlib.util.spec_from_file_location("extractor",sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);m.extract_release(sys.argv[2],pathlib.Path(sys.argv[3]),json.loads(pathlib.Path(sys.argv[4]).read_text()));print("PASS")'
  await logged('python3',['-B','-c',readbackScript,resolve(here,'../clean-reinstall/deploy.py'),work+'/release.tar.gz',work+'/archive-readback',work+'/inventory.json'],repo,work+'/archive-readback.log')
  assert.equal(digest(await inventory(work+'/archive-readback')),digest(entries));assert.deepEqual(await toolHashes(),tools)
  const qualification=await load(spec.qualification_file);assert.equal(qualification.result,'PASS');assert.equal(qualification.application_commit,applicationCommit);assert.ok(qualification.browser_checks>=266);assert.equal(qualification.focused_footer_tests,5);assert.ok(qualification.focused_tests>=39);assert.ok(qualification.native_release_tests>=6);assert.equal(qualification.remote_phase_checks,6);assert.equal(qualification.regression_qualification,'PASS_NO_NEW_FUNCTIONAL_BLOCKERS');assert.equal(qualification.typecheck,'PASS');assert.equal(qualification.build,'PASS')
  for(const[file,sha]of Object.entries(qualification.evidence_sha256))assert.equal(hash(await readFile(file)),sha)
  assert.deepEqual(await applicationInputs(),app);const after=await remote(base,'inspect');assert.deepEqual(stable(after),stable(before))
  const afterDb=await databaseState(spec.target,release);assert.deepEqual(approvalState(afterDb),approvalState(database));assert.deepEqual(await authState(spec.target),auth)
  await save(work+'/runtime-after.json',after);await save(work+'/database-after-preparation.json',afterDb)
  const archive=await readFile(work+'/release.tar.gz'),protectedFiles=[spec.target.credentials_file,spec.target.database.ca_file,spec.target.identity,spec.target.known_hosts,spec.backup.key,spec.qualification_file,spec.accepted_release_plan,spec.accepted_release_archive,spec.accepted_receipt,spec.accepted_schema_receipt,spec.backup.pg_dump,dirname(spec.backup.pg_dump)+'/pg_restore',spec.npm_cli]
  const plan={format:1,created_utc:new Date().toISOString(),application_commit:applicationCommit,application_inputs:app,release_id:hash(archive).slice(0,16),archive_sha256:hash(archive),archive_bytes:archive.length,inventory_sha256:digest(entries),schema_version:89,migration_sha256:release.pending[0].sha256,migrations:release.pending.map(({filename,version,name,sha256})=>({filename,version,name,sha256})),target:spec.target,product_probe_paths:spec.product_probe_paths,product_probe_ids:spec.product_probe_ids,before,database,database_state_sha256:digest(approvalState(database)),auth,tools,qualification:{file:spec.qualification_file,sha256:hash(await readFile(spec.qualification_file))},rollback:{automatic:false,application_only:true,previous_release:before.current,preserve_schema:89,previous_archive_sha256:accepted.archive_sha256},accepted_release:{application_commit:accepted.application_commit,archive_sha256:accepted.archive_sha256,plan_sha256:acceptedSeal},archive_readback:{result:'PASS',entries:entries.length},backup:spec.backup,backup_evidence,retained_assets_sha256:hash(assets),protected_inputs:Object.fromEntries(await Promise.all(protectedFiles.map(async file=>[file,hash(await readFile(file))]))),scope,automatic_retry:false,automatic_rollback:false}
  plan.seal=digest(plan);await save(work+'/plan.json',plan);console.log(JSON.stringify({result:'PREPARED_FOR_OWNER_REVIEW',seal:plan.seal,release:plan.release_id,entries:entries.length,retained_assets:Object.keys(before.assets).length,production_writes:0}))
}
async function localPrepared(file,{clean=false}={}){
  assert.equal(process.version,'v22.23.1');const plan=await load(file),{seal,...body}=plan;assert.equal(digest(body),seal);assert.equal(plan.application_commit,applicationCommit);assert.deepEqual(plan.scope,scope)
  assert.deepEqual(await toolHashes(),plan.tools);assert.deepEqual(await applicationInputs(),plan.application_inputs);assert.equal(plan.schema_version,89);assert.deepEqual(plan.rollback,{automatic:false,application_only:true,previous_release:plan.before.current,preserve_schema:89,previous_archive_sha256:plan.accepted_release.archive_sha256});assert.equal(plan.database_state_sha256,digest(approvalState(plan.database)))
  if(clean)assert.equal((await run('git',['status','--porcelain'],{cwd:repo})).stdout,'')
  const work=dirname(file),release=await migrations(repo);assert.deepEqual(plan.migrations,release.pending.map(({filename,version,name,sha256})=>({filename,version,name,sha256})));assert.equal(plan.migration_sha256,release.pending[0].sha256);assert.deepEqual(release.history.map(({version,name})=>({version,name})),plan.database.history)
  for(const[file,digest]of Object.entries(plan.protected_inputs))assert.equal(hash(await readFile(file)),digest)
  assert.equal(hash(await readFile(work+'/release.tar.gz')),plan.archive_sha256);assert.equal(digest(await load(work+'/inventory.json')),plan.inventory_sha256)
  const c=await load(plan.target.credentials_file);assert.equal(digest(await inventory(work+'/build-source/.output',{secrets:[c.database_password,c.service_role_key]})),plan.inventory_sha256)
  assert.equal(hash(await readFile(work+'/retained-assets.tar.gz')),plan.retained_assets_sha256);assert.equal(digest(await inventory(work+'/archive-readback')),plan.inventory_sha256);assert.equal(hash(await readFile(plan.qualification.file)),plan.qualification.sha256);const q=await load(plan.qualification.file);for(const[file,sha]of Object.entries(q.evidence_sha256))assert.equal(hash(await readFile(file)),sha)
  const backupProof=await load(work+'/backup-verification.json');assert.deepEqual(backupProof,plan.backup_evidence)
  for(const[name,proof]of [['database-before.dump',backupProof.database],['runtime-recovery.tar.gz',backupProof.runtime]]){assert.equal(hash(await readFile(work+'/'+name+'.enc')),proof.encryptedSha256);const result=JSON.parse((await run(process.execPath,[plan.backup.envelope,'verify',plan.backup.key,work+'/'+name+'.enc'],{env:cleanEnv(),timeout:180000})).stdout);assert.equal(result.authenticatedDecryption,true);assert.equal(result.plaintextSha256,proof.plaintextSha256)}
  for(const name of ['execution-intent.json','STOP.json','completed.json']){try{await access(work+'/'+name);throw Error('Execution already attempted; never repeat')}catch(e){if(e.code!=='ENOENT')throw e}}
  return {plan,release,work}
}
async function livePrepared(plan,release){assert.deepEqual(stable(await remote(plan,'inspect')),stable(plan.before));assert.deepEqual(approvalState(await databaseState(plan.target,release)),approvalState(plan.database));assert.deepEqual(await authState(plan.target),plan.auth);await publicHealth(plan)}
export async function check(options){const {plan,release}=await localPrepared(options.plan,{clean:true});await livePrepared(plan,release);console.log(JSON.stringify({result:'READ_ONLY_CHECK_PASS',seal:plan.seal,release:plan.release_id,production_writes:0}))}
async function verifyAfter(plan,release){
 const db=await connect(plan.target);try{await db.query('begin isolation level repeatable read read only');const after=await checkDatabase(db,release,{after:true});await compareOriginal(db,plan.database.protected_tables,{authSecurity:plan.database.auth_security});assertAdditive(plan.database.schema,after.schema);assert.deepEqual(after.controls,plan.database.controls);assert.deepEqual(after.auth_security,plan.database.auth_security);await db.query('commit');return after}finally{await db.end()}
}
async function verifyProductRoutes(plan){
 const response=await fetch(plan.target.origin+'/api/storefront/product-appearance',{signal:AbortSignal.timeout(12000)});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal((await response.json()).style,'classic')
 for(const id of plan.product_probe_ids){const metadata=await fetch(plan.target.origin+'/api/storefront/products/'+id+'/presentation',{signal:AbortSignal.timeout(12000)});assert.equal(metadata.status,200);const value=await metadata.json();assert.ok(Array.isArray(value.videos)&&Array.isArray(value.related)&&Array.isArray(value.compatible));const admin=await fetch(plan.target.origin+'/api/admin-products/'+id+'/presentation',{signal:AbortSignal.timeout(12000)});assert.equal(admin.status,401);await admin.body?.cancel()}
 for(const path of plan.product_probe_paths){const r=await fetch(plan.target.origin+path,{signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);const html=await r.text();assert.ok(!html.includes('class=\"product-premium\"'));assert.ok(html.includes('application/ld+json')&&html.includes('store-footer-modern'))}
}
export async function apply(options){
  const {plan,release,work}=await localPrepared(options.plan,{clean:true});assert.equal(options.approval,plan.seal,'Final exact owner approval required')
  await save(work+'/execution-intent.json',{plan_sha256:plan.seal,approved_utc:new Date().toISOString(),automatic_retry:false})
  let phase='preflight';const heartbeat=setInterval(()=>console.log(JSON.stringify({phase,status:'running'})),15000)
  try{
    await livePrepared(plan,release);phase='fresh encrypted recovery';const execution=work+'/execution';await mkdir(execution,{mode:0o700});await backup(plan,execution)
    phase='remote staging';await save(work+'/remote-prepare.json',await remote(plan,'prepare',{approved:plan.seal}));const scp=sshArgs(plan.target).filter(x=>!['-T','-n'].includes(x)),stage='/var/lib/premium-product-releases/'+plan.release_id
    await run('scp',[...scp,work+'/release.tar.gz',work+'/inventory.json','root@'+plan.target.host+':'+stage+'/'],{env:cleanEnv(),timeout:180000,maxBuffer:2e6})
    for(const step of ['stage','candidate']){phase=step;await save(work+'/remote-'+step+'.json',await remote(plan,step,{approved:plan.seal}))}
    phase='locked additive migration89';const db=await connect(plan.target,{readOnly:false});let receipt
    try{receipt=await applyMigration(db,release,{approval:options.approval,seal:plan.seal,beforeMigration:async locked=>assert.deepEqual(approvalState(locked),approvalState(plan.database)),beforeCommit:async value=>save(work+'/migration-before-commit.json',value)})}finally{await db.end()}
    await save(work+'/migration-committed.json',receipt)
    phase='schema89 private candidate';const migrated=await verifyAfter(plan,release);await save(work+'/remote-candidate89.json',await remote(plan,'candidate89',{approved:plan.seal}));assert.deepEqual(approvalState(await verifyAfter(plan,release)),approvalState(migrated))
    phase='read-only preactivation preservation';const beforeActivation=await verifyAfter(plan,release);await save(work+'/database-preactivation.json',beforeActivation)
    phase='activation';await saveActivationReceipt(work,await remote(plan,'activate',{approved:plan.seal,database:{plan_sha256:plan.seal,schema:89,migration_sha256:plan.migration_sha256,preservation:'PASS',state_sha256:digest(approvalState(beforeActivation))}}))
    phase='public verification';await save(work+'/http-after.json',await publicHealth(plan));assert.deepEqual(await authState(plan.target),plan.auth);await verifyProductRoutes(plan)
    phase='database preservation';const afterDatabase=await verifyAfter(plan,release);assert.deepEqual(approvalState(afterDatabase),approvalState(beforeActivation));await save(work+'/database-after.json',afterDatabase)
    await save(work+'/completed.json',{result:'PASS',plan:plan.seal,release:plan.release_id,schema:89,migrations_applied:1,classic_selected:true,completed_utc:new Date().toISOString(),public_checkout:false,signup:false,provider_calls:0});console.log(JSON.stringify({result:'DEPLOY_PASS',seal:plan.seal,release:plan.release_id,schema:89}))
  }catch(e){await save(work+'/STOP.json',{result:'STOP',phase,error_type:e.name,code:e.code,automatic_retry:false,automatic_rollback:false});throw Error('STOP in '+phase+'. Preserve evidence. No retry or rollback.')}finally{clearInterval(heartbeat)}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const o=argumentsFor(process.argv.slice(2));await({prepare,check,apply}[o.mode])(o)}catch(e){console.error(JSON.stringify({result:'STOP',error_type:e.name,message:e.message?.startsWith('STOP in ')?e.message:'Premium product release guard failed; no production retry. Inspect private evidence.'}));process.exitCode=1}
}
