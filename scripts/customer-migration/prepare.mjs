// Offline only. Authenticates encrypted inputs; writes a private review, never imports.
import {readFile,writeFile,lstat} from 'node:fs/promises'
import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {resolve} from 'node:path'
import {planCustomerMigration,compareSnapshots} from './plan.mjs'

const digest=bytes=>createHash('sha256').update(bytes).digest('hex')
const args=process.argv.slice(2),options={}
for(let i=0;i<args.length;i+=2){if(!['--source','--comparison','--target-snapshot','--key-file','--envelope','--review','--out','--source-key'].includes(args[i])||!args[i+1]||options[args[i]])throw Error('Invalid preparation arguments');options[args[i]]=args[i+1]}
try {
 for(const k of ['--source','--target-snapshot','--key-file','--out','--source-key'])if(!options[k])throw Error('Missing preparation input')
 const envelope=resolve(options['--envelope']||'docs/operations/backup-envelope.mjs'),key=resolve(options['--key-file'])
 const open=async file=>{
  const stat=await lstat(file);if(!stat.isFile()||stat.isSymbolicLink())throw Error('Unsafe private input')
  const result=spawnSync(process.execPath,[envelope,'decrypt',key,resolve(file)],{maxBuffer:128*1024*1024,timeout:120000})
  if(result.status!==0)throw Error('Encrypted input authentication failed')
  return JSON.parse(result.stdout)
 }
 const source=await open(options['--source']),target=await open(options['--target-snapshot'])
 const review=options['--review']?JSON.parse(await readFile(options['--review'],'utf8')):{}
 const result=planCustomerMigration(source,target,review)
 if(options['--comparison'])result.comparison=compareSnapshots(source,await open(options['--comparison']))
 const raw=Buffer.from(JSON.stringify(result)),out=resolve(options['--out'])
 const enc=spawnSync(process.execPath,[envelope,'encrypt',key,out+'.json.enc'],{input:raw,maxBuffer:1000000,timeout:120000})
 if(enc.status!==0)throw Error('Private review encryption failed')
 await writeFile(out+'.json.enc.receipt.json',enc.stdout,{flag:'wx',mode:0o600})
 const manifest={format:1,status:result.status,created_utc:new Date().toISOString(),source_key:options['--source-key'],source_sha256:source.encrypted_sha256,target_project_ref:target.project_ref,target_observed_utc:target.observed_utc,review_sha256:digest(Buffer.from(JSON.stringify(review))),payload_sha256:result.payload_sha256,private_review_sha256:JSON.parse(enc.stdout).encryptedSha256,summary:result.summary,comparison:result.comparison||null,auth_transition:'ordinary_verified_signup_or_existing_account_recovery; no legacy password import',profile_updates:0,production_writes:0,provider_calls:0}
 await writeFile(out+'.manifest.private.json',JSON.stringify(manifest,null,2)+'\n',{flag:'wx',mode:0o600})
 console.log(JSON.stringify({status:result.status,summary:result.summary,comparison:result.comparison||null,profile_updates:0,production_writes:0,provider_calls:0}))
}catch{console.error('Customer migration preparation stopped. Preserve private evidence; no import ran.');process.exitCode=1}
