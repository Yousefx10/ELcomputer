import { createError, getRouterParam } from 'h3'
import { requireAdminRequest } from '../../../utils/adminRequest'
import { recordAdminActivity } from '../../../utils/adminLogs'

export default defineEventHandler(async event => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'dashboard.orders' })
  const orderId = getRouterParam(event, 'id')
  const body = await readBody(event)
  const amount = Number(body?.amount)
  const reference = String(body?.reference || '').trim()
  if (!Number.isFinite(amount) || amount <= 0 || !/^\d+(\.\d{1,2})?$/.test(String(body?.amount)) || reference.length < 3 || reference.length > 120 || body?.verified !== true) {
    throw createError({ statusCode: 400, statusMessage: 'Confirm a verified payment amount and reference.' })
  }
  const { data: order, error } = await supabaseAdmin.rpc('commerce_record_preorder_payment', {
    p_order_id: orderId, p_admin_id: adminUser.id, p_amount: amount, p_reference: reference
  })
  if (error) throw createError({ statusCode: error.code === '23505' ? 409 : 400, statusMessage: error.message || 'Could not record payment.' })
  await recordAdminActivity({ supabaseAdmin, adminUser, actionKey: 'orders.preorder.payment_recorded',
    description: `Recorded verified preorder payment for ${order.order_number || orderId}.`,
    metadata: { order_id: orderId, payment_amount: amount, reference }
  })
  return { order }
})
