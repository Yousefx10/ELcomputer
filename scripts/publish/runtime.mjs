import { randomBytes, randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
import { resolve, dirname } from 'node:path'
import { mkdir, writeFile, chmod, realpath } from 'node:fs/promises'
import { readProtected, createWorkspace, writeAtomic } from '../install/files.mjs'
import { validateCredentials, sourceRoot } from '../install/contracts.mjs'
import { object, ensure, fail, canonical } from './contracts.mjs'

export const emptyWorkers={NUXT_SMS_WORKER_SECRET:'',NUXT_EMAIL_WORKER_SECRET:'',NUXT_SHIPPING_WORKER_SECRET:'',NUXT_ERP_WORKER_SECRET:'',NUXT_DAFTRA_ACCOUNT_URL:'',NUXT_DAFTRA_API_KEY:'',NUXT_DAFTRA_CLIENT_ID:'',NUXT_PAYMOB_SECRET_KEY:'',NUXT_PAYMOB_PUBLIC_KEY:'',NUXT_PAYMOB_HMAC_SECRET:'',NUXT_PAYMOB_CARD_INTEGRATION_ID:'',NUXT_PAYMOB_INTEGRATION_IDS:'{}',NUXT_SHIPPING_LIVE_REQUESTS_ENABLED:'false',NUXT_PAYMOB_ENABLED:'false',NUXT_PAYMOB_MODE:'test',NUXT_PAYMOB_CARD_INTEGRATION_MODE:'test'}
export async function prepareRuntime({target,installation,credentials,directory,keyRecordDirectory}){
  ensure(directory!==keyRecordDirectory&&canonical(directory)&&canonical(keyRecordDirectory),'unsafe_file')
  ensure([directory,keyRecordDirectory].every(path=>path!==resolve(sourceRoot)&&!path.startsWith(resolve(sourceRoot)+'/')),'unsafe_file')
  await createWorkspace(directory);await createWorkspace(keyRecordDirectory)
  validateCredentials(credentials,installation.plan.target)
  const runtime_id=randomUUID(),credentialsKey=randomBytes(32).toString('hex'),shippingKey=randomBytes(32).toString('hex')
  const keys={format:1,runtime_id,publication_id:target.publication_id,installation_id:target.installation_id,project_ref:target.project_ref,credentials_key:credentialsKey,shipping_key:shippingKey}
  await writeAtomic(keyRecordDirectory,'encryption-keys.json',keys,{exclusive:true})
  const env={NODE_ENV:'production',NITRO_HOST:'127.0.0.1',NITRO_PORT:String(target.site.port),NUXT_PUBLIC_SUPABASE_URL:installation.plan.target.api_url,NUXT_PUBLIC_SUPABASE_KEY:credentials.anon_key,NUXT_PUBLIC_SUPABASE_COOKIE_PREFIX:'sb-'+target.project_ref+'-auth-token',NUXT_SUPABASE_SERVICE_ROLE_KEY:credentials.service_role_key,NUXT_PUBLIC_SITE_URL:target.site_origin,NUXT_UPLOADS_DIR:target.site.uploads_path,NUXT_CREDENTIALS_ENCRYPTION_KEY:credentialsKey,NUXT_SHIPPING_CREDENTIALS_ENCRYPTION_KEY:shippingKey,...emptyWorkers}
  const runtime={format:1,runtime_id,publication_id:target.publication_id,installation_id:target.installation_id,project_ref:target.project_ref,key_record_file:resolve(keyRecordDirectory,'encryption-keys.json'),env}
  await writeAtomic(directory,'runtime.json',runtime,{exclusive:true})
  return{ok:true,command:'runtime',runtime_id,runtime_file:resolve(directory,'runtime.json'),independent_key_record:true}
}
export async function validateRuntime(runtime,target,installation,credentials){
  object(runtime,['format','runtime_id','publication_id','installation_id','project_ref','key_record_file','env'])
  ensure(runtime.format===1&&runtime.publication_id===target.publication_id&&runtime.installation_id===target.installation_id&&runtime.project_ref===target.project_ref,'runtime_changed')
  const expected=['NODE_ENV','NITRO_HOST','NITRO_PORT','NUXT_PUBLIC_SUPABASE_URL','NUXT_PUBLIC_SUPABASE_KEY','NUXT_PUBLIC_SUPABASE_COOKIE_PREFIX','NUXT_SUPABASE_SERVICE_ROLE_KEY','NUXT_PUBLIC_SITE_URL','NUXT_UPLOADS_DIR','NUXT_CREDENTIALS_ENCRYPTION_KEY','NUXT_SHIPPING_CREDENTIALS_ENCRYPTION_KEY',...Object.keys(emptyWorkers)]
  object(runtime.env,expected);ensure(Object.values(runtime.env).every(value=>typeof value==='string'&&!/[\0\r\n]/.test(value)),'runtime_changed')
  for(const[key,value]of Object.entries({NODE_ENV:'production',NITRO_HOST:'127.0.0.1',NITRO_PORT:String(target.site.port),NUXT_PUBLIC_SUPABASE_URL:installation.plan.target.api_url,NUXT_PUBLIC_SUPABASE_KEY:credentials.anon_key,NUXT_PUBLIC_SUPABASE_COOKIE_PREFIX:'sb-'+target.project_ref+'-auth-token',NUXT_SUPABASE_SERVICE_ROLE_KEY:credentials.service_role_key,NUXT_PUBLIC_SITE_URL:target.site_origin,NUXT_UPLOADS_DIR:target.site.uploads_path,...emptyWorkers}))ensure(runtime.env[key]===value,'runtime_changed')
  const a=runtime.env.NUXT_CREDENTIALS_ENCRYPTION_KEY,b=runtime.env.NUXT_SHIPPING_CREDENTIALS_ENCRYPTION_KEY
  ensure(/^[a-f0-9]{64}$/.test(a)&&/^[a-f0-9]{64}$/.test(b)&&a!==b,'runtime_changed')
  const keys=await readProtected(runtime.key_record_file)
  try{assert.deepEqual(keys,{format:1,runtime_id:runtime.runtime_id,publication_id:target.publication_id,installation_id:target.installation_id,project_ref:target.project_ref,credentials_key:a,shipping_key:b})}catch{fail('runtime_changed')}
  return runtime
}
