import { createError, getHeader } from 'h3'
import { assertPackingSessionOwner, getOrderPackingSession, isMissingOrderPackingSchemaError, throwOrderPackingDatabaseError } from './orderPacking'
import { assertPackingVideoBinding } from './privatePackingVideos'
import { recordAdminActivity } from './adminLogs'

export const publicPackingVideo = video => Object.fromEntries([
  'id', 'packing_session_id', 'work_session_id', 'order_id', 'file_name', 'mime_type', 'size_bytes',
  'duration_seconds', 'status', 'recording_started_at', 'recording_ended_at', 'uploaded_at'
].map(key => [key, video[key]]))

export const readPackingVideoMetadata = async event => {
  if (!String(getHeader(event, 'content-type')).startsWith('application/json')) throw createError({ statusCode: 415, statusMessage: 'Video recording details are required.' })
  if (Number(getHeader(event, 'content-length')) > 8192) throw createError({ statusCode: 413, statusMessage: 'Video recording details are too large.' })
  const chunks = []
  let size = 0
  const timer = setTimeout(() => event.node.req.destroy(), 15000)
  try {
    for await (const chunk of event.node.req.iterator({ destroyOnReturn: false })) {
      size += chunk.length
      if (size > 8192) {
        event.node.res.setHeader('Connection', 'close')
        event.node.res.once('finish', () => event.node.req.destroy())
        throw createError({ statusCode: 413, statusMessage: 'Video recording details are too large.' })
      }
      chunks.push(chunk)
    }
  } finally { clearTimeout(timer) }
  let body
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { /* reject below */ }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key =>
    !['mimeType', 'sizeBytes', 'durationSeconds', 'recordingStartedAt', 'recordingEndedAt'].includes(key))) {
    throw createError({ statusCode: 400, statusMessage: 'Video recording details are required.' })
  }
  return body
}

export const packingVideoRpc = async (client, name, args) => {
  const { data, error } = await client.rpc(name, args)
  if (isMissingOrderPackingSchemaError(error)) throw createError({ statusCode: 503, statusMessage: 'Private packing videos are not installed.' })
  if (error?.code === '42501') throw createError({ statusCode: 403, statusMessage: 'You can no longer process this order.' })
  if (error?.message?.startsWith('Release this order before')) throw createError({ statusCode: 409, statusMessage: error.message })
  if (error) throwOrderPackingDatabaseError(error, 'Could not save the packing video.')
  return data
}

export const preparePackingVideo = (client, adminId, sessionId, body) => packingVideoRpc(client, 'packing_video_prepare', {
  p_session_id: sessionId, p_admin_id: adminId, p_mime_type: body.mimeType, p_size_bytes: body.sizeBytes,
  p_started_at: body.recordingStartedAt, p_ended_at: body.recordingEndedAt
})
export const reauthorizePackingVideo = (client, adminId, video) => preparePackingVideo(client, adminId, video.packing_session_id, {
  mimeType: video.mime_type, sizeBytes: video.size_bytes, recordingStartedAt: video.recording_started_at,
  recordingEndedAt: video.recording_ended_at
})

export const getPackingVideo = async (client, sessionId, { adminId } = {}) => {
  const session = await getOrderPackingSession(client, sessionId)
  if (adminId) assertPackingSessionOwner(session, adminId)
  const { data: video, error } = await client.from('order_packing_videos').select('*').eq('packing_session_id', session.id).maybeSingle()
  if (error) throwOrderPackingDatabaseError(error, 'Could not load the packing video.')
  if (!video) throw createError({ statusCode: 404, statusMessage: 'Packing video upload not found.' })
  assertPackingVideoBinding(video, session)
  return { session, video }
}

export const finishPackingVideo = async (client, adminUser, video, evidence) => {
  const result = await packingVideoRpc(client, 'packing_video_finish', {
    p_session_id: video.packing_session_id, p_admin_id: adminUser.id, p_upload_id: video.upload_id,
    p_sha256: evidence.sha256, p_duration_seconds: evidence.duration
  })
  if (result.saved) await recordAdminActivity({ supabaseAdmin: client, adminUser,
    actionKey: 'orders.packing.video.saved', description: `Saved packing video ${video.file_name}.`,
    metadata: { order_id: video.order_id, packing_session_id: video.packing_session_id, work_session_id: video.work_session_id,
      video_id: video.id, file_name: video.file_name, size_bytes: video.size_bytes, sha256: evidence.sha256, storage_backend: 'vps' }
  })
  return { video: publicPackingVideo(result.video) }
}
