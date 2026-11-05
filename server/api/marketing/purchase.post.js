import {createError} from 'h3'
import {requireCustomerRequest} from '../../utils/customerRequest'
import {readEmailBody} from '../../utils/email/core'
import {metaConsentHash,metaEnabled,metaHeaders,metaPrivacyAllowed,metaRpc,metaSameOrigin} from '../../utils/metaTracking'
export default defineEventHandler(async event=>{
 metaHeaders(event);metaSameOrigin(event);if(!metaEnabled(useRuntimeConfig(event))||!metaPrivacyAllowed(event)||!metaConsentHash(event))return {event:null}
 const {authUser,supabaseAdmin}=await requireCustomerRequest(event),body=await readEmailBody(event,1024)
 if(Object.keys(body).some(k=>k!=='orderId')||!/^[a-f0-9-]{36}$/i.test(body.orderId||''))throw createError({statusCode:400,statusMessage:'Order unavailable.'})
 return {event:await metaRpc(supabaseAdmin,'commerce_meta_purchase',{p_user:authUser.id,p_order:body.orderId,p_hash:metaConsentHash(event)})}
})
