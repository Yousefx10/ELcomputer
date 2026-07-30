import { createError, readBody } from 'h3'
import { recordAdminActivity } from '../../../utils/adminLogs'
import { requireAdminRequest } from '../../../utils/adminRequest'
import {
  getAdminActiveOrderPackingSession,
  getOrderPackingDetail,
  getOrderPackingSessionsForOrders,
  getPackingSessionAdminId,
  getPackingSessionState,
  isOrderPackingUuid,
  ORDER_PACKING_ACTIVE_STATE,
  ORDER_PACKING_COMPLETED_STATE,
  ORDER_PACKING_ELIGIBLE_STATUSES,
  ORDER_PACKING_SESSIONS_TABLE,
  throwOrderPackingDatabaseError
} from '../../../utils/orderPacking'

const getAdminDisplayName = (adminUser = {}) => {
  return String(adminUser.full_name || adminUser.email || 'Admin').trim()
}

const createSessionConflict = ({
  message,
  session
}) => {
  return createError({
    statusCode: 409,
    statusMessage: message,
    data: {
      currentSessionId: session?.id || null,
      orderId: session?.order_id || null
    }
  })
}

const getOrderReference = (order = {}) => {
  return order.order_number || `Order #${String(order.id || '').slice(0, 8)}`
}

const loadSessionOrderReference = async (supabaseAdmin, session) => {
  if (!session?.order_id) {
    return 'another order'
  }

  const { data } = await supabaseAdmin
    .from('customer_orders')
    .select('id, order_number')
    .eq('id', session.order_id)
    .maybeSingle()

  return data ? getOrderReference(data) : 'another order'
}

const setOrderProcessing = async ({
  supabaseAdmin,
  order,
  createdSessionId = ''
}) => {
  if (order.status === 'processing') {
    return order
  }

  const { data: updatedOrder, error } = await supabaseAdmin
    .from('customer_orders')
    .update({
      status: 'processing',
      updated_at: new Date().toISOString()
    })
    .eq('id', order.id)
    .eq('status', order.status)
    .select('*')
    .maybeSingle()

  if (error) {
    if (createdSessionId) {
      await supabaseAdmin
        .from(ORDER_PACKING_SESSIONS_TABLE)
        .delete()
        .eq('id', createdSessionId)
        .eq('status', ORDER_PACKING_ACTIVE_STATE)
    }

    throwOrderPackingDatabaseError(error, 'Could not start processing this order.')
  }

  if (!updatedOrder) {
    if (createdSessionId) {
      await supabaseAdmin
        .from(ORDER_PACKING_SESSIONS_TABLE)
        .delete()
        .eq('id', createdSessionId)
        .eq('status', ORDER_PACKING_ACTIVE_STATE)
    }

    throw createError({
      statusCode: 409,
      statusMessage: 'The order status changed while it was being claimed. Refresh and try again.'
    })
  }

  return updatedOrder
}

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'dashboard.orders'
  })
  const body = await readBody(event)
  const orderId = String(body?.orderId || body?.order_id || '').trim()

  if (!isOrderPackingUuid(orderId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid order is required.'
    })
  }

  const currentAdminSession = await getAdminActiveOrderPackingSession(
    supabaseAdmin,
    adminUser.id
  )

  const { data: order, error: orderError } = await supabaseAdmin
    .from('customer_orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle()

  if (orderError) {
    throw createError({
      statusCode: 500,
      statusMessage: orderError.message || 'Could not load this order.'
    })
  }

  if (!order) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Order not found.'
    })
  }

  const orderSessions = await getOrderPackingSessionsForOrders(
    supabaseAdmin,
    [orderId]
  )
  const completedOrderSession = orderSessions.find(
    (session) => getPackingSessionState(session) === ORDER_PACKING_COMPLETED_STATE
  )

  if (completedOrderSession) {
    throw createSessionConflict({
      message: `Order ${getOrderReference(order)} has already been confirmed and packed.`,
      session: completedOrderSession
    })
  }

  if (
    currentAdminSession
    && String(currentAdminSession.order_id) !== orderId
  ) {
    const activeOrderReference = await loadSessionOrderReference(
      supabaseAdmin,
      currentAdminSession
    )

    throw createSessionConflict({
      message: `Finish or resume ${activeOrderReference} before claiming another order.`,
      session: currentAdminSession
    })
  }

  if (!ORDER_PACKING_ELIGIBLE_STATUSES.includes(order.status)) {
    throw createError({
      statusCode: 409,
      statusMessage: `Order ${getOrderReference(order)} is no longer awaiting confirmation.`
    })
  }

  const activeOrderSession = orderSessions.find(
    (session) => getPackingSessionState(session) === ORDER_PACKING_ACTIVE_STATE
  )

  if (
    activeOrderSession
    && getPackingSessionAdminId(activeOrderSession) !== String(adminUser.id)
  ) {
    throw createSessionConflict({
      message: `Order ${getOrderReference(order)} is already being processed by ${activeOrderSession.processor_name || activeOrderSession.processor_email || 'another admin'}.`,
      session: activeOrderSession
    })
  }

  let session = currentAdminSession || activeOrderSession || null
  let resumed = Boolean(session)

  if (!session) {
    const now = new Date().toISOString()
    const { data: createdSession, error: sessionError } = await supabaseAdmin
      .from(ORDER_PACKING_SESSIONS_TABLE)
      .insert({
        order_id: orderId,
        admin_user_id: adminUser.id,
        processor_name: getAdminDisplayName(adminUser),
        processor_email: String(adminUser.email || '').trim().toLowerCase() || null,
        status: ORDER_PACKING_ACTIVE_STATE,
        started_at: now,
        updated_at: now
      })
      .select('*')
      .single()

    if (sessionError) {
      if (sessionError.code === '23505') {
        const [
          concurrentAdminSession,
          concurrentOrderSessions
        ] = await Promise.all([
          getAdminActiveOrderPackingSession(supabaseAdmin, adminUser.id),
          getOrderPackingSessionsForOrders(supabaseAdmin, [orderId])
        ])
        const concurrentCompletedSession = concurrentOrderSessions.find(
          (candidate) => (
            getPackingSessionState(candidate) === ORDER_PACKING_COMPLETED_STATE
          )
        )
        const concurrentOrderSession = concurrentOrderSessions.find(
          (candidate) => (
            getPackingSessionState(candidate) === ORDER_PACKING_ACTIVE_STATE
          )
        ) || null

        if (concurrentCompletedSession) {
          throw createSessionConflict({
            message: `Order ${getOrderReference(order)} was already confirmed while you were claiming it.`,
            session: concurrentCompletedSession
          })
        } else if (
          concurrentAdminSession
          && String(concurrentAdminSession.order_id) === orderId
        ) {
          session = concurrentAdminSession
          resumed = true
        } else if (
          concurrentOrderSession
          && getPackingSessionAdminId(concurrentOrderSession) === String(adminUser.id)
        ) {
          session = concurrentOrderSession
          resumed = true
        } else {
          throw createSessionConflict({
            message: concurrentAdminSession
              ? `Finish or resume your current packing session before claiming ${getOrderReference(order)}.`
              : `Order ${getOrderReference(order)} was just claimed by another admin.`,
            session: concurrentAdminSession || concurrentOrderSession
          })
        }
      } else {
        throwOrderPackingDatabaseError(
          sessionError,
          'Could not claim this order for packing.'
        )
      }
    } else {
      session = createdSession
    }
  }

  if (!session) {
    throw createError({
      statusCode: 500,
      statusMessage: 'The order claim did not return a packing session.'
    })
  }

  await setOrderProcessing({
    supabaseAdmin,
    order,
    createdSessionId: resumed ? '' : session.id
  })

  await recordAdminActivity({
    supabaseAdmin,
    adminUser,
    actionKey: resumed ? 'orders.packing.resume' : 'orders.packing.start',
    description: resumed
      ? `Resumed packing order ${getOrderReference(order)}.`
      : `Started packing order ${getOrderReference(order)}.`,
    metadata: {
      order_id: orderId,
      order_number: order.order_number || null,
      packing_session_id: session.id,
      processor_admin_user_id: adminUser.id,
      resumed
    }
  })

  const detail = await getOrderPackingDetail({
    supabaseAdmin,
    sessionId: session.id,
    session
  })

  return {
    session: detail.session,
    sessionId: detail.session.id,
    resumed,
    detail
  }
})
