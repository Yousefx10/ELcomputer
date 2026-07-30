import { createError, getRouterParam } from 'h3'
import { recordAdminActivity } from '../../utils/adminLogs'
import { normalizeAdminOrderRecord, allowedAdminOrderStatuses } from '../../utils/adminOrders'
import { requireAdminRequest } from '../../utils/adminRequest'
import {
  DEFAULT_PACKED_ORDER_STATUS,
  isMissingOrderPackingSchemaError,
  ORDER_PACKING_COMPLETED_STATE,
  ORDER_PACKING_SESSIONS_TABLE
} from '../../utils/orderPacking'

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

  const { data: activePackingSession, error: activePackingSessionError } = await supabaseAdmin
    .from(ORDER_PACKING_SESSIONS_TABLE)
    .select('id, processor_name')
    .eq('order_id', orderId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (
    activePackingSessionError
    && !isMissingOrderPackingSchemaError(activePackingSessionError)
  ) {
    throw createError({
      statusCode: 500,
      statusMessage: activePackingSessionError.message || 'Could not verify the active packing session.'
    })
  }

  if (activePackingSession) {
    throw createError({
      statusCode: 409,
      statusMessage: `Finish or release the active packing session${activePackingSession.processor_name ? ` owned by ${activePackingSession.processor_name}` : ''} before changing this order status.`
    })
  }

  if (nextStatus === DEFAULT_PACKED_ORDER_STATUS) {
    const { data: completedPackingSession, error: packingSessionError } = await supabaseAdmin
      .from(ORDER_PACKING_SESSIONS_TABLE)
      .select('id')
      .eq('order_id', orderId)
      .eq('status', ORDER_PACKING_COMPLETED_STATE)
      .limit(1)
      .maybeSingle()

    if (packingSessionError) {
      throw createError({
        statusCode: 500,
        statusMessage: isMissingOrderPackingSchemaError(packingSessionError)
          ? 'Run the latest order packing migration first, then try again.'
          : packingSessionError.message || 'Could not verify the completed packing session.'
      })
    }

    if (!completedPackingSession) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Ready to Deliver is only available after every order item has been confirmed in a completed packing session.'
      })
    }
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
