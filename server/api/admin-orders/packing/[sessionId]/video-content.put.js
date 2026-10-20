import { createError, getQuery, getRouterParam, setHeader } from 'h3'
import { requireAdminRequest } from '../../../../utils/adminRequest'
import { isOrderPackingUuid } from '../../../../utils/orderPacking'
import { persistPackingVideo, removePrivatePackingVideos } from '../../../../utils/privatePackingVideos'
import { finishPackingVideo, getPackingVideo, reauthorizePackingVideo } from '../../../../utils/packingVideoRequests'

export default defineEventHandler(async event => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'dashboard.orders' })
  setHeader(event, 'Cache-Control', 'private, no-store')
  const sessionId = String(getRouterParam(event, 'sessionId') || '').trim(), uploadId = getQuery(event).upload
  if (!isOrderPackingUuid(sessionId) || typeof uploadId !== 'string' || !isOrderPackingUuid(uploadId)) throw createError({ statusCode: 400, statusMessage: 'A valid packing upload is required.' })
  const { video } = await getPackingVideo(supabaseAdmin, sessionId, { adminId: adminUser.id })
  if (uploadId !== video.upload_id) throw createError({ statusCode: 409, statusMessage: 'Packing video upload not found.' })
  await reauthorizePackingVideo(supabaseAdmin, adminUser.id, video)
  const evidence = await persistPackingVideo(event, video)
  try { return await finishPackingVideo(supabaseAdmin, adminUser, video, evidence) }
  catch (error) {
    // A reset may have erased metadata during streaming. Clean late publication
    // only after a definite absence; uncertainty must retain a recoverable file.
    const current = await supabaseAdmin.from('order_packing_videos').select('id').eq('id', video.id).maybeSingle()
    if (evidence.published && !current.error && !current.data) await removePrivatePackingVideos([video.storage_path])
    throw error
  }
})
