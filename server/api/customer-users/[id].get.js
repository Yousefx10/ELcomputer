import { createError, getRouterParam } from 'h3'
import { mapCustomerProfileRecord } from '../../utils/customerUsers'
import { requireAdminRequest } from '../../utils/adminRequest'

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event, {
    role: 'owner'
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
    { count: deliveredOrders, error: deliveredOrdersError },
    { count: inProgressOrders, error: inProgressOrdersError },
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
      .eq('status', 'delivered'),
    supabaseAdmin
      .from('customer_orders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', targetId)
      .eq('status', 'in_progress'),
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

  if (deliveredOrdersError) {
    throw createError({
      statusCode: 500,
      statusMessage: deliveredOrdersError.message
    })
  }

  if (inProgressOrdersError) {
    throw createError({
      statusCode: 500,
      statusMessage: inProgressOrdersError.message
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
      delivered: deliveredOrders || 0,
      inProgress: inProgressOrders || 0
    },
    recentOrders: (recentOrders || []).map((order) => ({
      ...order,
      total_amount: Number(order.total_amount || 0)
    }))
  }
})
