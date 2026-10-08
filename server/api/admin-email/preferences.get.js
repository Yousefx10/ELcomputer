import { getQuery } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest.js'
import { emailAddress } from '../../../app/utils/email.js'
import { emailHandler,emailFail,validateEmail } from '../../utils/email/core.js'
export default defineEventHandler(emailHandler(async event=>{
 const {supabaseAdmin}=await requireAdminRequest(event,{permission:'email.marketing.manage'})
 const recipient=validateEmail(()=>emailAddress(getQuery(event).recipient))
 const {data,error}=await supabaseAdmin.from('email_preferences').select('*').eq('recipient',recipient).maybeSingle()
 if(error)emailFail('Email preferences are unavailable.',503)
 return {preference:data||{recipient,marketing_status:'unknown',global_reason:null,provenance:'',blocked_senders:[],updated_at:null}}
}))
