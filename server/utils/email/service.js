import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto'
import { emailAddress, emailLine, emailBody, renderEmailSource, emailLayout } from '../../../app/utils/email.js'
import { getEmailSettings, emailReadiness } from './settings.js'
import { emailFail, emailRpc, validateEmail } from './core.js'
import { decryptCredentialSecret, credentialSecretsMatch } from '../credentialSecrets.js'
import { brevoProvider } from './brevo.js'
export const emailDigest = value => createHash('sha256').update(value).digest('hex')
const proof = value => {
 const key=String(useRuntimeConfig().credentialsEncryptionKey||'')
 if(key.trim().length<32)emailFail('Email encryption is unavailable.',503)
 return createHmac('sha256',key).update('email-manual-preview-v1\0'+JSON.stringify(value)).digest('base64url')
}
export const prepareEmail = async (db, input, classification='transactional',actor=null) => {
 const s=await getEmailSettings(db),c=s.config
 let template=null
 if(input.template_key){const result=await db.from('email_templates').select('*').eq('key',input.template_key).maybeSingle();if(result.error||!result.data||!result.data.is_enabled||result.data.classification!==classification) emailFail('Choose an enabled template for this email type.');template=result.data}
 return validateEmail(()=>{
  if(!['transactional','marketing'].includes(classification)||!['en','ar'].includes(input.locale)||!['html','text'].includes(input.body_format||'html'))throw Error('Invalid email type or language.')
  if(classification==='marketing'&&!template)throw Error('Marketing requires a marketing template.')
  const recipient=emailAddress(input.recipient),senderEmail=emailAddress(input.sender||template?.sender||c[classification+'_sender']),sender=c.approved_senders.find(x=>x.email===senderEmail&&x.verified)
  if(!sender)throw Error('Choose an approved sender.')
  if(classification==='marketing'&&senderEmail!==c.marketing_sender)throw Error('Use the marketing sender.')
  const values=input.values||{},subject=template?renderEmailSource(template['subject_'+input.locale],values,true):emailLine(input.subject),body=template?renderEmailSource(template['body_'+input.locale],values):emailBody(input.body)
  const replyTo=template?.reply_to||c.reply_to
  const content={classification,recipient,sender:senderEmail,sender_name:emailLine(sender.name,100),reply_to:replyTo?emailAddress(replyTo):'',template_key:template?.key||null,template_version:template?.version||null,category:template?.category||'manual',locale:input.locale,subject,body,body_format:input.body_format||'html',source:actor?'dashboard_manual':'service',business_reference:emailLine(input.business_reference||'',120,false),actor_id:actor,priority:Number.isInteger(input.priority)&&input.priority>=0&&input.priority<=10?input.priority:0,config_revision:s.revision,brand:c.brand_name||sender.name}
  return {settings:s,content,fingerprint:emailDigest(JSON.stringify(content)),html:emailLayout({...content,locale:input.locale,brand:content.brand}),text:body}
 })
}
export const previewManualEmail = async (db,input,actor) => {
 const prepared=await prepareEmail(db,input,'transactional',actor)
 const receipt={key:randomUUID(),expires:Date.now()+10*60000,fingerprint:prepared.fingerprint,actor}
 return {receipt:{...receipt,signature:proof(receipt)},subject:prepared.content.subject,recipient:prepared.content.recipient,sender:prepared.content.sender,html:prepared.html,text:prepared.text,enabled:prepared.settings.config.is_enabled&&emailReadiness(prepared.settings).ready}
}
export const createEmailService = db => {
 const enqueue=async(input,classification,actor=null)=>{
  const active=await getEmailSettings(db)
  if(!active.config.is_enabled||!emailReadiness(active).ready)emailFail('Email provider is disabled or unavailable.',503)
  const p=await prepareEmail(db,input,classification,actor)
  if(actor){
   const r=input.receipt
   if(input.confirmed!==true||input.essential_confirmed!==true||!r||typeof r.key!=='string'||!Number.isFinite(r.expires)||r.expires<Date.now()||r.expires>Date.now()+10*60000||r.actor!==actor||r.fingerprint!==p.fingerprint||!credentialSecretsMatch(r.signature,proof({key:r.key,expires:r.expires,fingerprint:r.fingerprint,actor:r.actor}))) emailFail('Preview and confirm this transactional email.',409)
  }
  if(!p.settings.config.is_enabled||!emailReadiness(p.settings).ready)emailFail('Email provider is disabled or unavailable.',503)
  const key=actor?input.receipt.key:input.idempotency_key
  if(typeof key!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) emailFail('Provide a stable email request key.')
  let unsubscribe='',hash=null
  if(classification==='marketing'){
   if(!p.settings.config.marketing_enabled||!p.settings.config.unsubscribe_origin) emailFail('Marketing delivery is unavailable.',503)
   const token=randomBytes(32).toString('base64url');hash=emailDigest(token);unsubscribe=p.settings.config.unsubscribe_origin+(p.content.locale==='ar'?'/ar':'')+'/email/unsubscribe#'+token
  }
  const html=unsubscribe?emailLayout({...p.content,brand:p.content.brand,unsubscribeUrl:unsubscribe}):p.html
  const text=p.text+(unsubscribe?'\n\n'+(p.content.locale==='ar'?'إلغاء الاشتراك: ':'Unsubscribe: ')+unsubscribe:'')
  return emailRpc(db,'enqueue',{...p.content,id:randomUUID(),idempotency_key:key,fingerprint:p.fingerprint,html_body:html,text_body:text,unsubscribe_hash:hash,correlation:'elc-'+randomBytes(32).toString('hex')},actor)
 }
 return {sendTransactional:(input,{actor=null}={})=>enqueue(input,'transactional',actor),sendMarketing:input=>enqueue(input,'marketing')}
}
export const processEmailQueue = async (db,{limit=1,provider=brevoProvider}={}) => {
 const results=[]
 for(let i=0;i<Math.min(3,Math.max(1,limit));i++){
  const message=await emailRpc(db,'claim');if(!message)break
  let outcome
  try{
   const settings=await getEmailSettings(db)
   if(!settings.config.is_enabled||!emailReadiness(settings).ready)outcome={state:'suppressed',error_category:'provider_unavailable'}
   else outcome=await provider.submit(settings,decryptCredentialSecret(settings.api_key_encrypted,'Email'),message,async()=>{
    const result=await emailRpc(db,'dispatch',{id:message.id,work_token:message.work_token})
    if(!result.allowed)throw Object.assign(Error('Email dispatch denied.'),{dispatchDenied:true,emailState:result.state||'uncertain'})
   })
  }catch(error){if(error.dispatchDenied){results.push({id:message.id,state:error.emailState||'uncertain'});continue}outcome={state:'uncertain',error_category:'worker_unknown'}}
  const finished=await emailRpc(db,'finish',{id:message.id,work_token:message.work_token,...outcome})
  results.push({id:message.id,state:finished.matched?finished.state:'uncertain'})
 }
 return results
}
