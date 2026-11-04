import {createError} from 'h3'
import {estimateSmsSegments,renderSmsTemplate,smsTemplateVariables} from '../../../app/utils/sms.js'
import {createSmsService} from './service.js'
export const transactionalVariables={cod_confirmed:['order_number'],prepaid_confirmed:['order_number'],payment_failed:['checkout_reference'],transfer_under_review:['checkout_reference'],transfer_verified:['order_number'],transfer_rejected:['checkout_reference'],invoice_available:['invoice_number','invoice_url']}
export const smsChannelRpc=async(db,name,args={})=>{const r=await db.rpc(name,args);if(r.error)throw createError({statusCode:409,statusMessage:'SMS channel settings changed or are unavailable.'});return r.data}
export async function processTransactionalSms(db,{limit=3,siteOrigin,authorize=()=>{}}={}){
 await authorize();await smsChannelRpc(db,'sms_capture_transactional');const rows=[]
 for(let i=0;i<Math.min(3,Math.max(1,limit));i++){
  await authorize();const e=await smsChannelRpc(db,'sms_claim_transactional');if(!e)break
  let reason='invalid_template'
  try{
   const variables={...e.variables};delete variables.invoice_path
   if(e.event_type==='invoice_available'){
    const origin=new URL(siteOrigin);if(origin.protocol!=='https:'||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/'||!/^\/account\/invoices\/[0-9a-f-]{36}$/.test(e.variables.invoice_path))throw Error()
    variables.invoice_url=new URL(e.variables.invoice_path,origin.origin).toString()
   }
   const required=smsTemplateVariables(e.template_text),allowed=transactionalVariables[e.event_type]
   if(!allowed||required.some(k=>!allowed.includes(k)))throw Error()
   const text=renderSmsTemplate(e.template_text,Object.fromEntries(required.map(k=>[k,String(variables[k]??'')])))
   if(estimateSmsSegments(text).segments>10)throw Error()
   reason='provider_unavailable';await authorize()
   const result=await createSmsService(db).sendNotification({recipients:[e.recipient],text,sender:e.sender||undefined,idempotencyKey:'tx:'+e.id,triggerSource:'transactional:'+e.event_type,expiresAt:new Date(Date.now()+3600000).toISOString()}, {transactionalEvent:{id:e.id,token:e.lease_token}})
   rows.push({id:e.id,state:'queued',batchId:result.id})
  }catch{
   await smsChannelRpc(db,'sms_suppress_transactional',{p_id:e.id,p_token:e.lease_token,p_reason:reason});rows.push({id:e.id,state:'suppressed',reason})
  }
 }
 return {processed:rows}
}
