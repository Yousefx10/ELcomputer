import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createEmailFixture,EMAIL_KEY_CANARY,WEBHOOK_CANARY } from './helpers/emailFixture.mjs'
import { emailAddress,emailLayout,renderEmailSource,emailLine } from '../app/utils/email.js'
import { createEmailService,previewManualEmail,processEmailQueue,emailDigest } from '../server/utils/email/service.js'
import { brevoProvider,brevoMessageId } from '../server/utils/email/brevo.js'
import { getEmailSettings,publicEmailSettings,validateEmailSettings } from '../server/utils/email/settings.js'
import { normalizeBrevoEvent } from '../server/utils/email/events.js'
import { emailRpc } from '../server/utils/email/core.js'
import { decryptCredentialSecret } from '../server/utils/credentialSecrets.js'
import { validateEmailTemplate } from '../server/utils/email/templates.js'
const acceptedProvider={submit:async(_s,_k,m,before)=>{await before();return {state:'accepted',http_status:201,provider_message_id:'fixture-'+m.id+'@email.example.invalid'}}}

test('recipient, headers and templates reject injection; EN/AR branded output escapes values',()=>{
 assert.equal(emailAddress('Buyer@Example.INVALID'),'buyer@example.invalid')
 for(const value of ['a@example.com\r\nBcc:x@y.com','A <a@example.com>','a@localhost','a..b@example.com','a@bad-.com','a@a..com','x@127.0.0.1','a,b@example.com'])assert.throws(()=>emailAddress(value))
 assert.throws(()=>emailLine('Hello\nBcc: x@example.invalid'))
 assert.throws(()=>renderEmailSource('{{unknown}}',{}));assert.throws(()=>renderEmailSource('{{message.toString()}}',{}));assert.throws(()=>renderEmailSource('{{message}}',{message:'x\r\nBcc:y'},true))
 const body=renderEmailSource('Hello {{customer_name}}',{customer_name:'<img src=x onerror=alert(1)> & "'})
 const html=emailLayout({subject:'Request <script>',body,locale:'ar',brand:'Store'})
 assert.match(html,/dir="rtl"/);assert.match(html,/lang="ar"/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<script|<img/);assert.match(html,/default-src 'none'/)
})

test('Brevo contract, message ID and provider errors use mocked transports only',async t=>{
 const s={config:{timeout_ms:1000}},m={sender:'store@email.example.invalid',sender_name:'Fixture',recipient:'buyer@email.example.invalid',subject:'Essential',reply_to:'reply@email.example.invalid',classification:'transactional',html_body:'<p>Fixture</p>',text_body:'Fixture',body_format:'html',correlation:'elc-'+'a'.repeat(64)}
 await t.test('201 is acceptance with canonical identity and one documented body type',async()=>{
  let dispatched=false
  const outcome=await brevoProvider.submit(s,EMAIL_KEY_CANARY,m,async()=>{dispatched=true},async(payload,key,_timeout,before)=>{await before();assert.equal(key,EMAIL_KEY_CANARY);assert.equal(payload.to.length,1);assert.equal(payload.replyTo.email,m.reply_to);assert.equal(payload.htmlContent,m.html_body);assert.equal(payload.textContent,undefined);assert.equal(payload.headers['X-Mailin-custom'],m.correlation);return {status:201,body:'{"messageId":"<mock@relay.example.invalid>"}'}})
  assert.equal(dispatched,true);assert.deepEqual(outcome,{state:'accepted',provider_message_id:'mock@relay.example.invalid',http_status:201})
  await brevoProvider.submit(s,EMAIL_KEY_CANARY,{...m,body_format:'text'},async()=>{},async payload=>{assert.equal(payload.textContent,'Fixture');assert.equal(payload.htmlContent,undefined);return {status:201,body:'{"messageId":"text@relay.example.invalid"}'}})
 })
 await t.test('known rejection/rate limits differ from ambiguous errors; raw response is discarded',async()=>{
  for(const [status,state]of [[400,'failed'],[401,'failed'],[402,'failed'],[403,'failed'],[405,'failed'],[406,'failed'],[422,'failed'],[429,'retry'],[500,'uncertain'],[302,'uncertain'],[200,'uncertain'],[201,'uncertain']]){
   const result=await brevoProvider.submit(s,EMAIL_KEY_CANARY,m,async()=>{},async()=>({status,body:'SENSITIVE RESPONSE',retryAfter:'45'}));assert.equal(result.state,state);assert.doesNotMatch(JSON.stringify(result),/SENSITIVE/);if(status===429)assert.equal(result.retry_seconds,45)
  }
  assert.equal((await brevoProvider.submit(s,EMAIL_KEY_CANARY,m,async()=>{},async()=>{throw Error('Secret timeout')})).state,'uncertain')
  assert.equal((await brevoProvider.submit(s,EMAIL_KEY_CANARY,m,async()=>{},async()=>{throw Object.assign(Error(),{preflight:true})})).state,'retry')
  for(const [code,category,state]of [['not_enough_credits','quota','failed'],['account_under_validation','account_validation','failed'],['duplicate_request','provider_duplicate','uncertain'],['toString','invalid_request','failed']]){const result=await brevoProvider.submit(s,EMAIL_KEY_CANARY,m,async()=>{},async()=>({status:400,body:JSON.stringify({code,message:'SENSITIVE_PROVIDER_DETAILS'})}));assert.equal(result.error_category,category);assert.equal(result.state,state);assert.doesNotMatch(JSON.stringify(result),/SENSITIVE/)}
  assert.throws(()=>brevoMessageId('<unsafe\r\n@example.invalid>'))
 })
})

test('SQL-backed email foundation, private settings, queue and recipient restrictions',async t=>{
 const f=await createEmailFixture(),{db,client,actors}=f,service=createEmailService(client)
 const recordEvent=async value=>emailRpc(client,'event',{...value,config_revision:(await f.settings()).revision})
 try{
  await t.test('disabled defaults create no backlog; browser roles cannot read or invoke email tables/RPC',async()=>{
   assert.equal((await f.settings()).config.is_enabled,false)
   await assert.rejects(()=>service.sendTransactional(f.input()),/disabled/)
   assert.equal((await db.query('select count(*)::int n from public.email_messages')).rows[0].n,0)
   for(const role of ['anon','authenticated']){await db.exec('set role '+role);for(const table of ['email_provider_settings','email_templates','email_preferences','email_messages','email_attempts','email_events'])await assert.rejects(()=>db.query('select * from public.'+table),/permission denied/);await assert.rejects(()=>db.query("select public.email_command('claim')"),/permission denied/);await db.exec('reset role')}
   await db.exec('set role service_role');await assert.rejects(()=>db.query("update public.email_provider_settings set revision=99"),/permission denied/);await db.exec('reset role')
  })
  await f.activate()
  await t.test('AES settings are masked; replacement resets activation and preserves empty secrets',async()=>{
   const saved=await f.settings(),safe=publicEmailSettings(saved)
   assert.equal(decryptCredentialSecret(saved.api_key_encrypted,'Email'),EMAIL_KEY_CANARY);assert.notEqual(saved.api_key_encrypted,EMAIL_KEY_CANARY);assert.equal(safe.api_key_configured,true);assert.doesNotMatch(JSON.stringify(safe),/private-api-key|encrypted|private-webhook/)
   assert.equal(validateEmailSettings({revision:saved.revision,api_key:''},saved).api_key_encrypted,undefined)
   const change=validateEmailSettings({revision:saved.revision,api_key:'replacement-credential-at-least-32-characters'},saved);assert.equal(change.config.is_enabled,false);assert.equal(change.config.account_approved,false)
   assert.throws(()=>validateEmailSettings({revision:saved.revision,is_enabled:'true'},saved));assert.throws(()=>validateEmailSettings({revision:saved.revision-1},saved),/changed/)
   await assert.rejects(()=>emailRpc(client,'settings',{revision:saved.revision,config:saved.config},actors.customer),/permission/)
  })
  await f.saveTemplate(validateEmailTemplate(f.template()));await f.saveTemplate(validateEmailTemplate(f.template('marketing')))
  await t.test('SQL idempotency and immutable snapshots preserve one intent',async()=>{
   const input=f.input(),first=await service.sendTransactional(input),second=await service.sendTransactional(input)
   assert.equal(first.id,second.id);assert.equal(second.reused,true)
   await assert.rejects(()=>service.sendTransactional({...input,body:'Different'}),/already used/)
   await assert.rejects(()=>f.fixtureWrite('update public.email_messages set recipient=$1 where id=$2',['other@email.example.invalid',first.id]),/immutable/)
   await f.unthrottle();await processEmailQueue(client,{provider:acceptedProvider});assert.equal((await f.message(first.id)).state,'accepted')
  })
  await t.test('manual receipt binds actor, content, recipient, revision and confirmation',async()=>{
   const input=f.input(),preview=await previewManualEmail(client,input,actors.owner)
   await assert.rejects(()=>service.sendTransactional({...input,receipt:preview.receipt,confirmed:true,essential_confirmed:true,body:'Changed'},{actor:actors.owner}),/Preview/)
   await assert.rejects(()=>service.sendTransactional({...input,receipt:preview.receipt,confirmed:true,essential_confirmed:true},{actor:actors.sender}),/Preview/)
   const result=await service.sendTransactional({...input,receipt:preview.receipt,confirmed:true,essential_confirmed:true},{actor:actors.owner});await f.unthrottle();await processEmailQueue(client,{provider:acceptedProvider});assert.equal((await f.message(result.id)).state,'accepted')
   await assert.rejects(()=>service.sendTransactional({...input,template_key:'fixture_marketing',values:{reference:'X',customer_name:'Buyer',message:'Promo'}}),/email type/)
  })
  await t.test('marketing consent gate, opt-out and transactional isolation',async()=>{
   const input=f.input({sender:'marketing@email.example.invalid',template_key:'fixture_marketing',values:{reference:'X',customer_name:'Buyer',message:'Fixture message'}})
   const blocked=await service.sendMarketing(input);assert.equal(blocked.state,'suppressed')
   await emailRpc(client,'preference',{recipient:input.recipient,marketing_status:'subscribed',provenance:'Fixture explicit consent',global_reason:null,clear_safety_confirmed:false,updated_at:(await db.query('select updated_at from public.email_preferences where recipient=$1',[input.recipient])).rows[0].updated_at},actors.owner)
   const allowed=await service.sendMarketing({...input,idempotency_key:randomUUID()}),m=await f.message(allowed.id);assert.equal(m.state,'queued');assert.match(m.html_body,/Unsubscribe from marketing/)
   const token=m.text_body.match(/#([A-Za-z0-9_-]{43})/)[1]
   assert.equal((await emailRpc(client,'unsubscribe',{token_hash:emailDigest('wrong')})).matched,false)
   assert.equal((await emailRpc(client,'unsubscribe',{token_hash:emailDigest(token)})).matched,true);assert.equal((await f.message(m.id)).state,'suppressed')
   const legitimate=await service.sendTransactional(f.input());assert.equal(legitimate.state,'queued');await f.unthrottle();await processEmailQueue(client,{provider:acceptedProvider});assert.equal((await f.message(legitimate.id)).state,'accepted')
  })
  await t.test('preflight/rate retries are bounded; timeout never retries',async()=>{
   const uncertain=await service.sendTransactional(f.input());let calls=0
   const failing={submit:async(_s,_k,_m,before)=>{await before();calls++;throw Error('sensitive timeout')}}
   await f.unthrottle();await processEmailQueue(client,{provider:failing});assert.equal((await f.message(uncertain.id)).state,'uncertain');await f.unthrottle();await processEmailQueue(client,{provider:failing});assert.equal(calls,1)
   const retry=await service.sendTransactional(f.input());const limited={submit:async(_s,_k,_m,before)=>{await before();return {state:'retry',error_category:'rate_limit',retry_seconds:1,http_status:429}}}
   for(let i=0;i<3;i++){await f.unthrottle();await f.fixtureWrite('update public.email_messages set next_attempt_at=clock_timestamp() where id=$1',[retry.id]);const result=await processEmailQueue(client,{provider:limited});assert.equal(result[0].state,i===2?'failed':'queued')}
   assert.equal((await f.message(retry.id)).state,'failed');assert.equal((await f.message(retry.id)).attempts,3)
  })
  await t.test('disable/re-enable retires queued work; dispatch catches revocation and expired leases',async()=>{
   const old=await service.sendTransactional(f.input());await f.configure({is_enabled:false});assert.equal((await f.message(old.id)).state,'suppressed')
   await assert.rejects(()=>service.sendTransactional(f.input()),/disabled/);await f.configure({is_enabled:true});await f.unthrottle();assert.deepEqual(await processEmailQueue(client,{provider:acceptedProvider}),[])
   const revoked=await service.sendTransactional(f.input()),work=await emailRpc(client,'claim');await f.configure({is_enabled:false});assert.equal((await emailRpc(client,'dispatch',{id:work.id,work_token:work.work_token})).allowed,false);assert.equal((await f.message(revoked.id)).state,'suppressed');await f.configure({is_enabled:true})
   const stale=await service.sendTransactional(f.input()),lease=await emailRpc(client,'claim');await f.fixtureWrite("update public.email_messages set started_at=clock_timestamp()-interval '3 minutes' where id=$1",[stale.id]);await emailRpc(client,'claim');assert.equal((await f.message(stale.id)).state,'uncertain')
  })
  await t.test('authenticated events deduplicate, match stable IDs, order delivery and persist safety',async()=>{
   const queued=await service.sendTransactional(f.input({recipient:'events@email.example.invalid'}));await f.unthrottle();await processEmailQueue(client,{provider:acceptedProvider});const m=await f.message(queued.id)
   const observation=(event,seconds=0,changes={})=>normalizeBrevoEvent({event,email:m.recipient,'message-id':'<'+m.provider_message_id+'>',ts_event:Math.floor(Date.now()/1000)+seconds,...changes})
   await recordEvent(observation('request'));
   const delivered=observation('delivered');assert.equal((await recordEvent(delivered)).replayed,false);assert.equal((await recordEvent(delivered)).replayed,true)
   await recordEvent(observation('request',-1));assert.equal((await f.message(m.id)).delivery_state,'delivered')
   const deliveryBefore=(await f.message(m.id)).delivery_at;await recordEvent(observation('request',3));assert.equal((await f.message(m.id)).delivery_at.valueOf(),deliveryBefore.valueOf())
   await recordEvent(observation('opened',1));assert.ok((await f.message(m.id)).opened_at);assert.equal((await f.message(m.id)).state,'accepted')
   assert.equal((await recordEvent(observation('spam',2,{email:'stranger@email.example.invalid'}))).matched,false)
   await recordEvent(observation('spam',2));assert.equal((await service.sendTransactional(f.input({recipient:m.recipient}))).state,'suppressed')
   assert.equal(normalizeBrevoEvent({event:'undocumented_event'}),null);assert.throws(()=>normalizeBrevoEvent({event:'delivered',email:m.recipient,'message-id':m.provider_message_id,ts_epoch:Date.now()}))
  })
  await t.test('early provider event matches only dispatched nonce; failed finish preserves ambiguity',async()=>{
   const queued=await service.sendTransactional(f.input({recipient:'early@email.example.invalid'}));await f.unthrottle();const work=await emailRpc(client,'claim')
   const body={event:'delivered',email:work.recipient,'message-id':'early@relay.example.invalid',ts_event:Math.floor(Date.now()/1000),'X-Mailin-custom':work.correlation}
   assert.equal((await recordEvent(normalizeBrevoEvent(body))).matched,false)
   await emailRpc(client,'dispatch',{id:work.id,work_token:work.work_token});assert.equal((await recordEvent(normalizeBrevoEvent(body))).matched,true)
   await emailRpc(client,'finish',{id:work.id,work_token:work.work_token,state:'accepted',provider_message_id:'early@relay.example.invalid',http_status:201});assert.equal((await f.message(queued.id)).state,'accepted')
   await assert.rejects(()=>f.fixtureWrite("delete from public.email_events"),/Canonical/)
  })
 }finally{await db.close()}
})

test('66th migration preserves populated business/SMS/PDC/Claims/payment checkpoints and canonical functions',async()=>{
 const {createClaimsFixture}=await import('./helpers/claimsFixture.mjs'),name='20261008180000_email_foundation.sql',f=await createClaimsFixture({stopBefore:name})
 try{
  await f.checkout();await f.enable();const item=await f.purchase(),claim=await f.create(f.body(item));await f.action(claim.id,'review')
  const tables=['products','product_variants','customer_profiles','admin_users','customer_orders','customer_order_items','after_sales_policies','after_sales_return_reasons','after_sales_policy_versions','after_sales_claims','after_sales_claim_events','after_sales_claim_information','after_sales_claim_evidence','shipping_claim_jobs','shipping_provider_settings','shipping_order_jobs','shipping_webhook_events','sms_provider_settings','sms_templates','sms_order_event_settings','sms_order_events','sms_batches','sms_messages','sms_attempts','payment_attempts']
  const snapshot=async()=>Object.fromEntries(await Promise.all(tables.map(async table=>[table,(await f.db.query('select to_jsonb(t) row from public.'+table+' t order by to_jsonb(t)::text')).rows])))
  const before=await snapshot(),functions=(await f.db.query("select proname,pg_get_function_identity_arguments(oid) args,prosrc from pg_proc where pronamespace='public'::regnamespace and proname not in ('default_admin_permissions','system_reset_plan') order by oid")).rows
  await f.db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));assert.deepEqual(await snapshot(),before)
  for(const fn of functions)assert.equal((await f.db.query('select prosrc from pg_proc where pronamespace=$1::regnamespace and proname=$2 and pg_get_function_identity_arguments(oid)=$3',['public',fn.proname,fn.args])).rows[0].prosrc,fn.prosrc,fn.proname)
  assert.equal((await f.db.query('select count(*)::int n from public.email_messages')).rows[0].n,0)
  assert.equal((await f.db.query("select public.system_reset_plan($1,'full') result",[f.owner])).rows[0].result.blockers.some(x=>x.table==='after_sales_claims'),true)
 }finally{await f.db.close()}
})

test('send authorization rechecks consent, suppression, staff rights; audit errors roll back settings',async()=>{
 const f=await createEmailFixture(),service=createEmailService(f.client)
 try{
  await f.activate();await f.saveTemplate(f.template('marketing'))
  const input=f.input({recipient:'revoked@email.example.invalid'}),preview=await previewManualEmail(f.client,input,f.actors.sender)
  const queued=await service.sendTransactional({...input,receipt:preview.receipt,confirmed:true,essential_confirmed:true},{actor:f.actors.sender});const lease=await emailRpc(f.client,'claim')
  await f.db.query("update public.admin_users set permissions='{\"email.view\":true}' where id=$1",[f.actors.sender])
  assert.equal((await emailRpc(f.client,'dispatch',{id:lease.id,work_token:lease.work_token})).allowed,false);assert.equal((await f.message(queued.id)).error_category,'staff_permission')
  const marketingInput=f.input({recipient:'consent@email.example.invalid',sender:'marketing@email.example.invalid',template_key:'fixture_marketing',values:{reference:'X',customer_name:'Buyer',message:'Fixture'}})
  await emailRpc(f.client,'preference',{recipient:marketingInput.recipient,marketing_status:'subscribed',provenance:'Fixture consent',global_reason:null,clear_safety_confirmed:false,updated_at:null},f.actors.owner)
  const marketing=await service.sendMarketing(marketingInput),m=await f.message(marketing.id),work=await emailRpc(f.client,'claim')
  const token=m.text_body.match(/#([A-Za-z0-9_-]{43})/)[1];await emailRpc(f.client,'unsubscribe',{token_hash:emailDigest(token)})
  assert.equal((await emailRpc(f.client,'dispatch',{id:work.id,work_token:work.work_token})).allowed,false);assert.equal((await f.message(m.id)).state,'suppressed')
  const fresh=await service.sendTransactional(f.input({recipient:'bounce@email.example.invalid'}));await f.unthrottle();await processEmailQueue(f.client,{provider:acceptedProvider});const accepted=await f.message(fresh.id)
  for(const event of ['deferred','soft_bounce','unsubscribed','invalid_email']){
   await emailRpc(f.client,'event',{...normalizeBrevoEvent({event,email:accepted.recipient,'message-id':accepted.provider_message_id,ts_event:Math.floor(Date.now()/1000)+2}),config_revision:(await f.settings()).revision})
  }
  const pref=(await f.db.query('select * from public.email_preferences where recipient=$1',[accepted.recipient])).rows[0];assert.equal(pref.global_reason,'invalid_email');assert.deepEqual(pref.blocked_senders,[accepted.sender])
  assert.equal((await service.sendTransactional(f.input({recipient:accepted.recipient}))).state,'suppressed')
  const prior=await f.settings();await f.db.exec("create function public.email_audit_fixture_failure() returns trigger language plpgsql as $$begin if new.action_key like 'email.%' then raise exception 'fixture audit outage'; end if;return new;end$$;create trigger email_audit_fixture_failure before insert on public.admin_activity_logs for each row execute function public.email_audit_fixture_failure()")
  await assert.rejects(()=>f.configure({is_enabled:false}));assert.deepEqual(await f.settings(),prior)
 }finally{await f.db.close()}
})
