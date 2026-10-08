import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createEmailFixture, emailFixtureRuntime } from './helpers/emailFixture.mjs'
import { createEmailService, processEmailQueue,previewManualEmail } from '../server/utils/email/service.js'
import { emailRpc } from '../server/utils/email/core.js'
import { normalizeBrevoEvent } from '../server/utils/email/events.js'
import { brevoProvider } from '../server/utils/email/brevo.js'
import { encryptCredentialSecret,decryptCredentialSecret } from '../server/utils/credentialSecrets.js'

test('AES-GCM uses fresh nonces and rejects tampering, wrong keys and malformed envelopes',()=>{
 globalThis.useRuntimeConfig=()=>emailFixtureRuntime
 const first=encryptCredentialSecret('fixture-private-value','Email'),second=encryptCredentialSecret('fixture-private-value','Email')
 assert.notEqual(first,second);assert.equal(decryptCredentialSecret(first,'Email'),'fixture-private-value')
 const parts=first.split('.');const bytes=Buffer.from(parts[3],'base64');bytes[0]^=1;parts[3]=bytes.toString('base64')
 assert.throws(()=>decryptCredentialSecret(parts.join('.'),'Email'));assert.throws(()=>decryptCredentialSecret('v1.invalid','Email'))
 const original=emailFixtureRuntime.credentialsEncryptionKey;emailFixtureRuntime.credentialsEncryptionKey='different-fixture-master-more-than-32-characters'
 try{assert.throws(()=>decryptCredentialSecret(first,'Email'))}finally{emailFixtureRuntime.credentialsEncryptionKey=original}
})

test('unknown callback names and malformed provider codes are safely classified', async () => {
 for (const event of ['__proto__','constructor','toString',{},null]) assert.equal(normalizeBrevoEvent({event}),null)
 const m={sender:'store@email.example.invalid',sender_name:'Fixture',recipient:'buyer@email.example.invalid',subject:'Essential',classification:'transactional',html_body:'<p>Fixture</p>',body_format:'html',correlation:'elc-'+'a'.repeat(64)}
 for(const code of [{toString:0},[],null]){
  const result=await brevoProvider.submit({config:{timeout_ms:1000}},'fixture-key',m,async()=>{},async()=>({status:400,body:JSON.stringify({code})}))
  assert.deepEqual(result,{state:'failed',error_category:'invalid_request',http_status:400})
 }
})

test('Brevo 429 honors its documented reset window and does not truncate long waits',async()=>{
 const m={sender:'store@email.example.invalid',sender_name:'Fixture',recipient:'buyer@email.example.invalid',subject:'Essential',classification:'transactional',html_body:'<p>Fixture</p>',body_format:'html',correlation:'elc-'+'a'.repeat(64)}
 for(const [headers,seconds]of [[{rateReset:'120'},120],[{rateReset:'120',retryAfter:'45'},120],[{rateReset:'45',retryAfter:'120'},120],[{rateReset:'900'},900],[{rateReset:'nonsense',retryAfter:'-1'},30]]){
  const result=await brevoProvider.submit({config:{timeout_ms:1000}},'fixture-key',m,async()=>{},async()=>({status:429,body:'',...headers}))
  assert.equal(result.retry_seconds,seconds)
 }
})

test('SQL authorization fields fail closed; throttle retries cannot exceed the attempt ledger', async t => {
 const f=await createEmailFixture(),service=createEmailService(f.client)
 try{
  await f.activate();await f.saveTemplate(f.template())
  await t.test('missing revisions, fingerprints and classifications cannot authorize stale writes',async()=>{
   const settings=await f.settings()
   await assert.rejects(()=>emailRpc(f.client,'settings',{config:settings.config},f.actors.owner))
   await assert.rejects(()=>emailRpc(f.client,'template',{...f.template(),version:null},f.actors.owner))
   await assert.rejects(()=>emailRpc(f.client,'template',{...f.template(),version:1,classification:null},f.actors.owner))
   const queued=await service.sendTransactional(f.input()),m=await f.message(queued.id)
   await assert.rejects(()=>emailRpc(f.client,'enqueue',{idempotency_key:m.idempotency_key}))
   await assert.rejects(()=>emailRpc(f.client,'enqueue',{...m,idempotency_key:randomUUID(),id:randomUUID(),config_revision:null}))
  })
  await t.test('missing or wrong lease cannot dispatch or finish processing work',async()=>{
   await service.sendTransactional(f.input())
   await f.unthrottle();const m=await emailRpc(f.client,'claim')
   for(const work_token of [undefined,null,randomUUID()]){
    assert.equal((await emailRpc(f.client,'dispatch',{id:m.id,work_token})).allowed,false)
    assert.equal((await emailRpc(f.client,'finish',{id:m.id,work_token,state:'failed'})).matched,false)
    assert.equal((await f.message(m.id)).state,'processing')
   }
   assert.equal((await emailRpc(f.client,'dispatch',{id:m.id,work_token:m.work_token})).allowed,true)
   await emailRpc(f.client,'finish',{id:m.id,work_token:m.work_token,state:'failed'})
   await f.configure({})
  })
  await t.test('dispatch throttling also consumes a bounded attempt',async()=>{
   const queued=await service.sendTransactional(f.input())
   for(let i=0;i<3;i++){
    await f.unthrottle();const m=await emailRpc(f.client,'claim')
    assert.equal(m.id,queued.id)
    await f.fixtureWrite("update public.email_provider_settings set next_dispatch_at=clock_timestamp()+interval '1 second'")
    const result=await emailRpc(f.client,'dispatch',{id:m.id,work_token:m.work_token})
    assert.equal(result.state,i===2?'failed':'queued')
    await f.fixtureWrite('update public.email_messages set next_attempt_at=clock_timestamp() where id=$1',[m.id])
   }
   await f.unthrottle();assert.equal(await emailRpc(f.client,'claim'),null)
   assert.equal((await f.message(queued.id)).attempts,3)
  })
  await t.test('worker authorization is rechecked after preflight and before the next claim',async()=>{
   const queued=await service.sendTransactional(f.input());await f.unthrottle()
   const original=emailFixtureRuntime.emailWorkerSecret;let submitted=0
   const authorize=()=>{if(emailFixtureRuntime.emailWorkerSecret!==original)throw Error('revoked')}
   const provider={submit:async(_s,_key,_m,before)=>{emailFixtureRuntime.emailWorkerSecret='rotated-fixture-worker-over-32-characters';await before();submitted++;return {state:'accepted',provider_message_id:'fixture@relay.example.invalid'}}}
   try{
    await processEmailQueue(f.client,{provider,authorize})
    assert.equal(submitted,0);assert.equal((await f.message(queued.id)).state,'suppressed')
    assert.equal((await f.message(queued.id)).error_category,'worker_authorization')
    await assert.rejects(()=>processEmailQueue(f.client,{provider,authorize}))
   }finally{emailFixtureRuntime.emailWorkerSecret=original}
  })
  await t.test('manual sends remain single-recipient and enforce the staff quota',async()=>{
   for(let i=0;i<10;i++){
    const input=f.input({recipient:'manual'+i+'@email.example.invalid'}),preview=await previewManualEmail(f.client,input,f.actors.owner)
    assert.equal((await service.sendTransactional({...input,receipt:preview.receipt,confirmed:true,essential_confirmed:true},{actor:f.actors.owner})).state,'queued')
   }
   const input=f.input(),preview=await previewManualEmail(f.client,input,f.actors.owner)
   await assert.rejects(()=>service.sendTransactional({...input,receipt:preview.receipt,confirmed:true,essential_confirmed:true},{actor:f.actors.owner}),e=>e.statusCode===429)
   await assert.rejects(()=>previewManualEmail(f.client,{...input,recipient:['one@email.example.invalid','two@email.example.invalid']},f.actors.owner))
   assert.equal((await f.db.query('select count(*)::int n from public.email_messages where actor_id=$1',[f.actors.owner])).rows[0].n,10)
  })
 }finally{await f.db.close()}
})
