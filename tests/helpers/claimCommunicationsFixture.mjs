import { createClaimsFixture } from './claimsFixture.mjs'
import { attachReverseFixture,reverseFixtureRuntime } from './reverseFixture.mjs'
import { emailFixtureRuntime } from './emailFixture.mjs'
import { getEmailSettings,validateEmailSettings } from '../../server/utils/email/settings.js'
import { encryptCredentialSecret } from '../../server/utils/credentialSecrets.js'
import { emailRpc } from '../../server/utils/email/core.js'
import { claimCommunicationPurposes,claimCommunicationTemplateDraft } from '../../app/utils/claimCommunications.js'
import { processClaimCommunications } from '../../server/utils/afterSalesCommunications.js'
import { processEmailQueue } from '../../server/utils/email/service.js'
import { processSmsQueue } from '../../server/utils/sms/service.js'
export const communicationRuntime={...emailFixtureRuntime,...reverseFixtureRuntime,smsWorkerSecret:'claims-sms-fixture-worker-more-than-32-characters'}
export const attachClaimCommunicationsFixture=async base=>{
 const f=await attachReverseFixture(base);globalThis.useRuntimeConfig=()=>communicationRuntime
 const emailConfigure=async values=>{const current=await getEmailSettings(f.client);return emailRpc(f.client,'settings',validateEmailSettings({revision:current.revision,...values},current),f.owner)}
 const providers=async()=>{
  globalThis.useRuntimeConfig=()=>communicationRuntime
  await f.db.query("update public.sms_provider_settings set is_enabled=true,base_url='https://sms.example.invalid',sender_names=array['APP'],default_sender='APP',expected_outbound_ip='8.8.8.8',trusted_ip_confirmed=true,activation_confirmed=true,hash_protocol_confirmed=true,account_id_encrypted=$1,password_encrypted=$2,hash_secret_encrypted=$3 where id='vodafone'",[encryptCredentialSecret('fixture-account'),encryptCredentialSecret('fixture-password'),encryptCredentialSecret('AB'.repeat(16))])
  await emailConfigure({api_key:'claims-fixture-private-brevo-key-over-32-characters',approved_senders:[{email:'store@email.example.invalid',name:'ELcomputer Fixture',verified:true}],transactional_sender:'store@email.example.invalid',brand_name:'ELcomputer'})
  await emailConfigure({account_approved:true,activation_confirmed:true,is_enabled:true})
 }
 const templates={sms:{},email:{}}
 const createTemplates=async()=>{
  for(const purpose of claimCommunicationPurposes){
   const sms=claimCommunicationTemplateDraft(purpose,'sms'),email=claimCommunicationTemplateDraft(purpose,'email')
   const {data,error}=await f.client.from('sms_templates').insert({...sms,is_enabled:true,created_by:f.owner,updated_by:f.owner}).select('*').single();if(error)throw Error(error.message);templates.sms[purpose]=data
   templates.email[purpose]=await emailRpc(f.client,'template',{...email,is_enabled:true},f.owner)
  }
 }
 const settings=async purpose=>(await f.db.query('select * from public.after_sales_communication_settings where purpose=$1',[purpose])).rows[0]
 const configure=async(purpose,changes={})=>{
  const current=await settings(purpose)
  return f.rpc('after_sales_communication_configure',{p_actor:f.owner,p_input:{purpose,revision:current.revision,is_enabled:true,sms_enabled:true,email_enabled:true,sms_template_en:templates.sms[purpose]?.id||null,sms_template_ar:templates.sms[purpose]?.id||null,email_template_en:templates.email[purpose]?.key||null,email_template_ar:templates.email[purpose]?.key||null,sms_sender:'',email_sender:'',...changes}})
 }
 const enableCommunications=async()=>{await providers();await createTemplates();for(const purpose of claimCommunicationPurposes)await configure(purpose)}
 const purchase=async quantity=>{const item=await base.purchase(quantity);await f.db.query("update public.customer_orders set email='purchase-contact@email.example.invalid' where id=$1",[item.order_id]);return item}
 const intents=async id=>(await f.db.query('select * from public.after_sales_communications where claim_id=$1 order by created_at,id',[id])).rows
 const fixtureWrite=async(sql,args=[])=>{await f.db.exec("begin;set local app.email_write='on';set local app.claim_communication_write='on'");try{const result=await f.db.query(sql,args);await f.db.exec('commit');return result}catch(e){await f.db.exec('rollback');throw e}}
 const unthrottle=async()=>{await f.db.exec('update public.sms_provider_settings set next_request_at=null');await fixtureWrite('update public.email_provider_settings set next_dispatch_at=null')}
 const calls={sms:[],email:[]}
 const smsProvider={submit:async(_s,_c,b,m,_t,before)=>{await before();calls.sms.push({batch:b,messages:m});return {resultStatus:'SUCCESS',messages:m.map(message=>({position:message.position,status:'submitted',code:'0'}))}}}
 const emailProvider={submit:async(_s,_c,m,before)=>{await before();calls.email.push(m);return {state:'accepted',provider_message_id:'claim-'+m.id+'@relay.example.invalid',http_status:201}}}
 const prepare=async(channel,limit=3)=>processClaimCommunications(f.client,{channel,limit})
 const dispatch=async channel=>{
  const all=[]
  for(let i=0;i<6;i++){await unthrottle();const result=channel==='sms'?(await processSmsQueue(f.client,{provider:smsProvider})).processed:await processEmailQueue(f.client,{provider:emailProvider});if(!result.length)break;all.push(...result)}
  return all
 }
 return {...f,reverseConfigure:f.configure,purchase,templates,providers,emailConfigure,createTemplates,enableCommunications,settings,configure,intents,fixtureWrite,unthrottle,calls,prepare,dispatch,smsProvider,emailProvider}
}
export const createClaimCommunicationsFixture=async options=>attachClaimCommunicationsFixture(await createClaimsFixture(options))
