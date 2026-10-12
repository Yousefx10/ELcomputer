// Runs through the pinned SSH session. Only framed typed commands are accepted.
import { createInterface } from 'node:readline'
import { PublicationSession } from './remote.mjs'
import { PublicationError, ensure } from './contracts.mjs'
const session=new PublicationSession()
process.umask(0o077)
// Vendor diagnostics may include environment metadata; never forward them.
for(const name of['log','info','warn','error','debug'])console[name]=()=>{}
let busy=false,closing=false
async function close(){if(closing)return;closing=true;await session.close();process.exit()}
process.on('SIGTERM',close);process.on('SIGINT',close);process.stdin.on('end',()=>{if(!busy)close();else closing=true})
const input=createInterface({input:process.stdin,crlfDelay:Infinity})
input.on('line',async line=>{
  if(busy||line.length>64*1024*1024)return close()
  busy=true;let id=null
  try{
    const message=JSON.parse(line);id=message.id;ensure(Number.isSafeInteger(id)&&id>=0&&typeof message.action==='string')
    let result
    const p=message.payload
    if(message.action==='probe')result=await session.probe(p.target,{fresh:p.fresh})
    else if(message.action==='claim')result=await session.claim(p.plan,{resume:p.resume})
    else if(message.action==='transfer')result=await session.transfer(Buffer.from(p.base64,'base64'))
    else if(message.action==='artifact')result=await session.artifact()
    else if(message.action==='runtime')result=await session.runtime(p)
    else if(message.action==='staging')result=await session.stage()
    else if(message.action==='activation')result=await session.activate()
    else if(message.action==='process')result=await session.process()
    else if(message.action==='audit')result=await session.audit(p.runtime)
    else if(message.action==='health')result=await session.health(p.token,{verifyOnly:p.verifyOnly===true})
    else if(message.action==='receipt')result=await session.complete(p.receipt)
    else ensure(false)
    process.stdout.write(JSON.stringify({id,ok:true,result})+'\n')
  }catch(error){const code=error instanceof PublicationError?error.code:'stage_uncertain';process.stdout.write(JSON.stringify({id,ok:false,code})+'\n')}
  finally{busy=false;if(closing){closing=false;await close()}}
})
