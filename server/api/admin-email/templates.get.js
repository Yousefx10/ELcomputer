import { requireAdminRequest } from '../../utils/adminRequest.js'
import { hasAdminPermission } from '../../../app/utils/adminPermissions.js'
import { emailHandler,emailFail } from '../../utils/email/core.js'
export default defineEventHandler(emailHandler(async event=>{
 const {supabaseAdmin,adminUser}=await requireAdminRequest(event,{permission:'email.view'})
 const manage=hasAdminPermission(adminUser,'email.templates.view'),send=hasAdminPermission(adminUser,'email.transactional.send')
 if(!manage&&!send)emailFail('Email template permission denied.',403)
 let q=supabaseAdmin.from('email_templates').select('key,name,category,classification,subject_en,subject_ar,body_en,body_ar,sender,reply_to,is_enabled,version,updated_at').order('key').limit(200)
 if(!manage)q=q.eq('classification','transactional').eq('is_enabled',true)
 const {data,error}=await q;if(error)emailFail('Email templates are unavailable.',503)
 return {templates:data}
}))
