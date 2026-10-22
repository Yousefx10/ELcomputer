import { createError, setHeader } from 'h3'

export const PDP_MAX_VIDEO_BYTES = 64 * 1024 * 1024
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const fail = (status, code) => { throw createError({ statusCode: status, statusMessage: 'Product presentation is unavailable.', data: { code } }) }
export const pdpId = value => { if (typeof value !== 'string' || !uuid.test(value)) fail(400, 'PDP_INVALID'); return value.toLowerCase() }
export const privatePresentationResponse = event => { setHeader(event, 'Cache-Control', 'private, no-store'); setHeader(event, 'X-Content-Type-Options', 'nosniff') }

export function presentationError(error) {
  const code = error?.message?.match(/^pdp:([a-z_]+)$/)?.[1]
  if (code === 'permission' || error?.code === '42501') fail(403, 'PDP_FORBIDDEN')
  if (code === 'not_found') fail(404, 'PDP_NOT_FOUND')
  if (code === 'conflict' || error?.code === '40001') fail(409, 'PDP_CONFLICT')
  if (['invalid', 'variant', 'video', 'relationship', 'request_reused'].includes(code) || String(error?.code || '').startsWith('22')) fail(400, 'PDP_INVALID')
  fail(503, 'PDP_UNAVAILABLE')
}

export async function readPresentationBytes(event, maximum = 65536) {
  const length = event.node.req.headers['content-length']
  if (length && (!/^\d+$/.test(length) || Number(length) > maximum)) fail(413, 'PDP_TOO_LARGE')
  if (event._requestBody) {
    if (!Buffer.isBuffer(event._requestBody) || event._requestBody.length > maximum) fail(413, 'PDP_TOO_LARGE')
    return event._requestBody
  }
  let size = 0
  const chunks = []
  for await (const chunk of event.node.req) {
    size += chunk.length
    if (size > maximum) fail(413, 'PDP_TOO_LARGE')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

export function presentationCommand(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['request_id', 'expected_revision', 'content'].includes(key))) fail(400, 'PDP_INVALID')
  const requestId = pdpId(body.request_id)
  if (!Number.isSafeInteger(body.expected_revision) || body.expected_revision < 0) fail(400, 'PDP_INVALID')
  const content = body.content
  if (!content || typeof content !== 'object' || Array.isArray(content) || Buffer.byteLength(JSON.stringify(content)) > 64000 || Object.keys(content).some(key => !['videos', 'related', 'compatible'].includes(key))) fail(400, 'PDP_INVALID')
  for (const key of ['videos', 'related', 'compatible']) if (!Array.isArray(content[key]) || content[key].length > (key === 'videos' ? 6 : 8)) fail(400, 'PDP_INVALID')
  for (const key of ['related', 'compatible']) {
    if (content[key].some(value => typeof value !== 'string' || !uuid.test(value)) || new Set(content[key]).size !== content[key].length) fail(400, 'PDP_INVALID')
  }
  for (const item of content.videos) {
    if (!item || typeof item !== 'object' || Array.isArray(item) || Object.keys(item).some(key => !['asset_id', 'label', 'label_ar', 'variant_id', 'sort_order'].includes(key))) fail(400, 'PDP_INVALID')
    pdpId(item.asset_id)
    if (item.variant_id != null) pdpId(item.variant_id)
    if (!Number.isInteger(item.sort_order) || item.sort_order < 0 || item.sort_order > 9999 || [item.label, item.label_ar].some(value => typeof value !== 'string' || value.length > 200 || /[\u0000-\u001f\u007f]/.test(value))) fail(400, 'PDP_INVALID')
  }
  return { p_request_id: requestId, p_expected_revision: body.expected_revision, p_content: content }
}
