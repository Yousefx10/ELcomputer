import { createError } from 'h3'
import { claimCommunicationPurposes,claimCommunicationVariables,claimCommunicationTemplateMatches,validateClaimCommunicationTemplate,claimCommunicationUrl } from '../../app/utils/claimCommunications.js'
import { smsTemplateVariables,renderSmsTemplate,estimateSmsSegments,normalizeSmsPhone } from '../../app/utils/sms.js'
import { emailAddress,emailLine,renderEmailSource } from '../../app/utils/email.js'
import { getSmsSettings,smsReadiness } from './sms/settings.js'
import { createSmsService } from './sms/service.js'
import { getEmailSettings,emailReadiness } from './email/settings.js'
import { createEmailService } from './email/service.js'
import { runClaimRpc } from './claimDatabase.js'
import en from '../../i18n/locales/en.json' with {type:'json'}
import ar from '../../i18n/locales/ar.json' with {type:'json'}
const check=result=>{if(result.error)throw createError({statusCode:503,statusMessage:'Claim communications are unavailable.'});return result.data}

export const getClaimCommunicationSettings=async db=>{
 const settings=check(await db.from('after_sales_communication_settings').select('purpose,is_enabled,sms_enabled,email_enabled,sms_template_en,sms_template_ar,email_template_en,email_template_ar,sms_sender,email_sender,revision,updated_at').order('purpose'))
 const sms=await getSmsSettings(db),email=await getEmailSettings(db)
 const smsTemplates=check(await db.from('sms_templates').select('id,code,name,category,traffic_type,is_enabled,sender').ilike('code','claim_%').order('code').limit(200))
 const emailTemplates=check(await db.from('email_templates').select('key,name,category,classification,is_enabled,sender,version').ilike('key','claim_%').order('key').limit(200))
 return {settings,sms:{enabled:sms.is_enabled&&smsReadiness(sms).ready,senders:sms.sender_names,templates:smsTemplates.filter(t=>claimCommunicationPurposes.some(p=>claimCommunicationTemplateMatches(t,p,'sms')))},email:{enabled:email.config.is_enabled&&emailReadiness(email).ready,senders:email.config.approved_senders.filter(s=>s.verified).map(s=>s.email),templates:emailTemplates.filter(t=>claimCommunicationPurposes.some(p=>claimCommunicationTemplateMatches(t,p,'email')))}}
}
export const validateClaimCommunicationSetting=async(db,body)=>{
 const fields=['purpose','revision','is_enabled','sms_enabled','email_enabled','sms_template_en','sms_template_ar','email_template_en','email_template_ar','sms_sender','email_sender']
 const fail=()=>{throw createError({statusCode:400,statusMessage:'Invalid claim communication settings.'})}
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!fields.includes(k))||!claimCommunicationPurposes.includes(body.purpose)||!Number.isInteger(body.revision)||body.revision<0||['is_enabled','sms_enabled','email_enabled'].some(k=>typeof body[k]!=='boolean'))fail()
 const input=Object.fromEntries(fields.map(k=>[k,body[k]]))
 for(const ch of ['sms','email']){
  if(typeof input[ch+'_sender']!=='string'||input[ch+'_sender'].length>254)fail()
  for(const lang of ['en','ar']){
   const key=ch+'_template_'+lang,ref=input[key]
   if(ref!==null&&(typeof ref!=='string'||!(ch==='sms'?/^[0-9a-f-]{36}$/i:/^[a-z][a-z0-9_]{1,79}$/).test(ref)))fail()
   if(body.is_enabled&&body[ch+'_enabled']){
    const t=check(await db.from(ch==='sms'?'sms_templates':'email_templates').select('*').eq(ch==='sms'?'id':'key',ref).maybeSingle())
    try{validateClaimCommunicationTemplate(t,body.purpose,ch)}catch{fail()}
   }
  }
 }
 return input
}
export const claimCommunicationValues=row=>{
 const catalog=row.locale==='ar'?ar:en,values={}
 for(const key of claimCommunicationVariables(row.purpose))values[key]=String(row.payload[key]||'')
 values.claim_url=claimCommunicationUrl(row.claim_id,row.locale)
 values.claim_type=catalog.claims.types?.[row.payload.claim_type]||catalog.claims[row.payload.claim_type]||row.payload.claim_type
 if('resolution' in values)values.resolution=catalog.claims.resolutions[row.payload.resolution]||''
 return values
}
export const processClaimCommunications=async(db,{channel,limit=1,authorize=()=>{}}={})=>{
 if(!['sms','email'].includes(channel))throw Error('Invalid communication channel.')
 const processed=[]
 for(let index=0;index<Math.min(3,Math.max(1,limit));index++){
  await authorize()
  const row=check(await db.rpc('after_sales_communication_take',{p_channel:channel}));if(!row)break
  let reason='storage_error'
  try{
   const context={id:row.id,token:row.work_token},known=claimCommunicationValues(row)
   reason='invalid_template';validateClaimCommunicationTemplate(row.template_snapshot,row.purpose,channel)
   let result
   if(channel==='sms'){
    const settings=await getSmsSettings(db);reason=settings.is_enabled?'provider_not_ready':'provider_disabled';if(!settings.is_enabled||!smsReadiness(settings).ready)throw Error()
    reason='invalid_phone';const recipient=normalizeSmsPhone(row.recipient,{defaultCountry:settings.default_country,allowInternational:settings.allow_international})
    const variables=Object.fromEntries(smsTemplateVariables(row.template_snapshot['text_'+row.locale]).map(k=>[k,known[k]]))
    reason='invalid_template';const text=renderSmsTemplate(row.template_snapshot['text_'+row.locale],variables)
    reason='segment_limit';if(estimateSmsSegments(text).segments>10)throw Error()
    await authorize();reason='storage_error'
    result=await createSmsService(db).sendNotification({recipients:[recipient],templateCode:row.template_snapshot.code,locale:row.locale,variables,sender:row.sender,idempotencyKey:'claim:'+row.id,triggerSource:'claim:'+row.purpose,expiresAt:new Date(row.expires_at).toISOString(),priority:20},{claimCommunication:context})
   }else{
    const settings=await getEmailSettings(db);reason=settings.config.is_enabled?'provider_not_ready':'provider_disabled';if(!settings.config.is_enabled||!emailReadiness(settings).ready)throw Error()
    reason='invalid_email';const recipient=emailAddress(row.recipient)
    const source=row.template_snapshot['subject_'+row.locale]+'\n'+row.template_snapshot['body_'+row.locale]
    const values=Object.fromEntries([...new Set([...source.matchAll(/\{\{([a-z_]+)\}\}/g)].map(m=>m[1]))].map(k=>[k,known[k]]))
    reason='invalid_template';emailLine(renderEmailSource(row.template_snapshot['subject_'+row.locale],values,true));renderEmailSource(row.template_snapshot['body_'+row.locale],values)
    await authorize();reason='storage_error'
    result=await createEmailService(db).sendTransactional({recipient,sender:row.sender,locale:row.locale,template_key:row.template_reference,values,idempotency_key:row.id,business_reference:known.claim_reference,priority:5},{claimCommunication:context})
   }
   processed.push({id:row.id,status:result.status||result.state})
  }catch(error){
   if(error.statusCode===401)reason='storage_error'
   if(reason==='storage_error'&&error.statusCode===400)reason='invalid_template'
   check(await db.rpc('after_sales_communication_finish',{p_id:row.id,p_token:row.work_token,p_reason:reason}))
   if(error.statusCode===401)throw error
   processed.push({id:row.id,status:reason==='storage_error'?'deferred':'suppressed'})
  }
 }
 return {processed}
}
export const claimCommunicationRpc=runClaimRpc
