import {createError,getHeader} from 'h3'
import {getSupabaseAdminClient} from '../../../utils/supabaseAdmin'
import {credentialSecretsMatch} from '../../../utils/credentialSecrets'
import {metaHeaders,metaRpc} from '../../../utils/metaTracking'
export default defineEventHandler(async event=>{
 metaHeaders(event);const secret=String(useRuntimeConfig(event).metaWorkerSecret||'')
 if(secret.length<32||!credentialSecretsMatch(getHeader(event,'authorization'),'Bearer '+secret))throw createError({statusCode:403,statusMessage:'Unavailable.'})
 return metaRpc(getSupabaseAdminClient(),'commerce_meta_retention')
})
