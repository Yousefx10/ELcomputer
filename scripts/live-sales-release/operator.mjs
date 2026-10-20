#!/usr/bin/env node
import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir,readdir,lstat,chmod,access} from 'node:fs/promises'
import {resolve,dirname,relative} from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFile,spawn} from 'node:child_process'
import {promisify} from 'node:util'
import {pipeline} from 'node:stream/promises'
import {create as tarCreate} from 'tar'
import {inventory} from '../publish/inventory.mjs'
import {canonical} from '../commerce-release/operator.mjs'
import {hash,migrations,connect,checkDatabase,applyMigrations,compareOriginal,verifyAccess} from './database.mjs'
import {assertAuthSecurityShape} from './auth.mjs'
const run=promisify(execFile),here=dirname(fileURLToPath(import.meta.url)),repo=resolve(here,'../..')
export const digest=value=>hash(canonical(value))
const load=async file=>JSON.parse(await readFile(file,'utf8'))
const save=(file,value)=>writeFile(file,JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'})
export function argumentsFor(args){
  if(args.length===3&&args[0]==='prepare')return {mode:'prepare',spec:resolve(args[1]),directory:resolve(args[2])}
  if(args.length===2&&args[0]==='check')return {mode:'check',plan:resolve(args[1])}
  if(args.length===4&&args[0]==='rebind')return {mode:'rebind',previous:resolve(args[1]),evidence:resolve(args[2]),directory:resolve(args[3])}
  if(args.length===4&&args[0]==='apply'&&args[2]==='--approved'&&/^[a-f0-9]{64}$/.test(args[3]))return {mode:'apply',plan:resolve(args[1]),approval:args[3]}
  throw Error('Use prepare SPEC NEW_DIRECTORY, rebind OLD_PLAN AUTH_EVIDENCE NEW_DIRECTORY, check PLAN, or apply PLAN --approved EXACT_DIGEST')
}
function sshArgs(t){assert.match(t.host,/^[A-Za-z0-9.-]+$/);return ['-T','-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','-o','HostKeyAlgorithms=ssh-ed25519','-o','UserKnownHostsFile='+t.known_hosts,'-o','ConnectionAttempts=1','-o','ConnectTimeout=12','-o','ServerAliveInterval=15','-o','ServerAliveCountMax=2','-o','ControlMaster=no','-i',t.identity]}
const shell=value=>"'"+String(value).replaceAll("'","'\\''")+"'"
export function remoteCommand(){
  // The full sealed plan exceeds common per-argument limits. Structured stdin
  // carries both source and plan without shell expansion or remote staging.
  return 'python3 -c '+shell('import sys,json; p=json.load(sys.stdin); sys.argv=["live-sales-remote.py",p["mode"],json.dumps(p["plan"])]+(["--approved",p["plan"]["seal"]] if "seal" in p["plan"] else []); exec(compile(p["source"],"live-sales-remote.py","exec"))')
}
async function remoteProcess(plan,mode){
  const source=await readFile(here+'/remote.py','utf8')
  const child=spawn('ssh',[...sshArgs(plan.target),'root@'+plan.target.host,remoteCommand()],{stdio:['pipe','pipe','pipe'],timeout:180000})
  child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({source,plan,mode}));return child
}
async function remote(plan,mode,{bytes=false}={}){
  const child=await remoteProcess(plan,mode),output=[],errors=[];let size=0
  child.stdout.on('data',chunk=>{size+=chunk.length;if(size>128*1024*1024)child.kill('SIGTERM');else output.push(chunk)})
  child.stderr.on('data',chunk=>errors.push(chunk))
  const code=await exited(child);assert.equal(code,0,'Pinned remote phase failed: '+mode);assert.ok(size<=128*1024*1024)
  const data=Buffer.concat(output);return bytes?data:JSON.parse(data)
}
async function inputs(){
  const names=(await run('git',['ls-files','-z'],{cwd:repo,maxBuffer:8e6})).stdout.split('\0').filter(n=>/^(app|server|public|i18n)\//.test(n)||['package.json','package-lock.json','nuxt.config.ts','tsconfig.json'].includes(n))
  return Object.fromEntries(await Promise.all(names.map(async name=>[name,hash(await readFile(repo+'/'+name))])))
}
export async function toolHashes(){return Object.fromEntries(await Promise.all(['operator.mjs','database.mjs','auth.mjs','remote.py','../commerce-release/database.mjs','../commerce-release/operator.mjs','../clean-reinstall/deploy.py','../publish/inventory.mjs','../publish/contracts.mjs','../lib/cleanBaseline.mjs','../../docs/operations/backup-envelope.mjs'].map(async name=>[name,hash(await readFile(resolve(here,name)))])))}
const cleanEnv=()=>({PATH:dirname(process.execPath)+':/usr/local/bin:/usr/bin:/bin',HOME:process.env.HOME,LANG:'C',NODE_ENV:'production'})
const exited=child=>new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve)})
async function logged(command,args,cwd,file,{timeout=600000,env=cleanEnv()}={}){
  const child=spawn(command,args,{cwd,env,stdio:['ignore','pipe','pipe'],timeout}),chunks=[]
  child.stdout.on('data',x=>chunks.push(x));child.stderr.on('data',x=>chunks.push(x));const code=await exited(child)
  await writeFile(file,Buffer.concat(chunks),{flag:'wx',mode:0o600});assert.equal(code,0,'Private build log retained')
}
export function stable(state){return Object.fromEntries(Object.entries(state).filter(([key])=>!['observed_utc','free_bytes','production_writes'].includes(key)))}
const telemetry=new Set(['public.store_analytics_sessions','public.store_analytics_events'])
// Live storefront telemetry can advance between read-only observations. Bind
// its schema here; SQL still locks and compares ALL original rows in both tables.
export function approvalState(state){return {...state,protected_tables:state.protected_tables.map(table=>{
  if(telemetry.has(table.schema+'.'+table.name))return {schema:table.schema,name:table.name,columns:table.columns,live_telemetry:true}
  if(table.schema==='auth'&&table.name==='users'){
    assertAuthSecurityShape(state.auth_security,table)
    return {...table,sha256:state.auth_security.sha256,projection:'identity-security-v1'}
  }
  return table
})}}
async function databaseState(target,release,{after=false}={}){
  const db=await connect(target)
  try{await db.query('begin isolation level repeatable read read only');const state=await checkDatabase(db,release,{after});await db.query('commit');return state}finally{await db.end()}
}
async function authState(target){
  const c=await load(target.credentials_file)
  const response=await fetch('https://'+target.project_ref+'.supabase.co/auth/v1/settings',{headers:{apikey:c.anon_key},signal:AbortSignal.timeout(15000)})
  assert.equal(response.status,200);const settings=await response.json()
  assert.equal(settings.disable_signup,true);assert.equal(settings.mailer_autoconfirm,false)
  return {disable_signup:true,mailer_autoconfirm:false}
}
export async function publicHealth(plan){
  const checks=[]
  for(const [path,expected]of [['/',200],['/dashboard/login',200],['/api/admin-products/list',401],['/api/customer-users',401],['/account',302],['/ar/account',302],['/checkout',403],['/ar/checkout',403],['/api/checkout',403],['/login',403],['/signup',403],['/api/payments/paymob/webhook',403],['/api/webhooks/pdc',403],['/private/shipping-documents/probe.pdf',404]]){
    const response=await fetch(plan.target.origin+path,{redirect:'manual',signal:AbortSignal.timeout(12000)});await response.body?.cancel();assert.equal(response.status,expected,'Live route failed: '+path);checks.push({method:'GET',path,status:response.status})
  }
  return checks
}
async function encryptStream(plan,work,name,source){
  const b=plan.backup;assert.equal(b.envelope,resolve(here,'../../docs/operations/backup-envelope.mjs'))
  const encrypted=spawn(process.execPath,[b.envelope,'encrypt',b.key,work+'/'+name+'.enc'],{env:cleanEnv(),stdio:['pipe','pipe','pipe'],timeout:180000})
  const errors=[],receipt=[];source.stderr.on('data',x=>errors.push(x));encrypted.stderr.on('data',x=>errors.push(x));encrypted.stdout.on('data',x=>receipt.push(x))
  const outcomes=await Promise.allSettled([exited(source),exited(encrypted),pipeline(source.stdout,encrypted.stdin)])
  await writeFile(work+'/'+name+'.diagnostics',Buffer.concat(errors),{flag:'wx',mode:0o600})
  assert.ok(outcomes.every(r=>r.status==='fulfilled')&&outcomes[0].value===0&&outcomes[1].value===0,'Encrypted backup failed')
  const captured=JSON.parse(Buffer.concat(receipt)),verified=JSON.parse((await run(process.execPath,[b.envelope,'verify',b.key,work+'/'+name+'.enc'],{env:cleanEnv(),timeout:180000})).stdout)
  assert.equal(verified.authenticatedDecryption,true);assert.equal(captured.plaintextSha256,verified.plaintextSha256);assert.equal(captured.encryptedSha256,verified.encryptedSha256)
  await save(work+'/'+name+'.receipt.json',{...captured,authenticatedDecryption:true,verified_utc:new Date().toISOString()});return captured
}
export async function decryptTo(plan,work,name,command,args,env=cleanEnv(),label='readback'){
  const b=plan.backup,source=spawn(process.execPath,[b.envelope,'decrypt',b.key,work+'/'+name+'.enc'],{env:cleanEnv(),stdio:['ignore','pipe','pipe'],timeout:180000})
  // Some archive readers exit after the TOC. Drain authenticated plaintext in
  // bounded memory first so they cannot close the envelope's pipe prematurely.
  // No plaintext file is created. The bound is explicit for this small release.
  const reader='import sys,subprocess; data=sys.stdin.buffer.read(134217729); assert len(data)<=134217728; r=subprocess.run(sys.argv[1:],input=data,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=150); sys.stdout.buffer.write(r.stdout); sys.stderr.buffer.write(r.stderr); raise SystemExit(r.returncode)'
  const sink=spawn('python3',['-c',reader,command,...args],{env,stdio:['pipe','pipe','pipe'],timeout:180000}),output=[],errors=[]
  sink.stdout.on('data',x=>output.push(x));for(const child of [source,sink])child.stderr.on('data',x=>errors.push(x))
  const outcomes=await Promise.allSettled([exited(source),exited(sink),pipeline(source.stdout,sink.stdin)])
  await writeFile(work+'/'+name+'.'+label+'-diagnostics',Buffer.concat(errors),{flag:'wx',mode:0o600})
  assert.ok(outcomes.every(r=>r.status==='fulfilled')&&outcomes[0].value===0&&outcomes[1].value===0,'Backup readback failed')
  return Buffer.concat(output)
}
async function backup(plan,work,{reuse=null}={}){
  const t=plan.target,b=plan.backup,c=await load(t.credentials_file)
  const env={...cleanEnv(),DYLD_LIBRARY_PATH:b.library_path,PGHOST:t.database.host,PGPORT:'5432',PGDATABASE:'postgres',PGUSER:'postgres',PGPASSWORD:c.database_password,PGSSLMODE:'verify-full',PGSSLROOTCERT:t.database.ca_file,PGCONNECT_TIMEOUT:'12',PGOPTIONS:'-c default_transaction_read_only=on -c statement_timeout=120000 -c lock_timeout=5000'}
  let database
  if(reuse){
    // Preparation-only recovery of a verified encrypted local artifact. The
    // caller first proves protected business data and every table's schema match.
    database=await load(reuse+'/database-before.dump.receipt.json')
    const bytes=await readFile(reuse+'/database-before.dump.enc');assert.equal(hash(bytes),database.encryptedSha256)
    await writeFile(work+'/database-before.dump.enc',bytes,{flag:'wx',mode:0o600})
    const checked=JSON.parse((await run(process.execPath,[b.envelope,'verify',b.key,work+'/database-before.dump.enc'],{env:cleanEnv(),timeout:180000})).stdout)
    assert.equal(checked.plaintextSha256,database.plaintextSha256);assert.equal(checked.authenticatedDecryption,true)
    await save(work+'/database-before.dump.receipt.json',{...database,reused_from:reuse,reverified_utc:new Date().toISOString()})
  }else{
    const dump=spawn(b.pg_dump,['-w','-Fc','-Z0','--lock-wait-timeout=5000'],{env,stdio:['ignore','pipe','pipe'],timeout:180000})
    database=await encryptStream(plan,work,'database-before.dump',dump)
  }
  const listing=await decryptTo(plan,work,'database-before.dump',dirname(b.pg_dump)+'/pg_restore',['--list'],{...cleanEnv(),DYLD_LIBRARY_PATH:b.library_path})
  for(const name of ['customer_orders','users','identities','schema_migrations','products','objects'])assert.ok(listing.toString().includes(name),'Backup table missing')
  await writeFile(work+'/database-toc.txt',listing,{mode:0o600,flag:'wx'})
  await decryptTo(plan,work,'database-before.dump',dirname(b.pg_dump)+'/pg_restore',['--file=/dev/null'],{...cleanEnv(),DYLD_LIBRARY_PATH:b.library_path},'full-readback')
  const ssh=await remoteProcess(plan,'recovery')
  const recovery=await encryptStream(plan,work,'runtime-recovery.tar.gz',ssh)
  const verifier='import sys,tarfile,json,hashlib; expected=json.loads(sys.argv[1]); seen=set(); t=tarfile.open(fileobj=sys.stdin.buffer,mode="r|gz");\nfor m in t:\n assert m.isfile() and m.name in expected and m.name not in seen; seen.add(m.name); assert hashlib.sha256(t.extractfile(m).read()).hexdigest()==expected[m.name]["sha256"]\nassert seen==set(expected)\nprint(json.dumps({"files":len(seen),"full_byte_readback":True}))'
  const expected=Object.fromEntries(Object.entries(plan.before.recovery_files).map(([path,value])=>[path.slice(1),value]))
  const checked=JSON.parse(await decryptTo(plan,work,'runtime-recovery.tar.gz','python3',['-c',verifier,JSON.stringify(expected)]))
  await save(work+'/backup-verification.json',{database:{...database,authenticatedDecryption:true,pg_restore_list:'PASS',pg_restore_full_readback:'PASS'},recovery:{...recovery,...checked},production_writes:0})
}
export async function validateAssets(file){
  const validator='import tarfile,pathlib,sys; t=tarfile.open(sys.argv[1]); ms=t.getmembers(); names=[m.name for m in ms]; assert ms and len(set(names))==len(names); assert all(m.isfile() and pathlib.PurePosixPath(m.name).parts[0]=="_nuxt" and ".." not in pathlib.PurePosixPath(m.name).parts and not m.name.startswith("/") and m.size<50000000 and m.name!="_nuxt/builds/latest.json" for m in ms); assert sum(m.size for m in ms)<134217728'
  await run('python3',['-c',validator,file],{timeout:10000})
}
async function prepare(options){
  assert.equal(process.version,'v22.23.1');const spec=await load(options.spec),work=options.directory
  await mkdir(work,{mode:0o700});const release=await migrations(repo),app=await inputs()
  const commit=(await run('git',['rev-parse','HEAD'],{cwd:repo})).stdout.trim();assert.equal(commit,spec.application_commit)
  const base={target:spec.target,release_id:'preflight',archive_bytes:0}
  const before=await remote(base,'inspect');assert.equal(before.current,spec.target.root+'/releases/'+spec.expected_release)
  assert.equal(before.recovery_files['/etc/caddy/Caddyfile'].sha256,spec.expected_caddy_sha256)
  await save(work+'/runtime-before.json',before)
  const database=await databaseState(spec.target,release);await save(work+'/database-before.json',database)
  const auth=await authState(spec.target);await save(work+'/auth-before.json',auth);await save(work+'/http-before.json',await publicHealth(base))
  if(spec.reuse_database_backup)assert.deepEqual(approvalState(await load(spec.reuse_database_backup+'/database-before.json')),approvalState(database),'Retained business/schema evidence changed')
  await backup({...base,before,backup:spec.backup},work,{reuse:spec.reuse_database_backup})
  const assets=await remote(base,'assets',{bytes:true});await writeFile(work+'/retained-assets.tar.gz',assets,{flag:'wx',mode:0o600});await validateAssets(work+'/retained-assets.tar.gz')
  const build=work+'/build-source';await mkdir(build,{mode:0o700})
  await logged('git',['archive','--format=tar','--output='+work+'/source.tar',commit],repo,work+'/git-archive.log')
  await logged('tar',['-xf',work+'/source.tar','-C',build],repo,work+'/source-extract.log')
  await mkdir(build+'/public',{recursive:true});await logged('tar',['-xzf',work+'/retained-assets.tar.gz','-C',build+'/public'],repo,work+'/retained-assets.log')
  assert.equal((await run(process.execPath,[spec.npm_cli,'--version'],{env:cleanEnv()})).stdout.trim(),'10.9.8')
  await writeFile(work+'/empty.env','',{flag:'wx',mode:0o600})
  await logged(process.execPath,[spec.npm_cli,'ci','--no-audit','--no-fund'],build,work+'/npm-ci.log')
  assert.equal(hash(await readFile(build+'/package-lock.json')),app['package-lock.json'])
  await logged(process.execPath,[build+'/node_modules/nuxt/bin/nuxt.mjs','build','--dotenv',work+'/empty.env'],build,work+'/build.log')
  const output=build+'/.output'
  async function modes(path){const s=await lstat(path);if(s.isSymbolicLink())return;if(s.isDirectory()){await chmod(path,0o755);for(const n of await readdir(path))await modes(path+'/'+n)}else await chmod(path,0o644)}
  await modes(output)
  const c=await load(spec.target.credentials_file),entries=await inventory(output,{secrets:[c.database_password,c.service_role_key]})
  for(const [path,value]of Object.entries(before.assets))assert.equal(hash(await readFile(output+'/public/_nuxt/'+path)),value.sha256,'Retained asset lost')
  await save(work+'/inventory.json',entries);await tarCreate({cwd:build,file:work+'/release.tar.gz',gzip:true,portable:true,noMtime:true,follow:false},['.output']);await chmod(work+'/release.tar.gz',0o600)
  assert.deepEqual(await inputs(),app)
  const after=await remote(base,'inspect');assert.deepEqual(stable(after),stable(before),'Runtime drift during preparation')
  const databaseAfter=await databaseState(spec.target,release)
  assert.deepEqual(approvalState(databaseAfter),approvalState(database),'Business/schema drift during preparation');assert.deepEqual(await authState(spec.target),auth)
  await save(work+'/database-after-preparation.json',databaseAfter)
  await save(work+'/runtime-after.json',after)
  const archive=await readFile(work+'/release.tar.gz')
  const protectedFiles=[spec.target.credentials_file,spec.target.database.ca_file,spec.target.identity,spec.target.known_hosts,spec.backup.key,spec.backup.pg_dump,dirname(spec.backup.pg_dump)+'/pg_restore',spec.npm_cli]
  const plan={format:1,created_utc:new Date().toISOString(),application_commit:commit,application_inputs:app,release_id:hash(archive).slice(0,16),archive_sha256:hash(archive),archive_bytes:archive.length,inventory_sha256:digest(entries),target:spec.target,before,database,auth,tools:await toolHashes(),backup:spec.backup,backup_evidence:await load(work+'/backup-verification.json'),retained_assets_sha256:hash(assets),preflight_live_telemetry:[...telemetry],migrations:release.pending.map(({filename,version,name,sha256})=>({filename,version,name,sha256})),protected_inputs:Object.fromEntries(await Promise.all(protectedFiles.map(async file=>[file,hash(await readFile(file))]))),scope:{schema:'85->87',public_checkout:false,signup:false,live_charging:false,automatic_shipping:false,caddy_change:false,provider_calls:false,wordpress_import:false},automatic_retry:false,automatic_rollback:false}
  plan.seal=digest(plan);await save(work+'/plan.json',plan)
  console.log(JSON.stringify({result:'PREPARED_FOR_OWNER_REVIEW',seal:plan.seal,release:plan.release_id,archive_bytes:archive.length,inventory:entries.length,retained_assets:Object.keys(before.assets).length,production_writes:0}))
}
async function inspectPrepared(file,{clean=false}={}){
  assert.equal(process.version,'v22.23.1');const plan=await load(file),{seal,...body}=plan;assert.equal(digest(body),seal)
  assert.deepEqual(await toolHashes(),plan.tools);assert.deepEqual(await inputs(),plan.application_inputs)
  if(clean)assert.equal((await run('git',['status','--porcelain'],{cwd:repo})).stdout,'','Commit task-owned changes first')
  const work=dirname(file),release=await migrations(repo)
  assert.deepEqual(release.pending.map(({filename,version,name,sha256})=>({filename,version,name,sha256})),plan.migrations)
  for(const [file,sha]of Object.entries(plan.protected_inputs))assert.equal(hash(await readFile(file)),sha)
  assert.equal(hash(await readFile(work+'/release.tar.gz')),plan.archive_sha256);assert.equal(plan.release_id,plan.archive_sha256.slice(0,16));assert.equal(digest(await load(work+'/inventory.json')),plan.inventory_sha256)
  for(const [name,receipt]of [['database-before.dump',plan.backup_evidence.database],['runtime-recovery.tar.gz',plan.backup_evidence.recovery]]){
    const checked=JSON.parse((await run(process.execPath,[plan.backup.envelope,'verify',plan.backup.key,work+'/'+name+'.enc'],{env:cleanEnv(),timeout:180000})).stdout)
    assert.equal(checked.encryptedSha256,receipt.encryptedSha256);assert.equal(checked.plaintextSha256,receipt.plaintextSha256)
  }
  assert.deepEqual(stable(await remote(plan,'inspect')),stable(plan.before));assert.deepEqual(approvalState(await databaseState(plan.target,release)),approvalState(plan.database));assert.deepEqual(await authState(plan.target),plan.auth)
  return {plan,work,release}
}
async function rebind(options){
  assert.equal(process.version,'v22.23.1')
  const previous=await load(options.previous),{seal:previousSeal,...oldBody}=previous,origin=dirname(options.previous),work=options.directory
  assert.equal(digest(oldBody),previousSeal,'Original approval evidence changed')
  const evidence=await load(options.evidence)
  assert.equal(evidence.result,'AUTH_FIELD_COMPARISON_COMPLETE')
  assert.equal(evidence.old_approval_seal,previousSeal)
  assert.equal(evidence.baseline_reproduced,true);assert.equal(evidence.blocked_fingerprint_reproduced,true)
  assert.equal(evidence.identity_membership_unchanged,true);assert.equal(evidence.all_other_fields_equal,true)
  assert.deepEqual(evidence.changed_fields,[{field:'updated_at',advanced_timestamp:true}],'Only the proven metadata-only correction can be rebound')
  const originalAuth=previous.database.protected_tables.find(t=>t.schema==='auth'&&t.name==='users')
  assert.equal(evidence.approved_full_sha256,originalAuth.sha256)
  const blocked=await load(origin+'/blocked-release-receipt.json')
  assert.equal(blocked.operator_invocations,1);assert.equal(blocked.production_mutations,0);assert.equal(blocked.sql,'NOT_STARTED')
  assert.match(blocked.preparation_commit,/^[a-f0-9]{40}$/)
  assert.equal(evidence.blocked_full_sha256,blocked.observed.sha256)
  assertAuthSecurityShape(evidence.auth_security,originalAuth)
  // Prove the old tool evidence still names its immutable reviewed Git source.
  for(const [name,expected]of Object.entries(previous.tools)){
    const path=relative(repo,resolve(here,name));assert.ok(!path.startsWith('../'))
    assert.equal(hash((await run('git',['show',blocked.preparation_commit+':'+path],{cwd:repo,encoding:'buffer',maxBuffer:8e6})).stdout),expected,'Original reviewed tool provenance changed')
  }
  assert.deepEqual(await inputs(),previous.application_inputs)
  const release=await migrations(repo)
  assert.deepEqual(release.pending.map(({filename,version,name,sha256})=>({filename,version,name,sha256})),previous.migrations)
  for(const [path,expected]of Object.entries(previous.protected_inputs))assert.equal(hash(await readFile(path)),expected,'Protected deployment input changed')
  const base={target:previous.target,release_id:previous.release_id,archive_bytes:previous.archive_bytes}
  const before=await remote(base,'inspect');assert.deepEqual(stable(before),stable(previous.before),'Target runtime drift')
  const database=await databaseState(previous.target,release)
  const adopted={...previous.database,auth_security:evidence.auth_security}
  assert.deepEqual(approvalState(database),approvalState(adopted),'A security/business change remains unexplained')
  const auth=await authState(previous.target);assert.deepEqual(auth,previous.auth)
  await mkdir(work,{mode:0o700})
  await save(work+'/runtime-before.json',before);await save(work+'/database-before.json',database);await save(work+'/auth-before.json',auth)
  await save(work+'/http-before.json',await publicHealth(base));await save(work+'/auth-drift-evidence.json',evidence)
  for(const [name,expected]of [['release.tar.gz',previous.archive_sha256],['retained-assets.tar.gz',previous.retained_assets_sha256]]){
    const bytes=await readFile(origin+'/'+name);assert.equal(hash(bytes),expected)
    await writeFile(work+'/'+name,bytes,{flag:'wx',mode:0o600})
  }
  const entries=await load(origin+'/inventory.json');assert.equal(digest(entries),previous.inventory_sha256);await save(work+'/inventory.json',entries)
  await validateAssets(work+'/retained-assets.tar.gz')
  const extractor='import importlib.util,json,pathlib,sys; s=importlib.util.spec_from_file_location("extractor",sys.argv[1]); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); m.extract_release(pathlib.Path(sys.argv[2]),pathlib.Path(sys.argv[3]),json.loads(pathlib.Path(sys.argv[4]).read_text())); print("PASS")'
  await run('python3',['-c',extractor,resolve(here,'../clean-reinstall/deploy.py'),work+'/release.tar.gz',work+'/artifact-readback',work+'/inventory.json'],{timeout:30000})
  for(const [path,value]of Object.entries(before.assets))assert.equal(hash(await readFile(work+'/artifact-readback/public/_nuxt/'+path)),value.sha256,'A retained client asset differs')
  await save(work+'/archive-readback.json',{result:'PASS',archive_sha256:previous.archive_sha256,entries:entries.length,retained_assets:Object.keys(before.assets).length})
  await backup({...base,before,backup:previous.backup},work)
  const after=await remote(base,'inspect');assert.deepEqual(stable(after),stable(before))
  const databaseAfter=await databaseState(previous.target,release);assert.deepEqual(approvalState(databaseAfter),approvalState(database));assert.deepEqual(await authState(previous.target),auth)
  await save(work+'/runtime-after.json',after);await save(work+'/database-after-preparation.json',databaseAfter)
  const plan={...oldBody,created_utc:new Date().toISOString(),before,database,auth,tools:await toolHashes(),backup_evidence:await load(work+'/backup-verification.json'),
    supersedes_seal:previousSeal,rebind_source:options.previous,reviewed_utc:new Date().toISOString(),
    auth_drift_resolution:{evidence_sha256:hash(await readFile(work+'/auth-drift-evidence.json')),changed_fields:['updated_at'],actor_operation:'not established',policy:'identity-security-v1'},
    preparation_evidence:{}}
  for(const name of ['auth-drift-evidence.json','archive-readback.json','backup-verification.json'])plan.preparation_evidence[name]=hash(await readFile(work+'/'+name))
  plan.seal=digest(plan);await save(work+'/plan.json',plan)
  console.log(JSON.stringify({result:'REBOUND_FOR_OWNER_REVIEW',seal:plan.seal,release:plan.release_id,production_writes:0,deployment:'NOT_EXECUTED'}))
}
async function check(options){const {plan}=await inspectPrepared(options.plan);await publicHealth(plan);console.log(JSON.stringify({result:'READY_FOR_OWNER_APPROVAL',seal:plan.seal,release:plan.release_id,production_writes:0,hosted_candidate:'NOT_EXERCISED',deployment:'NOT_AUTHORIZED'}))}
async function apply(options){
  const requested=await load(options.plan);assert.equal(requested.seal,options.approval,'Separate exact owner approval required')
  const {plan,work,release}=await inspectPrepared(options.plan,{clean:true})
  await save(work+'/execution-intent.json',{seal:plan.seal,started_utc:new Date().toISOString()})
  let phase='fresh backup';const heartbeat=setInterval(()=>console.log(JSON.stringify({phase,status:'running',utc:new Date().toISOString()})),15000)
  try{
    const fresh=work+'/execution-backup';await mkdir(fresh,{mode:0o700});await backup(plan,fresh)
    phase='remote preparation';await save(work+'/remote-prepare.json',await remote(plan,'prepare'))
    const scp=sshArgs(plan.target).filter(x=>x!=='-T')
    await run('scp',[...scp,work+'/release.tar.gz',work+'/inventory.json','root@'+plan.target.host+':/var/lib/live-sales-releases/'+plan.release_id+'/'],{timeout:180000,maxBuffer:2e6})
    for(const step of ['stage','provision','candidate']){phase=step;await save(work+'/remote-'+step+'.json',await remote(plan,step))}
    phase='SQL';const db=await connect(plan.target,{readOnly:false})
    try{await save(work+'/database-applied.json',await applyMigrations(db,release,{beforeCommit:state=>{
      assert.deepEqual(approvalState({protected_tables:state.before,auth_security:state.auth_security}),approvalState({protected_tables:plan.database.protected_tables,auth_security:plan.database.auth_security}),'Business/security data changed since approval')
      return save(work+'/database-before-commit.json',state)
    }}))}finally{await db.end()}
    phase='activation';await save(work+'/remote-activation.json',await remote(plan,'activate'))
    phase='verification';await save(work+'/http-after.json',await publicHealth(plan));const final=await databaseState(plan.target,release,{after:true});await save(work+'/database-after.json',final);await authState(plan.target)
    const verified=await connect(plan.target)
    try{await compareOriginal(verified,plan.database.protected_tables.filter(table=>!telemetry.has(table.schema+'.'+table.name)),{authSecurity:plan.database.auth_security});await verifyAccess(verified)}finally{await verified.end()}
    await save(work+'/completed.json',{result:'PASS',seal:plan.seal,release:plan.release_id,completed_utc:new Date().toISOString(),public_checkout:'disabled',providers:'disabled',owner_browser:'pending'})
    console.log(JSON.stringify({result:'PASS',release:plan.release_id,seal:plan.seal}))
  }catch(error){await save(work+'/STOP.json',{result:'STOP',phase,error_type:error.name,code:error.code,automatic_retry:false,automatic_rollback:false});throw Error('STOP in '+phase+'; preserve evidence, no automatic retry or recovery')}finally{clearInterval(heartbeat)}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const options=argumentsFor(process.argv.slice(2));await({prepare,rebind,check,apply}[options.mode])(options)}
  catch(error){console.error(JSON.stringify({result:'STOP',error_type:error.name,message:error.message?.startsWith('STOP in ')?error.message:'Release gate failed. Preserve private evidence; no automatic retry.'}));process.exitCode=1}
}
