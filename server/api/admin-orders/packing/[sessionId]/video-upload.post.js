import { createError, getRouterParam, setHeader } from 'h3'
import { requireAdminRequest } from '../../../../utils/adminRequest'
import { assertPackingSessionOwner, getOrderPackingSession, isOrderPackingUuid } from '../../../../utils/orderPacking'
import { getPackingVideosRoot, MAX_PACKING_VIDEO_BYTES, PACKING_VIDEO_EXTENSIONS } from '../../../../utils/privatePackingVideos'
import { preparePackingVideo, publicPackingVideo, readPackingVideoMetadata } from '../../../../utils/packingVideoRequests'

export default defineEventHandler(async event => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'dashboard.orders' })
  setHeader(event, 'Cache-Control', 'private, no-store')
  const sessionId = String(getRouterParam(event, 'sessionId') || '').trim()
  if (!isOrderPackingUuid(sessionId)) throw createError({ statusCode: 400, statusMessage: 'A valid packing session is required.' })
  const body = await readPackingVideoMetadata(event)
  body.mimeType = String(body.mimeType || '').split(';')[0].trim().toLowerCase()
  if (!Object.hasOwn(PACKING_VIDEO_EXTENSIONS, body.mimeType)) throw createError({ statusCode: 415, statusMessage: 'This video format is not supported.' })
  if (!Number.isSafeInteger(body.sizeBytes) || body.sizeBytes < 1 || body.sizeBytes > MAX_PACKING_VIDEO_BYTES) throw createError({ statusCode: 413, statusMessage: 'The packing video must be under 500 MB.' })
  const started = new Date(body.recordingStartedAt), ended = new Date(body.recordingEndedAt)
  if (typeof body.recordingStartedAt !== 'string' || typeof body.recordingEndedAt !== 'string' || !Number.isFinite(started.getTime()) || !Number.isFinite(ended.getTime()) || ended <= started) throw createError({ statusCode: 400, statusMessage: 'Recording times are invalid.' })
  body.recordingStartedAt = started.toISOString(); body.recordingEndedAt = ended.toISOString()
  assertPackingSessionOwner(await getOrderPackingSession(supabaseAdmin, sessionId), adminUser.id)
  await getPackingVideosRoot({ create: true })
  const video = await preparePackingVideo(supabaseAdmin, adminUser.id, sessionId, body)
  return { video: publicPackingVideo(video), upload: {
    url: `/api/admin-orders/packing/${sessionId}/video-content?upload=${video.upload_id}`
  } }
})
