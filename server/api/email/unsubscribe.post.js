import { getSupabaseAdminClient } from '../../utils/supabaseAdmin.js'
import { emailHandler,emailFail,readEmailBody,emailRpc } from '../../utils/email/core.js'
import { emailDigest } from '../../utils/email/service.js'
export default defineEventHandler(emailHandler(async event=>{
 const b=await readEmailBody(event,1024)
 if(typeof b.token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(b.token)||Object.keys(b).some(k=>k!=='token'))emailFail('This unsubscribe link is unavailable.',404)
 const result=await emailRpc(getSupabaseAdminClient(),'unsubscribe',{token_hash:emailDigest(b.token)})
 if(!result.matched)emailFail('This unsubscribe link is unavailable.',404)
 return {unsubscribed:true}
}))
