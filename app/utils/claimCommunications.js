import { smsTemplateVariables } from './sms.js'
import { DEFAULT_SITE_URL } from './seo.js'

export const claimCommunicationPurposes=['more_information','approved','rejected','pickup_scheduled','received','resolution_decided','resolved']
const common=['customer_name','claim_reference','claim_type','order_number','product_name','claim_url']
export const claimCommunicationVariables=purpose=>[...common,...(purpose==='more_information'?['request_text']:purpose==='pickup_scheduled'?['courier_name','awb']:['resolution_decided','resolved'].includes(purpose)?['resolution']:[])]
export const claimCommunicationTemplateVariables=[...new Set(claimCommunicationPurposes.flatMap(claimCommunicationVariables))]
export const claimCommunicationTemplateMatches=(template,purpose,channel)=>{
 if(!claimCommunicationPurposes.includes(purpose)||!template)return false
 const key=channel==='sms'?template.code:template.key
 return new RegExp('^claim_'+purpose+'(?:_[a-z0-9]+)*$').test(key||'')&&template.category==='claims:'+purpose&&(channel==='sms'?template.traffic_type==='notification':template.classification==='transactional')
}
export const validateClaimCommunicationTemplate=(template,purpose,channel)=>{
 if(!claimCommunicationTemplateMatches(template,purpose,channel)||!template.is_enabled)throw Error('Choose an enabled Claim template for this milestone.')
 for(const locale of ['en','ar']){
  const body=channel==='sms'?template['text_'+locale]:template['body_'+locale]
  const source=(channel==='email'?template['subject_'+locale]+'\n':'')+body
  const variables=smsTemplateVariables(source)
  if(!body?.trim()||variables.some(v=>!claimCommunicationVariables(purpose).includes(v))||!variables.includes('claim_reference')||!body.includes('{{claim_url}}')||(channel==='email'&&purpose==='more_information'&&!body.includes('{{request_text}}')))throw Error('Use the approved Claim variables and account link.')
 }
 return template
}
export const claimCommunicationUrl=(id,locale)=>{
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw Error('Invalid claim link.')
 return DEFAULT_SITE_URL+(locale==='ar'?'/ar':'')+'/account/after-sales/'+id
}
// Suggestions are saved by authorized staff in the existing template editors.
// They are never a worker fallback or seeded enabled configuration.
export const claimCommunicationTemplateDraft=(purpose,channel)=>{
 if(!claimCommunicationPurposes.includes(purpose))return null
 const labels={more_information:['Action needed','مطلوب إجراء'],approved:['Claim approved','تمت الموافقة على المطالبة'],rejected:['Claim rejected','تم رفض المطالبة'],pickup_scheduled:['Reverse pickup booked','تم حجز استلام المرتجع'],received:['Item received','تم استلام المنتج'],resolution_decided:['Resolution decided','تم تحديد قرار المطالبة'],resolved:['Claim closed','تم إغلاق المطالبة']}
 const sentences={more_information:['Your claim needs more information.','نحتاج إلى معلومات إضافية لمطالبتك.'],approved:['Your claim was approved.','تمت الموافقة على مطالبتك.'],rejected:['Your claim was rejected. Review the decision in My Account.','تم رفض مطالبتك. راجع القرار في حسابي.'],pickup_scheduled:['PDC accepted your reverse pickup booking. Tracking: {{awb}}.','قبلت PDC حجز استلام المرتجع. رقم التتبع: {{awb}}.'],received:['ELcomputer received your item for review.','استلم ELcomputer منتجك للمراجعة.'],resolution_decided:['A {{resolution}} resolution was decided. This does not confirm execution.','تم تحديد قرار {{resolution}}. هذا لا يؤكد تنفيذ القرار.'],resolved:['Your claim was closed. Review the recorded outcome in My Account.','تم إغلاق مطالبتك. راجع النتيجة المسجلة في حسابي.']}
 const body_en='ELcomputer — {{claim_reference}}\n\n'+sentences[purpose][0]+(purpose==='more_information'&&channel==='email'?'\n\n{{request_text}}':'')+'\n\n{{claim_url}}'
 const body_ar='ELcomputer — {{claim_reference}}\n\n'+sentences[purpose][1]+(purpose==='more_information'&&channel==='email'?'\n\n{{request_text}}':'')+'\n\n{{claim_url}}'
 const base={name:labels[purpose][0],category:'claims:'+purpose,sender:'',is_enabled:false}
 return channel==='sms'?{...base,code:'claim_'+purpose,text_en:body_en,text_ar:body_ar,traffic_type:'notification'}:{...base,key:'claim_'+purpose,classification:'transactional',subject_en:labels[purpose][0]+' — {{claim_reference}}',subject_ar:labels[purpose][1]+' — {{claim_reference}}',body_en,body_ar,reply_to:'',version:0}
}
