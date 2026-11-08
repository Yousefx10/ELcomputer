import { createError, getQuery, setHeader } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabaseAdmin'
import { assertStoreAnalyticsRateLimit } from '../../utils/storeAnalyticsRateLimit'
import { normalizeAwb, normalizeOrderNumber, readPublicShipment, readPublicShipmentByOrder } from '../../utils/publicTracking'
import { readCourierName } from '../../utils/courierName'

// Public lookup by AWB or order number for the tracking page. Bounded per visitor; no courier request.
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'X-Robots-Tag', 'noindex')
  assertStoreAnalyticsRateLimit(event, { scope: 'public-tracking', limit: 20, message: 'Too many tracking requests. Try again in a minute.' })
  const query = getQuery(event), value = query.q ?? query.awb
  const orderNumber = normalizeOrderNumber(value), awb = orderNumber ? null : normalizeAwb(value)
  if (!orderNumber && !awb) throw createError({ statusCode: 400, statusMessage: 'Enter a valid AWB or order number.' })
  const db = getSupabaseAdminClient()
  const shipment = orderNumber ? await readPublicShipmentByOrder(db, orderNumber) : await readPublicShipment(db, awb)
  if (!shipment) throw createError({ statusCode: 404, statusMessage: 'No shipment found for this number.' })
  return { shipment, courierName: await readCourierName(db) }
})
