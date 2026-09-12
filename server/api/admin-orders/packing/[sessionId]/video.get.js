import { createError, getRouterParam, sendRedirect, setHeader } from 'h3'
import { requireAdminRequest } from '../../../../utils/adminRequest'
import {
  isOrderPackingUuid,
  ORDER_PACKING_VIDEOS_BUCKET,
  ORDER_PACKING_VIDEOS_TABLE,
  throwOrderPackingDatabaseError
} from '../../../../utils/orderPacking'

const getContentDisposition = (filename) => {
  const safeName = String(filename || 'packing-video.webm')
    .replace(/[^a-z0-9._ -]/gi, '_')
    .replace(/["\\]/g, '_')
    .slice(0, 240) || 'packing-video.webm'

  return `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'dashboard.orders'
  })
  const sessionId = String(getRouterParam(event, 'sessionId') || '').trim()

  if (!isOrderPackingUuid(sessionId)) {
    throw createError({ statusCode: 400, statusMessage: 'A valid packing session is required.' })
  }

  const { data: video, error: videoError } = await supabaseAdmin
    .from(ORDER_PACKING_VIDEOS_TABLE)
    .select('*')
    .eq('packing_session_id', sessionId)
    .eq('status', 'ready')
    .maybeSingle()

  if (videoError) {
    throwOrderPackingDatabaseError(videoError, 'Could not load the packing video.')
  }

  if (!video) {
    throw createError({ statusCode: 404, statusMessage: 'Packing video not found.' })
  }

  const { data, error } = await supabaseAdmin.storage
    .from(ORDER_PACKING_VIDEOS_BUCKET)
    .createSignedUrl(video.storage_path, 60, {
      download: video.file_name
    })

  if (error || !data?.signedUrl) {
    throw createError({ statusCode: 500, statusMessage: error?.message || 'Could not download the packing video.' })
  }

  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Content-Disposition', getContentDisposition(video.file_name))
  return sendRedirect(event, data.signedUrl, 302)
})
