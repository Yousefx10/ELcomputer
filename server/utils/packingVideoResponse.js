import { createError, getHeader, sendStream, setHeader, setResponseStatus } from 'h3'
import { openPackingVideo } from './privatePackingVideos'

// Streams a verified private packing video with single-range support.
export const sendPackingVideo = async (event, video, fileName = video.file_name) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
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
    const name = String(fileName).replace(/[^a-z0-9._ -]/gi, '_').slice(0, 240)
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
}
