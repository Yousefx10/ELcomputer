import { createError, getRouterParam } from 'h3'
import { completedOrderStatuses, openOrderStatuses } from '../../utils/adminOrders'
import { mapCustomerProfileRecord } from '../../utils/customerUsers'
import { requireAdminRequest } from '../../utils/adminRequest'

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'users.view'
  })

  const targetId = getRouterParam(event, 'id')

  if (!targetId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Customer user id is required.'
    })
  }

  const [
    { data: profileRecord, error: profileError },
    { count: totalOrders, error: totalOrdersError },
    { count: completedOrders, error: completedOrdersError },
    { count: openOrders, error: openOrdersError },
    { data: recentOrders, error: recentOrdersError }
  ] = await Promise.all([
    supabaseAdmin
      .from('customer_profiles')
      .select('*')
      .eq('id', targetId)
      .maybeSingle(),
    supabaseAdmin
      .from('customer_orders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', targetId),
    supabaseAdmin
      .from('customer_orders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', targetId)
      .in('status', completedOrderStatuses),
    supabaseAdmin
      .from('customer_orders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', targetId)
      .in('status', openOrderStatuses),
    supabaseAdmin
      .from('customer_orders')
      .select('id, order_number, status, total_amount, currency, created_at, updated_at')
      .eq('user_id', targetId)
      .order('created_at', { ascending: false })
      .limit(10)
  ])

  if (profileError) {
    throw createError({
      statusCode: 500,
      statusMessage: profileError.message
    })
  }

  if (!profileRecord) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Customer user not found.'
    })
  }

  if (totalOrdersError) {
    throw createError({
      statusCode: 500,
      statusMessage: totalOrdersError.message
    })
  }

  if (completedOrdersError) {
    throw createError({
      statusCode: 500,
      statusMessage: completedOrdersError.message
    })
  }

  if (openOrdersError) {
    throw createError({
      statusCode: 500,
      statusMessage: openOrdersError.message
    })
  }

  if (recentOrdersError) {
    throw createError({
      statusCode: 500,
      statusMessage: recentOrdersError.message
    })
  }

  return {
    item: mapCustomerProfileRecord(profileRecord),
    stats: {
      totalOrders: totalOrders || 0,
      completed: completedOrders || 0,
      open: openOrders || 0
    },
    recentOrders: (recentOrders || []).map((order) => ({
      ...order,
      total_amount: Number(order.total_amount || 0)
    }))
  }
})
