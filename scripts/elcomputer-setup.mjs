#!/usr/bin/env node
import { prepareGuided, runGuided } from './guided/workflow.mjs'
import { safeEnvironment, ensure, InstallationError } from './install/contracts.mjs'
import { cleanEnvironment, PublicationError } from './publish/contracts.mjs'

let command='unknown'
try{
  const[operation,...args]=process.argv.slice(2);command=operation
  ensure(['plan','check','apply','resume','verify'].includes(command))
  const options={},allowed=command==='plan'?['--manifest','--out']:['--workspace',...(['apply','resume'].includes(command)?['--confirm-database','--confirm-publication']:[])]
  for(let i=0;i<args.length;i++){const key=args[i],value=args[++i];ensure(allowed.includes(key)&&!Object.hasOwn(options,key)&&typeof value==='string'&&!value.startsWith('--'));options[key]=value}
  ensure(command==='plan'?options['--manifest']&&options['--out']:options['--workspace'])
  safeEnvironment();cleanEnvironment()
  const result=command==='plan'?await prepareGuided({manifestFile:options['--manifest'],directory:options['--out']}):await runGuided({command,directory:options['--workspace'],confirmDatabase:options['--confirm-database'],confirmPublication:options['--confirm-publication']})
  process.stdout.write(JSON.stringify(result)+'\n')
}catch(error){
  const safe=error instanceof InstallationError||error instanceof PublicationError?error:new InstallationError(error?.code)
  process.stdout.write(JSON.stringify({ok:false,command,code:safe.code,message:safe.message})+'\n');process.exitCode=1
}
