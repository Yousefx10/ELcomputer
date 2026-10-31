import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {mkdtemp,realpath,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {processPdcOrderJob} from '../server/utils/pdcOrderShipping.js'
import {encryptShippingSecret} from '../server/utils/shippingSecrets.js'
test('label-only processing rejects any booking task or changed identity before provider access',async()=>{
 const dir=await mkdtemp(join(await realpath(tmpdir()),'pdc-label-only-')),prior=globalThis.useRuntimeConfig,jobId=randomUUID(),config={shippingLiveRequestsEnabled:true,shippingDocumentsDir:join(dir,'private'),uploadsDir:join(dir,'public'),shippingCredentialsEncryptionKey:'owned-worker-fixture-key-over32characters'}
 globalThis.useRuntimeConfig=()=>config
 try{
  const settings={is_enabled:true,api_mode:'production',base_url:'https://clientsapi.pdc-eg.com/api/ClientUsers/V6/',company_id:'123',access_token_encrypted:encryptShippingSecret('owned-token'),webhook_secret_encrypted:encryptShippingSecret('owned-independent-secret-over-32-characters')}
  for(const job of [{id:jobId,task:'book',awb:null},{id:randomUUID(),task:'label',awb:'FIXTURE-AWB-123',to_ref:'FIXTURE-REF-456'},{id:jobId,task:'label',awb:'OTHER',to_ref:'FIXTURE-REF-456'},{id:jobId,task:'label',awb:'FIXTURE-AWB-123',to_ref:'OTHER'}]){
   let requests=0;const db={rpc:async(name)=>{assert.equal(name,'shipping_order_take');return {data:job}}}
   await assert.rejects(processPdcOrderJob({supabaseAdmin:db,settings,jobId,labelOnly:true,expectedIdentity:{awb:'FIXTURE-AWB-123',reference:'FIXTURE-REF-456'},runtime:config,fetcher:async()=>{requests++;throw Error('Provider forbidden')}}),e=>e.statusCode===409)
   assert.equal(requests,0)
  }
 }finally{globalThis.useRuntimeConfig=prior;await rm(dir,{recursive:true,force:true})}
})
