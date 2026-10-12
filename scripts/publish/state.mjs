import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { readProtected, writeAtomic, privateDirectory, workspaceLock } from '../install/files.mjs'
import { ensure, digest, object } from './contracts.mjs'

export const stages=['planned','transfer','artifact','runtime','staging','activation','process','health','receipt','complete']
export const lock=(directory,plan,options)=>workspaceLock(directory,{target:{installation_id:plan.target.publication_id},plan_digest:plan.plan_digest},options)
export function receipt(plan,checkpoint){return{format:1,kind:'elcomputer-publication',publication_id:plan.target.publication_id,installation_id:plan.target.installation_id,project_ref:plan.target.project_ref,site_origin:plan.target.site_origin,ssh_host:plan.target.ssh.host,ssh_host_key_sha256:plan.target.ssh.host_key_sha256,site_user:plan.target.ssh.user,app_path:plan.target.site.app_path,uploads_path:plan.target.site.uploads_path,pm2_name:plan.target.site.pm2_name,port:plan.target.site.port,release_sha256:plan.target.release_sha256,inventory_sha256:plan.bundle.inventory_sha256,source:plan.bundle.source,installation_receipt_digest:plan.installation.receipt_digest,plan_digest:plan.plan_digest,stage:checkpoint.stage,status:checkpoint.status,revision:checkpoint.revision,checkpoint_digest:checkpoint.checkpoint_digest,ingress_restricted:true,pending:['Linux/hosted end-to-end acceptance','reboot acceptance','backup/recovery','commerce/providers','public ingress review']}}
export async function readChain(directory,plan){
  await privateDirectory(directory);const names=(await readdir(directory)).filter(name=>/^checkpoint-\d{6}\.json$/.test(name)).sort(),chain=[]
  ensure(names.length>0,'checkpoint_changed')
  let previous=''
  for(let index=0;index<names.length;index++){
    ensure(names[index]===`checkpoint-${String(index).padStart(6,'0')}.json`,'checkpoint_changed')
    const checkpoint=await readProtected(resolve(directory,names[index]));object(checkpoint,['format','publication_id','plan_digest','revision','previous_digest','stage','status','at','evidence','checkpoint_digest'])
    const{checkpoint_digest,...content}=checkpoint
    ensure(checkpoint.format===1&&checkpoint.publication_id===plan.target.publication_id&&checkpoint.plan_digest===plan.plan_digest&&checkpoint.revision===index&&checkpoint.previous_digest===previous&&checkpoint_digest===digest(content)&&stages.includes(checkpoint.stage)&&['ready','pending','verified','complete'].includes(checkpoint.status),'checkpoint_changed')
    previous=checkpoint_digest;chain.push(checkpoint)
  }
  return chain
}
export async function checkpoint(directory,plan,previous,stage,status,evidence={}){
  ensure(stages.includes(stage),'checkpoint_changed')
  if(previous)ensure((await readChain(directory,plan)).at(-1).checkpoint_digest===previous.checkpoint_digest,'checkpoint_changed')
  const content={format:1,publication_id:plan.target.publication_id,plan_digest:plan.plan_digest,revision:previous?previous.revision+1:0,previous_digest:previous?.checkpoint_digest||'',stage,status,at:new Date().toISOString(),evidence},record={...content,checkpoint_digest:digest(content)}
  await writeAtomic(directory,`checkpoint-${String(record.revision).padStart(6,'0')}.json`,record,{exclusive:true});await writeAtomic(directory,'receipt.json',receipt(plan,record));return record
}
