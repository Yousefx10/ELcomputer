import test from 'node:test'
import assert from 'node:assert/strict'
import { createClaimCommunicationsFixture } from './helpers/claimCommunicationsFixture.mjs'
import { claimCommunicationPurposes,claimCommunicationTemplateDraft,validateClaimCommunicationTemplate } from '../app/utils/claimCommunications.js'
import { processClaimCommunications } from '../server/utils/afterSalesCommunications.js'

test('purpose-bound Claim templates reject unrelated channels, variables and missing account links',()=>{
 for(const purpose of claimCommunicationPurposes)for(const channel of ['sms','email']){
  const draft={...claimCommunicationTemplateDraft(purpose,channel),is_enabled:true}
  assert.equal(validateClaimCommunicationTemplate(draft,purpose,channel),draft)
  assert.throws(()=>validateClaimCommunicationTemplate({...draft,category:'marketing'},purpose,channel))
  assert.throws(()=>validateClaimCommunicationTemplate({...draft,[channel==='sms'?'text_en':'body_en']:'Offer {{private_notes}}'},purpose,channel))
  assert.throws(()=>validateClaimCommunicationTemplate({...draft,[channel==='sms'?'traffic_type':'classification']:'campaign'},purpose,channel))
 }
})

test('authoritative Claim milestones connect only through private durable central channel intents',async t=>{
 const f=await createClaimCommunicationsFixture()
 try{
  await f.enable()
  await t.test('all settings default OFF; disabled channels permanently skip and no backfill occurs',async()=>{
   const controls=(await f.db.query('select * from public.after_sales_communication_settings')).rows
   assert.equal(controls.length,7);assert.ok(controls.every(c=>!c.is_enabled&&!c.sms_enabled&&!c.email_enabled))
   const item=await f.purchase(),claim=await f.create(f.body(item));await f.action(claim.id,'review');await f.action(claim.id,'approve')
   const rows=await f.intents(claim.id);assert.equal(rows.length,2);assert.ok(rows.every(r=>r.status==='suppressed'&&r.reason==='event_disabled'))
   await f.enableCommunications();assert.deepEqual((await f.prepare('email')).processed,[]);assert.deepEqual((await f.prepare('sms')).processed,[])
   assert.equal((await f.db.query('select count(*)::int n from public.email_messages')).rows[0].n,0)
  })
  await t.test('new information requests use distinct IDs; responses and replay do not resend',async()=>{
   const item=await f.purchase(),claim=await f.create(f.body(item));await f.action(claim.id,'review');await f.action(claim.id,'note',{text:'PRIVATE-STAFF-NOTE'})
   await f.action(claim.id,'request_information',{text:'Please provide <script>unsafe</script> item details.'})
   assert.equal((await f.intents(claim.id)).length,2)
   await f.prepare('sms');await f.prepare('email');await f.dispatch('sms');await f.dispatch('email')
   const rows=await f.intents(claim.id);assert.ok(rows.every(r=>r.status==='queued'))
   assert.equal(f.calls.sms.at(-1).messages[0].recipient,'+201012345678');assert.equal(f.calls.email.at(-1).recipient,'purchase-contact@email.example.invalid')
   assert.equal(f.calls.email.at(-1).locale,'ar');assert.match(f.calls.email.at(-1).html_body,/dir="rtl"/);assert.match(f.calls.email.at(-1).html_body,/&lt;script&gt;/);assert.doesNotMatch(f.calls.email.at(-1).html_body,/<script|PRIVATE-STAFF-NOTE/)
   assert.match(f.calls.email.at(-1).html_body,/<a href="https:\/\/new.elcomputer.net\/ar\/account\/after-sales\//)
   await f.customerAction(claim.id,'respond');assert.equal((await f.intents(claim.id)).length,2)
   await f.action(claim.id,'request_information',{text:'Please provide the second detail.'});const repeated=await f.intents(claim.id)
   assert.equal(repeated.length,4);assert.equal(new Set(repeated.map(r=>r.occurrence_id)).size,2)
   const original=repeated[0];await assert.rejects(()=>f.db.query("select public.after_sales_communication_enqueue($1,null,'email','{}')",[original.id]))
   await f.prepare('email');await f.prepare('email');assert.equal((await f.db.query('select count(*)::int n from public.email_messages where business_reference=$1',[(await f.detail(claim.id)).claim.reference])).rows[0].n,2)
   await f.customerAction(claim.id,'respond');await f.configure('more_information',{is_enabled:false})
  })
  await t.test('Approved, Received, Resolution Decided and Resolved remain workflow facts, not financial execution',async()=>{
   const item=await f.purchase(),claim=await f.create(f.body(item));await f.action(claim.id,'review');await f.action(claim.id,'approve')
   await f.prepare('sms');await f.prepare('email');await f.dispatch('sms');await f.dispatch('email')
   await f.action(claim.id,'receive',{text:'Manual walk-in receipt.'});await f.prepare('sms');await f.prepare('email');await f.dispatch('sms');await f.dispatch('email')
   await f.action(claim.id,'inspect');await f.action(claim.id,'select_resolution',{resolution:'refund',text:'Refund decision recorded.'})
   await f.prepare('sms');await f.prepare('email');await f.dispatch('sms');await f.dispatch('email')
   const before=(await f.intents(claim.id)).length;await f.action(claim.id,'select_resolution',{resolution:'refund',text:'Same decision saved again.'});assert.equal((await f.intents(claim.id)).length,before)
   await f.action(claim.id,'resolve',{text:'Claim handling concluded.'});await f.prepare('sms');await f.prepare('email');await f.dispatch('sms');await f.dispatch('email')
   assert.equal((await f.detail(claim.id)).claim.status,'resolved');assert.deepEqual([...new Set((await f.intents(claim.id)).map(r=>r.purpose))],['approved','received','resolution_decided','resolved'])
   const reference=(await f.detail(claim.id)).claim.reference
   assert.equal(f.calls.email.filter(m=>m.business_reference===reference).length,4)
   assert.equal((await f.db.query("select count(*)::int n from public.after_sales_communications c join public.sms_batches b on b.id=c.sms_batch_id where c.claim_id=$1 and b.status='submitted'",[claim.id])).rows[0].n,4)
   assert.doesNotMatch(f.calls.email.map(m=>m.text_body).join(' '),/refund has been issued|replacement has shipped/i)
   assert.ok(f.calls.email.every(m=>m.classification==='transactional'));assert.ok(f.calls.sms.every(c=>c.batch.traffic_type==='notification'))
  })
  await t.test('Rejected is captured once; invalid SMS does not block Email or Claims',async()=>{
   const item=await f.purchase();await f.db.query("update public.customer_orders set phone='invalid' where id=$1",[item.order_id])
   const claim=await f.create(f.body(item));await f.action(claim.id,'review');await f.action(claim.id,'reject')
   await f.prepare('sms');await f.prepare('email');await f.dispatch('email')
   const rows=await f.intents(claim.id);assert.equal(rows.find(r=>r.channel==='sms').reason,'invalid_phone');assert.equal(rows.find(r=>r.channel==='email').status,'queued');assert.equal((await f.detail(claim.id)).claim.status,'rejected')
  })
 }finally{await f.db.close()}
})
