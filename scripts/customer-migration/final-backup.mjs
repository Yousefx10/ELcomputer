// Read-only exported-snapshot backup. No production writes or configuration edits.
import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises'
import {spawn,execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {dirname,resolve} from 'node:path'
import {pipeline} from 'node:stream/promises'
import {fileURLToPath} from 'node:url'
import {connect} from '../commerce-release/database.mjs'
import {remote as inspectRuntime} from '../inactive-history-release/operator.mjs'
import {remote as footerRemote} from '../footer-release/operator.mjs'
import {decryptTo} from '../live-sales-release/operator.mjs'
import {baseline,targetIdentity,sha} from './final-db.mjs'

const run=promisify(execFile),load=async p=>JSON.parse(await readFile(p,'utf8'))
const save=(p,v)=>writeFile(p,JSON.stringify(v,null,2)+'\n',{flag:'wx',mode:0o600})
const cleanEnv=()=>({PATH:dirname(process.execPath)+':/usr/local/bin:/usr/bin:/bin',HOME:process.env.HOME,LANG:'C',NODE_ENV:'production'})
const exited=p=>new Promise((yes,no)=>{p.once('error',no);p.once('close',yes)})

async function encrypt(work,name,source,config){
 const sink=spawn(process.execPath,[config.envelope,'encrypt',config.key,work+'/'+name+'.enc'],{env:cleanEnv(),stdio:['pipe','pipe','pipe'],timeout:180000}),output=[],errors=[]
 source.stderr.on('data',b=>errors.push(b));sink.stderr.on('data',b=>errors.push(b));sink.stdout.on('data',b=>output.push(b))
 const results=await Promise.allSettled([exited(source),exited(sink),pipeline(source.stdout,sink.stdin)])
 await writeFile(work+'/'+name+'.diagnostics',Buffer.concat(errors),{flag:'wx',mode:0o600})
 assert.ok(results.every(r=>r.status==='fulfilled')&&results[0].value===0&&results[1].value===0,'Encrypted backup failed')
 const receipt=JSON.parse(Buffer.concat(output)),verified=JSON.parse((await run(process.execPath,[config.envelope,'verify',config.key,work+'/'+name+'.enc'],{env:cleanEnv(),timeout:180000})).stdout)
 assert.equal(verified.authenticatedDecryption,true);assert.equal(verified.plaintextSha256,receipt.plaintextSha256);assert.equal(verified.encryptedSha256,receipt.encryptedSha256)
 await save(work+'/'+name+'.receipt.json',{...receipt,authenticatedDecryption:true});return receipt
}

async function readback(work,name,command,args,config,{keepOutput=false}={}){
 return decryptTo({backup:config},work,name,command,args,{...cleanEnv(),DYLD_LIBRARY_PATH:config.library_path},keepOutput?'final-output':'final-full')
}

export async function prepareRecovery(work){
 const spec=await load(work+'/spec.json'),prior=await load(spec.deployed_workspace+'/plan.json'),receipt=await load(spec.deployed_workspace+'/DEPLOYMENT-RECEIPT.json'),target=await load(work+'/target.json')
 assert.equal(receipt.result,'DEPLOY_PASS_INACTIVE');assert.equal(receipt.release,spec.expected_release);assert.equal(spec.expected_schema,94)
 const runtime=await inspectRuntime(prior,'inspect');assert.equal(runtime.current,target.root+'/releases/'+spec.expected_release);assert.equal(runtime.verified.archive_sha256,receipt.archive_sha256)
 await save(work+'/runtime-before.json',runtime)
 const config=await load(work+'/backup-config.json');config.envelope=fileURLToPath(new URL('../../docs/operations/backup-envelope.mjs',import.meta.url));await save(work+'/backup-effective-config.json',config)
 const db=await connect(target);let exported,dump,dbReceipt,state,identity,context
 await mkdir(work+'/backups',{mode:0o700})
 try{
  await db.query("begin isolation level repeatable read read only;set local idle_in_transaction_session_timeout='5min'")
  exported=(await db.query('select pg_export_snapshot() snapshot')).rows[0].snapshot
  const credentials=await load(target.credentials_file)
  const env={...cleanEnv(),DYLD_LIBRARY_PATH:config.library_path,PGHOST:target.database.host,PGPORT:'5432',PGDATABASE:'postgres',PGUSER:'postgres',PGPASSWORD:credentials.database_password,PGSSLMODE:'verify-full',PGSSLROOTCERT:target.database.ca_file,PGCONNECT_TIMEOUT:'12',PGOPTIONS:'-c default_transaction_read_only=on -c statement_timeout=120000 -c lock_timeout=5000'}
  dump=encrypt(work+'/backups','database-before.dump',spawn(config.pg_dump,['-w','-Fc','-Z0','--lock-wait-timeout=5000','--snapshot='+exported],{env,stdio:['ignore','pipe','pipe'],timeout:180000}),config)
  // Both clients observe the same exported PostgreSQL snapshot. Catalog edits
  // outside this transaction need not be paused or adopted into this approval.
  const observed=async()=>{
   state=await baseline(db);assert.ok(Object.values(state.history_counts).every(n=>n===0),'History is not empty; do not import over it')
   identity=await targetIdentity(db);identity.project_ref=target.project_ref
   context=(await db.query("select current_setting('TimeZone') timezone,current_setting('search_path') search_path,current_setting('server_version') server_version,(select count(*)::int from vault.secrets) vault_secret_rows")).rows[0]
   assert.equal(context.vault_secret_rows,0)
   await save(work+'/roles-before.private.json',(await db.query('select rolname,rolinherit,rolbypassrls from pg_roles order by rolname')).rows)
   return state
  }
  const results=await Promise.allSettled([dump,observed()]);assert.ok(results.every(r=>r.status==='fulfilled'),'Snapshot or backup failed');dbReceipt=results[0].value
  await db.query('rollback')
 }finally{await db.end()}
 await save(work+'/database-before.private.json',state);await save(work+'/database-context.json',context)
 const raw=Buffer.from(JSON.stringify(identity))
 const child=spawn(process.execPath,[config.envelope,'encrypt',config.key,work+'/target-identities.json.enc'],{env:cleanEnv(),stdio:['pipe','pipe','pipe'],timeout:120000}),parts=[];child.stdout.on('data',b=>parts.push(b));child.stderr.resume();child.stdin.end(raw);assert.equal(await exited(child),0)
 await save(work+'/target-identities.json.enc.receipt.json',JSON.parse(Buffer.concat(parts)))
 return finishRecovery(work)
}

export async function finishRecovery(work){
 const config=await load(work+'/backup-effective-config.json'),target=await load(work+'/target.json'),spec=await load(work+'/spec.json'),runtime=await load(work+'/runtime-before.json'),state=await load(work+'/database-before.private.json'),dbReceipt=await load(work+'/backups/database-before.dump.receipt.json')
 const pgRestore=dirname(config.pg_dump)+'/pg_restore',toc=await readback(work+'/backups','database-before.dump',pgRestore,['--list'],config,{keepOutput:true})
 for(const name of ['customer_history_private','customer_profiles','customer_orders','identities','schema_migrations'])assert.ok(toc.toString().includes(name))
 await writeFile(work+'/backups/database-toc.txt',toc,{flag:'wx',mode:0o600});await readback(work+'/backups','database-before.dump',pgRestore,['--file=/dev/null'],config)
 const runtimeBytes=await footerRemote({target,before:runtime,release_id:spec.expected_release,archive_bytes:0},'recovery',{bytes:true})
 const runtimeSource=spawn(process.execPath,['-e','process.stdin.pipe(process.stdout)'],{env:cleanEnv(),stdio:['pipe','pipe','pipe']});runtimeSource.stdin.end(runtimeBytes)
 const runtimeReceipt=await encrypt(work+'/backups','runtime-recovery.tar.gz',runtimeSource,config)
 const expected=Object.fromEntries(Object.entries(runtime.recovery_files).map(([path,v])=>[path.slice(1),v.sha256]))
 const verifier='import sys,tarfile,json,hashlib;q=json.loads(sys.argv[1]);seen=set();t=tarfile.open(fileobj=sys.stdin.buffer,mode="r|gz");\nfor m in t:\n assert m.isfile() and m.name in q and m.name not in seen;seen.add(m.name);assert hashlib.sha256(t.extractfile(m).read()).hexdigest()==q[m.name]\nassert seen==set(q)\nprint(json.dumps({"files":len(seen),"full_byte_readback":True}))'
 const runtimeProof=JSON.parse(await readback(work+'/backups','runtime-recovery.tar.gz','python3',['-c',verifier,JSON.stringify(expected)],config,{keepOutput:true}))
 const credentials=await load(target.credentials_file),r=await fetch('https://'+target.project_ref+'.supabase.co/auth/v1/settings',{headers:{apikey:credentials.anon_key},signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);const a=await r.json();assert.equal(a.disable_signup,true);assert.equal(a.mailer_autoconfirm,false)
 await save(work+'/auth-before.json',{disable_signup:true,mailer_autoconfirm:false,external:a.external})
 const proof={result:'EXPORTED_SNAPSHOT_BACKUP_AUTHENTICATED_FULL_READBACK_PASS',verified_utc:new Date().toISOString(),schema:94,consistent_exported_snapshot:true,database:{...dbReceipt,pg_restore_list:'PASS',pg_restore_full_readback:'PASS'},runtime:{...runtimeReceipt,...runtimeProof},snapshot_sha256:sha(await readFile(work+'/database-before.private.json')),captured_utc:(await stat(work+'/backups/database-before.dump.enc')).birthtime.toISOString(),production_writes:0}
 await save(work+'/backup-proof.json',proof);console.log(JSON.stringify({result:proof.result,protected_tables:state.tables.length,current_users:state.protected_tables.find(t=>t.schema==='auth'&&t.name==='users').count,database_bytes:dbReceipt.plaintextBytes,runtime_files:runtimeProof.files,production_writes:0}))
 return proof
}

if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname){
 try{if(process.argv[2]==='finish')await finishRecovery(resolve(process.argv[3]));else await prepareRecovery(resolve(process.argv[2]))}catch(e){console.error(JSON.stringify({result:'READ_ONLY_PREPARATION_STOP',error_type:e.name,message:String(e.message).split('\n')[0]}));process.exitCode=1}
}
