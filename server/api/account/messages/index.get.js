import { createError, getQuery } from 'h3'
import { requireCustomerRequest } from '../../../utils/customerRequest'

const MESSAGE_SELECT = [
  'id',
  'user_id',
  'order_id',
  'sender_admin_user_id',
  'sender_name',
  'subject',
  'body',
  'read_at',
  'created_at'
].join(', ')

const MISSING_MESSAGE_SCHEMA_CODES = new Set([
  '42P01',
  '42703',
  'PGRST202',
  'PGRST204',
  'PGRST205'
])

const normalizePositiveInteger = (value, fallback, maximum) => {
  const normalizedValue = Number.parseInt(String(value || ''), 10)

  if (!Number.isInteger(normalizedValue) || normalizedValue < 1) {
    return fallback
  }

  return Math.min(normalizedValue, maximum)
}

const throwMessageDatabaseError = (error) => {
  throw createError({
    statusCode: 500,
    statusMessage: MISSING_MESSAGE_SCHEMA_CODES.has(error?.code)
      ? 'Customer messages are not available yet.'
      : error?.message || 'Could not load customer messages.'
  })
}

export default defineEventHandler(async (event) => {
  const { authUser, supabaseAdmin } = await requireCustomerRequest(event)
  const query = getQuery(event)
  const page = normalizePositiveInteger(query.page, 1, 100000)
  const pageSize = normalizePositiveInteger(query.pageSize, 50, 100)
  const fromIndex = (page - 1) * pageSize
  const toIndex = fromIndex + pageSize - 1

  const [
    { data: messageRows, count: total, error: messagesError },
    { count: unreadCount, error: unreadCountError }
  ] = await Promise.all([
    supabaseAdmin
      .from('customer_order_messages')
      .select(MESSAGE_SELECT, {
        count: 'exact'
      })
      .eq('user_id', authUser.id)
      .order('created_at', {
        ascending: false
      })
      .order('id', {
        ascending: false
      })
      .range(fromIndex, toIndex),
    supabaseAdmin
      .from('customer_order_messages')
      .select('*', {
        count: 'exact',
        head: true
      })
      .eq('user_id', authUser.id)
      .is('read_at', null)
  ])

  if (messagesError) {
    throwMessageDatabaseError(messagesError)
  }

  if (unreadCountError) {
    throwMessageDatabaseError(unreadCountError)
  }

  const orderIds = [
    ...new Set(
      (messageRows || [])
        .map((message) => message.order_id)
        .filter(Boolean)
    )
  ]
  let orderNumberMap = new Map()

  if (orderIds.length) {
    const { data: orderRows, error: ordersError } = await supabaseAdmin
      .from('customer_orders')
      .select('id, order_number')
      .eq('user_id', authUser.id)
      .in('id', orderIds)

    if (ordersError) {
      throwMessageDatabaseError(ordersError)
    }

    orderNumberMap = new Map(
      (orderRows || []).map((order) => [
        String(order.id),
        order.order_number || null
      ])
    )
  }

  return {
    items: (messageRows || []).map((message) => ({
      ...message,
      order_number: orderNumberMap.get(String(message.order_id || '')) || null
    })),
    total: total || 0,
    unreadCount: unreadCount || 0,
    page,
    pageSize
  }
})
