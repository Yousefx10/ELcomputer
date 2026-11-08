import { createError, getRouterParam, setHeader } from 'h3'
import { requireCustomerRequest } from '../../../../utils/customerRequest'
import { assertStoreAnalyticsRateLimit } from '../../../../utils/storeAnalyticsRateLimit'
import { processPdcTracking } from '../../../../utils/pdcTrackingPolling'

// Opening an order asks the courier for the latest status. The database allows one check
// per parcel every 5 minutes, inside the daily budget. A refused check keeps the saved status.
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  assertStoreAnalyticsRateLimit(event, { scope: 'order-tracking-refresh', limit: 10, message: 'Too many tracking requests. Try again in a minute.' })
  const id = getRouterParam(event, 'id')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id || '')) throw createError({ statusCode: 404, statusMessage: 'Order not found.' })
  const { authUser, supabaseAdmin } = await requireCustomerRequest(event)
  const { data, error } = await supabaseAdmin.from('customer_orders').select('id').eq('id', id).eq('user_id', authUser.id).maybeSingle()
  if (error || !data) throw createError({ statusCode: 404, statusMessage: 'Order not found.' })
  try {
    const result = await processPdcTracking({ db: supabaseAdmin, orderId: id })
    return { refreshed: result.checked > 0 }
  } catch { return { refreshed: false } }
})
