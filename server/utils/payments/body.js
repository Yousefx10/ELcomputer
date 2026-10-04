import { createError, getHeader, setHeader } from 'h3'

// Bound bytes while receiving the public callback, before buffering or parsing JSON.
export const readPaymentCallbackBody = (event, limit = 65536, timeoutMs = 10000) => {
  const request = event.node.req
  const rejectBody = statusCode => {
    request.pause()
    setHeader(event, 'Connection', 'close')
    return createError({ statusCode, statusMessage: 'Invalid callback.' })
  }
  if (Number(getHeader(event, 'content-length')) > limit) return Promise.reject(rejectBody(413))
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    const finish = (error, body) => {
      clearTimeout(timer)
      request.removeListener('data', data)
      request.removeListener('end', end)
      request.removeListener('error', failed)
      request.removeListener('aborted', aborted)
      error ? reject(error) : resolve(body)
    }
    const data = chunk => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      size += bytes.length
      if (size > limit) return finish(rejectBody(413))
      chunks.push(bytes)
    }
    const end = () => finish(null, Buffer.concat(chunks).toString('utf8'))
    const failed = () => finish(rejectBody(400))
    const aborted = () => finish(rejectBody(400))
    const timer = setTimeout(() => finish(rejectBody(408)), timeoutMs)
    timer.unref?.()
    request.on('data', data).once('end', end).once('error', failed).once('aborted', aborted)
  })
}
