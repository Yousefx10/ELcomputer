import { createError, getQuery, setHeader } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabaseAdmin'
import { assertStoreAnalyticsRateLimit } from '../../utils/storeAnalyticsRateLimit'
import { normalizeAwb, readPublicShipment } from '../../utils/publicTracking'

// Public AWB lookup for the tracking page. Bounded per visitor; no courier request.
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'X-Robots-Tag', 'noindex')
  assertStoreAnalyticsRateLimit(event, { scope: 'public-tracking', limit: 20, message: 'Too many tracking requests. Try again in a minute.' })
  const awb = normalizeAwb(getQuery(event).awb)
  if (!awb) throw createError({ statusCode: 400, statusMessage: 'Enter a valid AWB number.' })
  const shipment = await readPublicShipment(getSupabaseAdminClient(), awb)
  if (!shipment) throw createError({ statusCode: 404, statusMessage: 'No shipment found for this AWB.' })
  return { shipment }
})
