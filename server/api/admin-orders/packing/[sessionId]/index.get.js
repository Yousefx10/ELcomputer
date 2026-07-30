import { createError, getRouterParam } from 'h3'
import { requireAdminRequest } from '../../../../utils/adminRequest'
import {
  getOrderPackingDetail,
  isOrderPackingUuid
} from '../../../../utils/orderPacking'

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'dashboard.orders'
  })
  const sessionId = String(
    getRouterParam(event, 'sessionId') || ''
  ).trim()

  if (!isOrderPackingUuid(sessionId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid packing session is required.'
    })
  }

  return getOrderPackingDetail({
    supabaseAdmin,
    sessionId
  })
})
