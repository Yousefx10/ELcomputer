// A separate recovery approval. Never invokes the consumed Beta operator/apply or writes SQL.
import assert from 'node:assert/strict'
import {readFile,writeFile,stat,access,mkdir} from 'node:fs/promises'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {databaseTools,digest,hash} from '../schema95-beta-release/database.mjs'
const here=dirname(fileURLToPath(import.meta.url)),run=promisify(execFile),load=async f=>JSON.parse(await readFile(f,'utf8'))
const save=(f,v)=>writeFile(f,JSON.stringify(v,null,2)+'\n',{flag:'wx',mode:0o600}),stable=v=>Object.fromEntries(Object.entries(v).filter(([k])=>!['observed_utc','free_bytes','production_writes'].includes(k)))
const cleanEnv=()=>({PATH:dirname(process.execPath)+':/usr/bin:/bin:/usr/sbin:/sbin',HOME:process.env.HOME,LANG:'C',NODE_ENV:'production'})
const shell=v=>"'"+v.replaceAll("'","'\\''")+"'"
export const scope={kind:'schema95_asset_recovery',schema:95,migrations:0,database_writes:0,runtime_change:false,auth_change:false,caddy_asset_route_only:true,caddy_sigusr1_max:1,app_restarts_max:1,candidate_loopback_only:true,signup:'preserve_open',purchasing:false,provider_calls:0,automatic_retry:false,automatic_rollback:false}
export function assertPlan(p,now=Date.now()){
 const {seal,...body}=p;assert.equal(digest(body),seal);assert.deepEqual(p.scope,scope);assert.equal(p.release_id,'81becf54218a8e14');assert.equal(p.archive_sha256,'81becf54218a8e144137f2bdce7df1eed6bcc07745924c0167fcd7435aae37ff');assert.equal(p.staged_verified.plan_sha256,'a510a04dd2d55b0b39c22c1b88437008ecaefbc1cc94ca3872305209840febab')
 assert.equal(p.migration_already_committed,true);assert.equal(p.recovery_proof.database.pg_restore_full_readback,'PASS');assert.equal(p.recovery_proof.runtime.full_byte_readback,true)
 for(const k of ['git_push','public_activation','production_payment','pdc_calls','business_settings_change'])assert.equal(p[k],false,k)
 const source=Date.parse(p.backup_source_utc),expires=Date.parse(p.expires_utc);assert.ok(Number.isFinite(source)&&source<=now&&expires===source+6*3600000&&now<=expires,'Recovery source expired')
}
async function remote(p,mode,approved=null,database=null){
 assert.ok(['inspect','prepare','candidate','activate'].includes(mode));if(mode!=='inspect'){assertPlan(p);assert.equal(approved,p.seal)}
 const t=p.target,args=['-T','-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','-o','HostKeyAlgorithms=ssh-ed25519','-o','UserKnownHostsFile='+t.known_hosts,'-o','ConnectionAttempts=1','-o','ConnectTimeout=12','-o','ControlMaster=no','-i',t.identity,'root@'+t.host]
 // The remote CLI consumes JSON once. Compile with a fresh in-memory stdin stream.
 const bootstrap='import sys,json,io;q=json.load(sys.stdin);sys.stdin=io.StringIO(json.dumps(q));exec(compile(q["source"],"schema95-asset-activation.py","exec"))'
 const task=run('ssh',[...args,'python3 -I -S -B -c '+shell(bootstrap)],{env:cleanEnv(),timeout:180000,maxBuffer:64e6})
 task.child.stdin.on('error',()=>{});task.child.stdin.end(JSON.stringify({source:await readFile(here+'/remote.py','utf8'),helper_source:await readFile(p.immutable_helper,'utf8'),plan:p,mode,approved,database}))
 try{return JSON.parse((await task).stdout)}catch(e){let reason='remote stopped';try{const v=JSON.parse(e.stdout);reason=v.type+': '+v.message}catch{}throw Error(mode+': '+reason)}
}
async function hashes(files){return Object.fromEntries(await Promise.all(files.map(async f=>[f,hash(await readFile(f))])))}
async function frozen(p){
 const old=await load(p.preservation_file);let count=0
 for(const t of old){if(t.path===p.documentation_repo)continue;assert.equal((await run('git',['rev-parse','HEAD'],{cwd:t.path})).stdout.trim(),t.head);assert.equal((await run('git',['status','--porcelain=v1','-z'],{cwd:t.path,encoding:'buffer',maxBuffer:8e6})).stdout.toString('hex'),t.status_hex);for(const [f,m]of Object.entries(t.files)){assert.equal(hash(await readFile(t.path+'/'+f)),m.sha256);count++}}
 assert.equal(count,135);assert.equal((await run('git',['rev-parse','HEAD'],{cwd:p.location_repo})).stdout.trim(),p.location_head);assert.equal((await run('git',['status','--porcelain'],{cwd:p.location_repo})).stdout,'')
}
async function auth(p){
 const c=await load(p.target.credentials_file),r=await fetch('https://'+p.target.project_ref+'.supabase.co/auth/v1/settings',{headers:{apikey:c.anon_key},redirect:'manual',signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);const a=await r.json();assert.equal(a.disable_signup,false);assert.equal(a.mailer_autoconfirm,false);assert.equal(a.external?.email,true);return {disable_signup:false,mailer_autoconfirm:false,external:a.external}
}
async function health(p){for(const[path,status]of[['/login',200],['/ar/login',200],['/cart',403],['/checkout',403],['/api/account/history',401]]){const r=await fetch(p.target.origin+path,{redirect:'manual',signal:AbortSignal.timeout(15000)});await r.arrayBuffer();assert.equal(r.status,status,path)}}
async function local(p){
 assertPlan(p);assert.equal(process.version,'v22.23.1');for(const[f,sha]of Object.entries(p.inputs))assert.equal(hash(await readFile(f)),sha,'Sealed input changed: '+f)
 await frozen(p)
 for(const[name,proof]of[['database-before.dump',p.recovery_proof.database],['runtime-recovery.tar.gz',p.recovery_proof.runtime]]){
  const f=p.recovery_directory+'/'+name+'.enc';assert.equal(hash(await readFile(f)),proof.encryptedSha256);const checked=JSON.parse((await run(process.execPath,[p.backup.envelope,'verify',p.backup.key,f],{env:cleanEnv(),timeout:180000})).stdout);assert.equal(checked.authenticatedDecryption,true);assert.equal(checked.plaintextSha256,proof.plaintextSha256)
 }
}
async function live(p){
 assert.deepEqual(stable(await remote(p,'inspect')),stable(p.before));const d=await databaseTools(p.source_repo);assert.deepEqual(d.comparable(await d.observe(p.target)),d.comparable(p.database),'Schema95/data/ownership drift');assert.deepEqual(await auth(p),p.auth);await health(p)
}
async function prepare(w){
 assert.equal(process.version,'v22.23.1');const old=await load(w+'/../schema95-beta-release-20261026/review-2/plan.json'),baseline=await load(w+'/target-baseline.private.json'),oldWork=resolve(w,'../schema95-beta-release-20261026/review-2')
 const {seal,...body}=old;assert.equal(digest(body),seal);assert.equal(seal,'a510a04dd2d55b0b39c22c1b88437008ecaefbc1cc94ca3872305209840febab');await access(oldWork+'/execution-intent.json');await access(oldWork+'/execution/STOP.json');await assert.rejects(access(oldWork+'/execution/completed.json'))
 const migration=await load(oldWork+'/execution/migration-committed.json');assert.equal(migration.schema,95);assert.equal(migration.migration_committed,true);assert.equal(migration.preservation,'PASS')
 const q=await load(w+'/local-caddy-qualification.json');assert.equal(q.result,'PASS');assert.equal(q.all_other_adapted_policy_identical,true);assert.equal(q.config_sha256,hash(await readFile(w+'/Caddyfile.proposed')))
 const cause=await load(w+'/offline-asset-reproduction.json');assert.equal(cause.retained_asset_status,404);assert.equal(cause.retained_asset_in_compiled_manifest,false)
 const test=await readFile(w+'/new-guard-tests.log','utf8');assert.match(test,/# fail 0/);assert.doesNotMatch(test,/# skipped [1-9]/)
 const py=await readFile(w+'/new-remote-tests.log','utf8');assert.match(py,/\nOK\s*$/)
 const recovery=oldWork+'/execution/backups',proof=await load(recovery+'/backup-verification.json'),source=(await stat(recovery+'/backup-verification.json')).mtime.toISOString()
 const oldAssets=Object.keys(baseline.assets).filter(n=>n.endsWith('.js')).sort().slice(0,3).map(name=>({name,sha256:baseline.assets[name].sha256}))
 const entries=await load(oldWork+'/inventory.json'),newAssets=entries.filter(e=>e.type==='file'&&/^public\/_nuxt\/[^/]+\.js$/.test(e.path)&&!baseline.assets[e.path.slice('public/_nuxt/'.length)]).slice(0,3).map(e=>({name:e.path.slice('public/_nuxt/'.length),sha256:e.sha256}));assert.equal(newAssets.length,3)
 const p={scope,target:old.target,widget:old.widget,release_id:old.release_id,archive_sha256:old.archive_sha256,inventory_sha256:old.inventory_sha256,source_repo:old.source_repo,immutable_helper:resolve(here,'../schema95-beta-release/remote.py'),staged_verified:baseline.staged_verified,caddy_binary:baseline.caddy_binary,caddy_binary_metadata:baseline.caddy_binary_metadata,caddy_version:baseline.caddy_version,before:Object.fromEntries(Object.entries(baseline).filter(([k])=>Object.hasOwn(old.before,k))),caddy_after_sha256:q.config_sha256,asset_candidate_port:old.target.candidate_port+1,http_assets:[...oldAssets,...newAssets],new_only_asset:newAssets[0],migration_already_committed:true,recovery_directory:recovery,recovery_proof:proof,backup:old.backup,backup_source_utc:source,expires_utc:new Date(Date.parse(source)+6*3600000).toISOString(),preservation_file:old.preservation_file,documentation_repo:old.documentation_repo,location_repo:old.location_repo,location_head:old.location_head,git_push:false,public_activation:false,production_payment:false,pdc_calls:false,business_settings_change:false,approval_phrase:'APPROVE SCHEMA95 ASSET RECOVERY',created_utc:new Date().toISOString()}
 p.before=await remote(p,'inspect');assert.equal(p.before.current,old.before.current);assert.deepEqual(p.before.verified,old.before.verified);assert.deepEqual(p.before.nuxt,old.before.nuxt);assert.deepEqual(p.before.caddy,old.before.caddy)
 const d=await databaseTools(p.source_repo);p.database=await d.observe(p.target);assert.equal(p.database.history.length,95);assert.equal(digest(p.database.schema),old.expected_after_schema_sha256);assert.deepEqual(p.database.history.slice(0,94),old.database.history);assert.deepEqual(p.database.auth_security,old.database.auth_security);p.auth=await auth(p)
 const additional=[...['operator.mjs','remote.py','qualify.mjs','guards.test.mjs','remote_test.py'].map(n=>here+'/'+n),w+'/Caddyfile.before',w+'/Caddyfile.proposed',w+'/local-caddy-qualification.json',w+'/local-qualification-final.log',w+'/offline-asset-reproduction.json',w+'/new-guard-tests.log',w+'/new-remote-tests.log',w+'/tools/caddy',w+'/tools/download-verification.json',oldWork+'/plan.json',oldWork+'/execution-intent.json',oldWork+'/execution/STOP.json',oldWork+'/execution/migration-committed.json',recovery+'/backup-verification.json',old.preservation_file]
 p.inputs={...old.application_inputs,...old.tools,...old.protected_inputs,...await hashes(additional)};p.seal=digest(p);await local(p);await live(p);await save(w+'/plan.json',p);console.log(JSON.stringify({result:'SCHEMA95_ASSET_RECOVERY_READY',seal:p.seal,approval:p.approval_phrase+' '+p.seal,expires_utc:p.expires_utc,production_writes:0}))
}
async function check(w){const p=await load(w+'/plan.json');await local(p);await live(p);console.log(JSON.stringify({result:'READ_ONLY_CHECK_PASS',seal:p.seal,production_writes:0}))}
async function apply(w,approved){
 const p=await load(w+'/plan.json');assertPlan(p);assert.equal(approved,p.seal);try{await access(w+'/execution-intent.json');throw Error('Consumed approval')}catch(e){if(e.code!=='ENOENT')throw e}await local(p);await live(p);await save(w+'/execution-intent.json',{seal:p.seal,utc:new Date().toISOString(),automatic_retry:false});await mkdir(w+'/execution',{mode:0o700});let phase='prepare'
 try{
  await save(w+'/execution/prepare.json',await remote(p,'prepare',approved));phase='new candidate';await save(w+'/execution/candidate.json',await remote(p,'candidate',approved));await live(p)
  phase='asset route and activation';await save(w+'/execution/activate.json',await remote(p,'activate',approved,{seal:p.seal,schema:95,database_writes:0,preservation:'PASS'}))
  const d=await databaseTools(p.source_repo);assert.deepEqual(d.comparable(await d.observe(p.target)),d.comparable(p.database));assert.deepEqual(await auth(p),p.auth);await health(p)
  for(const a of p.http_assets){const r=await fetch(p.target.origin+'/_nuxt/'+a.name,{signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);assert.equal(hash(Buffer.from(await r.arrayBuffer())),a.sha256)}
  await frozen(p);await save(w+'/execution/completed.json',{result:'DEPLOY_PASS',seal:p.seal,release:p.release_id,schema:95,migration_replays:0,main_restarts:1,caddy_sigusr1:1,signup_open:true,confirmation_required:true,purchasing_closed:true,provider_calls:0,real_payments:0,business_settings_changes:0});console.log(JSON.stringify({result:'DEPLOY_PASS',seal:p.seal,release:p.release_id,schema:95}))
 }catch(e){await save(w+'/execution/STOP.json',{result:'STOP',phase,type:e.name,message:e.message.slice(0,200),automatic_retry:false,automatic_rollback:false});throw Error('STOP in '+phase+'; preserve evidence. No automatic retry or rollback.')}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{const[mode,w,approval]=process.argv.slice(2);assert.ok(['prepare','check','apply'].includes(mode));await({prepare,check,apply}[mode])(resolve(w),approval)}catch(e){console.error(JSON.stringify({result:'STOP',type:e.name,message:e.message.slice(0,250),automatic_retry:false}));process.exitCode=1}}
