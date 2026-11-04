import {requireAdminRequest} from '../../utils/adminRequest'
import {smsHandler} from '../../utils/sms/admin'
import {smsChannelRpc} from '../../utils/sms/transactional'
import {hasAdminPermission} from '../../../app/utils/adminPermissions'
import {unsubscribeKeys} from '../../utils/sms/marketing'
export default defineEventHandler(smsHandler(async event=>{
 const {adminUser,supabaseAdmin:db}=await requireAdminRequest(event,{permission:'sms.marketing.view'}),runtime=useRuntimeConfig(event)
 let unsubscribeReady=false;try{unsubscribeKeys(runtime);unsubscribeReady=true}catch{}
 const result={settings:await smsChannelRpc(db,'sms_marketing_settings',{p_actor:adminUser.id}),runtimeEnabled:[true,'true'].includes(runtime.smsMarketingEnabled),unsubscribeReady,templates:[],history:null}
 if(hasAdminPermission(adminUser,'sms.templates.view')){const r=await db.from('sms_templates').select('id,name,revision,traffic_type,is_enabled').eq('traffic_type','campaign').limit(200);if(!r.error)result.templates=r.data||[]}
 if(hasAdminPermission(adminUser,'sms.marketing.reports'))result.history=await smsChannelRpc(db,'sms_marketing_history',{p_actor:adminUser.id})
 return result
}))
