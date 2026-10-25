import { createError, getRouterParam } from 'h3'
import { requireAdminRequest } from '../../../utils/adminRequest'
import { recordAdminActivity } from '../../../utils/adminLogs'
import { assertBuiltInErpDomain } from '../../../utils/erpOwnership'

export default defineEventHandler(async event => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'dashboard.orders' })
  await assertBuiltInErpDomain(supabaseAdmin)
  const orderId = getRouterParam(event, 'id')
  const { data: order, error } = await supabaseAdmin.rpc('commerce_release_backorder', { p_order_id: orderId, p_admin_id: adminUser.id })
  if (error) throw createError({ statusCode: 409, statusMessage: 'Stock could not be assigned. Review this order.' })
  await recordAdminActivity({ supabaseAdmin, adminUser, actionKey: 'orders.backorder.released',
    description: `Assigned physical stock to order ${order.order_number || orderId}.`, metadata: { order_id: orderId } })
  return { order }
})
