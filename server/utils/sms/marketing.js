import {createHmac,timingSafeEqual} from 'node:crypto'
import {createError} from 'h3'
import {estimateSmsSegments,normalizeSmsPhone,renderSmsTemplate,smsTemplateVariables} from '../../../app/utils/sms.js'
import {smsChannelRpc} from './transactional.js'
import {createSmsService} from './service.js'
const invalid=()=>{throw createError({statusCode:400,statusMessage:'Invalid marketing request.'})}
export const marketingPermissions={settings:'sms.marketing.configure',import:'sms.marketing.consent',suppress:'sms.marketing.consent',draft:'sms.marketing.manage',preview:'sms.marketing.manage',prepare:'sms.marketing.manage',approve:'sms.marketing.approve',resume:'sms.marketing.approve',pause:'sms.marketing.manage',cancel:'sms.marketing.manage'}
export function marketingOrigin(value){try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)invalid();return u.origin}catch{invalid()}}
export function unsubscribeKeys(runtime){
 const primary=String(runtime.smsUnsubscribeSecret||'');if(primary.length<32)throw createError({statusCode:409,statusMessage:'Protected unsubscribe configuration is missing.'})
 let previous;try{previous=JSON.parse(runtime.smsUnsubscribePreviousSecrets||'[]');if(!Array.isArray(previous)||previous.length>5||previous.some(x=>typeof x!=='string'||x.length<32))throw Error()}catch{throw createError({statusCode:409,statusMessage:'Protected unsubscribe configuration is missing.'})}
 return [primary,...previous]
}
const signature=(id,key)=>createHmac('sha256',key).update('sms-marketing-unsubscribe:'+id).digest('base64url')
export const unsubscribeToken=(id,runtime)=>{if(!/^[0-9a-f-]{36}$/.test(id))invalid();return id+'.'+signature(id,unsubscribeKeys(runtime)[0])}
export function verifyUnsubscribe(token,runtime){
 if(typeof token!=='string'||!/^([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/.test(token))return null
 const [id,sig]=token.split('.');let keys;try{keys=unsubscribeKeys(runtime)}catch{return null}
 return keys.some(key=>timingSafeEqual(Buffer.from(signature(id,key)),Buffer.from(sig)))?id:null
}
export function normalizeMarketingContacts(rows){
 if(!Array.isArray(rows)||!rows.length||rows.length>500)invalid();const phones=new Set()
 return rows.map(row=>{
  if(!row||row.opt_in!==true||!['en','ar'].includes(row.locale)||!Array.isArray(row.tags)||row.tags.length>10||row.tags.some(x=>typeof x!=='string'||!/^[a-z0-9_-]{1,40}$/.test(x)))invalid()
  for(const k of ['consent_reference','source_reference'])if(typeof row[k]!=='string'||row[k].length<8||row[k].length>200||/[\x00-\x1f]/.test(row[k]))invalid()
  const date=new Date(row.consented_at);if(!Number.isFinite(+date)||+date>Date.now()||+date<Date.now()-10*366*86400000)invalid()
  let phone;try{phone=normalizeSmsPhone(row.phone)}catch{invalid()};if(!/^\+201[0125]\d{8}$/.test(phone)||phones.has(phone))invalid();phones.add(phone)
  return {phone,locale:row.locale,tags:[...new Set(row.tags)].sort(),opt_in:true,consented_at:date.toISOString(),consent_reference:row.consent_reference,source_reference:row.source_reference}
 })
}
export function validateMarketingDraft(d){
 if(!d||typeof d.title!=='string'||!d.title.trim()||d.title.length>100||!/^([0-9a-f-]{36})$/.test(d.template_id)||!['en','ar','all'].includes(d.locale)||!Array.isArray(d.tags)||d.tags.length>10||d.tags.some(x=>typeof x!=='string'||!/^[a-z0-9_-]{1,40}$/.test(x))||!Number.isInteger(d.budget_minor)||d.budget_minor<1||d.budget_minor>10000000||!Number.isInteger(d.recipient_limit)||d.recipient_limit<1||d.recipient_limit>500||typeof d.scheduled_at!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(d.scheduled_at)||!Number.isFinite(Date.parse(d.scheduled_at)))invalid()
 return {...d,title:d.title.trim(),tags:[...new Set(d.tags)].sort(),scheduled_at:new Date(d.scheduled_at).toISOString()}
}
export function buildMarketingPlan(source,runtime){
 const {campaign:c,controls:s,template:t,contacts,provider:p}=source,origin=marketingOrigin(runtime.public.siteUrl)
 unsubscribeKeys(runtime)
 if(!t?.is_enabled||t.traffic_type!=='campaign'||!t.text_en?.trim()||!t.text_ar?.trim()||!s.unit_cost_minor||!s.commercial_reference||!s.unicode_accepted||!Array.isArray(contacts)||!contacts.length||contacts.length>Math.min(c.recipient_limit,s.max_recipients))throw createError({statusCode:409,statusMessage:'Audience or accepted provider pricing is unavailable.'})
 for(const text of [t.text_en,t.text_ar]){const required=smsTemplateVariables(text);if(required.length!==1||required[0]!=='unsubscribe_url')throw createError({statusCode:409,statusMessage:'Both translations require only unsubscribe_url.'})}
 const sender=t.sender||p.sender;if(!p.senders.includes(sender))throw createError({statusCode:409,statusMessage:'Approved campaign sender is missing.'})
 const rows=contacts.map(x=>{
  const link=origin+'/sms/unsubscribe#'+unsubscribeToken(x.id,runtime),text=renderSmsTemplate(x.locale==='ar'?t.text_ar:t.text_en,{unsubscribe_url:link}),estimate=estimateSmsSegments(text)
  if(text.length>4000||estimate.segments<1||estimate.segments>s.max_segments)throw createError({statusCode:409,statusMessage:'Campaign message exceeds the approved segment limit.'})
  return {contact_id:x.id,contact_revision:x.revision,recipient:x.phone,locale:x.locale,body:text,sender,encoding:estimate.encoding,units:estimate.units,segments:estimate.segments,cost_minor:estimate.segments*s.unit_cost_minor}
 })
 const segments=rows.reduce((n,r)=>n+r.segments,0),cost=rows.reduce((n,r)=>n+r.cost_minor,0)
 if(!Number.isSafeInteger(cost)||cost>c.budget_minor)throw createError({statusCode:409,statusMessage:'Campaign budget exceeded.'})
 return {rows,summary:{recipients:rows.length,segments,cost_minor:cost,currency:'EGP',unit_cost_minor:s.unit_cost_minor,template_revision:t.revision,settings_revision:s.revision,encodings:[...new Set(rows.map(r=>r.encoding))],preview_en:t.text_en.replace(/{{\s*unsubscribe_url\s*}}/g,'[private unsubscribe link]'),preview_ar:t.text_ar.replace(/{{\s*unsubscribe_url\s*}}/g,'[رابط إلغاء الاشتراك الخاص]')}}
}
export async function processMarketingSms(db,{limit=3,authorize=()=>{}}={}){
 const result=[]
 for(let i=0;i<Math.min(3,Math.max(1,limit));i++){
  await authorize({trafficType:'campaign'});const r=await smsChannelRpc(db,'sms_claim_marketing');if(!r)break;if(!r.id){result.push({state:'suppressed'});continue}
  try{await authorize({trafficType:'campaign'});const batch=await createSmsService(db).sendCampaign({recipients:[r.recipient],text:r.body,sender:r.sender,idempotencyKey:'marketing:'+r.id,triggerSource:'marketing:'+r.campaign_id,priority:0,expiresAt:new Date(Date.now()+3600000).toISOString()},{marketingRecipient:{id:r.id,token:r.lease_token}});result.push({id:r.id,state:'queued',batchId:batch.id})}
  catch{await smsChannelRpc(db,'sms_marketing_suppress_preparation',{p_id:r.id,p_token:r.lease_token});result.push({id:r.id,state:'suppressed'})}
 }return {processed:result}
}
