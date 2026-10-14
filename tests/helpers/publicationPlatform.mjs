import { readdir, mkdir, mkdtemp, realpath, writeFile, readFile, cp, chmod, rm } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID, randomBytes } from 'node:crypto'
import { userInfo } from 'node:os'
import { createServer } from 'node:net'
import { create as tarCreate } from 'tar'
import { installerSourceCopy, createInstallerPlatform } from './installerPlatform.mjs'
import { sourceRoot } from '../../scripts/install/contracts.mjs'
import { inventory } from '../../scripts/publish/inventory.mjs'
import { hash, digest, validateRegistry, validateTarget } from '../../scripts/publish/contracts.mjs'
import { writeAtomic } from '../../scripts/install/files.mjs'
import { PublicationSession } from '../../scripts/publish/remote.mjs'

const port=async()=>{const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const value=server.address().port;await new Promise(resolve=>server.close(resolve));return value}
export async function createPublicationFixture({compiledOutput=process.env.PUBLICATION_REVIEW_OUTPUT||'/private/tmp/elcomputer-m4-reviewed-package/build-source/.output',initialize=true,siteOrigin='https://fresh.example.invalid',release79=false}={}){
  const directory=await realpath(await mkdtemp('/tmp/elcomputer-publication-lab-'));await chmod(directory,0o700)
  let source,lab
  try{
  const extraFiles=['scripts/elcomputer-publish.mjs',...(await readdir(resolve(sourceRoot,'scripts/publish'))).map(name=>'scripts/publish/'+name)]
  source=await installerSourceCopy({extraFiles,release79});lab=await createInstallerPlatform({siteOrigin});const installDir=join(lab.directory,'installation')
  if(initialize){
  const prepared=await source.cli(['plan','--target',lab.targetFile,'--out',installDir,'--credentials-file',lab.credentialsFile])
  if(prepared.code!==0)throw Error(JSON.stringify(prepared.result))
  const installed=await source.cli(['apply','--plan',join(installDir,'plan.json'),'--credentials-file',lab.credentialsFile,'--owner-file',lab.ownerFile,'--confirm',prepared.result.confirmation])
  if(installed.code!==0)throw Error(JSON.stringify(installed.result))
  }
  const mod=async path=>import(pathToFileURL(join(source.directory,path)))
  const workflow=await mod('scripts/publish/workflow.mjs'),runtimeModule=await mod('scripts/publish/runtime.mjs'),installationModule=await mod('scripts/publish/installation.mjs'),{frozenSource}=await mod('scripts/install/contracts.mjs'),{agentSource}=await mod('scripts/publish/ssh.mjs')
  const build=join(directory,'bundle'),output=join(build,'build-source/.output');await mkdir(dirname(output),{recursive:true,mode:0o700});await cp(compiledOutput,output,{recursive:true,verbatimSymlinks:true})
  // Only software source paths enter the compiled fixture. Assert its actual
  // application inputs match the current checkout; publisher-only edits do
  // not become a claim that a new merchant build was performed.
  const original=dirname(compiledOutput)
  const {execFile}=await import('node:child_process'),{promisify}=await import('node:util')
  const names=(await promisify(execFile)('git',['ls-files','-z'],{cwd:sourceRoot})).stdout.split('\0').filter(name=>/^(app\/|server\/|shared\/|i18n\/|public\/|nuxt\.config\.ts$|package-lock\.json$)/.test(name))
  for(const file of names)if(hash(await readFile(join(original,file)))!==hash(await readFile(resolve(sourceRoot,file))))throw Error('Compiled app source drift')
  const entries=await inventory(output),archive=join(build,'release.tar.gz');await tarCreate({file:archive,cwd:join(build,'build-source'),gzip:true,portable:true,noMtime:true},['.output']);await chmod(archive,0o600)
  const body={format:1,kind:'elcomputer-output',source:await frozenSource(),archive_sha256:hash(await readFile(archive)),inventory_sha256:digest(entries),entries,node:'22.23.1',content:'output only; no runtime secrets, source or merchant uploads'},bundle={...body,release_sha256:digest(body)};await writeAtomic(build,'bundle.json',bundle)
  const registry=validateRegistry({format:1,production:{project_refs:['zsqhuwgoasrexdnamlks'],ssh_hosts:['reserved.example.invalid'],ssh_fingerprints:['SHA256:'+'A'.repeat(43)],domains:['new.elcomputer.net'],users:['newelcomputer'],paths:['/home/newelcomputer/htdocs/new.elcomputer.net'],pm2_names:['new-elcomputer'],ports:[3001]},reserved:{project_refs:[],ssh_hosts:[],ssh_fingerprints:[],domains:[],users:[],paths:[],pm2_names:[],ports:[]}})
  const sessions=[],originalPm2=process.env.PM2_HOME;process.env.PM2_PROGRAMMATIC='true';process.env.PM2_NO_INTERACTION='true'
  async function site(label,{guided=false}={}){
    const domain=new URL(lab.target.site_origin).hostname
    const root=join(directory,label),siteHome=join(root,'site-home'),app=join(siteHome,'htdocs/'+domain),uploads=join(siteHome,'data/'+domain+'/uploads')
    for(const folder of [root,siteHome,dirname(app),dirname(dirname(uploads)),dirname(uploads)])await mkdir(folder,{recursive:true,mode:0o700})
    const target=validateTarget({format:1,publication_id:randomUUID(),installation_id:lab.target.installation_id,project_ref:lab.target.project_ref,site_origin:lab.target.site_origin,release_sha256:bundle.release_sha256,ssh:{host:domain,port:22222,user:userInfo().username,host_key_sha256:'SHA256:'+randomBytes(32).toString('base64').replace(/=$/,''),known_hosts_file:join(root,'known-hosts'),identity_file:join(root,'key'),machine_id:randomBytes(16).toString('hex')},site:{app_path:app,uploads_path:uploads,pm2_home:join(siteHome,'.elcomputer-pm2'),pm2_name:'fresh-'+label,port:await port()},runtime:{node_path:source.node,pm2_package:process.env.PUBLICATION_REVIEW_PM2_PACKAGE||'/private/tmp/elcomputer-publication-tools/node_modules/pm2'},ingress:{nginx_file:'/fixture/nginx.conf',certificate_file:'/fixture/site.pem',certificate_key_file:'/fixture/site.key',operator_ipv4:'192.0.2.100',startup_unit:'pm2-'+userInfo().username+'.service'}},registry,{laboratory:true})
    const identity={host_key_sha256:target.ssh.host_key_sha256,known_hosts_sha256:'c'.repeat(64),addresses:['127.0.0.1']}
    const remoteFactory=async()=>{
      const session=new PublicationSession({laboratory:{directory,pid:process.pid,machine_id:target.ssh.machine_id}});sessions.push(session)
      return{session,identity,agent_sha256:hash(await agentSource()),async call(action,p={}){
        if(action==='probe')return session.probe(p.target,{fresh:p.fresh})
        if(action==='claim')return session.claim(p.plan,{resume:p.resume})
        if(action==='transfer')return session.transfer(Buffer.from(p.base64,'base64'))
        if(action==='artifact'){const mask=process.umask(0o077);try{return await session.artifact()}finally{process.umask(mask)}}
        if(action==='runtime')return session.runtime(p)
        if(action==='staging')return session.stage()
        if(action==='activation')return session.activate()
        if(action==='process'){const mask=process.umask(0o077);try{return await session.process()}finally{process.umask(mask)}}
        if(action==='health')return session.health(p.token,{verifyOnly:p.verifyOnly})
        if(action==='audit')return session.audit(p.runtime)
        if(action==='receipt'){const mask=process.umask(0o077);try{return await session.complete(p.receipt)}finally{process.umask(mask)}}
        throw Error('Unknown fixture protocol action')
      },close:()=>session.close()}
    }
    const ingressCheck=async()=>({certificate_sha256:'d'.repeat(64),ca_sha256:null,acceptance:'TLS/Nginx fixture only'})
    if(guided)return{target,root,registry,remoteFactory,ingressCheck}
    const installation=await installationModule.completedInstallation(join(installDir,'receipt.json'))
    const prepared=await runtimeModule.prepareRuntime({target,installation,credentials:lab.credentials,directory:join(root,'private'),keyRecordDirectory:join(root,'key-record')})
    const runtimeFile=prepared.runtime_file,publishDir=join(root,'publication')
    const options={target,registry,receiptFile:join(installDir,'receipt.json'),bundleFile:join(build,'bundle.json'),runtimeFile,credentials:lab.credentials,directory:publishDir,remoteFactory,ingressCheck}
    const planned=await workflow.planPublication(options),plan=JSON.parse(await readFile(join(publishDir,'plan.json')))
    const execute={plan,directory:publishDir,credentials:lab.credentials,runtimeFile,owner:lab.owner,confirm:planned.confirmation,remoteFactory,ingressCheck}
    return{target,runtimeFile,plan,root,publishDir,execute,apply:()=>workflow.executePublication({command:'apply',...execute}),resume:()=>workflow.executePublication({command:'resume',...execute}),verify:()=>workflow.readOnlyPublication({command:'verify',...execute})}
  }
  return{directory,lab,source,bundle,workflow,site,async close(){for(const session of [...new Map(sessions.filter(s=>s.target).map(s=>[s.target.site.pm2_home,s])).values()].reverse()){try{const require=(await import('node:module')).createRequire(import.meta.url),API=require(join(session.target.runtime.pm2_package,'lib/API.js'));if(session.target&&await lstatExists(session.target.site.pm2_home)){const pm2=new API({pm2_home:session.target.site.pm2_home,daemon_mode:true,silent:true});await new Promise(resolve=>pm2.connect(false,()=>resolve()));await new Promise(resolve=>pm2.killDaemon(()=>resolve()));await new Promise(resolve=>pm2.disconnect(()=>resolve()));for(const socket of[pm2.Client.client_sock,pm2.Client.sub_sock]){socket?.set('retry timeout',0);socket?.close()}}}catch{}}await lab.close();await source.close();if(originalPm2==null)delete process.env.PM2_HOME;else process.env.PM2_HOME=originalPm2;await rm(directory,{recursive:true,force:true})}}
  }catch(error){await lab?.close();await source?.close();await rm(directory,{recursive:true,force:true});throw error}
}
async function lstatExists(file){try{await readFile(join(file,'pm2.pid'));return true}catch{return false}}
