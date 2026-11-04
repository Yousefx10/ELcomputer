import {requireAdminRequest} from '../../utils/adminRequest'
import {smsHandler} from '../../utils/sms/admin'
import {smsChannelRpc} from '../../utils/sms/transactional'
export default defineEventHandler(smsHandler(async event=>{const {adminUser,supabaseAdmin}=await requireAdminRequest(event,{permission:'sms.settings.view'});return {settings:await smsChannelRpc(supabaseAdmin,'sms_transactional_settings',{p_actor:adminUser.id}),runtimeEnabled:[true,'true'].includes(useRuntimeConfig(event).smsTransactionalEnabled)}}))
