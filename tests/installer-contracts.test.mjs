import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, realpath, chmod, writeFile, readFile, rm, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { validateTarget, validateCredentials, safeEnvironment, digest } from '../scripts/install/contracts.mjs'
import { createWorkspace, readProtected, writeAtomic, checkpointWrite, checkpointRead, workspaceLock, settledCliJobs } from '../scripts/install/files.mjs'
import { validateHistory } from '../scripts/install/verify.mjs'
import { validatePlan, stages } from '../scripts/install/workflow.mjs'
import { migrationInventory } from '../scripts/lib/cleanBaseline.mjs'

const target=()=>({format:1,profile:'supabase-direct',installation_id:randomUUID(),project_ref:'abcdefghijklmnopqrst',api_url:'https://abcdefghijklmnopqrst.supabase.co',site_origin:'https://fresh.example.invalid',database:{host:'db.abcdefghijklmnopqrst.supabase.co',port:5432,name:'postgres',user:'postgres',ca_file:'/private/tmp/reviewed-ca.pem'},excluded_project_refs:[]})
const code=name=>error=>error.code===name
test('strict target routes exclude production, aliases, transaction pools and URL credentials',()=>{
  assert.ok(validateTarget(target()))
  for(const change of [t=>t.project_ref='zsqhuwgoasrexdnamlks',t=>t.site_origin='https://new.elcomputer.net',t=>t.excluded_project_refs=[t.project_ref]]){
    const t=target();change(t);assert.throws(()=>validateTarget(t),code('protected_target'))
  }
  for(const change of [t=>t.database.port=6543,t=>t.database.host='aws-0.pooler.supabase.com',t=>t.api_url+='/',t=>t.api_url='https://user:password@abcdefghijklmnopqrst.supabase.co',t=>t.api_url+='?project=other',t=>t.database.user='service_role',t=>t.force=true,t=>t.site_origin='https://fresh.example.invalid/path',t=>t.database.ca_file='relative.pem']){
    const t=target();change(t);assert.throws(()=>validateTarget(t))
  }
})

test('a killed parent cannot leave an untracked CLI child available to resume', {timeout:15000},async()=>{
  const directory=await realpath(await mkdtemp('/tmp/elcomputer-install-supervisor-')),job=join(directory,'cli-'+randomUUID())
  const {mkdir}=await import('node:fs/promises');await mkdir(job,{mode:0o700})
  const plan={target:{installation_id:randomUUID()},plan_digest:'a'.repeat(64)},file=join(job,'supervisor.json'),marker=join(job,'running.txt')
  const supervisor=new URL('../scripts/install/cli-supervisor.mjs',import.meta.url).pathname,files=new URL('../scripts/install/files.mjs',import.meta.url).href
  const script=`import{spawn}from'node:child_process';import{writeAtomic}from ${JSON.stringify(files)};const child=spawn(process.execPath,[${JSON.stringify(supervisor)},${JSON.stringify(file)}],{stdio:['ignore','ignore','ignore','ipc']});child.once('spawn',async()=>{await writeAtomic(${JSON.stringify(job)},'supervisor.json',{format:1,nonce:'owned-supervisor',parent_pid:process.pid,supervisor_pid:child.pid,installation_id:${JSON.stringify(plan.target.installation_id)},plan_digest:${JSON.stringify(plan.plan_digest)},cli_binary_sha256:'b'.repeat(64),executable:process.execPath,args:['--input-type=module','-e',${JSON.stringify('import{writeFileSync}from"node:fs";writeFileSync('+JSON.stringify(marker)+',String(process.pid),{mode:0o600});setInterval(()=>{},1000)')}]},{exclusive:true});child.send('start')});setInterval(()=>{},1000)`
  let parent
  const wait=async read=>{for(let i=0;i<200;i++){try{const value=await read();if(value)return value}catch{}await new Promise(resolve=>setTimeout(resolve,25))}throw Error('Owned supervisor timeout')}
  try{
    parent=spawn(process.execPath,['--input-type=module','-e',script],{env:{PATH:process.env.PATH,LANG:'C'},stdio:'ignore'})
    const nativePid=Number(await wait(()=>readFile(marker,'utf8')))
    await assert.rejects(()=>settledCliJobs(directory,plan),code('lock_busy'))
    const ended=new Promise(resolve=>parent.once('exit',resolve));parent.kill('SIGKILL');await ended
    const finished=await wait(()=>readProtected(join(job,'finished.json')))
    assert.equal(finished.exit_code,null);assert.equal(finished.signal,'SIGTERM')
    await settledCliJobs(directory,plan)
    assert.throws(()=>process.kill(nativePid,0),error=>error.code==='ESRCH')
    await rm(join(job,'finished.json'));await assert.rejects(()=>settledCliJobs(directory,plan),error=>['stage_uncertain','lock_busy'].includes(error.code))
  }finally{parent?.kill('SIGKILL');await rm(directory,{recursive:true,force:true})}
})
test('credential files cannot supply a target, DSN or a mismatched project',()=>{
  const t=target(),c={project_ref:t.project_ref,database_password:'PRIVATE-DATABASE-CANARY',service_role_key:'sb_secret_'+ 'a'.repeat(40),anon_key:'sb_publishable_'+ 'b'.repeat(40)}
  assert.ok(validateCredentials(c,t))
  assert.throws(()=>validateCredentials({...c,project_ref:'other'},t),code('target_changed'))
  assert.throws(()=>validateCredentials({...c,database_url:'postgres://user:password@host'},t))
  assert.throws(()=>validateCredentials({...c,database_password:'line\nbreak'},t))
})
test('ambient connection, injection and provider credentials are rejected',()=>{
  safeEnvironment({PATH:'/usr/bin',LANG:'C'})
  for(const key of ['PGHOST','PGSERVICEFILE','PGPASSFILE','DATABASE_URL','SUPABASE_URL','SUPABASE_ACCESS_TOKEN','SUPABASE_DB_PASSWORD','NUXT_SUPABASE_SERVICE_KEY','NODE_OPTIONS','NODE_TLS_REJECT_UNAUTHORIZED','NODE_EXTRA_CA_CERTS','SSLKEYLOGFILE'])assert.throws(()=>safeEnvironment({[key]:'CANARY'}),code('ambient_credentials'))
})
test('only exact baseline migration identities can be adopted',async()=>{
  const inventory=await migrationInventory(),rows=inventory.map(({version,name})=>({version,name,statements:['certified SQL']}))
  assert.deepEqual(validateHistory(rows,inventory),[])
  assert.equal(validateHistory(rows.slice(0,5),inventory,{partial:true}).length,65)
  for(const corrupted of [[...rows,{version:'999',name:'unknown',statements:['SQL']}],rows.map((row,i)=>i?row:{...row,name:'changed'}),rows.map((row,i)=>i?row:{...row,statements:[]}),rows.map((row,i)=>i?row:{...row,version:rows[1].version})])assert.throws(()=>validateHistory(corrupted,inventory),code('history_uncertain'))
})
test('protected plans, checkpoint chains and exclusive locks reject tampering',async()=>{
  const parent=await realpath(await mkdtemp('/tmp/elcomputer-install-contract-')),directory=join(parent,'workspace')
  try{
    await createWorkspace(directory)
    const content={format:1,engine:1,created_at:new Date().toISOString(),target:target(),source:{},observation:{},owner_request_id:randomUUID(),stages},plan={...content,plan_digest:digest(content)}
    validatePlan(plan)
    const cp=await checkpointWrite(directory,plan,null,'planned','ready')
    assert.equal((await checkpointRead(directory,plan)).length,1)
    const release=await workspaceLock(directory,plan)
    await assert.rejects(()=>workspaceLock(directory,plan),code('lock_busy'))
    await release()
    await writeAtomic(directory,'private.json',{secret:'PRIVATE-CANARY'})
    await chmod(join(directory,'private.json'),0o644)
    await assert.rejects(()=>readProtected(join(directory,'private.json')),code('unsafe_file'))
    await symlink(join(directory,'private.json'),join(directory,'alias.json'))
    await assert.rejects(()=>readProtected(join(directory,'alias.json')),code('unsafe_file'))
    const receipt=await readFile(join(directory,'receipt.json'),'utf8');assert.doesNotMatch(receipt,/PRIVATE-CANARY|owner_email|password|service_role_key/)
    await writeFile(join(directory,'checkpoint-000000.json'),JSON.stringify({...cp,status:'complete'}),{mode:0o600})
    await assert.rejects(()=>checkpointRead(directory,plan),code('checkpoint_changed'))
    await assert.rejects(()=>createWorkspace(directory),code('unsafe_file'))
  }finally{await rm(parent,{recursive:true,force:true})}
})
