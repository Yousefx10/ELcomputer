import {createError} from 'h3'
import {requireAdminRequest} from '../../utils/adminRequest'
import {readEmailBody} from '../../utils/email/core'
import {encryptCredentialSecret} from '../../utils/credentialSecrets'
import {metaHeaders,metaRpc,metaSameOrigin} from '../../utils/metaTracking'
export default defineEventHandler(async event=>{
 metaHeaders(event);metaSameOrigin(event);const {adminUser,supabaseAdmin}=await requireAdminRequest(event,{permission:'settings.edit'}),body=await readEmailBody(event,16384)
 if(Object.keys(body).some(k=>!['revision','config','token','clearToken'].includes(k))||!Number.isInteger(body.revision)||body.revision<0||!body.config||typeof body.config!=='object'||Array.isArray(body.config)||body.token!==undefined&&(typeof body.token!=='string'||body.token.length>4096)||body.clearToken!==undefined&&typeof body.clearToken!=='boolean')throw createError({statusCode:400,statusMessage:'Check tracking settings.'})
 if(body.token&&body.clearToken)throw createError({statusCode:400,statusMessage:'Choose whether to replace or remove the token.'})
 const encrypted=body.token?encryptCredentialSecret(body.token,'Meta Conversions API'):null
 return metaRpc(supabaseAdmin,'commerce_meta_configure',{p_actor:adminUser.id,p_revision:body.revision,p_config:body.config,p_token:encrypted,p_clear_token:body.clearToken===true})
})
