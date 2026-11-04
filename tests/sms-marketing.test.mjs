import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createOrderSmsFixture} from './helpers/orderSmsFixture.mjs'
import {createEmailNativeDatabase} from './helpers/emailNativeDatabase.mjs'
import {smsChannelRpc} from '../server/utils/sms/transactional.js'
import {normalizeMarketingContacts,buildMarketingPlan,unsubscribeToken,verifyUnsubscribe,processMarketingSms} from '../server/utils/sms/marketing.js'
import {createSmsService,processSmsQueue} from '../server/utils/sms/service.js'
const runtime={credentialsEncryptionKey:'isolated-marketing-master-at-least-32-characters',smsUnsubscribeSecret:'isolated-unsubscribe-key-at-least-32-characters',smsUnsubscribePreviousSecrets:'[]',public:{siteUrl:'https://merchant.example.invalid'}}
globalThis.useRuntimeConfig=()=>runtime
const contact=(phone,locale='en')=>({phone,locale,tags:['owned'],opt_in:true,consented_at:new Date(Date.now()-10000).toISOString(),consent_reference:'explicit-fixture-consent',source_reference:'owned-fixture-list'})
test('marketing consent, immutable approved plans and final authorization',async t=>{
 const f=await createOrderSmsFixture(process.env.INTEGRATION_NATIVE==='1'?{database:await createEmailNativeDatabase()}:{}),{db,client}=f;const sql=(q,p=[])=>db.query(q,p),scalar=async(q,p=[])=>Object.values((await sql(q,p)).rows[0])[0]
 const rpc=async(n,a={})=>{const r=await client.rpc(n,a);if(r.error)throw Error(r.error.message);return r.data}
 const actorArgs={p_actor:f.owner};let template,campaign,plan
 try{
 await t.test('default-off, least privilege, protected keys and real opt-in are mandatory',async()=>{
  assert.equal(await scalar('select is_enabled from private.sms_marketing_controls'),false)
  assert.equal(await scalar('select unit_cost_minor from private.sms_marketing_controls'),null)
  assert.throws(()=>normalizeMarketingContacts([contact('01012345678'),contact('+201012345678')]),/Invalid/)
  assert.throws(()=>normalizeMarketingContacts([{...contact('01012345678'),opt_in:false}]),/Invalid/)
  assert.equal(verifyUnsubscribe('invented',runtime),null)
  const id=randomUUID(),token=unsubscribeToken(id,runtime);assert.equal(verifyUnsubscribe(token,runtime),id);assert.equal(verifyUnsubscribe(token.slice(0,-1)+'!',runtime),null)
  assert.equal(verifyUnsubscribe(token,{...runtime,smsUnsubscribeSecret:'replacement-unsubscribe-key-at-least-32-characters',smsUnsubscribePreviousSecrets:JSON.stringify([runtime.smsUnsubscribeSecret])}),id)
  const viewer=randomUUID();await sql("insert into auth.users(id,email) values($1,'marketing-viewer@example.invalid')",[viewer]);await sql("insert into public.admin_users(id,email,role,permissions) values($1,'marketing-viewer@example.invalid','admin','{\"sms.marketing.view\":true}')",[viewer])
  await assert.rejects(()=>rpc('sms_marketing_import',{p_actor:viewer,p_contacts:normalizeMarketingContacts([contact('01012345678')])}),/authorized/)
  for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(()=>sql('select * from private.sms_marketing_contacts'),/permission denied/);await assert.rejects(()=>sql("select public.sms_marketing_unsubscribe(null)"),/permission denied/);await db.exec('reset role')}
 })
 await f.enable();await db.exec('update public.sms_order_event_settings set is_enabled=false')
 template=await scalar("insert into public.sms_templates(code,name,category,text_en,text_ar,traffic_type,is_enabled,variables) values('fixture_campaign','Fixture','fixtures','Fixture notice. Stop: {{unsubscribe_url}}','رسالة اختبار. إلغاء: {{unsubscribe_url}}','campaign',true,array['unsubscribe_url']) returning id")
 await t.test('imports normalize numbers, reject implied consent, deduplicate and retain suppression',async()=>{
  const rows=normalizeMarketingContacts([contact('01012345678'),contact('01112345678','ar'),contact('01212345678')])
  assert.deepEqual(await rpc('sms_marketing_import',{...actorArgs,p_contacts:rows}),{added:3,skipped:0})
  await rpc('sms_marketing_suppress',{...actorArgs,p_phone:'+201212345678',p_reason:'withdrawn fixture consent'})
  assert.deepEqual(await rpc('sms_marketing_import',{...actorArgs,p_contacts:rows}),{added:0,skipped:3})
  assert.equal(await scalar('select count(*)::int from private.sms_marketing_suppressions'),1)
 })
 const draft=budget=>({title:'Fixture campaign',template_id:template,locale:'all',tags:['owned'],scheduled_at:new Date(Date.now()-1000).toISOString(),budget_minor:budget,recipient_limit:5})
 const prepare=async c=>{const source=await rpc('sms_campaign_preview_source',{...actorArgs,p_id:c.id});const p=buildMarketingPlan(source,runtime);const result=await rpc('sms_campaign_prepare',{...actorArgs,p_id:c.id,p_revision:c.revision,p_rows:p.rows});return {campaign:result,plan:p}}
 await t.test('unknown pricing and budget/segment overflow block preparation atomically',async()=>{
  const c=await rpc('sms_campaign_save',{...actorArgs,p_id:null,p_revision:0,p_draft:draft(1)})
  await assert.rejects(()=>prepare(c),/pricing/)
  await rpc('sms_marketing_configure',{...actorArgs,p_revision:0,p_settings:{enabled:true,unit_cost_minor:25,commercial_reference:'fixture-contract-max-cost',max_recipients:5,max_segments:5,unicode_accepted:true}})
  await assert.rejects(()=>prepare(c),/budget/)
  assert.equal(await scalar('select count(*)::int from private.sms_campaign_recipients'),0)
  const limited=await rpc('sms_campaign_save',{...actorArgs,p_id:null,p_revision:0,p_draft:{...draft(1000),recipient_limit:1}});await assert.rejects(()=>prepare(limited),/Audience/)
 })
 await t.test('freeze records exact multilingual segments and cost; approval requires exact revision',async()=>{
  const c=await rpc('sms_campaign_save',{...actorArgs,p_id:null,p_revision:0,p_draft:draft(1000)}),r=await prepare(c);campaign=r.campaign;plan=r.plan
  assert.equal(campaign.planned_recipients,2);assert.equal(campaign.reserved_cost_minor,plan.summary.cost_minor);assert.ok(plan.summary.encodings.includes('utf16'))
  assert.ok(!JSON.stringify(plan.summary).includes(runtime.smsUnsubscribeSecret));assert.ok(!plan.summary.preview_en.includes('#'))
  await assert.rejects(()=>rpc('sms_campaign_control',{...actorArgs,p_id:campaign.id,p_revision:campaign.revision,p_action:'approve',p_confirmation:'approve'}),/Review/)
  const confirm=c=>`APPROVE ${c.id} ${c.revision} ${c.planned_recipients} ${c.planned_segments} ${c.reserved_cost_minor} EGP`
  campaign=await rpc('sms_campaign_control',{...actorArgs,p_id:campaign.id,p_revision:campaign.revision,p_action:'approve',p_confirmation:confirm(campaign)})
  await assert.rejects(()=>rpc('sms_campaign_control',{...actorArgs,p_id:campaign.id,p_revision:campaign.revision-1,p_action:'pause',p_confirmation:''}),/changed/)
  await assert.rejects(()=>createSmsService(client).sendCampaign({recipients:['01012345678'],text:'unapproved',idempotencyKey:'raw-campaign',sender:'APP'}),/could not be queued/)
 })
 await t.test('unsubscribe after queueing is rechecked before POST; no ambiguous retry or budget release',async()=>{
  const result=await processMarketingSms(client,{limit:3});assert.equal(result.processed.filter(x=>x.state==='queued').length,2)
  let sends=0
  const provider={submit:async(_s,_c,j,m,_x,authorize)=>{
   const recipient=await scalar('select contact_id from private.sms_campaign_recipients where batch_id=$1',[j.id]);await rpc('sms_marketing_unsubscribe',{p_contact:recipient});await authorize();sends++;throw Error('must not send')
  }}
  for(let i=0;i<2;i++){await db.exec('update public.sms_provider_settings set next_request_at=null');await processSmsQueue(client,{trafficTypes:['campaign'],provider})}
  assert.equal(sends,0);assert.equal(await scalar("select count(*)::int from public.sms_batches where status='failed'"),2)
  assert.equal((await processMarketingSms(client,{limit:3})).processed.length,0)
  assert.equal(await scalar('select reserved_cost_minor from private.sms_campaigns where id=$1',[campaign.id]),campaign.reserved_cost_minor)
 })
 await t.test('pause/cancel remain independent from transactional configuration and preserve audit',async()=>{
  campaign=await rpc('sms_campaign_control',{...actorArgs,p_id:campaign.id,p_revision:campaign.revision,p_action:'pause',p_confirmation:''});assert.equal(campaign.state,'paused')
  campaign=await rpc('sms_campaign_control',{...actorArgs,p_id:campaign.id,p_revision:campaign.revision,p_action:'cancel',p_confirmation:''});assert.equal(campaign.state,'cancelled')
  const report=await rpc('sms_marketing_history',actorArgs);assert.equal(report.delivery,'unverified');assert.ok(report.audit.some(x=>x.action==='approve'));assert.ok(report.audit.some(x=>x.action==='unsubscribe'))
  assert.equal(await scalar('select transactional_enabled from private.sms_channel_controls'),false)
 })
 }finally{await db.close()}
})
