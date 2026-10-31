import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {mkdtemp,rm,mkdir,readdir,readFile,realpath} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {saveShippingDocument,readShippingDocument} from '../server/utils/privateShippingDocuments.js'
import {shippingLabelFixture} from './helpers/shippingLabelFixture.mjs'
import {validateShippingLabelPdf} from '../server/utils/shippingLabelPdf.js'
test('publication validates new bytes and any already-published orphan before returning evidence',async()=>{
 const dir=await mkdtemp(join(await realpath(tmpdir()),'label-owned-')),previous=globalThis.useRuntimeConfig,root=dir+'/private'
 globalThis.useRuntimeConfig=()=>({shippingDocumentsDir:root,uploadsDir:dir+'/public'})
 const key=`vps-v1/orders/${randomUUID()}/${randomUUID()}.pdf`,identity={awb:'FIXTURE-AWB-123',reference:'FIXTURE-REF-456'},good=shippingLabelFixture(),wrong=shippingLabelFixture({awb:'OTHER'})
 try{
  const verify=bytes=>validateShippingLabelPdf(bytes,identity)
  await assert.rejects(saveShippingDocument(key,wrong,{verify}))
  const original=await saveShippingDocument(key,wrong)
  await assert.rejects(saveShippingDocument(key,good,{verify}))
  assert.deepEqual(await readShippingDocument(original),wrong)
 }finally{globalThis.useRuntimeConfig=previous;await rm(dir,{recursive:true,force:true})}
})
test('duplicate successful publications reuse one file and one exact evidence digest',async()=>{
 const dir=await mkdtemp(join(await realpath(tmpdir()),'label-owned-')),previous=globalThis.useRuntimeConfig
 globalThis.useRuntimeConfig=()=>({shippingDocumentsDir:dir+'/private',uploadsDir:dir+'/public'})
 const key=`vps-v1/orders/${randomUUID()}/${randomUUID()}.pdf`,bytes=shippingLabelFixture(),verify=data=>validateShippingLabelPdf(data,{awb:'FIXTURE-AWB-123',reference:'FIXTURE-REF-456'})
 try{const a=await saveShippingDocument(key,bytes,{verify}),b=await saveShippingDocument(key,bytes,{verify});assert.deepEqual(a,b);assert.deepEqual(await readShippingDocument(a),bytes);assert.deepEqual(await readdir(join(dir,'private',key.split('/').slice(0,-1).join('/'))),[key.split('/').at(-1)])}finally{globalThis.useRuntimeConfig=previous;await rm(dir,{recursive:true,force:true})}
})
