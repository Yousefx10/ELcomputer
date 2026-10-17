import { open, lstat, realpath, mkdir, rename, unlink, readdir, link } from 'node:fs/promises'
import { constants } from 'node:fs'
import { resolve, dirname, basename, isAbsolute } from 'node:path'
import { hostname } from 'node:os'
import { randomUUID } from 'node:crypto'
import { ensure, fail, digest, object, sourceRoot } from './contracts.mjs'
import {releasePlan,releaseStagesFor} from './releases.mjs'

export async function canonicalPath(path) {
  ensure(typeof path==='string' && isAbsolute(path) && resolve(path)===path,'unsafe_file')
  try { ensure(await realpath(path)===path,'unsafe_file') } catch { fail('unsafe_file') }
  return path
}
export async function privateDirectory(path) {
  await canonicalPath(path)
  const stat=await lstat(path)
  ensure(stat.isDirectory() && stat.uid===process.getuid() && (stat.mode&0o077)===0,'unsafe_file')
  return path
}
export async function readProtected(path, { json=true, privateMode=true, maxBytes=1024*1024 }={}) {
  await canonicalPath(path)
  const handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW)
  try {
    const stat=await handle.stat()
    ensure(stat.isFile() && stat.uid===process.getuid() && !(stat.mode&0o022) && (!privateMode || !(stat.mode&0o077)) && stat.size<=maxBytes,'unsafe_file')
    const text=await handle.readFile('utf8')
    if(!json)return text
    try{return JSON.parse(text)}catch{fail('invalid_input')}
  } finally {await handle.close()}
}
export async function createWorkspace(path) {
  ensure(typeof path==='string' && isAbsolute(path) && resolve(path)===path && path!==resolve(sourceRoot) && !path.startsWith(resolve(sourceRoot)+'/'),'unsafe_file')
  await canonicalPath(dirname(path))
  try { await mkdir(path,{mode:0o700}) } catch { fail('unsafe_file') }
  await privateDirectory(path)
  return path
}
export async function writeAtomic(directory,name,value,{exclusive=false}={}) {
  await privateDirectory(directory)
  ensure(/^[a-z][a-z0-9.-]*\.json$/.test(name),'unsafe_file')
  const path=resolve(directory,name),temp=resolve(directory,'.write-'+randomUUID())
  const handle=await open(temp,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600)
  try{await handle.writeFile(JSON.stringify(value,null,2)+'\n');await handle.sync()}finally{await handle.close()}
  if(exclusive){
    // Atomic no-overwrite publication: a crash leaves a complete old/new file.
    try{await link(temp,path);await unlink(temp)}catch{await unlink(temp).catch(()=>{});fail('unsafe_file')}
  }else{
    try{const stat=await lstat(path);ensure(stat.isFile()&&!stat.isSymbolicLink()&&stat.uid===process.getuid()&&!(stat.mode&0o077),'unsafe_file')}catch(error){if(error.code!=='ENOENT')throw error}
  }
  if(!exclusive)await rename(temp,path)
  const parent=await open(directory,constants.O_RDONLY);try{await parent.sync()}finally{await parent.close()}
}
export async function validateLaboratory(target) {
  if(target.profile!=='owned-laboratory')return
  const file=target.laboratory.identity_file,directory=dirname(file)
  await privateDirectory(directory)
  ensure(directory.startsWith((await realpath('/tmp'))+'/elcomputer-install-lab-') && basename(file)==='identity.json','target_changed')
  const identity=await readProtected(file)
  object(identity,['instance_id','pid','project_ref','api_url','database_port'])
  ensure(identity.instance_id===target.laboratory.instance_id && identity.project_ref===target.project_ref && identity.api_url===target.api_url && identity.database_port===target.database.port && Number.isInteger(identity.pid),'target_changed')
  try{process.kill(identity.pid,0)}catch{fail('target_changed')}
}
export function receipt(plan,checkpoint) {
  return {format:plan.engine,installation_id:plan.target.installation_id,project_ref:plan.target.project_ref,site_origin:plan.target.site_origin,plan_digest:plan.plan_digest,source:plan.source,status:checkpoint.status,stage:checkpoint.stage,revision:checkpoint.revision,checkpoint_digest:checkpoint.checkpoint_digest,baseline_covered:checkpoint.evidence?.covered_versions===70?70:0,later_migrations:releasePlan(plan)?(checkpoint.evidence?.normal_versions||[]):checkpoint.evidence?.migration71===true?['20261012160000']:[],owner_created:checkpoint.evidence?.owner_created===true,...(releasePlan(plan)?{release_certificate_sha256:plan.source.release.certificate_sha256,last_migration:checkpoint.evidence?.last_migration||0}:{}),...(plan.target.production_profile?{production_profile:plan.target.production_profile}:{}),pending:['VPS publication','hosted end-to-end acceptance','backup/recovery acceptance','commerce/provider acceptance']}
}
export async function checkpointRead(directory,plan) {
  await privateDirectory(directory)
  const files=(await readdir(directory)).filter(name=>/^checkpoint-\d{6}\.json$/.test(name)).sort()
  ensure(files.length>0,'checkpoint_changed')
  let previous=''
  const chain=[]
  for(let index=0;index<files.length;index++) {
    ensure(files[index]===`checkpoint-${String(index).padStart(6,'0')}.json`,'checkpoint_changed')
    const checkpoint=await readProtected(resolve(directory,files[index]))
    object(checkpoint,['format','plan_digest','installation_id','revision','previous_digest','stage','status','at','evidence','checkpoint_digest'])
    const {checkpoint_digest,...content}=checkpoint
    ensure(checkpoint.format===1 && checkpoint.plan_digest===plan.plan_digest && checkpoint.installation_id===plan.target.installation_id && checkpoint.revision===index && checkpoint.previous_digest===previous && digest(content)===checkpoint_digest,'checkpoint_changed')
    ensure(['ready','pending','verified','complete'].includes(checkpoint.status) && ['planned','baseline','history','migration71','database','storage','owner','complete',...(releasePlan(plan)?releaseStagesFor(plan.source):[])].includes(checkpoint.stage),'checkpoint_changed')
    previous=checkpoint_digest;chain.push(checkpoint)
  }
  return chain
}
export async function checkpointWrite(directory,plan,previous,stage,status,evidence={}) {
  const revision=previous?previous.revision+1:0
  if(previous){const current=(await checkpointRead(directory,plan)).at(-1);ensure(current.checkpoint_digest===previous.checkpoint_digest,'checkpoint_changed')}
  const content={format:1,plan_digest:plan.plan_digest,installation_id:plan.target.installation_id,revision,previous_digest:previous?.checkpoint_digest||'',stage,status,at:new Date().toISOString(),evidence}
  const checkpoint={...content,checkpoint_digest:digest(content)}
  await writeAtomic(directory,`checkpoint-${String(revision).padStart(6,'0')}.json`,checkpoint,{exclusive:true})
  await writeAtomic(directory,'receipt.json',receipt(plan,checkpoint))
  return checkpoint
}
export async function workspaceLock(directory,plan,{resume=false}={}) {
  await privateDirectory(directory)
  const path=resolve(directory,'installer.lock'),record={format:1,installation_id:plan.target.installation_id,plan_digest:plan.plan_digest,pid:process.pid,hostname:hostname(),nonce:randomUUID()}
  let handle
  try{handle=await open(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600)}catch(error){
    if(error.code!=='EEXIST')fail('unsafe_file')
    const previous=await readProtected(path)
    object(previous,Object.keys(record))
    ensure(Number.isSafeInteger(previous.pid)&&previous.pid>0&&typeof previous.nonce==='string','lock_uncertain')
    ensure(previous.installation_id===record.installation_id&&previous.plan_digest===record.plan_digest&&previous.hostname===record.hostname,'lock_uncertain')
    let dead=false
    try{process.kill(previous.pid,0)}catch(error){dead=error.code==='ESRCH'}
    ensure(resume&&dead,'lock_busy')
    // Preserve the stale lock as evidence; never delete target resources.
    const again=await readProtected(path);ensure(digest(again)===digest(previous),'lock_uncertain')
    await rename(path,resolve(directory,'stale-lock-'+randomUUID()+'.json'))
    try{handle=await open(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600)}catch{fail('lock_busy')}
  }
  await handle.writeFile(JSON.stringify(record));await handle.sync();await handle.close()
  return async()=>{try{const current=await readProtected(path);ensure(current.nonce===record.nonce,'lock_uncertain');await unlink(path)}catch(error){if(error.code!=='ENOENT')throw error}}
}

export async function settledCliJobs(directory,plan){
  for(const name of (await readdir(directory)).filter(name=>/^cli-[0-9a-f-]{36}$/.test(name))){
    const job=resolve(directory,name);await privateDirectory(job)
    let spec
    try{spec=await readProtected(resolve(job,'supervisor.json'))}catch(error){if(error.code==='unsafe_file'){try{await lstat(resolve(job,'supervisor.json'))}catch(missing){if(missing.code==='ENOENT')continue}}throw error}
    ensure(spec.installation_id===plan.target.installation_id&&spec.plan_digest===plan.plan_digest&&Number.isSafeInteger(spec.supervisor_pid)&&spec.supervisor_pid>0,'checkpoint_changed')
    let finished;try{finished=await readProtected(resolve(job,'finished.json'))}catch(error){if(error.code!=='unsafe_file')throw error}
    if(finished){
      ensure(finished.format===1&&finished.nonce===spec.nonce&&finished.installation_id===spec.installation_id&&finished.plan_digest===spec.plan_digest&&finished.cli_binary_sha256===spec.cli_binary_sha256&&(Number.isInteger(finished.exit_code)||finished.exit_code===null&&typeof finished.signal==='string'),'checkpoint_changed')
      continue // A durable child-exit proof remains valid after PID reuse.
    }
    let dead=false;try{process.kill(spec.supervisor_pid,0)}catch(error){dead=error.code==='ESRCH'}
    ensure(dead,'lock_busy');fail('stage_uncertain')
  }
}
