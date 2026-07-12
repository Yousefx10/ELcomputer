import { createError, getRouterParam } from 'h3'
import { normalizeAdminOrderRecord, allowedAdminOrderStatuses } from '../../utils/adminOrders'
import { requireAdminRequest } from '../../utils/adminRequest'

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event, {
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

  return {
    order: normalizeAdminOrderRecord(updatedOrder)
  }
})
