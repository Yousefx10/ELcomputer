import { createError, setHeader } from 'h3'
import { hasAdminPermission } from '~/utils/adminPermissions'
import { activeCustomerOrderStatuses } from '~/utils/orderStatus'
import { requireAdminRequest } from '../../utils/adminRequest'

const emptyCountResult = () => Promise.resolve({ count: 0, error: null })

const startOfTodayInRiyadh = () => {
  const riyadhOffsetMilliseconds = 3 * 60 * 60 * 1000
  const riyadhNow = new Date(Date.now() + riyadhOffsetMilliseconds)
  riyadhNow.setUTCHours(0, 0, 0, 0)

  return new Date(riyadhNow.getTime() - riyadhOffsetMilliseconds).toISOString()
}

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event)
  const canSeeOrders = hasAdminPermission(adminUser, 'dashboard.orders')
  const canViewProducts = hasAdminPermission(adminUser, 'products.view')
  const canViewCategories = hasAdminPermission(adminUser, 'categories.view')
  const todayStartedAt = startOfTodayInRiyadh()

  const countOrders = (configure) => {
    if (!canSeeOrders) {
      return emptyCountResult()
    }

    return configure(
      supabaseAdmin
        .from('customer_orders')
        .select('*', { count: 'exact', head: true })
    )
  }

  const countProducts = (configure) => {
    if (!canViewProducts) {
      return emptyCountResult()
    }

    return configure(
      supabaseAdmin
        .from('products')
        .select('*', { count: 'exact', head: true })
    )
  }

  const results = await Promise.all([
    countOrders((query) => query.in('status', activeCustomerOrderStatuses)),
    countOrders((query) => query.gte('created_at', todayStartedAt)),
    countOrders((query) => query.eq('status', 'pending_payment')),
    countOrders((query) => query.eq('status', 'ready_to_deliver')),
    countOrders((query) => query.in('status', ['being_shipped', 'out_for_delivery'])),
    countOrders((query) => query.eq('status', 'on_hold')),
    countProducts((query) => query),
    countProducts((query) => query.eq('is_published', true)),
    countProducts((query) => query.eq('is_published', false)),
    countProducts((query) => query.eq('stock_quantity', 0)),
    canViewCategories
      ? supabaseAdmin
          .from('categories')
          .select('*', { count: 'exact', head: true })
      : emptyCountResult()
  ])
  const encounteredError = results.find((result) => result.error)?.error

  if (encounteredError) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Could not load the dashboard summary.'
    })
  }

  setHeader(event, 'Cache-Control', 'no-store')

  return {
    orders: {
      open: results[0].count || 0,
      today: results[1].count || 0,
      awaitingPayment: results[2].count || 0,
      readyToDeliver: results[3].count || 0,
      inDelivery: results[4].count || 0,
      onHold: results[5].count || 0
    },
    catalog: {
      products: results[6].count || 0,
      published: results[7].count || 0,
      drafts: results[8].count || 0,
      outOfStock: results[9].count || 0,
      categories: results[10].count || 0
    }
  }
})
