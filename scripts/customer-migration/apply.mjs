// An import operator, not a deployment operator. No Auth creation or provider code.
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {spawnSync} from 'node:child_process'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {connect} from '../commerce-release/database.mjs'
import {historyBatches,historyUuid,historyDigest,authorizeHistoryImport} from './batches.mjs'

const mode=process.argv[2],args=process.argv.slice(3),options={}
try{
 if(!['check','apply','resume'].includes(mode))throw Error('Invalid import mode')
 for(let i=0;i<args.length;i+=2){if(!['--review','--manifest','--target','--key-file','--approval','--state'].includes(args[i])||!args[i+1]||options[args[i]])throw Error('Invalid import option');options[args[i]]=args[i+1]}
 for(const key of ['--review','--manifest','--target','--key-file','--state'])if(!options[key])throw Error('Missing import input')
 const manifest=JSON.parse(await readFile(options['--manifest'],'utf8'))
 if(mode!=='check')authorizeHistoryImport(JSON.parse(await readFile(options['--approval'],'utf8')),manifest)
 const opened=spawnSync(process.execPath,['docs/operations/backup-envelope.mjs','decrypt',options['--key-file'],options['--review']],{maxBuffer:128*1024*1024,timeout:120000})
 if(opened.status!==0)throw Error('Private review authentication failed')
 const prepared=JSON.parse(opened.stdout),batches=historyBatches(prepared)
 const receipt=JSON.parse(await readFile(options['--review']+'.receipt.json','utf8'))
 if(receipt.encryptedSha256!==manifest.private_review_sha256||createHash('sha256').update(await readFile(options['--review'])).digest('hex')!==manifest.private_review_sha256||prepared.payload_sha256!==manifest.payload_sha256||prepared.payload.source_sha256!==manifest.source_sha256)throw Error('Historical review changed')
 const target=JSON.parse(await readFile(options['--target'],'utf8'))
 if(target.project_ref!==manifest.target_project_ref)throw Error('Wrong import target')
 const state=resolve(options['--state']),binding=historyDigest({manifest,batches:batches.map(b=>b.id)}),sourceId=historyUuid([manifest.source_key,manifest.source_sha256])
 const db=await connect(target,{readOnly:mode==='check'})
 try{
  const present=(await db.query(`select exists(select 1 from supabase_migrations.schema_migrations where version='20261025120000') installed`)).rows[0].installed
  if(!present)throw Error('Historical schema release must be deployed first')
  if(mode==='check'){console.log(JSON.stringify({result:'IMPORT_CHECK_PASS',batches:batches.length,auth_users_created:0,production_writes:0}));process.exitCode=0}
  else{
   if(mode==='apply'){await mkdir(state,{mode:0o700});await writeFile(state+'/intent.json',JSON.stringify({binding,source_id:sourceId,created_utc:new Date().toISOString()}),{flag:'wx',mode:0o600})}
   else{const prior=JSON.parse(await readFile(state+'/intent.json','utf8'));if(prior.binding!==binding)throw Error('Import resumption binding changed')}
   for(let index=0;index<batches.length;index++){
    const batch=batches[index],record=await db.query('select public.customer_history_import_batch($1,$2,$3,$4,$5) receipt',[sourceId,manifest.source_key,manifest.source_sha256,batch.id,batch.payload])
    const file=state+'/batch-'+index+'.json'
    try{await writeFile(file,JSON.stringify(record.rows[0].receipt)+'\n',{flag:'wx',mode:0o600})}catch(error){if(error.code!=='EEXIST'||JSON.stringify(JSON.parse(await readFile(file,'utf8')))!==JSON.stringify(record.rows[0].receipt))throw Error('Preserved receipt requires review')}
   }
   await writeFile(state+'/completed.json',JSON.stringify({binding,completed_utc:new Date().toISOString(),batches:batches.length,auth_users_created:0,profile_updates:0,commerce_writes:0})+'\n',{flag:'wx',mode:0o600})
   console.log(JSON.stringify({result:'HISTORY_IMPORT_COMPLETE',batches:batches.length,auth_users_created:0,profile_updates:0,commerce_writes:0}))
  }
 }finally{await db.end()}
}catch{console.error('Customer history operator stopped. Preserve state and inspect the original batch receipt; no automatic retry or rollback.');process.exitCode=1}
