import { requireAdminRequest } from '../../utils/adminRequest.js'
import { emailHandler } from '../../utils/email/core.js'
import { getEmailSettings,publicEmailSettings } from '../../utils/email/settings.js'
export default defineEventHandler(emailHandler(async event=>{
 const {supabaseAdmin}=await requireAdminRequest(event,{permission:'email.settings.view'})
 return {settings:publicEmailSettings(await getEmailSettings(supabaseAdmin))}
}))
