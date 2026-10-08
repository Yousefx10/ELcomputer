import { requireAdminRequest } from '../../utils/adminRequest.js'
import { emailHandler,readEmailBody,emailRpc } from '../../utils/email/core.js'
import { getEmailSettings,publicEmailSettings,validateEmailSettings } from '../../utils/email/settings.js'
export default defineEventHandler(emailHandler(async event=>{
 const {supabaseAdmin,adminUser}=await requireAdminRequest(event,{permission:'email.settings.manage'})
 const body=await readEmailBody(event,16384),current=await getEmailSettings(supabaseAdmin)
 return {settings:publicEmailSettings(await emailRpc(supabaseAdmin,'settings',validateEmailSettings(body,current),adminUser.id))}
}))
