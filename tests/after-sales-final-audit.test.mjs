import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createReverseFixture, reverseFixtureRuntime } from './helpers/reverseFixture.mjs'
import { processPdcReverseQueue } from '../server/utils/pdcReverseLogistics.js'

test('canonical customer RPC rejects null actions without changing terminal claims', async () => {
 const f=await createReverseFixture()
 try {
  const c=await f.approve()
  for(const action of ['receive','inspect'])await f.action(c.id,action)
  await f.action(c.id,'select_resolution',{resolution:'refund',text:'Recorded decision only.'})
  await f.action(c.id,'resolve')
  const before=await f.detail(c.id,true)
  await assert.rejects(()=>f.rpc('after_sales_claim_customer_action',{p_customer:f.customer,p_claim:c.id,p_revision:before.claim.revision,p_action:null,p_input:{text:'Invalid null action.'}}),e=>e.code==='22023')
  assert.deepEqual(await f.detail(c.id,true),before)
 } finally {await f.db.close()}
})

test('canonical reverse events reject absent identity and source before receiving an item',async()=>{
 const f=await createReverseFixture()
 try {
  const c=await f.approve();await f.configure();await f.schedule(c.id)
  const work=(await f.take())[0];await f.finish(work);const job=await f.job(work.id)
  for(const awb of [null,undefined,'WRONG']) {
   const result=await f.record(f.event(job,5,{awb}))
   assert.equal(result.error,'awb_mismatch')
   assert.equal((await f.detail(c.id)).claim.status,'pickup_scheduled')
  }
  await assert.rejects(()=>f.record(f.event(job,5,{source:null})),/Invalid courier event/)
  assert.equal((await f.view(c.id)).events.length,0)
 }finally{await f.db.close()}
})

test('reverse transport cannot use settings read before a newer booking snapshot',async()=>{
 const f=await createReverseFixture();let calls=0,changed=false
 try {
  const c=await f.approve();await f.configure()
  const client={...f.client,rpc:async(name,args)=>{
   if(name==='shipping_claim_take'&&!changed){changed=true;await f.db.exec("update public.shipping_provider_settings set company_id='654321' where id='pdc'");await f.schedule(c.id)}
   return f.client.rpc(name,args)
  }}
  await processPdcReverseQueue({supabaseAdmin:client,runtime:reverseFixtureRuntime,fetcher:async(_url,options)=>{
   calls++;const ref=JSON.parse(options.body).shipments[0].toRef
   return new Response(JSON.stringify({generalResponse:{success:true},successResponses:[{success:true,ref,awb:'AUDIT-STALE-CONFIG'}]}),{headers:{'content-type':'application/json'}})
  }})
  assert.equal(calls,0)
  assert.equal((await f.detail(c.id)).claim.status,'approved')
  assert.equal((await f.view(c.id,true)).jobs[0].state,'failed')
 }finally{await f.db.close()}
})

test('revoked label requester cannot cause a later provider request',async()=>{
 const f=await createReverseFixture();let calls=0
 try {
  const c=await f.approve();await f.configure();await f.schedule(c.id)
  const work=(await f.take())[0];await f.finish(work)
  await f.rpc('shipping_claim_operation',{p_admin:f.owner,p_claim:c.id,p_job:work.id,p_action:'label',p_ready:true})
  await f.db.query('update public.admin_users set is_active=false where id=$1',[f.owner])
  await processPdcReverseQueue({supabaseAdmin:f.client,runtime:reverseFixtureRuntime,fetcher:async()=>{calls++;return new Response('%PDF-1.7 fixture',{headers:{'content-type':'application/pdf'}})}})
  assert.equal(calls,0);assert.equal((await f.job(work.id)).label_state,'failed')
 }finally{await f.db.close()}
})

test('reverse worker authorization loss before dispatch cannot reach a provider',async()=>{
 const f=await createReverseFixture();let calls=0,checks=0
 try {
  const c=await f.approve();await f.configure();await f.schedule(c.id)
  await assert.rejects(()=>processPdcReverseQueue({supabaseAdmin:f.client,runtime:reverseFixtureRuntime,authorize:()=>{if(++checks>1)throw Object.assign(Error('Worker revoked.'),{statusCode:401})},fetcher:async()=>{calls++;throw Error('Should not reach transport.')}}),e=>e.statusCode===401)
  assert.equal(calls,0);assert.equal((await f.detail(c.id)).claim.status,'approved')
 }finally{await f.db.close()}
})

test('integrated admission retains purchased duration, scoped policy and reason after all merchant edits and catalog deletion',async()=>{
 const f=await createReverseFixture()
 try{
  await f.enable();const item=await f.purchase(2),policy=(await f.db.query('select * from public.after_sales_policy_versions where id=$1',[item.after_sales_policy_version_id])).rows[0]
  const category=randomUUID();await f.db.query("insert into public.categories(id,name,slug) values($1,'Audit fixture category',($1::uuid)::text)",[category])
  await f.db.query("update public.products set category_id=$1,warranty_duration_value=24 where id=$2",[category,f.product])
  await f.save({warranty_enabled:false},'warranty');await f.save({return_window_days:1,return_enabled:false},'returns')
  for(const scope of ['category:'+category,'product:'+f.product])await f.rpc('after_sales_save_policy',{p_admin_id:f.owner,p_scope_key:scope,p_section:'overrides',p_revision:0,p_values:{return_enabled:false,warranty_enabled:false}})
  const {updated_at,...reason}=(await f.db.query("select * from public.after_sales_return_reasons where key='changed_mind'")).rows[0]
  await f.rpc('after_sales_save_reason',{p_admin_id:f.owner,p_reason:{...reason,is_enabled:false,label_en:'Changed current reason',label_ar:'سبب جديد'}})
  await f.db.query('delete from public.products where id=$1',[f.product])
  const claims=[await f.create(f.body(item)),await f.create(f.body(item,'warranty'))]
  for(const c of claims){const detail=await f.detail(c.id,true);assert.equal(detail.claim.policy_version_id,item.after_sales_policy_version_id);assert.equal(detail.item.warranty_duration_value,12);assert.equal(detail.claim.admission,'eligible')}
  assert.equal((await f.detail(claims[0].id)).return_reason.label_en,reason.label_en)
  assert.deepEqual((await f.db.query('select * from public.after_sales_policy_versions where id=$1',[policy.id])).rows[0],policy)
 }finally{await f.db.close()}
})
