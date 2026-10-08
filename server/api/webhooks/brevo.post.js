import { getHeader } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabaseAdmin.js'
import { emailHandler,emailFail,readEmailBody,emailRpc } from '../../utils/email/core.js'
import { getEmailSettings } from '../../utils/email/settings.js'
import { decryptCredentialSecret,credentialSecretsMatch } from '../../utils/credentialSecrets.js'
import { normalizeBrevoEvent } from '../../utils/email/events.js'
export default defineEventHandler(emailHandler(async event=>{
 const db=getSupabaseAdminClient(),settings=await getEmailSettings(db)
 if(!settings.config.webhook_enabled||!settings.webhook_token_encrypted)emailFail('Email webhook is inactive.',404)
 const expected='Bearer '+decryptCredentialSecret(settings.webhook_token_encrypted,'Email')
 if(!credentialSecretsMatch(getHeader(event,'authorization'),expected))emailFail('Email webhook authorization required.',401)
 const normalized=normalizeBrevoEvent(await readEmailBody(event,32768))
 if(normalized)await emailRpc(db,'event',{...normalized,config_revision:settings.revision})
 return {received:true}
}))
