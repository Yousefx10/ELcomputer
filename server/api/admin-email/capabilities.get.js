import { requireAdminRequest } from '../../utils/adminRequest.js'
import { emailHandler,emailFail } from '../../utils/email/core.js'
import { getEmailSettings,emailReadiness } from '../../utils/email/settings.js'
import { hasAdminPermission } from '../../../app/utils/adminPermissions.js'
export default defineEventHandler(emailHandler(async event=>{
 const {supabaseAdmin,adminUser}=await requireAdminRequest(event,{permission:'email.view'})
 const s=await getEmailSettings(supabaseAdmin)
 return {enabled:s.config.is_enabled&&emailReadiness(s).ready,senders:hasAdminPermission(adminUser,'email.transactional.send')||hasAdminPermission(adminUser,'email.templates.manage')?s.config.approved_senders.filter(x=>x.verified).map(x=>({email:x.email,name:x.name})):[],default_sender:s.config.transactional_sender}
}))
