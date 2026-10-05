import { createHash } from 'node:crypto'
import { createError } from 'h3'

const badPayload = () => createError({ statusCode: 400, statusMessage: 'Invalid courier update.' })
export const boundedPdcText = (value, limit, required = false) => {
  if (value == null && !required) return ''
  if (typeof value !== 'string' && typeof value !== 'number') throw badPayload()
  const text = String(value).trim()
  if (text.length > limit || /[\x00-\x1f\x7f]/.test(text) || (required && !text)) throw badPayload()
  return text
}

export const validatePdcTimezone = value => {
  const zone = String(value || 'Africa/Cairo')
  try { new Intl.DateTimeFormat('en', { timeZone: zone }).format() } catch { throw badPayload() }
  return zone
}

// Offset-free vendor examples use the configured zone, never the host timezone.
// Impossible/ambiguous local times at DST boundaries require an explicit offset.
export const parsePdcStatusDate = (value, timezone = 'Africa/Cairo') => {
  if (typeof value !== 'string') throw badPayload()
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})?$/)
  if (!match) throw badPayload()
  const [, y, m, d, h, min, s, fraction, offset] = match
  const parts = [y, m, d, h, min, s].map(Number)
  const utc = Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5], Number((fraction || '').slice(0, 3).padEnd(3, '0')))
  const date = new Date(utc)
  if (parts[0] < 2000 || parts[0] > 2200 || date.getUTCFullYear() !== parts[0] || date.getUTCMonth() + 1 !== parts[1] || date.getUTCDate() !== parts[2] || parts[3] > 23 || parts[4] > 59 || parts[5] > 59) throw badPayload()
  if (offset) {
    if (offset !== 'Z' && (Number(offset.slice(1, 3)) > 14 || Number(offset.slice(4)) > 59 || (Number(offset.slice(1, 3)) === 14 && Number(offset.slice(4)) !== 0))) throw badPayload()
    const result = new Date(value.replace(' ', 'T'))
    if (Number.isNaN(result.getTime())) throw badPayload()
    return result.toISOString()
  }
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: validatePdcTimezone(timezone), year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
  const localParts = time => {
    const p = Object.fromEntries(formatter.formatToParts(new Date(time)).map(p => [p.type, p.value]))
    return [p.year, p.month, p.day, p.hour, p.minute, p.second].map(Number)
  }
  const candidates = new Set()
  for (const sample of [utc - 86400000, utc, utc + 86400000]) {
    const p = localParts(sample)
    const shift = Date.UTC(p[0], p[1] - 1, p[2], p[3], p[4], p[5]) - Math.floor(sample / 1000) * 1000
    const candidate = utc - shift
    if (localParts(candidate).every((v, i) => v === parts[i])) candidates.add(candidate)
  }
  if (candidates.size !== 1) throw badPayload()
  return new Date([...candidates][0]).toISOString()
}

export const parsePdcWebhook = (body, timezone) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw badPayload()
  const awb = boundedPdcText(body.AWB, 100, true)
  const ref = boundedPdcText(body.REF, 200, true)
  const rawId = body.StatusID
  if (!['string', 'number'].includes(typeof rawId) || !/^\d+$/.test(String(rawId)) || !Number.isSafeInteger(Number(rawId)) || Number(rawId) <= 0 || Number(rawId) > 2147483647) throw badPayload()
  return {
    awb, ref, status_id: Number(rawId),
    status_name: boundedPdcText(body.CustomerStatusName, 200),
    reason: boundedPdcText(body.ReasonName, 500),
    status_date: parsePdcStatusDate(body.StatusDate, timezone), source: 'webhook'
  }
}

export const pdcEventKey = update => {
  const identity = update.status_id != null
    ? [update.awb, update.status_id]
    : [update.awb, update.status_name.toLowerCase(), update.reason, update.status_date]
  return `v2:${createHash('sha256').update(JSON.stringify(identity)).digest('hex')}`
}

export const persistPdcUpdate = async (db, update, signal) => {
  const { data, error } = await db.rpc('shipping_record_pdc_event', {
    p_update: { ...update, event_key: pdcEventKey(update) }
  }).abortSignal(signal || AbortSignal.timeout(4000))
  if (error) throw createError({ statusCode: 503, statusMessage: 'Courier update could not be saved.' })
  if (data?.error) throw createError({ statusCode: data.error === 'unknown_ref' ? 404 : 409, statusMessage: 'Shipment reference does not match.' })
  if (!data?.received) throw createError({ statusCode: 503, statusMessage: 'Courier update could not be saved.' })
  return data
}
