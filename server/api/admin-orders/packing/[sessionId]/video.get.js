import { createError, getRouterParam } from 'h3'
import { requireAdminRequest } from '../../../../utils/adminRequest'
import { isOrderPackingUuid } from '../../../../utils/orderPacking'
import { getPackingVideo } from '../../../../utils/packingVideoRequests'
import { sendPackingVideo } from '../../../../utils/packingVideoResponse'

export default defineEventHandler(async event => {
  const { supabaseAdmin } = await requireAdminRequest(event, { permission: 'dashboard.orders' })
  const sessionId = String(getRouterParam(event, 'sessionId') || '').trim()
  if (!isOrderPackingUuid(sessionId)) throw createError({ statusCode: 400, statusMessage: 'A valid packing session is required.' })
  const { video } = await getPackingVideo(supabaseAdmin, sessionId)
  if (video.status !== 'ready') throw createError({ statusCode: 404, statusMessage: 'Packing video not found.' })
  return sendPackingVideo(event, video)
})
