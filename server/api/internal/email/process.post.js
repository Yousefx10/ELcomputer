import { getHeader } from 'h3'
import { getSupabaseAdminClient } from '../../../utils/supabaseAdmin.js'
import { credentialSecretsMatch } from '../../../utils/credentialSecrets.js'
import { emailHandler,emailFail,readEmailBody } from '../../../utils/email/core.js'
import { processEmailQueue } from '../../../utils/email/service.js'
export default defineEventHandler(emailHandler(async event=>{
 const authorize=()=>{
  const secret=String(useRuntimeConfig().emailWorkerSecret||'')
  if(secret.length<32||!credentialSecretsMatch(getHeader(event,'x-email-worker-secret'),secret))emailFail('Email worker authorization required.',401)
 }
 authorize()
 const b=await readEmailBody(event,1024)
 if(b.limit!==undefined&&(!Number.isInteger(b.limit)||b.limit<1||b.limit>3))emailFail('Invalid email worker limit.')
 return {results:await processEmailQueue(getSupabaseAdminClient(),{limit:b.limit||1,authorize})}
}))
