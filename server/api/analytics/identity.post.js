import { createError, setHeader } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabaseAdmin'
import {
  ensureStoreAnalyticsSession,
  getOptionalStoreAnalyticsUserId
} from '../../utils/storeAnalytics'

export default defineEventHandler(async (event) => {
  let supabaseAdmin

  try {
    supabaseAdmin = getSupabaseAdminClient()
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'The storefront identity could not be checked.'
    })
  }

  const userId = await getOptionalStoreAnalyticsUserId(event, supabaseAdmin)

  if (!userId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication is required.'
    })
  }

  let identity

  try {
    identity = await ensureStoreAnalyticsSession({
      event,
      supabaseAdmin,
      userId
    })
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'The storefront identity could not be checked.'
    })
  }

  if (identity.isInternal) {
    const { error: cartError } = await supabaseAdmin.rpc(
      'store_analytics_mark_internal_session_carts',
      {
        p_session_id: identity.sessionId,
        p_visitor_id: identity.visitorId
      }
    )

    if (cartError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'The storefront identity could not be checked.'
      })
    }
  }

  setHeader(event, 'Cache-Control', 'no-store')

  return {
    success: true,
    excluded: identity.isInternal
  }
})
