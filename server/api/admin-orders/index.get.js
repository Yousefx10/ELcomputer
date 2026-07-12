import { createError, getQuery } from 'h3'
import { buildDateRangeFilter, getOrderStatsDateBoundaries, normalizeAdminOrderRecord, normalizeOrderSearchTerm } from '../../utils/adminOrders'
import { requireAdminRequest } from '../../utils/adminRequest'

const applyOrderDateRange = (queryBuilder, dateRange) => {
  let nextQueryBuilder = queryBuilder

  if (dateRange.from) {
    nextQueryBuilder = nextQueryBuilder.gte('created_at', dateRange.from)
  }

  if (dateRange.to) {
    nextQueryBuilder = nextQueryBuilder.lte('created_at', dateRange.to)
  }

  return nextQueryBuilder
}

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'dashboard.orders'
  })
  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(20, Math.max(1, Number(query.pageSize) || 10))
  const searchTerm = normalizeOrderSearchTerm(query.search)
  const from = typeof query.from === 'string' ? query.from : ''
  const to = typeof query.to === 'string' ? query.to : ''
  const dateRange = buildDateRangeFilter({ from, to })
  const fromIndex = (page - 1) * pageSize
  const toIndex = fromIndex + pageSize - 1
  const statsBoundaries = getOrderStatsDateBoundaries()

  let filteredCountQuery = applyOrderDateRange(
    supabaseAdmin
      .from('customer_orders')
      .select('*', { count: 'exact', head: true }),
    dateRange
  )

  let filteredDataQuery = applyOrderDateRange(
    supabaseAdmin
      .from('customer_orders')
      .select(`
        id,
        user_id,
        order_number,
        first_name,
        last_name,
        governorate,
        total_amount,
        status,
        created_at,
        updated_at
      `),
    dateRange
  )

  if (searchTerm) {
    const searchFilter = [
      `order_number.ilike.%${searchTerm}%`,
      `first_name.ilike.%${searchTerm}%`,
      `last_name.ilike.%${searchTerm}%`,
      `email.ilike.%${searchTerm}%`,
      `phone.ilike.%${searchTerm}%`,
      `governorate.ilike.%${searchTerm}%`
    ].join(',')

    filteredCountQuery = filteredCountQuery.or(searchFilter)
    filteredDataQuery = filteredDataQuery.or(searchFilter)
  }

  const [
    { count: totalCount, error: totalCountError },
    { count: todayCount, error: todayCountError },
    { count: weekCount, error: weekCountError },
    { count: monthCount, error: monthCountError },
    { data: recentOrders, error: recentOrdersError },
    { count: filteredTotal, error: filteredTotalError },
    { data: filteredOrders, error: filteredOrdersError }
  ] = await Promise.all([
    supabaseAdmin
      .from('customer_orders')
      .select('*', { count: 'exact', head: true }),
    supabaseAdmin
      .from('customer_orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', statsBoundaries.startOfToday),
    supabaseAdmin
      .from('customer_orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', statsBoundaries.sevenDaysAgo),
    supabaseAdmin
      .from('customer_orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', statsBoundaries.thirtyDaysAgo),
    supabaseAdmin
      .from('customer_orders')
      .select(`
        id,
        user_id,
        order_number,
        first_name,
        last_name,
        governorate,
        total_amount,
        status,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false })
      .limit(6),
    filteredCountQuery,
    filteredDataQuery
      .order('created_at', { ascending: false })
      .range(fromIndex, toIndex)
  ])

  const encounteredError = totalCountError
    || todayCountError
    || weekCountError
    || monthCountError
    || recentOrdersError
    || filteredTotalError
    || filteredOrdersError

  if (encounteredError) {
    throw createError({
      statusCode: 500,
      statusMessage: encounteredError.message
    })
  }

  return {
    stats: {
      total: totalCount || 0,
      today: todayCount || 0,
      week: weekCount || 0,
      month: monthCount || 0
    },
    recentOrders: (recentOrders || []).map(normalizeAdminOrderRecord),
    items: (filteredOrders || []).map(normalizeAdminOrderRecord),
    total: filteredTotal || 0,
    page,
    pageSize
  }
})
