import { readFile, writeFile, mkdir, readdir, lstat, realpath, readlink, rename, unlink, symlink, open, statfs, chmod } from 'node:fs/promises'
import { constants } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { userInfo, arch, totalmem } from 'node:os'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createServer } from 'node:net'
import http from 'node:http'
import { extract as tarExtract } from 'tar'
import { hash, digest, ensure, fail, nodeVersion, pm2Version, nginxConfiguration, startupConfiguration, freshUserProcesses } from './contracts.mjs'
import { inventory } from './inventory.mjs'

const run=promisify(execFile)
const present=async path=>{try{return await lstat(path)}catch(error){if(error.code==='ENOENT')return null;throw error}}
const pidAlive=pid=>{try{process.kill(pid,0);return true}catch(error){return error.code!=='ESRCH'}}
async function pm2Environment(target,callback){
  const previous={...process.env}
  for(const key of Object.keys(process.env))delete process.env[key]
  Object.assign(process.env,{PATH:dirname(target.runtime.node_path)+':/usr/bin:/bin',LANG:'C',HOME:userInfo().homedir,PM2_HOME:target.site.pm2_home,PM2_PROGRAMMATIC:'true',PM2_NO_INTERACTION:'true'})
  try{return await callback()}finally{for(const key of Object.keys(process.env))delete process.env[key];Object.assign(process.env,previous)}
}
async function softwareTree(root){
  ensure(await realpath(root)===root,'unsafe_file');const records=[]
  async function walk(path){
    const file=join(root,path),meta=await lstat(file),mode=meta.mode&0o7777
    ensure([0,process.getuid()].includes(meta.uid)&&(meta.isSymbolicLink()||!(mode&0o6022)),'unsafe_file')
    if(meta.isSymbolicLink()){const target=await readlink(file);ensure(!target.startsWith('/')&&(await realpath(file)).startsWith(root+'/'),'unsafe_file');records.push({path,mode,target})}
    else if(meta.isDirectory()){records.push({path,mode});for(const name of(await readdir(file)).sort())await walk(path?path+'/'+name:name)}
    else{ensure(meta.isFile(),'unsafe_file');records.push({path,mode,sha256:hash(await readFile(file))})}
  }
  await walk('');return digest(records)
}
export async function safeDirectory(path,{empty=false,uid=process.getuid(),privateMode=true}={}){
  ensure(await realpath(path)===path,'unsafe_file');const stat=await lstat(path)
  ensure(stat.isDirectory()&&stat.uid===uid&&!(stat.mode&0o022)&&(!privateMode||!(stat.mode&0o077)),'unsafe_file')
  if(empty)ensure((await readdir(path)).length===0,'occupied_target')
}
async function safeAbsentOrEmpty(path){const found=await present(path);if(found)await safeDirectory(path,{empty:true});else await safeDirectory(dirname(path))}
async function privateRead(path){ensure(await realpath(path)===path,'unsafe_file');const handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);try{const stat=await handle.stat();ensure(stat.isFile()&&stat.uid===process.getuid()&&!(stat.mode&0o077)&&stat.size<=4*1024*1024,'unsafe_file');return JSON.parse(await handle.readFile('utf8'))}finally{await handle.close()}}
async function atomic(directory,name,value){await safeDirectory(directory);const temp=join(directory,'.write-'+randomUUID()),handle=await open(temp,'wx',0o600);try{await handle.writeFile(JSON.stringify(value,null,2)+'\n');await handle.sync()}finally{await handle.close()}await rename(temp,join(directory,name));const parent=await open(directory,'r');try{await parent.sync()}finally{await parent.close()}}
async function freePort(port){
  const server=createServer()
  try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen({host:'127.0.0.1',port,exclusive:true},resolve)})}catch{fail('occupied_target')}finally{if(server.listening)await new Promise(resolve=>server.close(resolve))}
}
export class PublicationSession{
  constructor({laboratory=null}={}){this.laboratory=laboratory;this.locked=false;this.completed=false;this.pm2=null;this.record=null;this.target=null;this.plan=null}
  async probe(target,{fresh=false}={}){
    const uid=process.getuid(),user=userInfo()
    ensure(uid!==0&&user.username===target.ssh.user&&process.versions.node===nodeVersion,'prerequisite_missing')
    ensure(await realpath(target.runtime.node_path)===target.runtime.node_path&&process.execPath===target.runtime.node_path,'prerequisite_missing')
    const nodeMeta=await lstat(target.runtime.node_path);ensure(nodeMeta.isFile()&&[0,uid].includes(nodeMeta.uid)&&!(nodeMeta.mode&0o6022),'unsafe_file')
    ensure(await realpath(target.runtime.pm2_package)===target.runtime.pm2_package,'unsafe_file')
    ensure(target.runtime.pm2_package.endsWith('/node_modules/pm2'),'prerequisite_missing')
    const pm2Manifest=JSON.parse(await readFile(join(target.runtime.pm2_package,'package.json')))
    ensure(pm2Manifest.name==='pm2'&&pm2Manifest.version===pm2Version,'prerequisite_missing')
    let platform,machine,nginx,cron,startup
    if(this.laboratory){
      ensure(target.site.app_path.startsWith(this.laboratory.directory+'/')&&pidAlive(this.laboratory.pid)&&await realpath(this.laboratory.directory)===this.laboratory.directory,'unsafe_file')
      platform={os:process.platform,arch:arch(),acceptance:'owned non-Linux protocol fixture'};machine=this.laboratory.machine_id;nginx=nginxConfiguration(target);cron='';startup='fixture'
    }else{
      ensure(process.platform==='linux'&&arch()==='x64','prerequisite_missing')
      const os=await readFile('/etc/os-release','utf8');ensure(/^ID=ubuntu$/m.test(os)&&/^VERSION_ID="24\.04"$/m.test(os),'prerequisite_missing')
      machine=(await readFile('/etc/machine-id','utf8')).trim();platform={os:'ubuntu',version:'24.04',arch:'x64',acceptance:'Linux prerequisites'}
      const groups=(await run('/usr/bin/id',['-Gn'],{env:{PATH:'/usr/bin:/bin',LANG:'C'}})).stdout.trim().split(/\s+/)
      ensure(!groups.some(group=>['root','sudo','admin','docker','lxd','disk'].includes(group)),'prerequisite_missing')
      for(const folder of['/home/'+target.ssh.user,dirname(target.site.app_path),dirname(dirname(target.site.uploads_path)),dirname(target.site.uploads_path)])await safeDirectory(folder)
      if(fresh){
        ensure(!(await present('/home/'+target.ssh.user+'/.pm2')),'occupied_target')
        const processes=(await run('/usr/bin/ps',['-u',String(uid),'-o','pid=,ppid=,comm='],{env:{PATH:'/usr/bin:/bin',LANG:'C'}})).stdout
        ensure(freshUserProcesses(processes,process.pid),'occupied_target')
      }
      ensure(await realpath(target.ingress.nginx_file)===target.ingress.nginx_file,'unsafe_file');const meta=await lstat(target.ingress.nginx_file);ensure(meta.isFile()&&meta.uid===0&&!(meta.mode&0o022),'unsafe_file')
      nginx=await readFile(target.ingress.nginx_file,'utf8')
      const unit='/etc/systemd/system/'+target.ingress.startup_unit
      ensure(await realpath(unit)===unit,'unsafe_file');const unitStat=await lstat(unit);ensure(unitStat.isFile()&&unitStat.uid===0&&!(unitStat.mode&0o022),'unsafe_file')
      ensure(await readFile(unit,'utf8')===startupConfiguration(target),'prerequisite_missing')
      startup=(await run('/usr/bin/systemctl',['is-enabled',target.ingress.startup_unit],{env:{PATH:'/usr/bin:/bin',LANG:'C'}})).stdout.trim();ensure(startup==='enabled','prerequisite_missing')
      try{cron=(await run('/usr/bin/crontab',['-l'],{env:{PATH:'/usr/bin:/bin',LANG:'C'}})).stdout}catch(error){ensure(error.code===1,'prerequisite_missing');cron=''}
      const listeners=(await run('/usr/bin/ss',['-H','-ltn'],{env:{PATH:'/usr/bin:/bin',LANG:'C'}})).stdout
      if(fresh)ensure(!listeners.split('\n').some(line=>new RegExp(':'+target.site.port+'(?:\\s|$)').test(line)),'occupied_target')
    }
    ensure(machine===target.ssh.machine_id&&nginx===nginxConfiguration(target)&&!cron.split('\n').some(line=>line.trim()&&!line.trim().startsWith('#')),'prerequisite_missing')
    await safeDirectory(dirname(target.site.app_path));await safeDirectory(dirname(target.site.uploads_path))
    const disk=await statfs(dirname(target.site.app_path));ensure(Number(disk.bavail)*Number(disk.bsize)>100*1024*1024&&totalmem()>=512*1024*1024,'prerequisite_missing')
    if(fresh){
      await safeAbsentOrEmpty(target.site.app_path);await safeAbsentOrEmpty(target.site.uploads_path)
      ensure(!(await present(target.site.pm2_home)),'occupied_target');await freePort(target.site.port)
      ensure(!(await present(join(dirname(dirname(target.site.app_path)),'.elcomputer-publication.lock'))),'lock_busy')
    }
    return{uid,gid:process.getgid(),user:user.username,machine_id:machine,platform,node:process.versions.node,node_sha256:hash(await readFile(target.runtime.node_path)),pm2:pm2Manifest.version,pm2_software_sha256:await softwareTree(dirname(target.runtime.pm2_package)),nginx_sha256:hash(nginx),startup,worker_schedules:0}
  }
  async claim(plan,{resume=false}={}){
    this.target=plan.target;this.plan=plan
    const observed=await this.probe(plan.target)
    ensure(digest(observed)===digest(plan.remote),'target_changed')
    const home=dirname(dirname(plan.target.site.app_path)),lockFile=join(home,'.elcomputer-publication.lock')
    const record={format:1,pid:process.pid,nonce:randomUUID(),publication_id:plan.target.publication_id,installation_id:plan.target.installation_id,plan_digest:plan.plan_digest}
    try{const handle=await open(lockFile,'wx',0o600);await handle.writeFile(JSON.stringify(record));await handle.sync();await handle.close()}catch(error){
      ensure(error.code==='EEXIST','unsafe_file');const prior=await privateRead(lockFile)
      ensure(resume&&prior.plan_digest===plan.plan_digest&&prior.publication_id===record.publication_id&&Number.isInteger(prior.pid)&&!pidAlive(prior.pid),'lock_busy')
      await rename(lockFile,lockFile+'.stale-'+randomUUID());const handle=await open(lockFile,'wx',0o600);await handle.writeFile(JSON.stringify(record));await handle.sync();await handle.close()
    }
    this.locked={file:lockFile,nonce:record.nonce}
    const app=plan.target.site.app_path,exists=await present(app),state=join(app,'.elcomputer-publication')
    if(!resume){
      await safeAbsentOrEmpty(app);await safeAbsentOrEmpty(plan.target.site.uploads_path);ensure(!(await present(plan.target.site.pm2_home)),'occupied_target');await freePort(plan.target.site.port)
      if(!exists)await mkdir(app,{mode:0o700})
      await mkdir(state,{mode:0o700});await mkdir(join(state,'logs'),{mode:0o700});await mkdir(join(app,'.releases'),{mode:0o700})
      this.record={format:1,publication_id:plan.target.publication_id,installation_id:plan.target.installation_id,plan_digest:plan.plan_digest,release_sha256:plan.target.release_sha256,runtime_id:plan.runtime_id,phase:'claimed',process_intent:false,complete:false}
      await atomic(state,'state.json',this.record)
    }else{
      await safeDirectory(app);await safeDirectory(state);this.record=await privateRead(join(state,'state.json'))
      ensure(this.record.publication_id===plan.target.publication_id&&this.record.plan_digest===plan.plan_digest&&this.record.release_sha256===plan.target.release_sha256&&this.record.runtime_id===plan.runtime_id,'checkpoint_changed')
      this.completed=this.record.complete===true
    }
    return this.record
  }
  async mark(phase,extra={}){this.record={...this.record,...extra,phase};await atomic(join(this.target.site.app_path,'.elcomputer-publication'),'state.json',this.record)}
  async transfer(bytes){
    ensure(this.locked&&hash(bytes)===this.plan.bundle.archive_sha256,'source_changed')
    const directory=join(this.target.site.app_path,'.elcomputer-publication'),file=join(directory,'release.tar.gz')
    const existing=await present(file)
    if(existing){ensure(existing.isFile()&&!existing.isSymbolicLink()&&existing.uid===process.getuid()&&!(existing.mode&0o077),'unsafe_file');if(hash(await readFile(file))===this.plan.bundle.archive_sha256)return{transferred:true}}
    await this.mark('transfer')
    const handle=await open(file,constants.O_WRONLY|constants.O_CREAT|constants.O_TRUNC|constants.O_NOFOLLOW,0o600);try{await handle.writeFile(bytes);await handle.sync()}finally{await handle.close()}
    await this.mark('transferred');return{transferred:true}
  }
  async artifact(){
    const published=join(this.target.site.app_path,'.releases',this.target.release_sha256)
    if(await present(published)){ensure(digest(await inventory(published,{owner:process.getuid()}))===this.plan.bundle.inventory_sha256,'source_changed');return{inventory_sha256:this.plan.bundle.inventory_sha256}}
    const directory=join(this.target.site.app_path,'.elcomputer-publication'),archive=join(directory,'release.tar.gz')
    ensure(hash(await readFile(archive))===this.plan.bundle.archive_sha256,'source_changed')
    const extracted=join(directory,'extracted'),existing=await present(extracted)
    if(existing){
      await safeDirectory(extracted)
      try{ensure(digest(await inventory(join(extracted,'.output'),{owner:process.getuid()}))===this.plan.bundle.inventory_sha256,'source_changed')}
      catch{
        // Preserve incomplete extraction as evidence. Extract the exact verified
        // archive into a new owned directory; never delete or adopt its files.
        ensure(this.record.extraction_intent&&!this.record.artifact_verified,'checkpoint_changed')
        await rename(extracted,join(directory,'interrupted-extraction-'+randomUUID()))
      }
    }
    if(!(await present(extracted))){
      await this.mark('extracting',{extraction_intent:true})
      await mkdir(extracted,{mode:0o700})
      const approved=new Map(this.plan.bundle.entries.map(entry=>['.output'+(entry.path?'/'+entry.path:''),entry])),seen=new Set()
      await tarExtract({file:archive,cwd:extracted,strict:true,preserveOwner:false,chmod:true,filter:(path,entry)=>{
        const name=path.replace(/\/$/,''),item=approved.get(name);ensure(item&&!seen.has(name)&&['File','Directory','SymbolicLink'].includes(entry.type),'source_changed')
        ensure((entry.type==='File'&&item.type==='file')||(entry.type==='Directory'&&item.type==='directory')||(entry.type==='SymbolicLink'&&item.type==='link'&&entry.linkpath===item.target),'source_changed')
        if(item.type!=='link')ensure((entry.mode&0o7777)===item.mode,'source_changed')
        seen.add(name);return true
      }})
      ensure(seen.size===approved.size,'source_changed')
      // Explicitly restore reviewed modes after tar's private-umask creation.
      for(const item of this.plan.bundle.entries){
        if(item.type==='link')continue
        const file=join(extracted,'.output',item.path),meta=await lstat(file)
        ensure(meta.uid===process.getuid()&&!meta.isSymbolicLink()&&await realpath(file)===file,'unsafe_file')
        ensure(item.type==='directory'?meta.isDirectory():meta.isFile(),'source_changed')
        await chmod(file,item.mode)
      }
    }
    const entries=await inventory(join(extracted,'.output'),{owner:process.getuid()});ensure(digest(entries)===this.plan.bundle.inventory_sha256,'source_changed')
    await this.mark('artifact',{artifact_verified:true});return{inventory_sha256:digest(entries)}
  }
  async runtime({runtime,launcher,extraCa=null}){
    ensure(runtime.runtime_id===this.plan.runtime_id&&runtime.publication_id===this.target.publication_id&&hash(launcher)===this.plan.launcher_sha256,'runtime_changed')
    const directory=join(this.target.site.app_path,'.elcomputer-publication'),file=join(directory,'runtime.json')
    if(await present(file))ensure(digest(await privateRead(file))===digest(runtime),'runtime_changed');else await atomic(directory,'runtime.json',runtime)
    const launchFile=join(directory,'launcher.mjs')
    if(await present(launchFile))ensure(hash(await readFile(launchFile))===this.plan.launcher_sha256,'source_changed');else await writeFile(launchFile,launcher,{mode:0o600,flag:'wx'})
    if(extraCa){const ca=join(directory,'api-ca.pem');if(await present(ca))ensure((await readFile(ca,'utf8'))===extraCa,'runtime_changed');else await writeFile(ca,extraCa,{mode:0o600,flag:'wx'})}
    if(!(await present(this.target.site.uploads_path)))await mkdir(this.target.site.uploads_path,{mode:0o700})
    await safeDirectory(this.target.site.uploads_path)
    await this.mark('runtime');return{runtime_id:runtime.runtime_id,independent_keys:true,workers_off:true}
  }
  async stage(){
    const destination=join(this.target.site.app_path,'.releases',this.target.release_sha256),source=join(this.target.site.app_path,'.elcomputer-publication/extracted/.output')
    if(!(await present(destination))){await this.mark('staging');await rename(source,destination)}
    ensure(digest(await inventory(destination,{owner:process.getuid()}))===this.plan.bundle.inventory_sha256,'source_changed')
    await this.mark('staged');return{staged:true}
  }
  async activate(){
    const directory=this.target.site.app_path,output=join(directory,'.output'),target='.releases/'+this.target.release_sha256
    const found=await present(output)
    if(found){ensure(this.record.activation_intent&&found.isSymbolicLink()&&await realpath(output)===join(directory,target),'occupied_target')}
    else{await this.mark('activating',{activation_intent:true});const temp=join(directory,'.output-'+randomUUID());await symlink(target,temp);await rename(temp,output)}
    ensure(digest(await inventory(await realpath(output),{owner:process.getuid()}))===this.plan.bundle.inventory_sha256,'source_changed')
    await this.mark('activated');return{active_release:this.target.release_sha256}
  }
  async manager(){
    if(this.pm2)return this.pm2
    process.env.PM2_HOME=this.target.site.pm2_home
    process.env.PM2_PROGRAMMATIC='true'
    process.env.PM2_NO_INTERACTION='true'
    if(this.completed){const pid=Number(await readFile(join(this.target.site.pm2_home,'pm2.pid'),'utf8'));ensure(Number.isInteger(pid)&&pid>0&&pidAlive(pid),'health_failed')}
    if(!(await present(this.target.site.pm2_home)))await mkdir(this.target.site.pm2_home,{mode:0o700})
    await safeDirectory(this.target.site.pm2_home)
    const require=createRequire(resolve(this.target.runtime.pm2_package,'package.json')),API=require(join(this.target.runtime.pm2_package,'lib/API.js')),pm2=new API({pm2_home:this.target.site.pm2_home,daemon_mode:true,silent:true})
    await pm2Environment(this.target,()=>new Promise((resolve,reject)=>pm2.connect(false,error=>error?reject(error):resolve())))
    this.pm2=pm2;return pm2
  }
  async processes(){const pm2=await this.manager();return new Promise((resolve,reject)=>pm2.list((error,list)=>error?reject(error):resolve(list)))}
  matching(process){
    const env=process.pm2_env,site=this.target.site
    return process.name===site.pm2_name&&env.pm_cwd===site.app_path&&env.pm_exec_path===join(site.app_path,'.elcomputer-publication/launcher.mjs')&&env.exec_interpreter===this.target.runtime.node_path&&env.exec_mode==='fork_mode'&&env.ELCOMPUTER_PUBLICATION_ID===this.target.publication_id&&env.ELCOMPUTER_PLAN_DIGEST===this.plan.plan_digest&&env.autorestart===false&&!env.watch&&!env.cron_restart
  }
  async process(){
    ensure(this.record.phase==='activated'||this.record.process_intent,'checkpoint_changed')
    const pm2=await this.manager(),list=await this.processes();ensure(list.length<=1&&list.every(process=>this.matching(process)),'occupied_target')
    let app=list[0]
    if(app)ensure(this.record.process_intent,'checkpoint_changed')
    if(!app){
      await freePort(this.target.site.port);await this.mark('process',{process_intent:true})
      const state=join(this.target.site.app_path,'.elcomputer-publication')
      const extraCa=await present(join(state,'api-ca.pem'))?{NODE_EXTRA_CA_CERTS:join(state,'api-ca.pem')}:{}
      await pm2Environment(this.target,()=>new Promise((resolve,reject)=>pm2.start({name:this.target.site.pm2_name,script:join(state,'launcher.mjs'),cwd:this.target.site.app_path,interpreter:this.target.runtime.node_path,node_args:[],filter_env:[''],exec_mode:'fork',instances:1,autorestart:false,watch:false,vizion:false,out_file:join(state,'logs/app-out.log'),error_file:join(state,'logs/app-error.log'),env:{PATH:dirname(this.target.runtime.node_path)+':/usr/bin:/bin',NODE_ENV:'production',ELCOMPUTER_PUBLICATION_ID:this.target.publication_id,ELCOMPUTER_PLAN_DIGEST:this.plan.plan_digest,...extraCa}},error=>error?reject(error):resolve())))
      app=(await this.processes())[0]
    }else if(app.pm2_env.status==='stopped'&&this.record.process_intent){await freePort(this.target.site.port);await new Promise((resolve,reject)=>pm2.restart(app.pm_id,error=>error?reject(error):resolve()));app=(await this.processes())[0]}
    ensure(app&&this.matching(app)&&app.pm2_env.status==='online'&&app.pid>0,'health_failed')
    await this.mark('process-created',{process_intent:true,pm2_id:app.pm_id,pid:app.pid})
    return{created:true,pid:app.pid,mode:'fork_mode',interpreter:this.target.runtime.node_path}
  }
  async audit(runtime){
    ensure(this.record.complete&&this.record.activation_intent&&this.record.process_intent,'checkpoint_changed')
    const output=join(this.target.site.app_path,'.output'),release=join(this.target.site.app_path,'.releases',this.target.release_sha256)
    ensure((await lstat(output)).isSymbolicLink()&&await realpath(output)===release,'target_changed')
    ensure(digest(await inventory(release,{owner:process.getuid()}))===this.plan.bundle.inventory_sha256,'source_changed')
    const state=join(this.target.site.app_path,'.elcomputer-publication')
    ensure(digest(await privateRead(join(state,'runtime.json')))===digest(runtime)&&hash(await readFile(join(state,'launcher.mjs')))===this.plan.launcher_sha256,'runtime_changed')
    const archive=join(state,'release.tar.gz'),meta=await lstat(archive)
    ensure(await realpath(archive)===archive&&meta.isFile()&&meta.uid===process.getuid()&&!(meta.mode&0o077)&&hash(await readFile(archive))===this.plan.bundle.archive_sha256,'source_changed')
    const receipt=await privateRead(join(state,'receipt.json'))
    ensure(receipt.plan_digest===this.plan.plan_digest&&receipt.release_sha256===this.target.release_sha256&&receipt.inventory_sha256===this.plan.bundle.inventory_sha256&&digest(receipt)===this.record.receipt_sha256,'checkpoint_changed')
    await safeDirectory(this.target.site.uploads_path);return{output_verified:true,runtime_verified:true,uploads_durable:true}
  }
  async health(token,{verifyOnly=false}={}){
    ensure(this.record.process_intent,'checkpoint_changed')
    const processes=await this.processes(),app=processes[0];ensure(processes.length===1&&app&&this.matching(app)&&app.pid===this.record.pid&&app.pm2_env.status==='online','target_changed')
    const request=(path,authorization)=>new Promise((resolve,reject)=>{const req=http.get({host:'127.0.0.1',port:this.target.site.port,path,headers:{host:new URL(this.target.site_origin).hostname,'x-forwarded-proto':'https',...(authorization?{authorization:'Bearer '+authorization}:{})},timeout:5000},res=>{let body='';res.on('data',bytes=>{body+=bytes;ensure(body.length<4*1024*1024,'health_failed')});res.on('end',()=>resolve({status:res.statusCode,body,headers:res.headers}))});req.on('error',reject);req.on('timeout',()=>req.destroy())})
    let home
    for(let attempt=0;attempt<40;attempt++){try{home=await request('/');if(home.status===200)break}catch{}await new Promise(resolve=>setTimeout(resolve,250))}
    ensure(home?.status===200,'health_failed');const ar=await request('/ar'),dashboard=await request('/dashboard/setup'),anonymous=await request('/api/admin-setup/status'),owner=await request('/api/admin-setup/status',token)
    ensure(ar.status===200&&/dir="rtl"/.test(ar.body)&&[200,302].includes(dashboard.status)&&anonymous.status===401&&owner.status===200&&/private, no-store/.test(owner.headers['cache-control']||''),'health_failed')
    const runtime=await privateRead(join(this.target.site.app_path,'.elcomputer-publication/runtime.json'))
    for(const secret of[runtime.env.NUXT_SUPABASE_SERVICE_ROLE_KEY,runtime.env.NUXT_CREDENTIALS_ENCRYPTION_KEY,runtime.env.NUXT_SHIPPING_CREDENTIALS_ENCRYPTION_KEY])ensure(!home.body.includes(secret)&&!ar.body.includes(secret)&&!owner.body.includes(secret),'health_failed')
    ensure(home.body.includes(new URL(this.target.site_origin).hostname)&&home.body.includes(runtime.env.NUXT_PUBLIC_SUPABASE_KEY),'health_failed')
    if(!this.laboratory){const sockets=(await run('/usr/bin/ss',['-H','-ltnp'],{env:{PATH:'/usr/bin:/bin',LANG:'C'}})).stdout.split('\n').filter(line=>new RegExp(':'+this.target.site.port+'(?:\\s|$)').test(line));ensure(sockets.length===1&&sockets[0].includes('127.0.0.1:'+this.target.site.port)&&sockets[0].includes('pid='+app.pid+','),'health_failed')}
    if(!verifyOnly)await this.mark('healthy');return{storefront_en:true,storefront_ar:true,rtl:true,dashboard_route:true,owner_setup:true,anonymous_setup_denied:true,private_runtime_not_rendered:true,port_loopback:true,workers_off:true}
  }
  async complete(receipt){
    ensure(this.record.phase==='healthy'||this.record.complete,'checkpoint_changed')
    ensure(receipt.plan_digest===this.plan.plan_digest&&receipt.publication_id===this.target.publication_id,'checkpoint_changed')
    const processes=await this.processes();ensure(processes.length===1&&this.matching(processes[0])&&processes[0].pid===this.record.pid&&processes[0].pm2_env.status==='online','target_changed')
    await atomic(join(this.target.site.app_path,'.elcomputer-publication'),'receipt.json',receipt)
    const pm2=await this.manager();await new Promise((resolve,reject)=>pm2.dump(error=>error?reject(error):resolve()))
    await this.mark('complete',{complete:true,receipt_sha256:digest(receipt)});this.completed=true;return{complete:true,restricted:true}
  }
  async close(){
    if(this.pm2&&!this.completed&&this.record?.process_intent){try{const list=await this.processes(),app=list[0];if(list.length===1&&this.matching(app))await new Promise(resolve=>this.pm2.stop(app.pm_id,()=>resolve()))}catch{}}
    if(this.pm2){await new Promise(resolve=>this.pm2.disconnect(()=>resolve()));for(const socket of[this.pm2.Client.client_sock,this.pm2.Client.sub_sock]){socket?.set('retry timeout',0);socket?.close()}}
    if(this.locked){try{const current=await privateRead(this.locked.file);ensure(current.nonce===this.locked.nonce,'lock_busy');await unlink(this.locked.file)}catch{}}
  }
}
