#!/usr/bin/env node
import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir,readdir,lstat,chmod,cp,access} from 'node:fs/promises'
import {resolve,dirname,join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFile,spawn} from 'node:child_process'
import {promisify} from 'node:util'
import {pipeline} from 'node:stream/promises'
import {createReadStream} from 'node:fs'
import {create as tarCreate} from 'tar'
import {inventory} from '../publish/inventory.mjs'
import {hash,migrations,connect,checkDatabase,applyMigrations,verifyAccess} from './database.mjs'
const run=promisify(execFile),here=dirname(fileURLToPath(import.meta.url)),repo=resolve(here,'../..')
export const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item)
const digest=value=>hash(canonical(value)),load=async file=>JSON.parse(await readFile(file,'utf8'))
const save=(file,value)=>writeFile(file,JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'})
export function argumentsFor(args){
  if(args.length===3&&args[0]==='prepare')return {mode:'prepare',spec:resolve(args[1]),directory:resolve(args[2])}
  if(args.length===2&&args[0]==='check')return {mode:'check',plan:resolve(args[1])}
  if(args.length===4&&args[0]==='apply'&&args[2]==='--approved'&&/^[a-f0-9]{64}$/.test(args[3]))return {mode:'apply',plan:resolve(args[1]),approval:args[3]}
  throw Error('Use prepare SPEC DIRECTORY, or apply PLAN --approved PLAN_SHA256. No implicit deployment.')
}
function sshArgs(t){assert.match(t.host,/^[A-Za-z0-9.-]+$/);return ['-T','-n','-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','-o','HostKeyAlgorithms=ssh-ed25519','-o','UserKnownHostsFile='+t.known_hosts,'-o','ConnectionAttempts=1','-o','ConnectTimeout=12','-o','ServerAliveInterval=15','-o','ServerAliveCountMax=2','-o','ControlMaster=no','-i',t.identity]}
const shell=value=>"'"+String(value).replaceAll("'","'\\''")+"'"
async function remote(plan,mode,{bytes=false}={}){
  const source=await readFile(here+'/remote.py','utf8'),encoded=Buffer.from(source).toString('base64')
  const command='python3 -c '+shell('import base64;exec(compile(base64.b64decode('+JSON.stringify(encoded)+'),"commerce-remote.py","exec"))')+' '+shell(mode)+' '+shell(JSON.stringify(plan))+(plan.seal?' --approved '+shell(plan.seal):'')
  const r=await run('ssh',[...sshArgs(plan.target),'root@'+plan.target.host,command],{timeout:mode==='provision'?1100000:180000,maxBuffer:128*1024*1024,encoding:bytes?'buffer':'utf8'})
  return bytes?r.stdout:JSON.parse(r.stdout)
}
async function appInputs(){
  const names=(await run('git',['ls-files','-z'],{cwd:repo,maxBuffer:8e6})).stdout.split('\0').filter(n=>/^(app|server|public|i18n)\//.test(n)||['package.json','package-lock.json','nuxt.config.ts','tsconfig.json'].includes(n))
  return Object.fromEntries(await Promise.all(names.map(async name=>[name,hash(await readFile(repo+'/'+name))])))
}
async function tools(){return Object.fromEntries(await Promise.all(['operator.mjs','database.mjs','remote.py','decoder.json','../clean-reinstall/deploy.py','../publish/inventory.mjs','../../docs/operations/backup-envelope.mjs'].map(async name=>[name,hash(await readFile(resolve(here,name)))])))}
const cleanEnv=()=>({PATH:dirname(process.execPath)+':/usr/local/bin:/usr/bin:/bin',HOME:process.env.HOME,LANG:'C',NODE_ENV:'production'})
async function logged(command,args,cwd,file,{timeout=600000,env=cleanEnv()}={}){
  const child=spawn(command,args,{cwd,env,stdio:['ignore','pipe','pipe'],timeout}),chunks=[]
  child.stdout.on('data',x=>chunks.push(x));child.stderr.on('data',x=>chunks.push(x))
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve)})
  await writeFile(file,Buffer.concat(chunks),{flag:'wx',mode:0o600});assert.equal(code,0,'Command failed; private log retained: '+file)
}
async function prepare(options){
  assert.equal(process.version,'v22.23.1');const spec=await load(options.spec),work=options.directory
  assert.match(spec.target.project_ref,/^[a-z0-9]{20}$/);assert.equal(spec.target.database.host,'db.'+spec.target.project_ref+'.supabase.co')
  assert.equal(spec.target.origin,'https://'+spec.target.domain);assert.equal(spec.target.packing_dir,spec.target.root+'/shared/private/packing-videos')
  await mkdir(work,{mode:0o700});const release=await migrations(repo),inputs=await appInputs()
  const commit=(await run('git',['rev-parse','HEAD'],{cwd:repo})).stdout.trim()
  const baselinePlan={target:spec.target,release_id:'preflight',archive_bytes:0}
  const before=await remote(baselinePlan,'inspect');await save(work+'/runtime-before.json',before)
  await run('git',['merge-base','--is-ancestor',before.verified.commit,commit],{cwd:repo})
  const db=await connect(spec.target)
  try{await db.query('begin read only');await save(work+'/database-before.json',await checkDatabase(db,release));await db.query('rollback')}finally{await db.end()}
  const decoder=await load(here+'/decoder.json');assert.equal(hash(await readFile(spec.decoder_source)),decoder.sha256)
  await cp(spec.decoder_source,work+'/'+decoder.filename);await cp(spec.decoder_fixture,work+'/decoder-check.webm')
  const assets=await remote(baselinePlan,'assets',{bytes:true});await writeFile(work+'/retained-assets.tar.gz',assets,{flag:'wx',mode:0o600})
  const buildRoot=work+'/build-source';await mkdir(buildRoot,{mode:0o700})
  await logged('git',['archive','--format=tar','--output='+work+'/source.tar',commit],repo,work+'/git-archive.log')
  await logged('tar',['-xf',work+'/source.tar','-C',buildRoot],repo,work+'/source-extract.log')
  // Validate public-only retained files before any extraction.
  const validator='import tarfile,pathlib,sys; t=tarfile.open(sys.argv[1]); ms=t.getmembers(); assert ms and all(m.isfile() and pathlib.PurePosixPath(m.name).parts[0]=="_nuxt" and ".." not in pathlib.PurePosixPath(m.name).parts and not m.name.startswith("/") and m.size<50000000 for m in ms); assert sum(m.size for m in ms)<134217728'
  await run('python3',['-c',validator,work+'/retained-assets.tar.gz'],{timeout:10000})
  await mkdir(buildRoot+'/public',{recursive:true});await logged('tar',['-xzf',work+'/retained-assets.tar.gz','-C',buildRoot+'/public'],repo,work+'/retained-assets.log')
  const npm=spec.npm_cli;assert.equal((await run(process.execPath,[npm,'--version'],{env:cleanEnv()})).stdout.trim(),'10.9.8')
  await writeFile(work+'/empty.env','',{flag:'wx',mode:0o600})
  await logged(process.execPath,[npm,'ci','--no-audit','--no-fund'],buildRoot,work+'/npm-ci.log')
  assert.equal(hash(await readFile(buildRoot+'/package-lock.json')),inputs['package-lock.json'],'Install changed the reviewed lockfile')
  await logged(process.execPath,[buildRoot+'/node_modules/nuxt/bin/nuxt.mjs','build','--dotenv',work+'/empty.env'],buildRoot,work+'/build.log')
  const output=buildRoot+'/.output'
  async function modes(path){const s=await lstat(path);if(s.isSymbolicLink())return;if(s.isDirectory()){await chmod(path,0o755);for(const name of await readdir(path))await modes(path+'/'+name)}else await chmod(path,0o644)}
  await modes(output)
  const creds=await load(spec.target.credentials_file)
  const entries=await inventory(output,{secrets:[creds.database_password,creds.service_role_key]})
  await save(work+'/inventory.json',entries);await tarCreate({cwd:buildRoot,file:work+'/release.tar.gz',gzip:true,portable:true,noMtime:true,follow:false},['.output']);await chmod(work+'/release.tar.gz',0o600)
  assert.deepEqual(await appInputs(),inputs,'Application changed during build')
  const fresh=await remote(baselinePlan,'inspect');for(const key of ['current','env_sha256','unit_sha256','caddy_sha256','extractor_sha256','media_sha256','ffmpeg_policy'])assert.deepEqual(fresh[key],before[key],'Runtime changed during preparation')
  const archive=await readFile(work+'/release.tar.gz'),plan={format:1,created_utc:new Date().toISOString(),application_commit:commit,application_inputs:inputs,
    release_id:hash(archive).slice(0,16),archive_sha256:hash(archive),archive_bytes:archive.length,inventory_sha256:digest(entries),
    target:spec.target,before,decoder,decoder_fixture_sha256:hash(await readFile(work+'/decoder-check.webm')),tools:await tools(),backup:spec.backup,npm_cli:npm,
    migrations:release.pending.map(({filename,version,name,sha256})=>({filename,version,name,sha256})),
    protected_inputs:Object.fromEntries(await Promise.all([spec.target.credentials_file,spec.target.database.ca_file,spec.target.identity,spec.target.known_hosts,spec.backup.key].map(async file=>[file,hash(await readFile(file))])))}
  plan.seal=digest(plan);await save(work+'/plan.json',plan)
  console.log(JSON.stringify({result:'PREPARED',plan:work+'/plan.json',seal:plan.seal,application_commit:commit,migrations:release.pending.map(m=>({filename:m.filename,sha256:m.sha256})),archive_sha256:plan.archive_sha256,files:entries.length,production_writes:0}))
}
async function backup(plan,work){
  const t=plan.target,c=await load(t.credentials_file),b=plan.backup
  assert.equal(b.envelope,resolve(here,'../../docs/operations/backup-envelope.mjs'))
  await access(b.key);await access(b.pg_dump);await access(b.envelope)
  const env={...cleanEnv(),DYLD_LIBRARY_PATH:b.library_path,PGHOST:t.database.host,PGPORT:'5432',PGDATABASE:'postgres',PGUSER:'postgres',PGPASSWORD:c.database_password,
    PGSSLMODE:'verify-full',PGSSLROOTCERT:t.database.ca_file,PGCONNECT_TIMEOUT:'12',PGOPTIONS:'-c default_transaction_read_only=on -c statement_timeout=120000 -c lock_timeout=5000'}
  const dump=spawn(b.pg_dump,['-w','-Fc','-Z0','--lock-wait-timeout=5000'],{env,stdio:['ignore','pipe','pipe'],timeout:180000})
  const encrypted=spawn(process.execPath,[b.envelope,'encrypt',b.key,work+'/database-before.dump.enc'],{env:cleanEnv(),stdio:['pipe','pipe','pipe'],timeout:180000})
  const errors=[],receipt=[];dump.stderr.on('data',x=>errors.push(x));encrypted.stderr.on('data',x=>errors.push(x));encrypted.stdout.on('data',x=>receipt.push(x))
  const exited=child=>new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve)})
  const outcomes=await Promise.allSettled([exited(dump),exited(encrypted),pipeline(dump.stdout,encrypted.stdin)])
  await writeFile(work+'/backup-diagnostics.log',Buffer.concat(errors),{flag:'wx',mode:0o600})
  assert.ok(outcomes.every(r=>r.status==='fulfilled')&&outcomes[0].value===0&&outcomes[1].value===0,'Backup failed; SQL is prohibited')
  const checked=JSON.parse((await run(process.execPath,[b.envelope,'verify',b.key,work+'/database-before.dump.enc'],{timeout:180000,maxBuffer:2e6,env:cleanEnv()})).stdout)
  const captured=JSON.parse(Buffer.concat(receipt));assert.equal(checked.plaintextSha256,captured.plaintextSha256)
  await save(work+'/backup-receipt.json',captured)
}
async function publicHealth(plan){
  for(const [path,expected] of [['/',200],['/dashboard/login',200],['/api/admin-products/list',401],['/checkout',403],['/api/checkout',403],['/login',403]]){
    const response=await fetch(plan.target.origin+path,{redirect:'manual',signal:AbortSignal.timeout(12000)});await response.body?.cancel();assert.equal(response.status,expected,'Live route failed: '+path)
  }
}
async function inspectPrepared(file,{clean=false}={}){
  assert.equal(process.version,'v22.23.1');const plan=await load(file),{seal,...body}=plan
  assert.equal(digest(body),seal)
  assert.deepEqual(await tools(),plan.tools,'Release helper changed');assert.deepEqual(await appInputs(),plan.application_inputs,'Application changed')
  if(clean)assert.equal((await run('git',['status','--porcelain'],{cwd:repo})).stdout,'','Commit task-owned changes before approved execution')
  const work=dirname(file),release=await migrations(repo)
  assert.deepEqual(release.pending.map(({filename,version,name,sha256})=>({filename,version,name,sha256})),plan.migrations,'Migration changed after approval')
  for(const [file,sha256]of Object.entries(plan.protected_inputs))assert.equal(hash(await readFile(file)),sha256,'Protected input changed')
  assert.equal(hash(await readFile(work+'/release.tar.gz')),plan.archive_sha256)
  assert.equal(plan.release_id,plan.archive_sha256.slice(0,16))
  assert.equal(digest(await load(work+'/inventory.json')),plan.inventory_sha256)
  assert.deepEqual(plan.decoder,await load(here+'/decoder.json'),'Decoder definition changed')
  assert.equal(hash(await readFile(work+'/'+plan.decoder.filename)),plan.decoder.sha256)
  assert.equal(hash(await readFile(work+'/decoder-check.webm')),plan.decoder_fixture_sha256)
  const now=await remote(plan,'inspect');for(const key of ['current','env_sha256','unit_sha256','caddy_sha256','extractor_sha256','main_pid','caddy_pid'])assert.deepEqual(now[key],plan.before[key],'Runtime changed')
  assert.match(now.build_dependencies,/\b0 upgraded, \d+ newly installed, 0 to remove/,'Compiler installation would change existing packages')
  assert.equal(now.build_dependencies,plan.before.build_dependencies,'Dependency plan changed')
  const readonly=await connect(plan.target);try{await checkDatabase(readonly,release)}finally{await readonly.end()}
  return {plan,work,release,now}
}
async function check(options){
  const {plan,release,now}=await inspectPrepared(options.plan)
  await publicHealth(plan)
  console.log(JSON.stringify({result:'GO_FOR_OWNER_APPROVAL',plan_sha256:plan.seal,release:plan.release_id,migrations:release.pending.map(m=>m.version),media_files:now.media_files,production_writes:0}))
}
async function apply(options){
  const requested=await load(options.plan);assert.equal(requested.seal,options.approval,'Owner must approve this exact plan')
  const {plan,work,release}=await inspectPrepared(options.plan,{clean:true}),seal=plan.seal
  await save(work+'/execution-intent.json',{plan:seal,started_utc:new Date().toISOString()})
  let phase='backup'
  const heartbeat=setInterval(()=>console.log(JSON.stringify({phase,status:'running',time:new Date().toISOString()})),15000)
  try{
    console.log(JSON.stringify({phase,status:'started'}))
    await backup(plan,work)
    phase='remote preparation';await save(work+'/remote-prepare.json',await remote(plan,'prepare'))
    const stage='/var/lib/commerce-releases/'+plan.release_id
    // SCP receives only the reviewed output and its inventory, never secrets.
    const scp=sshArgs(plan.target).filter(x=>!['-T','-n'].includes(x))
    await run('scp',[...scp,work+'/release.tar.gz',work+'/inventory.json',work+'/'+plan.decoder.filename,work+'/decoder-check.webm','root@'+plan.target.host+':'+stage+'/'],{timeout:180000,maxBuffer:2e6})
    for(const step of ['stage','provision','candidate']){phase=step;await save(work+'/remote-'+step+'.json',await remote(plan,step))}
    phase='SQL';const db=await connect(plan.target,{readOnly:false})
    try{await save(work+'/database-applied.json',await applyMigrations(db,release,{beforeCommit:receipt=>save(work+'/database-before-commit.json',receipt)}))}finally{await db.end()}
    phase='activation';await save(work+'/remote-activation.json',await remote(plan,'activate'))
    phase='public verification';await publicHealth(plan)
    phase='database verification';const verified=await connect(plan.target)
    try{
      assert.deepEqual((await verified.query('select version,name from supabase_migrations.schema_migrations order by version')).rows,[...release.history,...release.pending.map(({version,name})=>({version,name}))])
      const count=(await verified.query('select count(*)::int count from public.customer_orders')).rows[0].count
      const saved=await load(work+'/database-applied.json');assert.equal(count,saved.counts['public.customer_orders'])
      await save(work+'/post-deploy-database.json',{access:await verifyAccess(verified),migrations:85,orders_unchanged:true})
    }finally{await verified.end()}
    await save(work+'/completed.json',{result:'PASS',plan:seal,completed_utc:new Date().toISOString(),public_checkout:'disabled',providers:'disabled'})
    console.log(JSON.stringify({result:'PASS',plan:seal,release:plan.release_id,evidence:work}))
  }catch(error){await save(work+'/STOP.json',{result:'STOP',phase,error_type:error.name,code:error.code,automatic_retry:false,automatic_rollback:false});throw Error('STOP in '+phase+'. Preserve evidence; no retry or rollback is authorized automatically.')}finally{clearInterval(heartbeat)}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const options=argumentsFor(process.argv.slice(2));await({prepare,check,apply}[options.mode])(options)}
  catch(error){console.error(JSON.stringify({result:'STOP',error_type:error.name,message:error.message?.startsWith('STOP in ')?error.message:'Release gate failed; inspect private evidence. No implicit production retry.'}));process.exitCode=1}
}
