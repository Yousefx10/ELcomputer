import { requireAdminRequest } from '../../utils/adminRequest.js'
import { emailHandler,readEmailBody } from '../../utils/email/core.js'
import { previewManualEmail } from '../../utils/email/service.js'
export default defineEventHandler(emailHandler(async event=>{
 const {supabaseAdmin,adminUser}=await requireAdminRequest(event,{permission:'email.transactional.send'})
 const body=await readEmailBody(event);delete body.business_reference;body.priority=0
 return previewManualEmail(supabaseAdmin,body,adminUser.id)
}))
