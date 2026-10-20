import { createError, getRouterParam, setHeader } from 'h3'
import { join } from 'node:path'
import { requireAdminRequest } from '../../../../utils/adminRequest'
import { isOrderPackingUuid } from '../../../../utils/orderPacking'
import { openPackingVideo, probePackingVideo, assertPackingVideoDuration, getPackingVideosRoot } from '../../../../utils/privatePackingVideos'
import { finishPackingVideo, getPackingVideo, reauthorizePackingVideo } from '../../../../utils/packingVideoRequests'

export default defineEventHandler(async event => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'dashboard.orders' })
  setHeader(event, 'Cache-Control', 'private, no-store')
  const sessionId = String(getRouterParam(event, 'sessionId') || '').trim()
  if (!isOrderPackingUuid(sessionId)) throw createError({ statusCode: 400, statusMessage: 'A valid packing session is required.' })
  const { video } = await getPackingVideo(supabaseAdmin, sessionId, { adminId: adminUser.id })
  await reauthorizePackingVideo(supabaseAdmin, adminUser.id, video)
  const opened = await openPackingVideo(video, { ready: video.status === 'ready' })
  try {
    const duration = video.status === 'ready' ? Number(video.duration_seconds)
      : await probePackingVideo(join(await getPackingVideosRoot(), video.storage_path), video.mime_type)
    assertPackingVideoDuration(video, duration)
    return await finishPackingVideo(supabaseAdmin, adminUser, video, { sha256: opened.sha256, duration })
  } finally { await opened.handle.close() }
})
