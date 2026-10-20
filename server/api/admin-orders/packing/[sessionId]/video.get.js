import { createError, getHeader, getRouterParam, sendStream, setHeader, setResponseStatus } from 'h3'
import { requireAdminRequest } from '../../../../utils/adminRequest'
import { isOrderPackingUuid } from '../../../../utils/orderPacking'
import { openPackingVideo } from '../../../../utils/privatePackingVideos'
import { getPackingVideo } from '../../../../utils/packingVideoRequests'

export default defineEventHandler(async event => {
  const { supabaseAdmin } = await requireAdminRequest(event, { permission: 'dashboard.orders' })
  setHeader(event, 'Cache-Control', 'private, no-store')
  const sessionId = String(getRouterParam(event, 'sessionId') || '').trim()
  if (!isOrderPackingUuid(sessionId)) throw createError({ statusCode: 400, statusMessage: 'A valid packing session is required.' })
  const { video } = await getPackingVideo(supabaseAdmin, sessionId)
  if (video.status !== 'ready') throw createError({ statusCode: 404, statusMessage: 'Packing video not found.' })
  const opened = await openPackingVideo(video)
  let transferred = false
  try {
    let start = 0, end = opened.stat.size - 1
    const range = getHeader(event, 'range')
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range)
      if (match && (match[1] || match[2])) {
        start = match[1] ? Number(match[1]) : Math.max(0, opened.stat.size - Number(match[2]))
        end = match[1] && match[2] ? Math.min(end, Number(match[2])) : end
      }
      if (!match || !(match[1] || match[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= opened.stat.size) {
        setHeader(event, 'Content-Range', `bytes */${opened.stat.size}`)
        throw createError({ statusCode: 416, statusMessage: 'This video range is unavailable.' })
      }
      setResponseStatus(event, 206)
      setHeader(event, 'Content-Range', `bytes ${start}-${end}/${opened.stat.size}`)
    }
    const name = String(video.file_name).replace(/[^a-z0-9._ -]/gi, '_').slice(0, 240)
    setHeader(event, 'Content-Disposition', `attachment; filename="${name}"`)
    setHeader(event, 'Content-Type', video.mime_type)
    setHeader(event, 'Content-Length', end - start + 1)
    setHeader(event, 'Accept-Ranges', 'bytes')
    setHeader(event, 'X-Content-Type-Options', 'nosniff')
    setHeader(event, 'Content-Security-Policy', "default-src 'none'; sandbox")
    const stream = opened.handle.createReadStream({ start, end, autoClose: true })
    event.node.res.once('close', () => stream.destroy())
    transferred = true
    return await sendStream(event, stream)
  } finally { if (!transferred) await opened.handle.close() }
})
