import { createError, getRouterParam, readBody } from 'h3'
import { recordAdminActivity } from '../../../../utils/adminLogs'
import { requireAdminRequest } from '../../../../utils/adminRequest'
import {
  CUSTOMER_MESSAGES_TABLE,
  DEFAULT_PACKED_ORDER_STATUS,
  getOrderPackingDetail,
  getOrderPackingSession,
  getPackingSessionAdminId,
  getPackingSessionState,
  isOrderPackingUuid,
  ORDER_PACKING_ACTIVE_STATE,
  ORDER_PACKING_COMPLETED_STATE,
  throwOrderPackingDatabaseError
} from '../../../../utils/orderPacking'

const ALLOWED_COMPLETION_STATUSES = new Set([
  DEFAULT_PACKED_ORDER_STATUS,
  'being_shipped',
  'out_for_delivery',
  'on_hold'
])

const getRpcResult = (data) => {
  if (Array.isArray(data)) {
    return data[0] || {}
  }

  return data && typeof data === 'object' ? data : {}
}

const getOrderReference = (order = {}) => {
  return order.order_number || `Order #${String(order.id || '').slice(0, 8)}`
}

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'dashboard.orders'
  })
  const sessionId = String(
    getRouterParam(event, 'sessionId') || ''
  ).trim()

  if (!isOrderPackingUuid(sessionId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid packing session is required.'
    })
  }

  const body = await readBody(event)
  const nextStatus = String(
    body?.status || body?.nextStatus || DEFAULT_PACKED_ORDER_STATUS
  ).trim().toLowerCase()
  const messageBody = String(body?.message || '').trim()

  if (!ALLOWED_COMPLETION_STATUSES.has(nextStatus)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid completed order status is required.'
    })
  }

  if (messageBody.length > 2000) {
    throw createError({
      statusCode: 400,
      statusMessage: 'The purchaser message must be 2,000 characters or fewer.'
    })
  }

  const session = await getOrderPackingSession(supabaseAdmin, sessionId)
  const sessionAdminId = getPackingSessionAdminId(session)
  const sessionState = getPackingSessionState(session)

  if (sessionAdminId !== String(adminUser.id)) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Only the admin who claimed this order can complete it.'
    })
  }

  if (
    sessionState !== ORDER_PACKING_ACTIVE_STATE
    && sessionState !== ORDER_PACKING_COMPLETED_STATE
  ) {
    throw createError({
      statusCode: 409,
      statusMessage: 'This packing session is no longer active.'
    })
  }

  const detailBeforeCompletion = await getOrderPackingDetail({
    supabaseAdmin,
    sessionId,
    session
  })

  if (sessionState === ORDER_PACKING_ACTIVE_STATE) {
    if (!detailBeforeCompletion.items.length) {
      throw createError({
        statusCode: 409,
        statusMessage: 'This order has no items to confirm.'
      })
    }

    if (!detailBeforeCompletion.progress.is_complete) {
      throw createError({
        statusCode: 409,
        statusMessage: `Scan all requested items before completing this order. ${detailBeforeCompletion.progress.remaining} remaining.`
      })
    }

    if (messageBody && !detailBeforeCompletion.order.user_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'This purchaser does not have a linked account inbox.'
      })
    }
  }

  const senderName = String(
    adminUser.full_name || adminUser.email || 'ELcomputer Team'
  ).trim().slice(0, 160)
  const orderReference = getOrderReference(detailBeforeCompletion.order)
  const messageSubject = messageBody
    ? `${orderReference} update`.slice(0, 200)
    : null
  const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
    'complete_order_packing_session',
    {
      p_session_id: sessionId,
      p_admin_user_id: adminUser.id,
      p_next_order_status: nextStatus,
      p_message_subject: messageSubject,
      p_message_body: messageBody || null,
      p_sender_name: senderName
    }
  )

  if (rpcError) {
    throwOrderPackingDatabaseError(
      rpcError,
      'Could not complete this packing session.'
    )
  }

  const rpcResult = getRpcResult(rpcData)
  const completedOrderId = rpcResult.order_id
    || rpcResult.orderId
    || detailBeforeCompletion.order.id
  const messageId = rpcResult.message_id || rpcResult.messageId || null
  let message = null

  if (messageId) {
    const { data: messageRecord, error: messageError } = await supabaseAdmin
      .from(CUSTOMER_MESSAGES_TABLE)
      .select('*')
      .eq('id', messageId)
      .maybeSingle()

    if (messageError) {
      throwOrderPackingDatabaseError(
        messageError,
        'The order was completed, but its purchaser message could not be loaded.'
      )
    }

    message = messageRecord || null
  }

  const serializedUnitCount = detailBeforeCompletion.items.reduce(
    (sum, item) => sum + (item.serialized_units?.length || 0),
    0
  )

  if (!rpcResult.already_completed) {
    await recordAdminActivity({
      supabaseAdmin,
      adminUser,
      actionKey: 'orders.packing.complete',
      description: `Completed packing order ${orderReference} with ${detailBeforeCompletion.progress.scanned_quantity} confirmed items.`,
      metadata: {
        order_id: completedOrderId,
        order_number: detailBeforeCompletion.order.order_number || null,
        packing_session_id: sessionId,
        processor_admin_user_id: adminUser.id,
        processor_name: senderName,
        order_line_count: detailBeforeCompletion.items.length,
        required_quantity: detailBeforeCompletion.progress.total_quantity,
        scanned_quantity: detailBeforeCompletion.progress.scanned_quantity,
        serialized_unit_count: serializedUnitCount,
        next_status: nextStatus,
        customer_message_id: messageId
      }
    })
  }

  const detail = await getOrderPackingDetail({
    supabaseAdmin,
    sessionId
  })

  return {
    detail,
    result: rpcResult,
    orderId: completedOrderId,
    messageId,
    message
  }
})
