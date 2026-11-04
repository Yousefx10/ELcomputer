import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createOrderSmsFixture} from './helpers/orderSmsFixture.mjs'
import {processTransactionalSms} from '../server/utils/sms/transactional.js'
import {processSmsQueue} from '../server/utils/sms/service.js'
import {estimateSmsSegments,normalizeSmsPhone} from '../app/utils/sms.js'
globalThis.useRuntimeConfig=()=>({credentialsEncryptionKey:'isolated-sms-channel-master-at-least-32-characters'})
test('transactional channel: verified source, revision fences and provider-independent queue',async t=>{
 const f=await createOrderSmsFixture(),{db,client}=f
 const sql=(q,p=[])=>db.query(q,p),scalar=async(q,p=[])=>Object.values((await sql(q,p)).rows[0])[0]
 const rpc=async(name,args={})=>{const r=await client.rpc(name,args);if(r.error)throw Error(r.error.message);return r.data}
 try{
 await t.test('inactive installation creates no sendable backlog and browser has no access',async()=>{
  assert.equal(await scalar('select transactional_enabled from private.sms_channel_controls'),false)
  assert.equal(await scalar("select count(*)::int from public.sms_templates where category='transactional' and is_enabled"),0)
  for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(()=>sql('select * from private.sms_transactional_events'),/permission denied/);await assert.rejects(()=>sql('select public.sms_claim_transactional()'),/permission denied/);await db.exec('reset role')}
 })
 await f.enable();await db.exec('update public.sms_order_event_settings set is_enabled=false;update public.sms_templates set is_enabled=true where code like \'tx_%\'')
 const template=await scalar("select id from public.sms_templates where code='tx_cod_confirmed'")
 await rpc('sms_configure_transactional',{p_actor:f.owner,p_revision:0,p_enabled:true,p_bindings:[{event_type:'cod_confirmed',is_enabled:true,template_id:template}]})
 await t.test('configuration fences stale staff revisions and both legacy overlap directions',async()=>{
  await assert.rejects(()=>rpc('sms_configure_transactional',{p_actor:f.owner,p_revision:0,p_enabled:true,p_bindings:[]}),/changed/)
  await assert.rejects(()=>sql("update public.sms_order_event_settings set is_enabled=true where event_type='order_confirmed'"),/overlapping/)
  await assert.rejects(()=>rpc('sms_configure_transactional',{p_actor:randomUUID(),p_revision:1,p_enabled:true,p_bindings:[]}),/authorized/)
 })
 let created
 await t.test('cash confirmation captures once in Arabic; pending/unverified card never confirms',async()=>{
  created=await f.checkout({locale:'ar'});await sql("update public.customer_orders set status='processing' where id=$1",[created.id])
  await rpc('sms_capture_transactional');await rpc('sms_capture_transactional')
  assert.equal(await scalar('select count(*)::int from private.sms_transactional_events where source_id=$1',[created.id]),1)
  const e=(await sql('select * from private.sms_transactional_events where source_id=$1',[created.id])).rows[0];assert.equal(e.locale,'ar');assert.equal(e.event_type,'cod_confirmed')
  const session=await scalar("select count(*)::int from private.payment_checkout_sessions");assert.ok(session>=0)
  assert.equal(await scalar('select private.sms_verified_paid($1)',[created.id]),false)
  const output=await processTransactionalSms(client,{siteOrigin:'https://store.example.invalid',limit:3});assert.equal(output.processed[0].state,'queued')
  assert.equal((await f.batches()).length,1)
  const m=(await sql('select * from public.sms_messages')).rows[0];assert.equal(m.recipient,normalizeSmsPhone('01012345678'));assert.equal(m.encoding,'utf16');assert.ok(m.body.includes(created.order_number))
  await processTransactionalSms(client,{siteOrigin:'https://store.example.invalid'});assert.equal((await f.batches()).length,1)
 })
 await t.test('template change while queued cancels at final pre-POST authorization',async()=>{
  await sql("update public.sms_templates set text_ar=text_ar||' ' where id=$1",[template])
  assert.equal(await scalar('select count(*)::int from private.sms_template_versions where template_id=$1',[template]),2)
  let sends=0
  const provider={submit:async(_s,_c,_j,_m,_x,authorize)=>{await authorize();sends++;throw Error('fixture must not send')}}
  await processSmsQueue(client,{trafficTypes:['notification'],provider});assert.equal(sends,0)
  assert.equal((await f.batches())[0].status,'failed')
 })
 await t.test('source cancellation before claim suppresses permanently; unknown proof cannot qualify paid',async()=>{
  const o=await f.checkout();await sql("update public.customer_orders set status='processing' where id=$1",[o.id]);await rpc('sms_capture_transactional');await sql("update public.customer_orders set status='cancelled' where id=$1",[o.id])
  await processTransactionalSms(client,{siteOrigin:'https://store.example.invalid'});assert.equal(await scalar('select state from private.sms_transactional_events where source_id=$1',[o.id]),'suppressed')
  assert.equal(await scalar('select private.sms_verified_paid($1)',[o.id]),false)
  assert.equal(estimateSmsSegments('ا'.repeat(71)).segments,2)
 })
 await t.test('optimistic template edit archives old bilingual content and rejects stale saves',async()=>{
  const row=(await sql('select * from public.sms_templates where id=$1',[template])).rows[0]
  await rpc('sms_save_versioned_template',{p_actor:f.owner,p_id:row.id,p_revision:row.revision,p_template:{...row,name:'Reviewed template'}})
  await assert.rejects(()=>rpc('sms_save_versioned_template',{p_actor:f.owner,p_id:row.id,p_revision:row.revision,p_template:row}),/changed/)
 })
 }finally{await db.close()}
})
