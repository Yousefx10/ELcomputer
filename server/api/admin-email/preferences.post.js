import { requireAdminRequest } from '../../utils/adminRequest.js'
import { emailAddress,emailLine } from '../../../app/utils/email.js'
import { emailHandler,emailRpc,readEmailBody,validateEmail } from '../../utils/email/core.js'
export default defineEventHandler(emailHandler(async event=>{
 const {supabaseAdmin,adminUser}=await requireAdminRequest(event,{permission:'email.marketing.manage'})
 const b=await readEmailBody(event,4096)
 const input=validateEmail(()=>{
  if(!['unknown','subscribed','unsubscribed'].includes(b.marketing_status)||![null,'manual','hard_bounce','invalid_email','spam'].includes(b.global_reason)||typeof b.clear_safety_confirmed!=='boolean'||b.updated_at!==null&&typeof b.updated_at!=='string')throw Error('Invalid email preference.')
  return {recipient:emailAddress(b.recipient),marketing_status:b.marketing_status,global_reason:b.global_reason,provenance:emailLine(b.provenance,500),clear_safety_confirmed:b.clear_safety_confirmed,updated_at:b.updated_at}
 })
 return {preference:await emailRpc(supabaseAdmin,'preference',input,adminUser.id)}
}))
