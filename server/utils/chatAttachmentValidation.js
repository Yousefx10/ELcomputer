import { createHash } from 'node:crypto'

export const CHAT_ATTACHMENT_TYPES = Object.freeze({
  'image/jpeg': { extension: 'jpg', sourceExtensions: ['jpg', 'jpeg'] },
  'image/png': { extension: 'png', sourceExtensions: ['png'] },
  'image/webp': { extension: 'webp', sourceExtensions: ['webp'] },
  'application/pdf': { extension: 'pdf', sourceExtensions: ['pdf'] }
})

const signatureMatches = (mime, bytes) => {
  if (mime === 'image/jpeg') return bytes.length >= 3
    && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (mime === 'image/png') return bytes.length >= 8
    && bytes.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))
  if (mime === 'image/webp') return bytes.length >= 12
    && bytes.subarray(0, 4).toString('ascii') === 'RIFF'
    && bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  if (mime === 'application/pdf') return bytes.length >= 5
    && bytes.subarray(0, 5).toString('ascii') === '%PDF-'
  return false
}

export const validateChatAttachmentFile = (file, policy) => {
  const bytes = Buffer.isBuffer(file?.data) ? file.data : Buffer.from(file?.data || [])
  const mime = String(file?.type || '').split(';', 1)[0].trim().toLowerCase()
  const info = CHAT_ATTACHMENT_TYPES[mime]
  const originalName = String(file?.filename || '')
    .replace(/[/\\\r\n\x00-\x1f]/g, '_').trim().slice(0, 180)
  const sourceExtension = originalName.includes('.')
    ? originalName.split('.').at(-1).toLowerCase() : ''
  if (!policy?.enabled) throw new Error('CHAT_ATTACHMENTS_DISABLED')
  if (!info || !policy.allowedMimes?.includes(mime)
    || !info.sourceExtensions.includes(sourceExtension) || !signatureMatches(mime, bytes)) {
    throw new Error('CHAT_ATTACHMENT_TYPE')
  }
  if (!originalName) throw new Error('CHAT_ATTACHMENT_NAME')
  if (!bytes.length || bytes.length > Number(policy.maxBytes || 0)) {
    throw new Error('CHAT_ATTACHMENT_SIZE')
  }
  return { bytes, mime, originalName, extension: info.extension,
    sha256: createHash('sha256').update(bytes).digest('hex') }
}

export const parseChatMultipart = (body, contentType) => {
  const match = /^multipart\/form-data;\s*boundary=(?:"([^"]+)"|([^;\s]+))$/i.exec(String(contentType || '').trim())
  const boundary = match?.[1] || match?.[2]
  if (!boundary || boundary.length > 70 || /[\r\n]/.test(boundary)) throw new Error('CHAT_MULTIPART')
  const marker = Buffer.from(`--${boundary}`)
  const separator = Buffer.from(`\r\n--${boundary}`)
  if (!body.subarray(0, marker.length).equals(marker)) throw new Error('CHAT_MULTIPART')
  const fields = {}
  let file = null
  let cursor = marker.length
  let partCount = 0
  while (cursor < body.length) {
    if (body.subarray(cursor, cursor + 2).toString() === '--') break
    if (body.subarray(cursor, cursor + 2).toString() !== '\r\n') throw new Error('CHAT_MULTIPART')
    cursor += 2
    const headerEnd = body.indexOf(Buffer.from('\r\n\r\n'), cursor)
    if (headerEnd < 0 || headerEnd - cursor > 8192) throw new Error('CHAT_MULTIPART')
    const headerText = body.subarray(cursor, headerEnd).toString('latin1')
    const next = body.indexOf(separator, headerEnd + 4)
    if (next < 0) throw new Error('CHAT_MULTIPART')
    const data = body.subarray(headerEnd + 4, next)
    const disposition = headerText.split('\r\n').find(line => /^content-disposition:/i.test(line)) || ''
    const name = /(?:^|;)\s*name="([^"]+)"/i.exec(disposition)?.[1]
    const filename = /(?:^|;)\s*filename="([^"]*)"/i.exec(disposition)?.[1]
    if (!name || ++partCount > 4) throw new Error('CHAT_MULTIPART')
    if (filename !== undefined) {
      if (file) throw new Error('CHAT_MULTIPART')
      const type = (headerText.split('\r\n').find(line => /^content-type:/i.test(line)) || '')
        .replace(/^content-type:\s*/i, '')
      file = { filename, type, data }
    } else {
      if (data.length > 200 || fields[name] !== undefined) throw new Error('CHAT_MULTIPART')
      fields[name] = data.toString('utf8')
    }
    cursor = next + separator.length
  }
  if (!file) throw new Error('CHAT_MULTIPART')
  return { fields, file }
}
