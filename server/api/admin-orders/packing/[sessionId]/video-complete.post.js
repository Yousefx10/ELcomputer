import { createError, getRouterParam, setHeader } from 'h3'
import { recordAdminActivity } from '../../../../utils/adminLogs'
import { requireAdminRequest } from '../../../../utils/adminRequest'
import {
  assertPackingSessionOwner,
  getOrderPackingSession,
  isOrderPackingUuid,
  ORDER_PACKING_VIDEOS_BUCKET,
  ORDER_PACKING_VIDEOS_TABLE,
  throwOrderPackingDatabaseError
} from '../../../../utils/orderPacking'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'dashboard.orders'
  })
  const sessionId = String(getRouterParam(event, 'sessionId') || '').trim()

  setHeader(event, 'Cache-Control', 'private, no-store')

  if (!isOrderPackingUuid(sessionId)) {
    throw createError({ statusCode: 400, statusMessage: 'A valid packing session is required.' })
  }

  const session = await getOrderPackingSession(supabaseAdmin, sessionId)
  assertPackingSessionOwner(session, adminUser.id)

  const { data: video, error: videoError } = await supabaseAdmin
    .from(ORDER_PACKING_VIDEOS_TABLE)
    .select('*')
    .eq('packing_session_id', sessionId)
    .eq('recorded_by', adminUser.id)
    .maybeSingle()

  if (videoError) {
    throwOrderPackingDatabaseError(videoError, 'Could not verify the packing video.')
  }

  if (!video) {
    throw createError({ statusCode: 404, statusMessage: 'Packing video upload not found.' })
  }

  const pathParts = String(video.storage_path).split('/').filter(Boolean)
  const objectName = pathParts.pop()
  const folder = pathParts.join('/')
  const { data: objects, error: storageError } = await supabaseAdmin.storage
    .from(ORDER_PACKING_VIDEOS_BUCKET)
    .list(folder, { limit: 10, search: objectName })

  if (storageError) {
    throw createError({ statusCode: 500, statusMessage: storageError.message || 'Could not verify the uploaded video.' })
  }

  const storedObject = (objects || []).find((item) => item.name === objectName)
  const storedSize = Number(storedObject?.metadata?.size || 0)
  const expectedSize = Number(video.size_bytes || 0)

  if (!storedObject || !Number.isSafeInteger(storedSize) || storedSize < 1) {
    throw createError({ statusCode: 409, statusMessage: 'The packing video upload is incomplete.' })
  }

  if (!Number.isSafeInteger(expectedSize) || expectedSize < 1 || storedSize !== expectedSize) {
    throw createError({ statusCode: 409, statusMessage: 'The packing video size does not match the recording.' })
  }

  const uploadedAt = new Date().toISOString()
  const { data: readyVideo, error: readyError } = await supabaseAdmin
    .from(ORDER_PACKING_VIDEOS_TABLE)
    .update({
      size_bytes: storedSize,
      status: 'ready',
      uploaded_at: uploadedAt,
      updated_at: uploadedAt
    })
    .eq('id', video.id)
    .eq('status', 'uploading')
    .select('id, packing_session_id, file_name, mime_type, size_bytes, duration_seconds, status, recording_started_at, recording_ended_at, uploaded_at')
    .maybeSingle()

  if (readyError) {
    throwOrderPackingDatabaseError(readyError, 'Could not finish the packing video upload.')
  }

  const result = readyVideo || video

  if (readyVideo) {
    await recordAdminActivity({
      supabaseAdmin,
      adminUser,
      actionKey: 'orders.packing.video.saved',
      description: `Saved packing video ${video.file_name}.`,
      metadata: {
        order_id: session.order_id,
        packing_session_id: sessionId,
        work_session_id: session.work_session_id,
        video_id: video.id,
        file_name: video.file_name,
        size_bytes: storedSize
      }
    })
  }

  return { video: result }
})
