import { readFile, realpath } from 'node:fs/promises'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { createInterface } from 'node:readline'
import { lookup } from 'node:dns/promises'
import { build } from 'esbuild'
import { resolve } from 'node:path'
import https from 'node:https'
import { readProtected } from '../install/files.mjs'
import { sourceRoot } from '../install/contracts.mjs'
import { ensure, fail, hash, PublicationError } from './contracts.mjs'

export const quote=value=>"'"+String(value).replaceAll("'","'\\''")+"'"
export async function agentSource(){const result=await build({entryPoints:[resolve(sourceRoot,'scripts/publish/agent.mjs')],bundle:true,platform:'node',target:'node22',format:'esm',write:false,banner:{js:"import { createRequire as __publisherRequire } from 'node:module'; const require = __publisherRequire(import.meta.url);"}});return result.outputFiles[0].text}
export async function sshIdentity(target,registry){
  const known=await readProtected(target.ssh.known_hosts_file,{json:false}),lines=known.trim().split('\n')
  const host=target.ssh.port===22?target.ssh.host:`[${target.ssh.host}]:${target.ssh.port}`
  ensure(lines.length===1&&lines[0].split(/\s+/)[0]===host&&lines[0].split(/\s+/)[1]==='ssh-ed25519','target_changed')
  await readProtected(target.ssh.identity_file,{json:false,maxBytes:32768})
  const{stdout}=await promisify(execFile)('/usr/bin/ssh-keygen',['-l','-E','sha256','-f',target.ssh.known_hosts_file],{env:{PATH:'/usr/bin:/bin',LANG:'C'}})
  ensure(stdout.trim().split(/\s+/)[1]===target.ssh.host_key_sha256,'target_changed')
  const addresses=[...new Set((await lookup(target.ssh.host,{all:true})).map(row=>row.address))].sort()
  const domainAddresses=[...new Set((await lookup(new URL(target.site_origin).hostname,{all:true})).map(row=>row.address))].sort()
  ensure(addresses.length>0&&JSON.stringify(addresses)===JSON.stringify(domainAddresses),'target_changed')
  ensure(addresses.every(address=>![...registry.production.ssh_hosts,...registry.reserved.ssh_hosts].includes(address)),'protected_target')
  return{host_key_sha256:target.ssh.host_key_sha256,known_hosts_sha256:hash(known),addresses}
}
export async function openSsh(target,registry,{expectedIdentity=null}={}){
  const identity=await sshIdentity(target,registry)
  if(expectedIdentity)ensure(JSON.stringify(identity)===JSON.stringify(expectedIdentity),'target_changed')
  const source=await agentSource()
  // Send bundled code through stdin; an argv containing the bundle can exceed
  // SSH/OS limits. Runtime secrets stay in later encrypted protocol frames.
  const bootstrap=`import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';let buffered=Buffer.alloc(0);async function first(chunk){buffered=Buffer.concat([buffered,chunk]);if(buffered.length>4*1024*1024)process.exit(1);const at=buffered.indexOf(10);if(at<0)return;process.stdin.pause();process.stdin.removeListener('data',first);const message=JSON.parse(buffered.subarray(0,at));const code=Buffer.from(message.code,'base64');if(createHash('sha256').update(code).digest('hex')!==message.sha256)process.exit(1);const dir=fs.mkdtempSync(path.join(os.tmpdir(),'elcomputer-publication-agent-'));fs.chmodSync(dir,0o700);const file=path.join(dir,'agent.mjs');fs.writeFileSync(file,code,{mode:0o600});process.on('exit',()=>fs.rmSync(dir,{recursive:true,force:true}));process.stdin.unshift(buffered.subarray(at+1));await import(pathToFileURL(file));}process.stdin.on('data',first);`
  const command=`exec env -i PATH=/usr/bin:/bin LANG=C ${quote(target.runtime.node_path)} --input-type=module -e ${quote(bootstrap)}`
  const args=['-F','/dev/null','-p',String(target.ssh.port),'-i',target.ssh.identity_file,'-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','IdentityAgent=none','-o','StrictHostKeyChecking=yes','-o','UserKnownHostsFile='+target.ssh.known_hosts_file,'-o','GlobalKnownHostsFile=/dev/null','-o','PasswordAuthentication=no','-o','KbdInteractiveAuthentication=no','-o','ForwardAgent=no','-o','ClearAllForwardings=yes','-o','PermitLocalCommand=no','-o','ProxyCommand=none','-o','ProxyJump=none','-o','ControlMaster=no','-o','ConnectTimeout=10','-o','ServerAliveInterval=10','-o','ServerAliveCountMax=2','-T',target.ssh.user+'@'+target.ssh.host,command]
  const child=spawn('/usr/bin/ssh',args,{env:{PATH:'/usr/bin:/bin',LANG:'C'},stdio:['pipe','pipe','pipe']})
  child.stdin.write(JSON.stringify({code:Buffer.from(source).toString('base64'),sha256:hash(source)})+'\n')
  child.stderr.resume();let next=0,closed=false;const pending=new Map()
  const rejectAll=()=>{closed=true;for(const job of pending.values()){clearTimeout(job.timer);job.reject(Error('SSH publication session ended'))}pending.clear()}
  child.on('error',rejectAll);child.on('exit',rejectAll)
  const reader=createInterface({input:child.stdout,crlfDelay:Infinity})
  reader.on('line',line=>{
    if(line.length>4*1024*1024){child.kill('SIGTERM');return rejectAll()}
    try{const data=JSON.parse(line),job=pending.get(data.id);ensure(job);pending.delete(data.id);clearTimeout(job.timer);data.ok?job.resolve(data.result):job.reject(new PublicationError(data.code))}catch{child.kill('SIGTERM');rejectAll()}
  })
  return{identity,agent_sha256:hash(source),call(action,payload={}){
    ensure(!closed,'stage_uncertain');const id=next++
    return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);child.kill('SIGTERM');reject(Error('SSH stage deadline'))},180000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({id,action,payload})+'\n')})
  },async close(){if(!closed){const ended=new Promise(resolve=>child.once('exit',resolve));child.stdin.end();const timer=setTimeout(()=>child.kill('SIGTERM'),10000);await ended;clearTimeout(timer)}}}
}
export async function ingress(target,{expected=null,before=false,pending=false,token=null}={}){
  const ca=target.ingress.ca_file?await readProtected(target.ingress.ca_file,{json:false,privateMode:false}):undefined
  const request=path=>new Promise((resolve,reject)=>{
    const req=https.get(target.site_origin+path,{agent:false,ca,rejectUnauthorized:true,minVersion:'TLSv1.2',timeout:10000,headers:token?{authorization:'Bearer '+token}:{}},res=>{
      const certificate=res.socket.getPeerCertificate();if(!res.socket.authorized||!certificate.raw){res.destroy();reject(Error('Unverified ingress'));return}
      const identity={certificate_sha256:hash(certificate.raw),ca_sha256:ca?hash(ca):null}
      res.resume();res.on('end',()=>resolve({status:res.statusCode,marker:res.headers['x-elcomputer-publication'],identity}))
    });req.on('error',reject);req.on('timeout',()=>req.destroy())
  })
  const home=await request('/');ensure(home.marker===target.publication_id,'target_changed')
  if(expected)ensure(JSON.stringify(home.identity)===JSON.stringify(expected),'target_changed')
  if(pending)ensure([200,502,503].includes(home.status),'health_failed')
  else if(before)ensure(home.status===502||home.status===503,'occupied_target')
  else{ensure(home.status===200&&(await request('/ar')).status===200&&(await request('/api/admin-setup/status')).status===200,'health_failed')}
  return home.identity
}
