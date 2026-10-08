import { getQuery } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest.js'
import { emailHandler,emailFail } from '../../utils/email/core.js'
export default defineEventHandler(emailHandler(async event=>{
 const {supabaseAdmin}=await requireAdminRequest(event,{permission:'email.history.view'})
 const page=Number(getQuery(event).page||1);if(!Number.isInteger(page)||page<1||page>10000)emailFail('Invalid email history page.')
 const {data,error,count}=await supabaseAdmin.from('email_messages').select('id,classification,recipient,sender,template_key,template_version,category,locale,source,business_reference,actor_id,provider_message_id,state,delivery_state,delivery_at,opened_at,attempts,error_category,created_at,accepted_at',{count:'exact'}).order('created_at',{ascending:false}).order('id').range((page-1)*25,page*25-1)
 if(error)emailFail('Email history is unavailable.',503)
 // Bodies, subjects, encrypted credentials, correlation nonces and unsubscribe tokens stay private.
 return {page,total:count,items:data.map(x=>({...x,recipient:x.recipient.replace(/^(.).*(@.*)$/,'$1•••$2')}))}
}))
