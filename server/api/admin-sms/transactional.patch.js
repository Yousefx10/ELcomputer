import {createError} from 'h3'
import {requireAdminRequest} from '../../utils/adminRequest'
import {readSmsBody,smsHandler} from '../../utils/sms/admin'
import {smsChannelRpc,transactionalVariables} from '../../utils/sms/transactional'
export default defineEventHandler(smsHandler(async event=>{
 const {adminUser,supabaseAdmin}=await requireAdminRequest(event,{permission:'sms.settings.manage'}),b=await readSmsBody(event,8192)
 if(!Number.isInteger(b.revision)||typeof b.enabled!=='boolean'||!Array.isArray(b.bindings)||b.bindings.length>7)throw createError({statusCode:400,statusMessage:'Check notification settings.'})
 for(const item of b.bindings){if(!Object.hasOwn(transactionalVariables,item.event_type)||typeof item.is_enabled!=='boolean')throw createError({statusCode:400,statusMessage:'Choose a supported notification event.'});if(item.is_enabled){const r=await supabaseAdmin.from('sms_templates').select('variables').eq('id',item.template_id).maybeSingle();if(r.error||!r.data||r.data.variables.some(v=>!transactionalVariables[item.event_type].includes(v)))throw createError({statusCode:400,statusMessage:'Template placeholders do not match this event.'})}}
 return {settings:await smsChannelRpc(supabaseAdmin,'sms_configure_transactional',{p_actor:adminUser.id,p_revision:b.revision,p_enabled:b.enabled,p_bindings:b.bindings})}
}))
