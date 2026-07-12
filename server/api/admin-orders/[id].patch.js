import { createError, getRouterParam } from 'h3'
import { recordAdminActivity } from '../../utils/adminLogs'
import { normalizeAdminOrderRecord, allowedAdminOrderStatuses } from '../../utils/adminOrders'
import { requireAdminRequest } from '../../utils/adminRequest'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'dashboard.orders'
  })
  const orderId = getRouterParam(event, 'id')

  if (!orderId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Order id is required.'
    })
  }

  const body = await readBody(event)
  const nextStatus = String(body?.status || '').trim()

  if (!allowedAdminOrderStatuses.includes(nextStatus)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid order status is required.'
    })
  }

  const { data: existingOrder, error: existingOrderError } = await supabaseAdmin
    .from('customer_orders')
    .select('id, order_number, status')
    .eq('id', orderId)
    .maybeSingle()

  if (existingOrderError) {
    throw createError({
      statusCode: 500,
      statusMessage: existingOrderError.message
    })
  }

  if (!existingOrder) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Order not found.'
    })
  }

  const { data: updatedOrder, error } = await supabaseAdmin
    .from('customer_orders')
    .update({
      status: nextStatus,
      updated_at: new Date().toISOString()
    })
    .eq('id', orderId)
    .select('*')
    .single()

  if (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error.message
    })
  }

  await recordAdminActivity({
    supabaseAdmin,
    adminUser,
    actionKey: 'orders.status.update',
    description: `Changed order ${existingOrder.order_number || orderId.slice(0, 8)} status from ${existingOrder.status} to ${nextStatus}.`,
    metadata: {
      order_id: orderId,
      order_number: existingOrder.order_number || null,
      previous_status: existingOrder.status,
      next_status: nextStatus
    }
  })

  return {
    order: normalizeAdminOrderRecord(updatedOrder)
  }
})
