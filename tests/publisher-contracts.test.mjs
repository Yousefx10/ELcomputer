import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, realpath, mkdir, writeFile, chmod, rm, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { validateRegistry, validateTarget } from '../scripts/publish/contracts.mjs'
import { quote } from '../scripts/publish/ssh.mjs'
import { inventory } from '../scripts/publish/inventory.mjs'
import { checkpoint, readChain } from '../scripts/publish/state.mjs'

const registry=()=>({format:1,production:{project_refs:['zsqhuwgoasrexdnamlks'],ssh_hosts:['reserved.example.invalid'],ssh_fingerprints:['SHA256:'+'A'.repeat(43)],domains:['new.elcomputer.net'],users:['newelcomputer'],paths:['/home/newelcomputer/htdocs/new.elcomputer.net'],pm2_names:['new-elcomputer'],ports:[3001]},reserved:{project_refs:[],ssh_hosts:[],ssh_fingerprints:[],domains:[],users:[],paths:[],pm2_names:[],ports:[]}})
const target=()=>({format:1,publication_id:randomUUID(),installation_id:randomUUID(),project_ref:'abcdefghijklmnopqrst',site_origin:'https://fresh.example.invalid',release_sha256:'a'.repeat(64),ssh:{host:'fresh.example.invalid',port:22,user:'freshsite',host_key_sha256:'SHA256:'+'B'.repeat(43),known_hosts_file:'/private/known-hosts',identity_file:'/private/key',machine_id:'c'.repeat(32)},site:{app_path:'/home/freshsite/htdocs/fresh.example.invalid',uploads_path:'/home/freshsite/data/fresh.example.invalid/uploads',pm2_home:'/home/freshsite/.elcomputer-pm2',pm2_name:'fresh-site',port:3042},runtime:{node_path:'/opt/node-v22.23.1/bin/node',pm2_package:'/opt/pm2'},ingress:{nginx_file:'/etc/nginx/sites-available/fresh-site',certificate_file:'/etc/letsencrypt/site.pem',certificate_key_file:'/etc/letsencrypt/site.key',operator_ipv4:'192.0.2.44',startup_unit:'pm2-freshsite.service'}})
test('publication requires a production exclusion registry and explicit fresh bindings',()=>{
  assert.ok(validateTarget(target(),validateRegistry(registry())))
  assert.throws(()=>validateRegistry({...registry(),production:{...registry().production,ssh_hosts:[]}}))
  for(const[key,values]of[['ports',['3042']],['ports',[0]],['ssh_hosts',[123]],['ssh_fingerprints',['wrong']],['project_refs',['wrong']],['paths',['relative']]])assert.throws(()=>validateRegistry({...registry(),reserved:{...registry().reserved,[key]:values}}))
  for(const change of [t=>t.ssh.host='reserved.example.invalid',t=>t.ssh.host_key_sha256='SHA256:'+'A'.repeat(43),t=>t.project_ref='zsqhuwgoasrexdnamlks',t=>t.site_origin='https://new.elcomputer.net',t=>t.ssh.user='newelcomputer',t=>t.site.pm2_name='new-elcomputer',t=>t.site.port=3001]){const value=target();change(value);assert.throws(()=>validateTarget(value,registry()))}
})
test('publication rejects root, paths outside the prepared home, shell syntax and forced targets',()=>{
  for(const change of [t=>t.ssh.user='root',t=>t.ssh.host='host;command',t=>t.ssh.identity_file='/private/../key',t=>t.site.app_path='/home/foreign/site',t=>t.site.uploads_path=t.site.app_path+'/uploads',t=>t.runtime.node_path='node',t=>t.ingress.operator_ipv4='999.1.1.1',t=>t.force=true,t=>t.site_origin='https://elcomputer.net',t=>t.ssh.machine_id='wrong',t=>t.release_sha256='wrong']){const value=target();change(value);assert.throws(()=>validateTarget(value,registry()))}
  assert.equal(quote("a'$()`"),"'a'\\''$()`'")
})
test('output inventory records bytes, modes and internal links; secrets and escapes fail closed',async()=>{
  const root=await realpath(await mkdtemp('/tmp/elcomputer-output-contract-'))
  try{
    await mkdir(join(root,'server'));await writeFile(join(root,'server/index.mjs'),'export default true',{mode:0o644});await symlink('index.mjs',join(root,'server/internal.mjs'))
    const records=await inventory(root);assert.ok(records.some(row=>row.type==='link'&&row.target==='index.mjs'));assert.ok(records.some(row=>row.path==='server/index.mjs'&&row.mode===0o644))
    await writeFile(join(root,'server/index.mjs'),'SECRET-SCAN-CANARY-VALUE');await assert.rejects(()=>inventory(root,{secrets:['SECRET-SCAN-CANARY-VALUE']}))
    await symlink('/etc/passwd',join(root,'server/escape'));await assert.rejects(()=>inventory(root))
    await rm(join(root,'server/escape'));await writeFile(join(root,'server/index.mjs'),'sb_secret_'+'x'.repeat(30));await assert.rejects(()=>inventory(root));await chmod(join(root,'server/index.mjs'),0o666);await assert.rejects(()=>inventory(root))
  }finally{await rm(root,{recursive:true,force:true})}
})
test('publication checkpoint intent and receipts are chained and secret-free',async()=>{
  const directory=await realpath(await mkdtemp('/tmp/elcomputer-publish-chain-'))
  try{
    const plan={target:target(),plan_digest:'b'.repeat(64),bundle:{inventory_sha256:'c'.repeat(64),source:{commit:'reviewed'}},installation:{receipt_digest:'d'.repeat(64)}}
    const first=await checkpoint(directory,plan,null,'planned','ready'),second=await checkpoint(directory,plan,first,'runtime','pending',{workers_off:true})
    assert.equal((await readChain(directory,plan)).length,2)
    await writeFile(join(directory,'checkpoint-000001.json'),JSON.stringify({...second,status:'complete'}),{mode:0o600});await assert.rejects(()=>readChain(directory,plan))
  }finally{await rm(directory,{recursive:true,force:true})}
})

test('SSH identity is pinned to a private explicit known-host entry without contacting a host',async()=>{
  const {execFile}=await import('node:child_process'),{promisify}=await import('node:util'),{readFile}=await import('node:fs/promises'),{sshIdentity}=await import('../scripts/publish/ssh.mjs')
  const directory=await realpath(await mkdtemp('/tmp/elcomputer-ssh-contract-')),run=promisify(execFile)
  try{
    await chmod(directory,0o700);const key=join(directory,'key'),known=join(directory,'known-hosts')
    await run('/usr/bin/ssh-keygen',['-q','-t','ed25519','-N','','-f',key]);const publicKey=(await readFile(key+'.pub','utf8')).trim().split(/\s+/).slice(0,2).join(' ')
    await writeFile(known,'127.0.0.1 '+publicKey+'\n',{mode:0o600})
    const fp=(await run('/usr/bin/ssh-keygen',['-l','-E','sha256','-f',known])).stdout.trim().split(/\s+/)[1]
    const value=target();value.ssh={...value.ssh,host:'127.0.0.1',port:22,known_hosts_file:known,identity_file:key,host_key_sha256:fp};value.site_origin='https://127.0.0.1'
    assert.equal((await sshIdentity(value,registry())).host_key_sha256,fp)
    value.ssh.host_key_sha256='SHA256:'+'B'.repeat(43);await assert.rejects(()=>sshIdentity(value,registry()))
    value.ssh.host_key_sha256=fp;await chmod(key,0o644);await assert.rejects(()=>sshIdentity(value,registry()))
  }finally{await rm(directory,{recursive:true,force:true})}
})

test('public CLI blocks production and ambient credentials before opening receipt or services',async()=>{
  const {execFile}=await import('node:child_process'),{promisify}=await import('node:util')
  const directory=await realpath(await mkdtemp('/tmp/elcomputer-publish-cli-'))
  try{
    await chmod(directory,0o700);const value=target();value.project_ref='zsqhuwgoasrexdnamlks'
    const targetFile=join(directory,'target.json'),registryFile=join(directory,'registry.json')
    await writeFile(targetFile,JSON.stringify(value),{mode:0o600});await writeFile(registryFile,JSON.stringify(registry()),{mode:0o600})
    const args=['scripts/elcomputer-publish.mjs','runtime','--target',targetFile,'--registry',registryFile,'--installation-receipt',join(directory,'never-opened.json'),'--credentials-file',join(directory,'missing.json'),'--out',join(directory,'runtime'),'--key-record-dir',join(directory,'keys')]
    async function rejected(env,extra=[]){try{await promisify(execFile)(process.execPath,[...args,...extra],{env:{PATH:process.env.PATH,LANG:'C',...env}});assert.fail('CLI must reject')}catch(error){assert.equal(error.code,1);return JSON.parse(error.stdout)}}
    assert.equal((await rejected({})).code,'protected_target')
    assert.equal((await rejected({SUPABASE_SERVICE_ROLE_KEY:'AMBIENT-PRIVATE-CANARY'})).code,'invalid_input')
    assert.equal((await rejected({},['--force','true'])).code,'invalid_input')
  }finally{await rm(directory,{recursive:true,force:true})}
})


test('fresh Linux user processes allow only the active SSH ancestry and system session',async()=>{
  const {freshUserProcesses}=await import('../scripts/publish/contracts.mjs')
  const initial='100 10 sshd\n101 100 node\n102 101 ps\n50 1 systemd\n51 50 (sd-pam)'
  assert.equal(freshUserProcesses(initial,101),true)
  for(const command of ['node','python3','server','PM2','bash'])assert.equal(freshUserProcesses(initial+'\n200 1 '+command,101),false)
})
