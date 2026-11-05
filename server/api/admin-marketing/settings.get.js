import {requireAdminRequest} from '../../utils/adminRequest'
import {metaHeaders,metaRpc} from '../../utils/metaTracking'
export default defineEventHandler(async event=>{metaHeaders(event);const {adminUser,supabaseAdmin}=await requireAdminRequest(event,{permission:'settings.view'});return {settings:await metaRpc(supabaseAdmin,'commerce_meta_settings',{p_actor:adminUser.id}),diagnostics:await metaRpc(supabaseAdmin,'commerce_meta_diagnostics',{p_actor:adminUser.id})}})
