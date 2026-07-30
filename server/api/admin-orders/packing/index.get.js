import { createError, getQuery } from 'h3'
import { normalizeAdminOrderRecord } from '../../../utils/adminOrders'
import { requireAdminRequest } from '../../../utils/adminRequest'
import {
  getAdminActiveOrderPackingSession,
  getOrderPackingSessionsForOrders,
  getPackingSessionAdminId,
  getPackingSessionState,
  CUSTOMER_MESSAGES_TABLE,
  ORDER_PACKING_ACTIVE_STATE,
  ORDER_PACKING_ELIGIBLE_STATUSES
} from '../../../utils/orderPacking'

const normalizePage = (value) => {
  const page = Number.parseInt(value, 10)
  return Number.isInteger(page) && page > 0 ? page : 1
}

const normalizePageSize = (value) => {
  const pageSize = Number.parseInt(value, 10)

  if (!Number.isInteger(pageSize) || pageSize < 1) {
    return 20
  }

  return Math.min(pageSize, 50)
}

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'dashboard.orders'
  })
  const query = getQuery(event)
  const page = normalizePage(query.page)
  const pageSize = normalizePageSize(query.pageSize || query.page_size)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const currentAdminSession = await getAdminActiveOrderPackingSession(
    supabaseAdmin,
    adminUser.id
  )
  let ordersQuery = supabaseAdmin
    .from('customer_orders')
    .select('*', { count: 'exact' })
    .in('status', ORDER_PACKING_ELIGIBLE_STATUSES)
    .is('packing_completed_at', null)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })

  const { data: orderRows, count, error: ordersError } = await ordersQuery
    .range(from, to)

  if (ordersError) {
    throw createError({
      statusCode: 500,
      statusMessage: ordersError.message || 'Could not load orders awaiting confirmation.'
    })
  }

  const pagedOrders = orderRows || []
  const orderIds = pagedOrders.map((order) => order.id)
  const orderSessions = await getOrderPackingSessionsForOrders(
    supabaseAdmin,
    orderIds,
    [ORDER_PACKING_ACTIVE_STATE]
  )
  const activeSessions = orderSessions.filter((session) => {
    return getPackingSessionState(session) === ORDER_PACKING_ACTIVE_STATE
  })
  const sessionsByOrderId = new Map()

  for (const session of activeSessions) {
    if (!sessionsByOrderId.has(String(session.order_id))) {
      sessionsByOrderId.set(String(session.order_id), session)
    }
  }

  const processorIds = [
    ...new Set(activeSessions.map(getPackingSessionAdminId).filter(Boolean))
  ]

  const [
    processorsResult,
    orderItemsResult,
    messagesResult
  ] = await Promise.all([
    processorIds.length
      ? supabaseAdmin
          .from('admin_users')
          .select('id, full_name, email, role')
          .in('id', processorIds)
      : Promise.resolve({ data: [], error: null }),
    orderIds.length
      ? supabaseAdmin
          .from('customer_order_items')
          .select('id, order_id, quantity')
          .in('order_id', orderIds)
      : Promise.resolve({ data: [], error: null }),
    orderIds.length
      ? supabaseAdmin
          .from(CUSTOMER_MESSAGES_TABLE)
          .select('*')
          .in('order_id', orderIds)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [], error: null })
  ])

  const relatedError = processorsResult.error
    || orderItemsResult.error
    || messagesResult.error

  if (relatedError) {
    throw createError({
      statusCode: 500,
      statusMessage: relatedError.message || 'Could not load order packing information.'
    })
  }

  const processorMap = new Map(
    (processorsResult.data || []).map((processor) => [
      String(processor.id),
      processor
    ])
  )
  const itemStatsByOrderId = new Map()
  const latestMessageByOrderId = new Map()

  for (const item of orderItemsResult.data || []) {
    const orderId = String(item.order_id)
    const stats = itemStatsByOrderId.get(orderId) || {
      item_count: 0,
      total_quantity: 0
    }

    stats.item_count += 1
    stats.total_quantity += Math.max(0, Number(item.quantity || 0))
    itemStatsByOrderId.set(orderId, stats)
  }

  for (const message of messagesResult.data || []) {
    const orderId = String(message.order_id || '')

    if (orderId && !latestMessageByOrderId.has(orderId)) {
      latestMessageByOrderId.set(orderId, message)
    }
  }

  const items = pagedOrders.map((order) => {
    const session = sessionsByOrderId.get(String(order.id)) || null
    const processorId = getPackingSessionAdminId(session)
    const processorRecord = processorMap.get(processorId) || null
    const isCurrentAdmin = Boolean(
      session && processorId === String(adminUser.id)
    )
    const processor = session
      ? {
          id: processorId || null,
          name: session.started_by_name
            || session.processor_name
            || processorRecord?.full_name
            || processorRecord?.email
            || 'Admin',
          email: session.started_by_email
            || session.processor_email
            || processorRecord?.email
            || null,
          role: processorRecord?.role || null
        }
      : null
    const currentSessionId = session?.id || null
    const latestMessage = latestMessageByOrderId.get(String(order.id)) || null
    const hasCustomerReply = latestMessage?.sender_type === 'customer'
    const activeSession = session
      ? {
          ...session,
          processor_name: processor?.name || 'Admin',
          processor_email: processor?.email || null,
          processor,
          can_resume: isCurrentAdmin,
          is_current_admin: isCurrentAdmin,
          isCurrentAdmin
        }
      : null

    return {
      ...normalizeAdminOrderRecord(order),
      ...(itemStatsByOrderId.get(String(order.id)) || {
        item_count: 0,
        total_quantity: 0
      }),
      currentSessionId,
      current_session_id: currentSessionId,
      isLocked: Boolean(session && !isCurrentAdmin),
      is_locked: Boolean(session && !isCurrentAdmin),
      isCurrentAdmin,
      is_current_admin: isCurrentAdmin,
      processor,
      latest_message: latestMessage,
      latestMessage,
      has_customer_reply: hasCustomerReply,
      hasCustomerReply,
      active_session: activeSession,
      activeSession,
      can_resume: isCurrentAdmin,
      lock: session
        ? {
            session_id: session.id,
            started_at: session.started_at || session.created_at || null,
            is_current_admin: isCurrentAdmin,
            processor
          }
        : null
    }
  })

  return {
    orders: items,
    items,
    currentSessionId: currentAdminSession?.id || null,
    current_session_id: currentAdminSession?.id || null,
    total: Math.max(0, Number(count || 0)),
    page,
    pageSize,
    pagination: {
      page,
      pageSize,
      total: Math.max(0, Number(count || 0)),
      totalPages: Math.max(
        1,
        Math.ceil(
          Math.max(0, Number(count || 0)) / pageSize
        )
      )
    }
  }
})
