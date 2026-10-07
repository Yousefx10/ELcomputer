import { requireAdminRequest } from '../../utils/adminRequest'
import { afterSalesHandler, afterSalesRpc, readAfterSalesBody, validateAfterSalesReason } from '../../utils/afterSalesPolicy.js'
export default defineEventHandler(afterSalesHandler(async event => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'settings.edit' })
  const reason = validateAfterSalesReason(await readAfterSalesBody(event))
  return { reason: await afterSalesRpc(supabaseAdmin, 'after_sales_save_reason', { p_admin_id: adminUser.id, p_reason: reason }) }
}))
