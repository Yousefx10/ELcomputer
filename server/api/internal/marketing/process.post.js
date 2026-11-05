import {createError,getHeader,setResponseStatus} from 'h3'
import {getSupabaseAdminClient} from '../../../utils/supabaseAdmin'
import {credentialSecretsMatch} from '../../../utils/credentialSecrets'
import {dispatchMetaEvent,metaEnabled,metaHeaders} from '../../../utils/metaTracking'
export default defineEventHandler(async event=>{
 metaHeaders(event);const runtime=useRuntimeConfig(event),secret=String(runtime.metaWorkerSecret||'')
 if(!metaEnabled(runtime)||![true,'true'].includes(runtime.metaDispatchEnabled)){setResponseStatus(event,404);return {state:'disabled'}}
 if(secret.length<32||!credentialSecretsMatch(getHeader(event,'authorization'),'Bearer '+secret))throw createError({statusCode:403,statusMessage:'Unavailable.'})
 return dispatchMetaEvent({db:getSupabaseAdminClient(),runtime})
})
