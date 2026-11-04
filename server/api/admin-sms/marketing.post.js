import {createError} from 'h3'
import {requireAdminRequest} from '../../utils/adminRequest'
import {hasAdminPermission} from '../../../app/utils/adminPermissions'
import {smsHandler,readSmsBody} from '../../utils/sms/admin'
import {smsChannelRpc} from '../../utils/sms/transactional'
import {marketingPermissions,normalizeMarketingContacts,buildMarketingPlan,validateMarketingDraft} from '../../utils/sms/marketing'
import {normalizeSmsPhone} from '../../../app/utils/sms'
export default defineEventHandler(smsHandler(async event=>{
 const {adminUser,supabaseAdmin:db}=await requireAdminRequest(event,{permission:'sms.marketing.view'}),body=await readSmsBody(event,262144),permission=marketingPermissions[body.action]
 if(!permission||!hasAdminPermission(adminUser,permission))throw createError({statusCode:403,statusMessage:'You do not have permission for this action.'})
 const rpc=(name,args)=>smsChannelRpc(db,name,{p_actor:adminUser.id,...args})
 if(body.action==='settings')return rpc('sms_marketing_configure',{p_revision:body.revision,p_settings:body.settings})
 if(body.action==='import')return rpc('sms_marketing_import',{p_contacts:normalizeMarketingContacts(body.contacts)})
 if(body.action==='suppress'){let phone;try{phone=normalizeSmsPhone(body.phone)}catch{throw createError({statusCode:400,statusMessage:'Invalid phone number.'})};return rpc('sms_marketing_suppress',{p_phone:phone,p_reason:body.reason})}
 if(body.action==='draft')return rpc('sms_campaign_save',{p_id:body.id||null,p_revision:body.revision||0,p_draft:validateMarketingDraft(body.draft)})
 if(['preview','prepare'].includes(body.action)){
  const source=await rpc('sms_campaign_preview_source',{p_id:body.id}),plan=buildMarketingPlan(source,useRuntimeConfig(event))
  if(body.revision!==source.campaign.revision)throw createError({statusCode:409,statusMessage:'Campaign changed. Reload.'})
  if(body.action==='preview')return {preview:plan.summary}
  return {campaign:await rpc('sms_campaign_prepare',{p_id:body.id,p_revision:body.revision,p_rows:plan.rows}),preview:plan.summary}
 }
 return rpc('sms_campaign_control',{p_id:body.id,p_revision:body.revision,p_action:body.action,p_confirmation:body.confirmation||''})
}))
