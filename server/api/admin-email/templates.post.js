import { requireAdminRequest } from '../../utils/adminRequest.js'
import { emailHandler,readEmailBody,emailRpc } from '../../utils/email/core.js'
import { validateEmailTemplate } from '../../utils/email/templates.js'
import { getEmailSettings } from '../../utils/email/settings.js'
export default defineEventHandler(emailHandler(async event=>{
 const {supabaseAdmin,adminUser}=await requireAdminRequest(event,{permission:'email.templates.manage'})
 const template=validateEmailTemplate(await readEmailBody(event,65536)),settings=await getEmailSettings(supabaseAdmin)
 if(template.sender&&!settings.config.approved_senders.some(x=>x.email===template.sender))throw Object.assign(Error('Choose an approved sender.'),{statusCode:400,statusMessage:'Choose an approved sender.'})
 return {template:await emailRpc(supabaseAdmin,'template',template,adminUser.id)}
}))
