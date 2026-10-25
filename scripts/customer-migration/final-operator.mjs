// One exact source/payload import plus the three required history-only routes.
// Production writes are unreachable without the separately recorded owner seal.
import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir,access,copyFile} from 'node:fs/promises'
import {execFile,spawnSync} from 'node:child_process'
import {promisify} from 'node:util'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {connect} from '../commerce-release/database.mjs'
import {remote as inspectRuntime} from '../inactive-history-release/operator.mjs'
import {historyBatches,historyDigest} from './batches.mjs'
import {baseline,targetIdentity,ownershipAuthority,historyCounts,verifyImported,importBatchPreserving,digest,sha} from './final-db.mjs'
import {prepareRecovery} from './final-backup.mjs'

const here=dirname(fileURLToPath(import.meta.url)),repo=resolve(here,'../..'),run=promisify(execFile),load=async p=>JSON.parse(await readFile(p,'utf8'))
const save=(p,v)=>writeFile(p,JSON.stringify(v,null,2)+'\n',{flag:'wx',mode:0o600})
export const scope=Object.freeze({historical_import:true,schema_migrations:0,application_deployments:0,auth_creation:0,password_imports:0,current_profile_updates:0,current_commerce_writes:0,automatic_auth_links:0,provider_calls:0,public_signup:false,public_purchasing:false,caddy_history_routes_only:true,caddy_signals_max:1,application_restarts:0,automatic_retry:false,automatic_rollback:false,git_push:false})
export function assertScope(p){assert.equal(p.format,1);assert.deepEqual(p.scope,scope);assert.equal(p.schema,94);assert.equal(p.batch_count,41);assert.equal(p.expected_counts.customers,516);assert.equal(p.expected_counts.orders,597);assert.equal(p.expected_counts.items,1789);assert.equal(p.eligibility.eligible_customers,513);assert.equal(p.eligibility.held_customers,3)}
export function assertRecovery(p,now=Date.now()){
 const time=Date.parse(p.recovery.qualified_utc);assert.ok(Number.isFinite(time)&&time<=now&&now-time<=6*3600000,'Fresh authenticated recovery proof expired')
 assert.equal(p.recovery.authenticated_full_readback,true);assert.equal(p.recovery.native_restoration_and_final_import,true);assert.equal(p.recovery.managed_vault_secret_rows,0)
}
export async function assertOwnerApproval(work,p,approved){
 assert.equal(approved,p.seal,'Exact final history import approval required')
 const receipt=await load(work+'/IMPORT-APPROVAL.receipt.json');assert.equal(receipt.approved,true);assert.equal(receipt.plan_sha256,p.seal);assert.equal(receipt.action,'import_customer_history_and_history_routes')
 try{await access(work+'/execution-intent.json');throw Error('Consumed history import scope; inspect receipts only')}catch(e){if(e.code!=='ENOENT')throw e}
}
const cleanEnv=()=>({PATH:dirname(process.execPath)+':/usr/local/bin:/usr/bin:/bin',HOME:process.env.HOME,LANG:'C',NODE_ENV:'production'})
const shell=s=>"'"+s.replaceAll("'","'\\''")+"'"
export async function ingressRemote(p,mode,{approved=null,proof=null,text=null}={}){
 if(mode==='apply'){assertScope(p);assert.equal(approved,p.seal)}else assert.equal(mode,'check')
 const t=p.target,source=await readFile(here+'/final-remote.py','utf8'),cmd='python3 -I -S -B -c '+shell('import sys,json,io;q=json.load(sys.stdin);sys.stdin=io.StringIO(json.dumps(q));sys.argv=["history-remote.py"];exec(compile(q["source"],"history-remote.py","exec"))')
 const child=run('ssh',['-T','-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','-o','HostKeyAlgorithms=ssh-ed25519','-o','UserKnownHostsFile='+t.known_hosts,'-o','ConnectTimeout=12','-o','ServerAliveInterval=10','-o','ServerAliveCountMax=2','-i',t.identity,'root@'+t.host,cmd],{env:cleanEnv(),timeout:120000,maxBuffer:8e6})
 child.child.stdin.on('error',()=>{});child.child.stdin.end(JSON.stringify({source,plan:p,mode,approved,import_proof:proof,proposed_text:text}));return JSON.parse((await child).stdout)
}
async function inputs(){
 const names=(await run('git',['ls-files','--cached','--others','--exclude-standard','--','scripts','tests','docs/operations/backup-envelope.mjs'],{cwd:repo,maxBuffer:8e6})).stdout.trim().split('\n').sort()
 return Object.fromEntries(await Promise.all(names.map(async n=>[n,sha(await readFile(repo+'/'+n))])))
}
function open(p,path){const r=spawnSync(process.execPath,[p.backup.envelope,'decrypt',p.backup.key,path],{env:cleanEnv(),maxBuffer:128*1024*1024,timeout:120000});assert.equal(r.status,0,'Private review authentication failed');return JSON.parse(r.stdout)}
async function local(work,p){
 const {seal,...body}=p;assert.equal(digest(body),seal);assertScope(p);assertRecovery(p)
 assert.equal((await run('git',['rev-parse','HEAD'],{cwd:repo})).stdout.trim(),p.operator_commit);assert.deepEqual(await inputs(),p.tools)
 for(const[name,h]of Object.entries(p.evidence_sha256))assert.equal(sha(await readFile(name)),h,'Import evidence changed: '+name)
 for(const[name,h]of Object.entries(p.protected_inputs))assert.equal(sha(await readFile(name)),h,'Protected target input changed')
 const owner=await load(p.source_approval);assert.equal(owner.approved,true);assert.equal(owner.packet_sha256,p.source_approval_seal);assert.equal(owner.production_write_authority,false)
 const prepared=open(p,work+'/customer-history-final.json.enc'),review=open(p,work+'/ownership-eligibility.json.enc'),manifest=await load(work+'/final-manifest.private.json'),batches=historyBatches(prepared)
 assert.equal(prepared.payload_sha256,p.payload_sha256);assert.equal(manifest.payload_sha256,p.payload_sha256);assert.equal(digest(review),p.eligibility_digest);assert.equal(prepared.summary.claim_approvals,513)
 assert.equal(prepared.payload.source_sha256,p.source_sha256);assert.equal(manifest.source_sha256,p.source_sha256);assert.equal(review.source_sha256,p.source_sha256)
 const allowed=new Set(review.eligible_legacy_ids);for(const c of prepared.payload.customers){assert.equal(c.claim_approved,allowed.has(c.legacy_id));assert.equal(c.review_evidence,c.claim_approved?p.eligibility_digest:null)}
 const batchIndex=batches.map((b,index)=>({index,id:b.id,sha256:historyDigest(b.payload),bytes:Buffer.byteLength(JSON.stringify(b.payload)),customers:b.payload.customers.length,orders:b.payload.orders.length,items:b.payload.items.length}))
 assert.equal(digest(batchIndex),p.batch_index_sha256)
 const proof=await load(work+'/recovery-and-import-proof.json');assert.equal(proof.result,'NATIVE_94_RESTORE_AND_FINAL_41_BATCH_IMPORT_PASS');assert.equal(proof.migrations_applied,0);assert.equal(proof.final_auth_links,0)
 assert.equal(proof.payload_sha256,p.payload_sha256);assert.equal(proof.eligibility_digest,p.eligibility_digest);assert.equal(proof.batch_index_sha256,p.batch_index_sha256);assert.equal(proof.backup_encrypted_sha256,sha(await readFile(work+'/backups/database-before.dump.enc')))
 assert.equal(proof.shared_batch_helper_sha256,sha(await readFile(here+'/final-db.mjs')),'Native proof does not cover this exact batch helper')
 for(const name of ['database-before.dump','runtime-recovery.tar.gz']){const v=JSON.parse((await run(process.execPath,[p.backup.envelope,'verify',p.backup.key,work+'/backups/'+name+'.enc'],{env:cleanEnv(),timeout:180000})).stdout);assert.equal(v.authenticatedDecryption,true)}
 return {prepared,manifest,batches}
}
async function checked(work,p){
 const data=await local(work,p),spec=await load(work+'/spec.json'),deployed=await load(spec.deployed_workspace+'/plan.json'),runtime=await inspectRuntime(deployed,'inspect')
 assert.equal(runtime.current,p.target.root+'/releases/'+p.release_id);assert.equal(runtime.verified.archive_sha256,p.archive_sha256)
 for(const[name,v]of Object.entries(p.runtime_recovery_files))assert.deepEqual(runtime.recovery_files[name],v,'Runtime/Caddy inputs changed')
 const db=await connect(p.target)
 try{await db.query('begin isolation level repeatable read read only');const state=await baseline(db);assert.equal(digest({history:state.history,schema:state.schema,history_schema:state.history_schema}),p.schema_authority_sha256);assert.deepEqual(state.tables,p.tables);assert.ok(Object.values(state.history_counts).every(n=>n===0),'History already contains records; do not import over them');assert.equal(digest(ownershipAuthority(await targetIdentity(db))),p.ownership_authority_sha256,'Ownership authority changed; review current identity inputs');await db.query('rollback')}finally{await db.end()}
 const c=await load(p.target.credentials_file),r=await fetch('https://'+p.target.project_ref+'.supabase.co/auth/v1/settings',{headers:{apikey:c.anon_key},signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);const a=await r.json();assert.equal(a.disable_signup,true);assert.equal(a.mailer_autoconfirm,false)
 assert.equal((await ingressRemote(p,'check')).result,'HISTORY_INGRESS_READ_ONLY_CHECK_PASS');return data
}
export async function seal(work){
 const spec=await load(work+'/spec.json'),manifest=await load(work+'/final-manifest.private.json'),state=await load(work+'/database-before.private.json'),backup=await load(work+'/backup-effective-config.json'),proof=await load(work+'/recovery-and-import-proof.json'),back=await load(work+'/backup-proof.json'),runtime=await load(work+'/runtime-before.json'),ingress=await load(work+'/history-ingress-proposal.json'),ingressProof=await load(work+'/history-ingress-qualification.json'),target=await load(work+'/target.json'),deploy=await load(spec.deployed_workspace+'/DEPLOYMENT-RECEIPT.json')
 assert.equal(ingressProof.result,'EXACT_HISTORY_INGRESS_PROPOSAL_ADAPT_AND_DIFF_PASS');assert.equal(proof.result,'NATIVE_94_RESTORE_AND_FINAL_41_BATCH_IMPORT_PASS')
 const tests=await readFile(work+'/operator-tests.log','utf8');assert.match(tests,/^# pass 7$/m);assert.match(tests,/^# fail 0$/m);assert.match(tests,/^# skipped 0$/m)
 const names=['spec.json','target.json','backup-effective-config.json','final-manifest.private.json','batch-index.json','customer-history-final.json.enc','customer-history-final.json.enc.receipt.json','ownership-eligibility.json.enc','ownership-eligibility.json.enc.receipt.json','target-identities.json.enc','target-identities.json.enc.receipt.json','database-before.private.json','database-context.json','runtime-before.json','auth-before.json','roles-before.private.json','backup-proof.json','backups/database-before.dump.enc','backups/database-before.dump.receipt.json','backups/runtime-recovery.tar.gz.enc','backups/runtime-recovery.tar.gz.receipt.json','recovery-and-import-proof.json','native-batch-receipts.json','Caddyfile.before.private','Caddyfile.proposed.private','history-ingress-proposal.json','history-ingress-qualification.json','history-ingress-method-matrix.json','operator-tests.log','prepare-final-data.mjs','rehearse-final-import.mjs','validate-ingress-proposal.mjs']
 const evidence=Object.fromEntries(await Promise.all(names.map(async n=>[work+'/'+n,sha(await readFile(work+'/'+n))])));evidence[spec.approved_source_receipt]=sha(await readFile(spec.approved_source_receipt));evidence[spec.deployed_workspace+'/DEPLOYMENT-RECEIPT.json']=sha(await readFile(spec.deployed_workspace+'/DEPLOYMENT-RECEIPT.json'))
 const protectedNames=[target.credentials_file,target.database.ca_file,target.identity,target.known_hosts,backup.key,backup.pg_dump,dirname(backup.pg_dump)+'/pg_restore',process.execPath]
 const p={format:1,created_utc:new Date().toISOString(),scope,schema:94,target,release_id:deploy.release,archive_sha256:deploy.archive_sha256,source_approval:spec.approved_source_receipt,source_approval_seal:manifest.source_approval_seal,source_key:manifest.source_key,source_sha256:manifest.source_sha256,source_id:manifest.source_id,payload_sha256:manifest.payload_sha256,private_review_sha256:manifest.private_review_sha256,eligibility_digest:manifest.review_sha256,eligibility:manifest.eligibility_summary,batch_count:41,batch_index_sha256:manifest.batch_index_sha256,expected_counts:{sources:1,batches:41,customers:516,orders:597,items:1789},ownership_authority_sha256:manifest.ownership_authority_sha256,schema_authority_sha256:digest({history:state.history,schema:state.schema,history_schema:state.history_schema}),tables:state.tables,backup,recovery:{qualified_utc:new Date(Math.min(Date.parse(back.captured_utc),Date.parse(back.verified_utc),Date.parse(proof.verified_utc))).toISOString(),authenticated_full_readback:true,native_restoration_and_final_import:true,managed_vault_secret_rows:0},runtime_recovery_files:runtime.recovery_files,ingress:{config_file:'/etc/caddy/Caddyfile',before_sha256:ingress.before_sha256,proposed_sha256:ingress.proposed_sha256,allowed_routes:ingress.added_routes,signals_max:1},tools:await inputs(),evidence_sha256:evidence,protected_inputs:Object.fromEntries(await Promise.all(protectedNames.map(async n=>[n,sha(await readFile(n))]))),operator_commit:(await run('git',['rev-parse','HEAD'],{cwd:repo})).stdout.trim(),approval_phrase:'APPROVE HISTORY IMPORT',rollback:{automatic:false,source_hide_requires_separate_approval:true,no_current_data_restore:true}}
 p.seal=digest(p);await checked(work,p);await save(work+'/final-import-plan.json',p);console.log(JSON.stringify({result:'HISTORY_IMPORT_READY_FOR_OWNER_APPROVAL',seal:p.seal,approval:p.approval_phrase+' '+p.seal,production_writes:0}));return p
}
export async function check(work){const p=await load(work+'/final-import-plan.json');await checked(work,p);console.log(JSON.stringify({result:'FINAL_HISTORY_READ_ONLY_CHECK_PASS',seal:p.seal,production_writes:0}))}
export async function apply(work,approved){
 const p=await load(work+'/final-import-plan.json');await assertOwnerApproval(work,p,approved);const data=await checked(work,p)
 await save(work+'/execution-intent.json',{seal:p.seal,started_utc:new Date().toISOString(),automatic_retry:false});const execution=work+'/execution';await mkdir(execution,{mode:0o700})
 for(const name of ['spec.json','target.json','backup-config.json'])await copyFile(work+'/'+name,execution+'/'+name)
 await prepareRecovery(execution);await checked(work,p)
 const db=await connect(p.target,{readOnly:false})
 try{
  for(const[index,batch]of data.batches.entries()){
   await save(execution+'/batch-'+index+'-intent.json',{id:batch.id,sha256:historyDigest(batch.payload),automatic_retry:false})
   const result=await importBatchPreserving(db,{sourceId:p.source_id,sourceKey:p.source_key,sourceSha256:p.source_sha256,tables:p.tables},batch)
   await save(execution+'/batch-'+index+'-receipt.json',result)
  }
  const verified=await verifyImported(db,data.prepared,p.source_id);assert.deepEqual({...verified.counts,claims:undefined},{...p.expected_counts,claims:undefined});assert.equal(verified.counts.claims,0)
  const proof={all_record_totals_currency_dates_items_refunds_addresses_events_equal:true,original_data_preservation:'PASS',source_id:p.source_id,...verified};await save(execution+'/import-verified.json',proof)
  const opened=await ingressRemote(p,'apply',{approved,proof,text:await readFile(work+'/Caddyfile.proposed.private','utf8')});assert.equal(opened.result,'HISTORY_ONLY_INGRESS_PASS');await save(execution+'/ingress.json',opened)
  const final=await verifyImported(db,data.prepared,p.source_id);await save(execution+'/completed.json',{result:'HISTORY_IMPORT_PASS',seal:p.seal,source_id:p.source_id,batches:41,counts:final.counts,eligibility:p.eligibility,auth_creation:0,passwords_imported:0,current_profile_updates:0,original_business_data_writes:0,automatic_auth_links:0,provider_calls:0,public_signup:'CLOSED',public_purchasing:'CLOSED',application_restarts:0,caddy_signals:1,hosted_owner_acceptance:'PENDING_OWNER_BROWSER',completed_utc:new Date().toISOString()})
 }finally{await db.end()}
 console.log(JSON.stringify({result:'HISTORY_IMPORT_PASS',seal:p.seal,batches:41}))
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const[mode,dir,approved]=process.argv.slice(2);assert.ok(['seal','check','apply'].includes(mode));await({seal,check,apply}[mode])(resolve(dir),approved)}catch(e){console.error(JSON.stringify({result:'STOP',error_type:e.name,message:'Preserve receipts. No automatic retry, second signal or rollback.'}));process.exitCode=1}
}
