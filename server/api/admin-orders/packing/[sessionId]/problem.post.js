import { createError, getRouterParam, readBody } from 'h3'
import { recordAdminActivity } from '../../../../utils/adminLogs'
import { requireAdminRequest } from '../../../../utils/adminRequest'
import {
  CUSTOMER_MESSAGES_TABLE,
  getOrderPackingDetail,
  getOrderPackingSession,
  getPackingSessionAdminId,
  isOrderPackingUuid,
  throwOrderPackingDatabaseError
} from '../../../../utils/orderPacking'

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
  const sessionId = String(getRouterParam(event, 'sessionId') || '').trim()

  if (!isOrderPackingUuid(sessionId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid packing session is required.'
    })
  }

  const body = await readBody(event)
  const messageBody = String(body?.message || body?.body || '').trim()
  const subject = String(body?.subject || '').trim()

  if (!messageBody) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Explain the order problem before contacting the purchaser.'
    })
  }

  if (messageBody.length > 2000) {
    throw createError({
      statusCode: 400,
      statusMessage: 'The purchaser message must be 2,000 characters or fewer.'
    })
  }

  if (subject.length > 200) {
    throw createError({
      statusCode: 400,
      statusMessage: 'The problem subject must be 200 characters or fewer.'
    })
  }

  const session = await getOrderPackingSession(supabaseAdmin, sessionId)

  if (getPackingSessionAdminId(session) !== String(adminUser.id)) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Only the admin who claimed this order can report its problem.'
    })
  }

  const detail = await getOrderPackingDetail({
    supabaseAdmin,
    sessionId,
    session
  })
  const orderReference = getOrderReference(detail.order)
  const resolvedSubject = subject || `${orderReference} needs your response`
  const senderName = String(
    adminUser.full_name || adminUser.email || 'ELcomputer Team'
  ).trim().slice(0, 160)
  const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
    'report_order_packing_problem',
    {
      p_session_id: sessionId,
      p_admin_user_id: adminUser.id,
      p_subject: resolvedSubject,
      p_body: messageBody,
      p_sender_name: senderName
    }
  )

  if (rpcError) {
    throwOrderPackingDatabaseError(
      rpcError,
      'Could not place this order on hold.'
    )
  }

  const result = getRpcResult(rpcData)
  const messageId = result.message_id || result.messageId
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
        'The order was placed on hold, but its message could not be reloaded.'
      )
    }

    message = messageRecord || null
  }

  if (!result.already_reported) {
    await recordAdminActivity({
      supabaseAdmin,
      adminUser,
      actionKey: 'orders.packing.problem',
      description: `Placed ${orderReference} on hold and requested a purchaser response.`,
      metadata: {
        order_id: detail.order.id,
        order_number: detail.order.order_number || null,
        packing_session_id: sessionId,
        processor_admin_user_id: adminUser.id,
        customer_message_id: messageId || null,
        next_status: result.order_status || 'on_hold'
      }
    })
  }

  return {
    orderId: result.order_id || detail.order.id,
    orderStatus: result.order_status || 'on_hold',
    sessionStatus: result.session_status || 'cancelled',
    messageId: messageId || null,
    message,
    result
  }
})
