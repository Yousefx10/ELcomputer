import {getSupabaseAdminClient} from '../../utils/supabaseAdmin'
import {metaEnabled,metaHeaders,metaPrivacyAllowed,metaRpc,metaIdentity} from '../../utils/metaTracking'
export default defineEventHandler(async event=>{
 metaHeaders(event);if(!metaEnabled(useRuntimeConfig(event))||!metaPrivacyAllowed(event))return {enabled:false}
 try{const db=getSupabaseAdminClient(),identity=await metaIdentity(event,db);if(!identity.allowed)return {enabled:false};const s=await metaRpc(db,'commerce_meta_settings',{p_customer:identity.user});return {enabled:s.enabled===true,pixelId:s.enabled?s.pixelId:'',revision:s.revision,testExpiresAt:s.testExpiresAt,consentMode:s.testMode?'opt_in':s.consentMode}}catch{return {enabled:false}}
})
