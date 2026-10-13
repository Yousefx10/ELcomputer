import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { readProtected, writeAtomic, workspaceLock, privateDirectory } from '../install/files.mjs'
import { digest, ensure, object } from '../install/contracts.mjs'

const stages=['preparation','package','preflight','database-plan','planned','database','database-verified','runtime','publication-plan','publication','final-verification','complete']
export const lock=(directory,intent,options)=>workspaceLock(directory,{target:{installation_id:intent.database_target.installation_id},plan_digest:intent.intent_digest},options)
export async function chain(directory,intent){
  await privateDirectory(directory)
  const names=(await readdir(directory)).filter(name=>/^journal-\d{6}\.json$/.test(name)).sort(),records=[]
  ensure(names.length>0,'checkpoint_changed');let previous=''
  for(let index=0;index<names.length;index++){
    ensure(names[index]===`journal-${String(index).padStart(6,'0')}.json`,'checkpoint_changed')
    const row=await readProtected(join(directory,names[index]));object(row,['format','intent_digest','installation_id','revision','previous_digest','stage','status','at','evidence','checkpoint_digest'])
    const{checkpoint_digest,...body}=row
    ensure(row.format===1&&row.intent_digest===intent.intent_digest&&row.installation_id===intent.database_target.installation_id&&row.revision===index&&row.previous_digest===previous&&digest(body)===checkpoint_digest&&stages.includes(row.stage)&&['pending','verified','complete'].includes(row.status),'checkpoint_changed')
    records.push(row);previous=checkpoint_digest
  }
  return records
}
export async function append(directory,intent,stage,status,evidence={}){
  let previous=null
  if(stage!=='preparation')previous=(await chain(directory,intent)).at(-1)
  const body={format:1,intent_digest:intent.intent_digest,installation_id:intent.database_target.installation_id,revision:previous?previous.revision+1:0,previous_digest:previous?.checkpoint_digest||'',stage,status,at:new Date().toISOString(),evidence}
  ensure(stages.includes(stage)&&['pending','verified','complete'].includes(status),'checkpoint_changed')
  const row={...body,checkpoint_digest:digest(body)}
  await writeAtomic(directory,`journal-${String(row.revision).padStart(6,'0')}.json`,row,{exclusive:true})
  return row
}
