import { assertBuiltInErpDomain } from '../../../utils/erpOwnership'
import { createError, getRouterParam } from 'h3'
import { requireAdminRequest } from '../../../utils/adminRequest'
import { recordAdminActivity } from '../../../utils/adminLogs'

export default defineEventHandler(async event => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'dashboard.orders' })
  const orderId = getRouterParam(event, 'id')
  await assertBuiltInErpDomain(supabaseAdmin)
  const { data: order, error } = await supabaseAdmin.rpc('commerce_release_preorder', { p_order_id: orderId, p_admin_id: adminUser.id })
  if (error) throw createError({ statusCode: 409, statusMessage: error.message || 'Could not release this preorder.' })
  await recordAdminActivity({ supabaseAdmin, adminUser, actionKey: 'orders.preorder.released',
    description: `Released preorder ${order.order_number || orderId} after assigning physical stock.`,
    metadata: { order_id: orderId, order_number: order.order_number }
  })
  return { order }
})
