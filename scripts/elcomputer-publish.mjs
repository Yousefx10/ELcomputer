#!/usr/bin/env node
import { dirname, resolve } from 'node:path'
import { readProtected, writeAtomic, privateDirectory } from './install/files.mjs'
import { validateCredentials, validateOwner } from './install/contracts.mjs'
import { PublicationError, ensure, cleanEnvironment, validateTarget, validateRegistry, digest } from './publish/contracts.mjs'
import { completedInstallation, verifyInstallation } from './publish/installation.mjs'
import { buildPackage } from './publish/bundle.mjs'
import { prepareRuntime } from './publish/runtime.mjs'
import { planPublication, executePublication, readOnlyPublication, validatePlan } from './publish/workflow.mjs'
import { readChain, receipt as publicationReceipt } from './publish/state.mjs'

function parse(argv){
  const[command,...rest]=argv,flags={},accepted=['--out','--target','--registry','--installation-receipt','--credentials-file','--bundle','--runtime-file','--key-record-dir','--plan','--receipt','--owner-file','--confirm','--json']
  ensure(['package','runtime','plan','check','apply','resume','verify'].includes(command))
  for(let index=0;index<rest.length;index++){const key=rest[index];ensure(accepted.includes(key)&&!Object.hasOwn(flags,key));if(key==='--json')flags[key]=true;else{const value=rest[++index];ensure(typeof value==='string'&&!value.startsWith('--'));flags[key]=value}}
  const required={package:['--out'],runtime:['--target','--registry','--installation-receipt','--credentials-file','--out','--key-record-dir'],plan:['--target','--registry','--installation-receipt','--credentials-file','--bundle','--runtime-file','--out'],check:['--credentials-file'],apply:['--credentials-file','--runtime-file','--owner-file','--confirm'],resume:['--credentials-file','--runtime-file','--owner-file','--confirm'],verify:['--credentials-file','--owner-file']}[command]
  ensure(required.every(key=>flags[key]))
  const allowed=[...required,'--json',...(['check','apply','resume','verify'].includes(command)?['--plan','--receipt']:[])]
  ensure(Object.keys(flags).every(key=>allowed.includes(key)))
  if(['check','apply','resume','verify'].includes(command))ensure(Boolean(flags['--plan'])!==Boolean(flags['--receipt']))
  return{command,flags}
}
let directory,command='unknown'
try{
  const parsed=parse(process.argv.slice(2));command=parsed.command;const flags=parsed.flags;cleanEnvironment()
  let result
  if(command==='package'){directory=flags['--out'];result=await buildPackage({directory})}
  else if(['runtime','plan'].includes(command)){
    const registry=validateRegistry(await readProtected(flags['--registry'])),target=validateTarget(await readProtected(flags['--target']),registry),installation=await completedInstallation(flags['--installation-receipt'])
    ensure(target.project_ref===installation.plan.target.project_ref&&target.installation_id===installation.plan.target.installation_id&&target.site_origin===installation.plan.target.site_origin,'receipt_unverified')
    const credentials=validateCredentials(await readProtected(flags['--credentials-file']),installation.plan.target);directory=flags['--out']
    if(command==='runtime'){
      const verified=await verifyInstallation(installation,credentials)
      try{result=await prepareRuntime({target,installation,credentials,directory,keyRecordDirectory:flags['--key-record-dir']})}finally{await verified.close()}
    }else result=await planPublication({target,registry,receiptFile:flags['--installation-receipt'],bundleFile:flags['--bundle'],runtimeFile:flags['--runtime-file'],credentials,directory})
  }else{
    const input=flags['--plan']||flags['--receipt'];directory=dirname(input);await privateDirectory(directory)
    const plan=validatePlan(await readProtected(resolve(directory,'plan.json')));validateRegistry(plan.registry);validateTarget(plan.target,plan.registry)
    ensure(input===resolve(directory,flags['--plan']?'plan.json':'receipt.json'),'unsafe_file')
    if(flags['--receipt']){const receipt=await readProtected(input),latest=(await readChain(directory,plan)).at(-1);ensure(digest(receipt)===digest(publicationReceipt(plan,latest)),'checkpoint_changed')}
    const installation=await completedInstallation(plan.installation.receipt_file),credentials=validateCredentials(await readProtected(flags['--credentials-file']),installation.plan.target),owner=flags['--owner-file']?validateOwner(await readProtected(flags['--owner-file'],{maxBytes:8192})):null
    result=['check','verify'].includes(command)?await readOnlyPublication({command,plan,directory,credentials,owner}):await executePublication({command,plan,directory,credentials,owner,runtimeFile:flags['--runtime-file'],confirm:flags['--confirm'],progress:({stage,status})=>process.stderr.write(stage+': '+status+'\n')})
  }
  await writeAtomic(directory,'result.json',result);process.stdout.write(JSON.stringify(result)+'\n')
}catch(error){
  const known=error instanceof PublicationError?error:new PublicationError(error?.code),result={ok:false,command,code:known.code,message:known.message}
  if(directory)try{await writeAtomic(directory,'result.json',result)}catch{}
  process.stdout.write(JSON.stringify(result)+'\n');process.exitCode=1
}
