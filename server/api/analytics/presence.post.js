import { createError, setHeader } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabaseAdmin'
import {
  getOptionalStoreAnalyticsUserId,
  touchExistingStoreAnalyticsPresence
} from '../../utils/storeAnalytics'
import { assertStoreAnalyticsRateLimit } from '../../utils/storeAnalyticsRateLimit'

export default defineEventHandler(async (event) => {
  assertStoreAnalyticsRateLimit(event, {
    scope: 'presence',
    limit: 120
  })

  let supabaseAdmin

  try {
    supabaseAdmin = getSupabaseAdminClient()
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Store presence could not be recorded.'
    })
  }

  const userId = await getOptionalStoreAnalyticsUserId(event, supabaseAdmin)
  let presence

  try {
    presence = await touchExistingStoreAnalyticsPresence({
      event,
      supabaseAdmin,
      userId,
      minimumIntervalSeconds: 45
    })
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Store presence could not be recorded.'
    })
  }

  setHeader(event, 'Cache-Control', 'no-store')

  return {
    success: true,
    touched: presence.touched,
    excluded: presence.excluded
  }
})
