import { createError, getRouterParam, readBody, setHeader } from 'h3'
import { requireAdminRequest } from '../../../../utils/adminRequest'
import {
  assertPackingSessionOwner,
  getOrderPackingSession,
  isOrderPackingUuid,
  ORDER_PACKING_VIDEOS_BUCKET,
  ORDER_PACKING_VIDEOS_TABLE,
  ORDER_PACKING_WORK_SESSIONS_TABLE,
  throwOrderPackingDatabaseError
} from '../../../../utils/orderPacking'

const MAX_VIDEO_BYTES = 500 * 1024 * 1024
const VIDEO_EXTENSIONS = {
  'video/webm': 'webm',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov'
}

const normalizeDate = (value, label) => {
  const date = new Date(value)

  if (!value || Number.isNaN(date.getTime())) {
    throw createError({ statusCode: 400, statusMessage: `${label} is invalid.` })
  }

  return date.toISOString()
}

const safeOrderNumber = (value) => {
  return String(value || 'order')
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180) || 'order'
}

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'dashboard.orders'
  })
  const sessionId = String(getRouterParam(event, 'sessionId') || '').trim()

  setHeader(event, 'Cache-Control', 'private, no-store')

  if (!isOrderPackingUuid(sessionId)) {
    throw createError({ statusCode: 400, statusMessage: 'A valid packing session is required.' })
  }

  const body = await readBody(event)
  const mimeType = String(body?.mimeType || '').split(';')[0].trim().toLowerCase()
  const extension = VIDEO_EXTENSIONS[mimeType]
  const sizeBytes = Number(body?.sizeBytes)
  const durationSeconds = Math.max(0, Number(body?.durationSeconds || 0))
  const recordingStartedAt = normalizeDate(body?.recordingStartedAt, 'Recording start time')
  const recordingEndedAt = normalizeDate(body?.recordingEndedAt, 'Recording end time')

  if (!extension) {
    throw createError({ statusCode: 400, statusMessage: 'This video format is not supported.' })
  }

  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_VIDEO_BYTES) {
    throw createError({ statusCode: 400, statusMessage: 'The packing video must be under 500 MB.' })
  }

  if (new Date(recordingEndedAt) < new Date(recordingStartedAt)) {
    throw createError({ statusCode: 400, statusMessage: 'Recording times are invalid.' })
  }

  const session = await getOrderPackingSession(supabaseAdmin, sessionId)
  assertPackingSessionOwner(session, adminUser.id)

  if (!isOrderPackingUuid(session.work_session_id)) {
    throw createError({ statusCode: 409, statusMessage: 'This order has no active packing session.' })
  }

  const { data: workSession, error: workSessionError } = await supabaseAdmin
    .from(ORDER_PACKING_WORK_SESSIONS_TABLE)
    .select('id, admin_user_id, status')
    .eq('id', session.work_session_id)
    .maybeSingle()

  if (workSessionError) {
    throwOrderPackingDatabaseError(workSessionError, 'Could not verify your packing session.')
  }

  if (
    !workSession
    || workSession.status !== 'active'
    || String(workSession.admin_user_id) !== String(adminUser.id)
  ) {
    throw createError({ statusCode: 409, statusMessage: 'Your packing session is no longer active.' })
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from('customer_orders')
    .select('id, order_number')
    .eq('id', session.order_id)
    .maybeSingle()

  if (orderError || !order) {
    throwOrderPackingDatabaseError(orderError, 'Could not load this order.')
  }

  const fileName = `${safeOrderNumber(order.order_number || order.id)}.${extension}`
  const storagePath = `${adminUser.id}/${order.id}/${session.id}/${fileName}`
  const now = new Date().toISOString()
  const { data: video, error: videoError } = await supabaseAdmin
    .from(ORDER_PACKING_VIDEOS_TABLE)
    .upsert({
      packing_session_id: session.id,
      work_session_id: session.work_session_id,
      order_id: order.id,
      recorded_by: adminUser.id,
      storage_path: storagePath,
      file_name: fileName,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      duration_seconds: Number.isFinite(durationSeconds) ? durationSeconds : 0,
      status: 'uploading',
      recording_started_at: recordingStartedAt,
      recording_ended_at: recordingEndedAt,
      uploaded_at: null,
      updated_at: now
    }, { onConflict: 'packing_session_id' })
    .select('id, storage_path, file_name, mime_type, status')
    .single()

  if (videoError) {
    throwOrderPackingDatabaseError(videoError, 'Could not prepare the packing video upload.')
  }

  const { data: upload, error: uploadError } = await supabaseAdmin.storage
    .from(ORDER_PACKING_VIDEOS_BUCKET)
    .createSignedUploadUrl(storagePath, { upsert: true })

  if (uploadError || !upload?.token) {
    throw createError({
      statusCode: /bucket.*not found/i.test(uploadError?.message || '') ? 503 : 500,
      statusMessage: uploadError?.message || 'Could not prepare the secure video upload.'
    })
  }

  return {
    video,
    upload: {
      path: storagePath,
      token: upload.token
    }
  }
})
