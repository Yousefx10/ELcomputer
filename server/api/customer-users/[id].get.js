import { createError, getRouterParam } from 'h3'
import { openOrderStatuses } from '../../utils/adminOrders'
import {
  calculateCustomerAcceptance,
  customerAcceptanceResolvedStatuses,
  mapCustomerProfileRecord
} from '../../utils/customerUsers'
import { requireAdminRequest } from '../../utils/adminRequest'

const ANALYTICS_SCHEMA_ERROR_CODES = new Set([
  '42P01',
  '42703',
  'PGRST202',
  'PGRST204',
  'PGRST205'
])

const createEmptyCustomerBehavior = (available = true) => ({
  available,
  visits: 0,
  returningVisits: 0,
  productViews: 0,
  totalProductDwellSeconds: 0,
  averageProductDwellSeconds: 0,
  addToCartEvents: 0,
  checkoutStarts: 0,
  lastSeenAt: null,
  products: []
})

const isMissingAnalyticsSchemaError = (error) => {
  return ANALYTICS_SCHEMA_ERROR_CODES.has(error?.code)
}

const loadCustomerBehavior = async (supabaseAdmin, customerId) => {
  const { data, error } = await supabaseAdmin.rpc(
    'store_analytics_get_customer_behavior',
    {
      p_user_id: customerId
    }
  )

  if (isMissingAnalyticsSchemaError(error) || error?.code === '42883') {
    return createEmptyCustomerBehavior(false)
  }

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Customer behavior data is unavailable.'
    })
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return createEmptyCustomerBehavior()
  }

  return {
    available: data.available !== false,
    visits: Math.max(0, Number(data.visits || 0)),
    returningVisits: Math.max(0, Number(data.returningVisits || 0)),
    productViews: Math.max(0, Number(data.productViews || 0)),
    totalProductDwellSeconds: Math.max(
      0,
      Number(data.totalProductDwellSeconds || 0)
    ),
    averageProductDwellSeconds: Math.max(
      0,
      Number(data.averageProductDwellSeconds || 0)
    ),
    addToCartEvents: Math.max(0, Number(data.addToCartEvents || 0)),
    checkoutStarts: Math.max(0, Number(data.checkoutStarts || 0)),
    lastSeenAt: data.lastSeenAt || null,
    products: Array.isArray(data.products)
      ? data.products.slice(0, 5).map((product) => ({
          title: String(product?.title || 'Unavailable product'),
          slug: String(product?.slug || ''),
          viewCount: Math.max(0, Number(product?.viewCount || 0)),
          dwellSeconds: Math.max(0, Number(product?.dwellSeconds || 0)),
          lastViewedAt: product?.lastViewedAt || null
        }))
      : []
  }
}

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
    { data: resolvedOrderRecords, error: resolvedOrdersError },
    { count: openOrders, error: openOrdersError },
    { data: recentOrders, error: recentOrdersError }
  ] = await Promise.all([
    supabaseAdmin
      .from('customer_profiles')
      .select('*')
      .eq('id', targetId)
      .eq('is_internal', false)
      .maybeSingle(),
    supabaseAdmin
      .from('customer_orders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', targetId),
    supabaseAdmin
      .from('customer_orders')
      .select('status')
      .eq('user_id', targetId)
      .in('status', customerAcceptanceResolvedStatuses),
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

  if (resolvedOrdersError) {
    throw createError({
      statusCode: 500,
      statusMessage: resolvedOrdersError.message
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

  const acceptance = calculateCustomerAcceptance(resolvedOrderRecords || [])
  const behavior = await loadCustomerBehavior(supabaseAdmin, targetId)

  return {
    item: {
      ...mapCustomerProfileRecord(profileRecord),
      acceptance
    },
    acceptance,
    behavior,
    stats: {
      totalOrders: totalOrders || 0,
      completed: acceptance.acceptedOrders,
      open: openOrders || 0
    },
    recentOrders: (recentOrders || []).map((order) => ({
      ...order,
      total_amount: Number(order.total_amount || 0)
    }))
  }
})
