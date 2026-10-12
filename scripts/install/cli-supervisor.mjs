// Private process supervisor. Not an operator command or application endpoint.
// IPC disconnect proves parent death, including SIGKILL. A durable exit record
// is written only after the actual native CLI has stopped.
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { readProtected, writeAtomic } from './files.mjs'
import { unlink } from 'node:fs/promises'

let child,stopping=false,timer,started=false
function stop(){
  stopping=true
  if(child&&child.exitCode===null&&child.signalCode===null){child.kill('SIGTERM');timer??=setTimeout(()=>child.kill('SIGKILL'),2000)}
  else if(!started)process.exit(1)
}
process.on('disconnect',stop)
process.on('SIGTERM',stop)
process.on('SIGINT',stop)
process.once('message',async message=>{
  if(message!=='start'||stopping)return stop()
  started=true
  const directory=dirname(process.argv[2])
  try{
    const spec=await readProtected(process.argv[2])
    if(spec.supervisor_pid!==process.pid||spec.parent_pid!==process.ppid||!process.connected||stopping)throw Error()
    child=spawn(spec.executable,spec.args,{cwd:directory,env:{PATH:process.env.PATH,LANG:'C',DO_NOT_TRACK:'1',DYLD_LIBRARY_PATH:process.env.DYLD_LIBRARY_PATH||'',PGPASSFILE:join(directory,'database.pgpass')},stdio:['ignore','ignore','ignore']})
    const result=await new Promise(resolve=>{child.once('error',()=>resolve({exit_code:null,signal:'spawn_failed'}));child.once('exit',(exit_code,signal)=>resolve({exit_code,signal}))})
    clearTimeout(timer)
    await writeAtomic(directory,'finished.json',{format:1,nonce:spec.nonce,installation_id:spec.installation_id,plan_digest:spec.plan_digest,cli_binary_sha256:spec.cli_binary_sha256,...result},{exclusive:true})
    await unlink(join(directory,'database.pgpass')).catch(()=>{})
    if(process.connected)process.send?.({ok:result.exit_code===0&&!stopping})
    process.exit(result.exit_code===0&&!stopping?0:1)
  }catch{
    stop()
    // No exit record on uncertainty. Resume must stop and preserve evidence.
    if(child&&child.exitCode===null&&child.signalCode===null)await new Promise(resolve=>child.once('exit',resolve))
    clearTimeout(timer)
    process.exit(1)
  }
})
