import { createError, getQuery, setHeader } from 'h3'
import { calculateNpsFromCounts, NPS_PERIOD_DAYS } from '../../utils/nps'
import { requireAdminRequest } from '../../utils/adminRequest'

const MISSING_ANALYTICS_SCHEMA_CODES = new Set([
  '42P01',
  '42883',
  'PGRST202',
  'PGRST204',
  'PGRST205'
])

const normalizeCount = (value) => {
  const numericValue = Number(value)

  return Number.isFinite(numericValue) && numericValue >= 0
    ? Math.floor(numericValue)
    : 0
}

const normalizeRate = (value) => {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return 0
  }

  return Math.max(0, Math.min(100, numericValue))
}

const normalizeDuration = (value) => {
  const numericValue = Number(value)

  return Number.isFinite(numericValue) && numericValue >= 0
    ? numericValue
    : 0
}

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'dashboard.analysis'
  })
  const query = getQuery(event)
  const requestedWindowDays = Number(query.windowDays)
  const windowDays = Number.isSafeInteger(requestedWindowDays)
    && requestedWindowDays >= 1
    && requestedWindowDays <= 365
    ? requestedWindowDays
    : 30

  const { data, error } = await supabaseAdmin.rpc(
    'store_analytics_get_snapshot',
    {
      p_window_days: windowDays
    }
  )

  if (MISSING_ANALYTICS_SCHEMA_CODES.has(error?.code)) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Run the latest NPS and customer analytics migration, then refresh this page.'
    })
  }

  if (error || !data || typeof data !== 'object') {
    throw createError({
      statusCode: 500,
      statusMessage: 'Analytics data is unavailable.'
    })
  }

  const nps = calculateNpsFromCounts(data.nps)
  const kpis = data.kpis || {}
  const activity = data.activity || {}

  setHeader(event, 'Cache-Control', 'no-store')

  return {
    windowDays,
    nps: {
      ...nps,
      periodDays: NPS_PERIOD_DAYS
    },
    kpis: {
      returningVisitorRate: normalizeRate(kpis.returningVisitorRate),
      totalVisits: normalizeCount(kpis.totalVisits),
      returningVisits: normalizeCount(kpis.returningVisits),
      uniqueVisitors: normalizeCount(kpis.uniqueVisitors),
      cartAbandonmentRate: normalizeRate(kpis.cartAbandonmentRate),
      matureCarts: normalizeCount(kpis.matureCarts),
      abandonedCarts: normalizeCount(kpis.abandonedCarts),
      repeatPurchaseRate: normalizeRate(kpis.repeatPurchaseRate),
      purchasingCustomers: normalizeCount(kpis.purchasingCustomers),
      repeatCustomers: normalizeCount(kpis.repeatCustomers)
    },
    activity: {
      pageViews: normalizeCount(activity.pageViews),
      productViews: normalizeCount(activity.productViews),
      uniqueProductViewers: normalizeCount(activity.uniqueProductViewers),
      avgProductDwellSeconds: normalizeDuration(activity.avgProductDwellSeconds),
      addToCartEvents: normalizeCount(activity.addToCartEvents),
      checkoutStarts: normalizeCount(activity.checkoutStarts),
      ordersCreated: normalizeCount(activity.ordersCreated)
    }
  }
})
