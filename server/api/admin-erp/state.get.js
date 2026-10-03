import { requireAdminRequest } from '../../utils/adminRequest'
import { getErpSettings } from '../../utils/erpOwnership'
export default defineEventHandler(async event => {
  const {supabaseAdmin}=await requireAdminRequest(event)
  const settings=await getErpSettings(supabaseAdmin)
  return {mode:settings.erp_mode,stateVersion:settings.erp_state_version}
})
