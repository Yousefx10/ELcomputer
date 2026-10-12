#!/usr/bin/env node
import { dirname, resolve } from 'node:path'
import { readFile, open } from 'node:fs/promises'
import { constants } from 'node:fs'
import { InstallationError, ensure, fail, safeEnvironment, validateTarget, validateCredentials, validateOwner } from './install/contracts.mjs'
import { readProtected, privateDirectory, writeAtomic, checkpointRead } from './install/files.mjs'
import { planInstallation, readOnlyInstallation, executeInstallation, validatePlan } from './install/workflow.mjs'

const usage='node scripts/elcomputer-install.mjs <plan|check|apply|resume|verify> --target FILE --out DIRECTORY | --plan FILE | --receipt FILE; --credentials-file FILE; apply/resume --confirm REF:UUID:DIGEST --owner-file FILE or --owner-fd 3'
function argumentsFor(argv) {
  const [command,...rest]=argv
  ensure(['plan','check','apply','resume','verify'].includes(command))
  const accepted=['--target','--out','--plan','--receipt','--credentials-file','--owner-file','--owner-fd','--confirm','--json'],options={}
  for(let index=0;index<rest.length;index++){
    const key=rest[index];ensure(accepted.includes(key)&&!Object.hasOwn(options,key))
    if(key==='--json'){options[key]=true;continue}
    const value=rest[++index];ensure(typeof value==='string'&&!value.startsWith('--'));options[key]=value
  }
  ensure(options['--credentials-file'])
  if(command==='plan')ensure(options['--target']&&options['--out']&&!options['--plan']&&!options['--receipt']&&!options['--owner-file']&&!options['--owner-fd']&&!options['--confirm'])
  else ensure(!options['--target']&&!options['--out']&&Boolean(options['--plan'])!==Boolean(options['--receipt']))
  if(['check','verify'].includes(command))ensure(!options['--confirm']&&!options['--owner-file']&&!options['--owner-fd'])
  ensure(!(options['--owner-file']&&options['--owner-fd']))
  return {command,options}
}
async function ownerInput(options) {
  if(options['--owner-file'])return validateOwner(await readProtected(options['--owner-file'],{maxBytes:8192}))
  if(options['--owner-fd']){
    ensure(/^[0-9]+$/.test(options['--owner-fd']))
    const descriptor=Number(options['--owner-fd'])
    ensure(Number.isSafeInteger(descriptor)&&descriptor>=3&&descriptor<=1024)
    const handle=await open('/dev/fd/'+descriptor,constants.O_RDONLY)
    try{
      const stat=await handle.stat();ensure(stat.uid===process.getuid()&&!(stat.mode&0o077)&&(stat.isFile()||stat.isFIFO())&&stat.size<=8192,'unsafe_file')
      const buffer=Buffer.alloc(8193);let length=0
      while(length<buffer.length){const {bytesRead}=await handle.read(buffer,length,buffer.length-length,null);if(!bytesRead)break;length+=bytesRead}
      ensure(length<=8192,'invalid_input');const contents=buffer.subarray(0,length).toString('utf8')
      try{return validateOwner(JSON.parse(contents))}catch{fail('invalid_input')}
    }finally{await handle.close()}
  }
  return null
}
let command='unknown',options={},directory
try{
  ({command,options}=argumentsFor(process.argv.slice(2)))
  safeEnvironment()
  ensure(process.versions.node==='22.23.1','platform_unavailable')
  let plan,target
  if(command==='plan'){
    target=validateTarget(await readProtected(options['--target']))
    directory=options['--out']
  }else{
    const input=options['--plan']||options['--receipt'];directory=dirname(input)
    await privateDirectory(directory)
    plan=validatePlan(await readProtected(resolve(directory,'plan.json')))
    if(options['--plan'])ensure(input===resolve(directory,'plan.json'),'unsafe_file')
    if(options['--receipt']){
      ensure(input===resolve(directory,'receipt.json'),'unsafe_file')
      const receipt=await readProtected(input),latest=(await checkpointRead(directory,plan)).at(-1)
      ensure(receipt.plan_digest===plan.plan_digest&&receipt.installation_id===plan.target.installation_id&&receipt.checkpoint_digest===latest.checkpoint_digest&&receipt.revision===latest.revision,'checkpoint_changed')
    }
    target=plan.target
  }
  const credentials=validateCredentials(await readProtected(options['--credentials-file'],{maxBytes:16384}),target)
  let result
  if(command==='plan')result=await planInstallation({target,credentials,directory})
  else if(['check','verify'].includes(command))result=await readOnlyInstallation({command,plan,directory,credentials})
  else{
    const owner=await ownerInput(options)
    result=await executeInstallation({command,plan,directory,credentials,owner,confirm:options['--confirm'],progress:({stage,status})=>process.stderr.write(`${stage}: ${status}\n`)})
  }
  await writeAtomic(directory,'result.json',result)
  process.stdout.write(JSON.stringify(result)+'\n')
}catch(error){
  const known=error instanceof InstallationError?error:new InstallationError('stage_uncertain')
  const result={ok:false,command,code:known.code,message:known.message}
  if(directory)try{await writeAtomic(directory,'result.json',result)}catch{}
  process.stdout.write(JSON.stringify(result)+'\n')
  process.exitCode=1
}
