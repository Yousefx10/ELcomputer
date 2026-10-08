import { getQuery } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest.js'
import { emailHandler,emailFail } from '../../utils/email/core.js'
export default defineEventHandler(emailHandler(async event=>{
 const {supabaseAdmin}=await requireAdminRequest(event,{permission:'email.history.view'})
 const id=getQuery(event).id;if(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id))emailFail('Choose an email history record.')
 const a=await supabaseAdmin.from('email_attempts').select('attempt_number,state,http_status,error_category,provider_message_id,started_at,finished_at').eq('message_id',id).order('attempt_number').limit(3)
 const e=await supabaseAdmin.from('email_events').select('event_type,event_at,received_at,provider_message_id').eq('message_id',id).order('event_at',{ascending:false}).limit(100)
 if(a.error||e.error)emailFail('Email events are unavailable.',503)
 return {attempts:a.data,events:e.data}
}))
