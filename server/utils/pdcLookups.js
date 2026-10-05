import { createError } from 'h3'
import { validatePdcBaseUrl } from './pdcShipping.js'
import { decryptShippingSecret } from './shippingSecrets.js'
import { boundedPdcText, parsePdcStatusDate, persistPdcUpdate } from './pdcTracking.js'

const unavailable = () => createError({ statusCode: 502, statusMessage: 'Courier lookup is unavailable.' })
export const requirePdcReadAccess = (settings, runtime = useRuntimeConfig()) => {
  if (runtime.shippingLiveRequestsEnabled !== true || !settings.is_enabled) throw createError({ statusCode: 503, statusMessage: 'Courier calls are disabled.' })
  validatePdcBaseUrl(settings.base_url, settings.api_mode)
  if (!settings.access_token_encrypted || !/^\d{1,40}$/.test(settings.company_id || '')) throw createError({ statusCode: 503, statusMessage: 'Courier credentials are incomplete.' })
}

// This boundary accepts read-only operations only. It never creates a shipment/label.
export const requestPdcLookup = async (settings, operation, body, fetcher = fetch) => {
  if (!['GetCities', 'GetProducts', 'GetShipmentsStatus'].includes(operation)) throw unavailable()
  validatePdcBaseUrl(settings.base_url, settings.api_mode)
  try {
    const response = await fetcher(new URL(operation, settings.base_url).toString(), {
      method: operation === 'GetShipmentsStatus' ? 'POST' : 'GET',
      headers: { AccessToken: decryptShippingSecret(settings.access_token_encrypted), CompanyID: String(settings.company_id), Accept: 'application/json', 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), redirect: 'error', signal: AbortSignal.timeout(8000)
    })
    if (!response.ok || Number(response.headers.get('content-length')) > 1048576 || !response.body) throw unavailable()
    const reader = response.body.getReader()
    const chunks = []
    let bytes = 0
    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        bytes += value.byteLength
        if (bytes > 1048576) { await reader.cancel(); throw unavailable() }
        chunks.push(Buffer.from(value))
      }
    } finally { reader.releaseLock() }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch { throw unavailable() }
}

export const pdcResponseRows = response => {
  const rows = Array.isArray(response) ? response : response?.data ?? response?.items ?? response?.shipments
  // The vendor does not specify pagination controls. Never silently accept a partial cache.
  if (!Array.isArray(rows) || rows.length > 5000 || response?.hasMore === true || response?.nextPage || Number(response?.totalCount ?? rows.length) > rows.length) throw unavailable()
  return rows
}

export const normalizePdcLookup = response => {
  const seen = new Set()
  return pdcResponseRows(response).map(row => {
    const id = Number(row?.id ?? row?.ID)
    const name = boundedPdcText(row?.name ?? row?.Name, 200, true)
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647 || seen.has(id)) throw unavailable()
    seen.add(id)
    return { id, name }
  })
}

export const reconcilePdcShipment = async (db, settings, orderId, fetcher = fetch) => {
  const { data: claim, error } = await db.rpc('shipping_claim_pdc_refresh', { p_order_id: orderId }).abortSignal(AbortSignal.timeout(4000))
  if (error) throw unavailable()
  if (claim?.error) throw createError({ statusCode: claim.error === 'throttled' ? 429 : 404, statusMessage: claim.error === 'throttled' ? 'Try again in five minutes.' : 'Shipment not found.' })
  if (!claim?.awb || !claim.ref) throw unavailable()
  const response = await requestPdcLookup(settings, 'GetShipmentsStatus', { awBs: claim.awb, reFs: claim.ref }, fetcher)
  const rows = pdcResponseRows(response)
  const matches = rows.filter(row => String(row?.AWB ?? '').trim() === claim.awb && String(row?.Ref ?? '').trim() === claim.ref)
  if (matches.length !== 1) throw createError({ statusCode: 409, statusMessage: 'Courier shipment could not be matched.' })
  const row = matches[0]
  let id = null
  if (row.StatusID != null) {
    if (!/^\d+$/.test(String(row.StatusID)) || !Number.isInteger(Number(row.StatusID)) || Number(row.StatusID) <= 0 || Number(row.StatusID) > 2147483647) throw unavailable()
    id = Number(row.StatusID)
  }
  const update = {
    awb: claim.awb, ref: claim.ref, status_id: id,
    status_name: boundedPdcText(row.Status, 200, true), reason: boundedPdcText(row.Reason, 500),
    status_date: row.StatusDate ? parsePdcStatusDate(row.StatusDate, settings.status_timezone) : null,
    observed_at: claim.observed_at, source: 'reconciliation'
  }
  return persistPdcUpdate(db, update)
}
