// Exact inactive deployment only. No import, public activation or provider action.
import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir,access,lstat} from 'node:fs/promises'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {inventory} from '../publish/inventory.mjs'
import {backup} from '../footer-release/operator.mjs'
import {scope,pendingVersions,hash,digest,releaseInputs,connect,databaseState,applySchema,compareOriginal,comparableState,canonicalSchema} from './database.mjs'
const here=dirname(fileURLToPath(import.meta.url)),repo=resolve(here,'../..'),run=promisify(execFile)
const load=async f=>JSON.parse(await readFile(f,'utf8'))
const save=(f,v)=>writeFile(f,JSON.stringify(v,null,2)+'\n',{flag:'wx',mode:0o600})
const shell=s=>"'"+s.replaceAll("'","'\\''")+"'"
const cleanEnv=()=>({PATH:dirname(process.execPath)+':/usr/bin:/bin:/usr/sbin:/sbin',HOME:process.env.HOME,LANG:'en_US.UTF-8',NODE_ENV:'production'})
const stable=v=>Object.fromEntries(Object.entries(v).filter(([k])=>!['observed_utc','free_bytes','production_writes'].includes(k)))
const sshArgs=t=>['-T','-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','-o','HostKeyAlgorithms=ssh-ed25519','-o','UserKnownHostsFile='+t.known_hosts,'-o','ConnectionAttempts=1','-o','ConnectTimeout=12','-o','ServerAliveInterval=10','-o','ServerAliveCountMax=2','-o','ControlMaster=no','-i',t.identity]

export function assertScope(p){
 assert.equal(p.format,11);assert.deepEqual(p.scope,scope);assert.equal(p.schema_version,94)
 assert.deepEqual(p.migrations.map(m=>m.version),pendingVersions)
 assert.equal(p.database_writes,'schema_only')
 for(const k of ['historical_import','claims','signup','automatic_retry','automatic_rollback','git_push'])assert.equal(p[k],false,k)
 assert.equal(p.provider_requests,0);assert.equal(p.nuxt_restarts_max,1)
}
export function assertFreshBackup(p,now=Date.now()){
 const time=Date.parse(p.backup_verified_utc)
 assert.ok(Number.isFinite(time)&&time<=now&&now-time<=6*3600000,'Backup qualification is stale; refresh recovery evidence before approval/apply')
 assert.equal(p.backup_qualification.authenticated_full_readback,true)
 assert.equal(p.backup_qualification.local_application_auth_restore,true)
}
export async function remote(p,mode,{approved=null,database=null}={}){
 assert.ok(['inspect','prepare','stage','candidate','activate'].includes(mode))
 if(mode!=='inspect'){assertScope(p);assert.equal(approved,p.seal)}
 const command='python3 -I -S -B -c '+shell('import sys,json;q=json.load(sys.stdin);sys.argv=["inactive-history-remote.py",q["mode"],json.dumps(q)];exec(compile(q["source"],"inactive-history-remote.py","exec"))')
 const child=run('ssh',[...sshArgs(p.target),'root@'+p.target.host,command],{env:cleanEnv(),timeout:180000,maxBuffer:32*1024*1024})
 child.child.stdin.on('error',()=>{});child.child.stdin.end(JSON.stringify({source:await readFile(here+'/remote.py','utf8'),mode,plan:p,approved,database}))
 return JSON.parse((await child).stdout)
}
async function toolInputs(){
 const names=(await run('git',['ls-files','--cached','--others','--exclude-standard','--','scripts','tests','docs/operations/backup-envelope.mjs'],{cwd:repo,maxBuffer:8e6})).stdout.trim().split('\n').sort()
 return Object.fromEntries(await Promise.all(names.map(async n=>[n,hash(await readFile(repo+'/'+n))])))
}
async function authState(target){
 const c=await load(target.credentials_file),r=await fetch('https://'+target.project_ref+'.supabase.co/auth/v1/settings',{headers:{apikey:c.anon_key},signal:AbortSignal.timeout(15000)})
 assert.equal(r.status,200);const v=await r.json();assert.equal(v.disable_signup,true);assert.equal(v.mailer_autoconfirm,false)
 return {disable_signup:true,mailer_autoconfirm:false,external:v.external}
}
async function readState(target,release,after=false){
 const db=await connect(target)
 try{await db.query('begin isolation level repeatable read read only');const state=await databaseState(db,release,{after});assert.equal(state.read_only,'on');await db.query('rollback');return state}finally{await db.end()}
}
export async function localCheck(work,p){
 const {seal,...body}=p;assert.equal(digest(body),seal);assertScope(p);assertFreshBackup(p)
 assert.equal((await run('git',['rev-parse','HEAD'],{cwd:repo})).stdout.trim(),p.operator_commit,'Operator checkout changed')
 const frozen=await load(p.frozen_inputs);assert.equal(hash(await readFile(p.frozen_inputs)),p.frozen_inputs_sha256)
 const receipt=await load(p.source_approval);assert.equal(receipt.approved,true);assert.equal(receipt.packet_sha256,p.source_approval_seal);assert.equal(receipt.production_write_authority,false)
 for(const [name,sha]of Object.entries(frozen.application_inputs_sha256))assert.equal(hash(await readFile(repo+'/'+name)),sha,'Application drift: '+name)
 assert.deepEqual(await toolInputs(),p.tools)
 const release=await releaseInputs(repo,frozen)
 assert.deepEqual(release.pending.map(({text,...m})=>m),p.migrations)
 assert.equal(hash(await readFile(work+'/application.tar.gz')),p.archive_sha256)
 assert.equal((await lstat(work+'/application.tar.gz')).size,p.archive_bytes)
 assert.equal(digest(await inventory(work+'/readback')),p.inventory_sha256)
 for(const [file,sha]of Object.entries(p.evidence_sha256))assert.equal(hash(await readFile(file)),sha,'Evidence drift: '+file)
 for(const [file,sha]of Object.entries(p.protected_inputs))assert.equal(hash(await readFile(file)),sha,'Protected input drift')
 assert.equal(digest(p.expected_after_schema),p.expected_after_schema_sha256)
 const qualification=await load(work+'/qualification.json'),recovery=await load(work+'/recovery-upgrade-proof.json')
 assert.equal(qualification.result,'PASS');assert.equal(qualification.archive_sha256,p.archive_sha256)
 assert.equal(recovery.result,'LOCAL_RESTORE_AND_91_TO94_PASS');assert.equal(recovery.expected_after_schema_sha256,p.expected_after_schema_sha256)
 assert.equal(recovery.managed_vault_secret_rows,0);assert.equal(p.database.managed_vault_secret_rows,0)
 const key=p.backup.key
 for(const name of ['database-before.dump','runtime-recovery.tar.gz']){
  const checked=JSON.parse((await run(process.execPath,[p.backup.envelope,'verify',key,work+'/backups/'+name+'.enc'],{env:cleanEnv(),timeout:180000})).stdout)
  assert.equal(checked.authenticatedDecryption,true)
 }
 return release
}
async function checked(work,p){
 const release=await localCheck(work,p)
 assert.deepEqual(stable(await remote(p,'inspect')),stable(p.before),'Runtime/asset/incident drift')
 const db=await readState(p.target,release)
 assert.deepEqual(comparableState(db),comparableState(p.database),'Current production data/schema changed')
 assert.deepEqual(await authState(p.target),p.auth)
 return release
}
export async function seal(work){
 const spec=await load(work+'/spec.json'),artifact=await load(work+'/artifact.json'),qualification=await load(work+'/qualification.json'),recovery=await load(work+'/recovery-upgrade-proof.json'),proof=await load(work+'/backup-proof.json'),frozen=await load(spec.frozen_inputs)
 assert.equal(qualification.result,'PASS');assert.equal(qualification.archive_sha256,artifact.archive_sha256)
 assert.equal(recovery.result,'LOCAL_RESTORE_AND_91_TO94_PASS');assert.equal(recovery.history_imported,0)
 const target=await load(work+'/target.json'),before=await load(work+'/runtime-before.json'),backupConfig=await load(work+'/backup-effective-config.json')
 const files=['spec.json','target.json','artifact.json','inventory.json','qualification.json','recovery-upgrade-proof.json','expected-after-schema.private.json','backup-proof.json','backups/backup-verification.json','backups/database-before.dump.enc','backups/runtime-recovery.tar.gz.enc','archive-readback.log','build.log','operator-tests.log','remote-tests.log','compiled-qualification.json','runtime-before.json','database-before.private.json','database-context.json','auth-before.json','prepare-baseline.mjs','rehearse-recovery.mjs','pack-inactive.mjs','compiled-qualify.mjs','browser-qualify.mjs','loopback-only.cjs']
 const evidence=Object.fromEntries(await Promise.all(files.map(async n=>[work+'/'+n,hash(await readFile(work+'/'+n))])))
 evidence[spec.source_approval]=hash(await readFile(spec.source_approval));evidence[spec.frozen_inputs]=hash(await readFile(spec.frozen_inputs))
 const priorArchive=spec.retained_baseline+'/application.tar.gz'
 assert.equal(hash(await readFile(priorArchive)),before.verified.archive_sha256,'Prior recovery archive mismatch')
 evidence[priorArchive]=hash(await readFile(priorArchive))
 const protectedFiles=[target.credentials_file,target.database.ca_file,target.identity,target.known_hosts,backupConfig.key,backupConfig.pg_dump,dirname(backupConfig.pg_dump)+'/pg_restore',process.execPath,backupConfig.envelope]
 const expected=await load(work+'/expected-after-schema.private.json'),sourceReceipt=await load(spec.source_approval)
 const plan={format:11,created_utc:new Date().toISOString(),scope,application_commit:spec.qualified_commit,source_approval:spec.source_approval,source_approval_seal:sourceReceipt.packet_sha256,frozen_inputs:spec.frozen_inputs,frozen_inputs_sha256:hash(await readFile(spec.frozen_inputs)),target,before,database:await load(work+'/database-before.private.json'),auth:await authState(target),schema_version:94,migrations:artifact.migrations,database_writes:'schema_only',historical_import:false,claims:false,signup:false,provider_requests:0,git_push:false,nuxt_restarts_max:1,automatic_retry:false,automatic_rollback:false,release_id:artifact.archive_sha256.slice(0,16),archive_sha256:artifact.archive_sha256,archive_bytes:artifact.archive_bytes,inventory_sha256:artifact.inventory_sha256,expected_after_schema:expected,expected_after_schema_sha256:digest(expected),tools:await toolInputs(),evidence_sha256:evidence,protected_inputs:Object.fromEntries(await Promise.all(protectedFiles.map(async f=>[f,hash(await readFile(f))]))),backup:backupConfig,backup_verified_utc:recovery.verified_utc,backup_qualification:{authenticated_full_readback:true,local_application_auth_restore:true,managed_vault_scope:recovery.scope},execution_backups_required:true,approval_phrase:'APPROVE INACTIVE BETA HISTORY DEPLOY',rollback:{previous_release:before.current,application_only_after_sql:true,preserve_schema:94,requires_separate_review:true,automatic:false}}
 assert.equal(frozen.claims_approved,0);assert.ok(proof.database.pg_restore_full_readback==='PASS')
 // Verification cannot make an old backup fresh again. Bind the older time.
 plan.database.schema=canonicalSchema(plan.database.schema)
 plan.rollback.previous_archive=priorArchive
 plan.rollback.previous_archive_sha256=before.verified.archive_sha256
 plan.database.managed_vault_secret_rows=(await load(work+'/database-context.json')).vault_secret_rows
 plan.operator_commit=(await run('git',['rev-parse','HEAD'],{cwd:repo})).stdout.trim()
 plan.database.protected_tables.sort((a,b)=>{const x=JSON.stringify(Object.fromEntries(Object.entries(a).sort())),y=JSON.stringify(Object.fromEntries(Object.entries(b).sort()));return x<y?-1:x>y?1:0})
 plan.backup_verified_utc=new Date(Math.min(Date.parse(proof.verified_utc),Date.parse(recovery.verified_utc))).toISOString()
 plan.seal=digest(plan);await checked(work,plan);await save(work+'/plan.json',plan)
 console.log(JSON.stringify({result:'SEALED_READY_FOR_OWNER_REVIEW',release:plan.release_id,seal:plan.seal,approval:plan.approval_phrase+' '+plan.seal,production_writes:0}))
}
export async function check(work){const p=await load(work+'/plan.json');await checked(work,p);console.log(JSON.stringify({result:'READ_ONLY_CHECK_PASS',seal:p.seal,production_writes:0}))}
export async function apply(work,approved){
 const p=await load(work+'/plan.json');assert.equal(approved,p.seal,'Exact separate deployment approval required')
 try{await access(work+'/execution-intent.json');throw Error('Consumed scope; inspect only')}catch(e){if(e.code!=='ENOENT')throw e}
 const release=await checked(work,p)
 await save(work+'/execution-intent.json',{seal:p.seal,started_utc:new Date().toISOString(),automatic_retry:false})
 const execution=work+'/execution';await mkdir(execution,{mode:0o700});await backup(p,execution)
 await checked(work,p)
 await save(execution+'/prepare.json',await remote(p,'prepare',{approved}))
 const destination='/var/lib/inactive-history-releases/'+p.release_id,scp=sshArgs(p.target).filter(v=>v!=='-T')
 for(const [local,name]of [['application.tar.gz','release.tar.gz'],['inventory.json','inventory.json']])await run('scp',[...scp,work+'/'+local,'root@'+p.target.host+':'+destination+'/'+name],{env:cleanEnv(),timeout:180000})
 await save(execution+'/stage.json',await remote(p,'stage',{approved}))
 await save(execution+'/candidate.json',await remote(p,'candidate',{approved}))
 await checked(work,p)
 await save(execution+'/sql-intent.json',{seal:p.seal,migrations:p.migrations.map(m=>m.version),automatic_retry:false})
 const db=await connect(p.target,{readOnly:false});let receipt
 try{receipt=await applySchema(db,release,p,{beforeCommit:value=>save(execution+'/sql-before-commit.json',value)})}finally{await db.end()}
 await save(execution+'/sql-committed.json',receipt)
 const afterSql=await readState(p.target,release,true);assert.deepEqual(afterSql.schema,p.expected_after_schema)
 await save(execution+'/activate.json',await remote(p,'activate',{approved,database:{...receipt,plan_sha256:p.seal,read_only:afterSql.read_only==='on'}}))
 const runtime=await remote(p,'inspect');assert.equal(runtime.current,p.target.root+'/releases/'+p.release_id)
 assert.deepEqual(runtime.caddy,p.before.caddy);assert.deepEqual(runtime.media,p.before.media);assert.deepEqual(runtime.private_files,p.before.private_files)
 const verify=await connect(p.target)
 try{await compareOriginal(verify,p.database.protected_tables.filter(t=>!['store_analytics_events','store_analytics_sessions'].includes(t.name)),{authSecurity:p.database.auth_security});await databaseState(verify,release,{after:true})}finally{await verify.end()}
 assert.deepEqual(await authState(p.target),p.auth)
 await save(execution+'/completed.json',{result:'DEPLOY_PASS',seal:p.seal,release:p.release_id,schema:94,migrations_applied:3,history_imported:0,claims:0,purchasing:'CLOSED',signup:'CLOSED',provider_calls:0,caddy_runtime_unchanged:true,previous_release:p.before.current,completed_utc:new Date().toISOString()})
 console.log(JSON.stringify({result:'DEPLOY_PASS',release:p.release_id,schema:94,history_imported:0}))
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const [mode,directory,approved]=process.argv.slice(2);assert.ok(['seal','check','apply'].includes(mode));await ({seal,check,apply}[mode])(resolve(directory),approved)}
 catch(error){console.error(JSON.stringify({result:'STOP',error_type:error.name,message:'Preserve evidence; no automatic retry or rollback.'}));process.exitCode=1}
}
