import { createError, setHeader } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'

const LIVE_VISITOR_WINDOW_SECONDS = 180
const MISSING_LIVE_ANALYTICS_CODES = new Set([
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

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'dashboard.analysis'
  })
  const { data, error } = await supabaseAdmin.rpc(
    'store_analytics_get_live_visitors',
    {
      p_active_seconds: LIVE_VISITOR_WINDOW_SECONDS
    }
  )

  if (MISSING_LIVE_ANALYTICS_CODES.has(error?.code)) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Run the latest live-store analytics migration, then refresh this page.'
    })
  }

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Live store activity is unavailable.'
    })
  }

  setHeader(event, 'Cache-Control', 'no-store')

  return {
    liveVisitors: normalizeCount(data),
    activeWindowSeconds: LIVE_VISITOR_WINDOW_SECONDS,
    measuredAt: new Date().toISOString()
  }
})
