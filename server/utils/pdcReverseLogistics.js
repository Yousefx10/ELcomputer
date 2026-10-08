import { getPdcSettings, requestPdcJson, requestPdcLabel, findShipmentResult, validatePdcBaseUrl, PDC_LABEL_BUCKET } from './pdcShipping.js'
import { decryptShippingSecret } from './shippingSecrets.js'
import { requestPdcLookup, pdcResponseRows } from './pdcLookups.js'
import { boundedPdcText, parsePdcStatusDate, persistPdcUpdate } from './pdcTracking.js'
import { runClaimRpc as claimRpc } from './claimDatabase.js'
import { claimError } from './afterSalesClaimValidation.js'

export const pdcReverseReady = (settings, runtime = useRuntimeConfig()) => {
  try {
    validatePdcBaseUrl(settings.base_url, settings.api_mode)
    return runtime.shippingLiveRequestsEnabled === true && settings.is_enabled === true && settings.reverse_enabled === true && Number(settings.reverse_shipment_type_id) === 3 &&
      /^\d{1,40}$/.test(settings.company_id || '') && Number(settings.product_id) > 0 && Number(settings.default_weight_kg) > 0 && Number(settings.origin_city_id) > 0 &&
      Boolean(settings.origin_address?.trim() && settings.origin_contact_name?.trim()) && /^01\d{9}$/.test(settings.origin_phone || '') &&
      Boolean(decryptShippingSecret(settings.access_token_encrypted)) && decryptShippingSecret(settings.webhook_secret_encrypted).length >= 32
  } catch { return false }
}
export const verifyReverseResult = (response, reference) => {
  const entries = response?.successResponses
  if (response?.generalResponse?.success === false && response?.generalResponse?.summary?.totalShipments === 1 && response?.generalResponse?.summary?.invalidShipments === 1 && Array.isArray(entries) && entries.length === 0 && Array.isArray(response.badResponses) && response.badResponses.length > 0) return { state: 'failed', code: 'provider_rejected' }
  if (!Array.isArray(entries) || entries.length !== 1 || response?.generalResponse?.success !== true || entries[0]?.success !== true || (entries[0]?.errors && entries[0].errors.length)) return { state: 'uncertain', code: 'invalid_response' }
  if (entries[0].ref !== reference) return { state: 'uncertain', code: 'ref_mismatch' }
  if (typeof entries[0].awb !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9-]{0,99}$/.test(entries[0].awb)) return { state: 'uncertain', code: 'invalid_response' }
  const result = findShipmentResult(response, reference)
  return { state: 'created', ref: reference, awb: result.awb }
}
const finishReverse = (db, job, result) => claimRpc(db, 'shipping_claim_finish', {
  p_job: job.id, p_token: job.token, p_state: result.state, p_ref: result.ref || null, p_awb: result.awb || null, p_code: result.code || null
})
export const processPdcReverseQueue = async ({ supabaseAdmin: db, limit = 10, fetcher = fetch, runtime = useRuntimeConfig() }) => {
  const settings = await getPdcSettings(db), ready = pdcReverseReady(settings, runtime), processed = []
  const jobs = await claimRpc(db, 'shipping_claim_take', { p_ready: ready, p_limit: Math.min(25, Math.max(1, Number(limit) || 10)) })
  for (const job of jobs) {
    if (!await claimRpc(db, 'shipping_claim_dispatch', { p_job: job.id, p_token: job.token, p_ready: ready })) { processed.push({ id: job.id, state: 'failed' }); continue }
    let result
    try { result = verifyReverseResult(await requestPdcJson({ settings, endpoint: 'SaveShipmentEx', body: job.payload, fetcher, bounded: true }), job.to_ref) }
    catch (error) { result = { state: 'uncertain', code: ['TimeoutError', 'AbortError'].includes(error.name) ? 'timeout' : 'provider_unavailable' } }
    try { processed.push(await finishReverse(db, job, result)) }
    catch (error) {
      // A provider success whose durable commit failed is never submitted again.
      // Lease expiry makes it uncertain; stable REF recovery can complete it.
      if (result.state === 'created') {
        try { processed.push(await finishReverse(db, job, { state: 'uncertain', code: 'awb_conflict' })) } catch { processed.push({ id: job.id, state: 'uncertain' }) }
      } else processed.push({ id: job.id, state: 'uncertain' })
    }
  }
  const labels = await claimRpc(db, 'shipping_claim_label_take', { p_ready: ready, p_limit: Math.min(25, Math.max(1, Number(limit) || 10)) })
  for (const job of labels) {
    let success = false
    try {
      const bytes = await requestPdcLabel({ settings, awb: job.awb, fetcher, bounded: true })
      const { error } = await db.storage.from(PDC_LABEL_BUCKET).upload(`claims/${job.claim_id}/${job.id}.pdf`, bytes, { contentType: 'application/pdf', upsert: true })
      success = !error
    } catch {}
    try { await claimRpc(db, 'shipping_claim_label_finish', { p_job: job.id, p_token: job.token, p_success: success }); processed.push({ id: job.id, label_ready: success }) }
    catch { processed.push({ id: job.id, label_ready: false }) }
  }
  return { active: ready, processed }
}
export const operatePdcReverse = async (actor, claim, operation, fetcher = fetch) => {
  const settings = await getPdcSettings(actor.db), ready = pdcReverseReady(settings)
  const job = await claimRpc(actor.db, 'shipping_claim_operation', { p_admin: actor.id, p_claim: claim, p_job: operation.job, p_action: operation.action, p_ready: ready })
  if (operation.action === 'label') return job
  const response = await requestPdcLookup(settings, 'GetShipmentsStatus', { awBs: job.awb || '', reFs: job.ref }, fetcher)
  const matches = pdcResponseRows(response).filter(row => typeof row.Ref === 'string' && row.Ref === job.ref && (!job.awb || row.AWB === job.awb))
  if (matches.length !== 1 || typeof matches[0].AWB !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9-]{0,99}$/.test(matches[0].AWB)) claimError('reverseMatch', 409)
  const row = matches[0], rawId = row.StatusID
  if (rawId != null && (!/^\d+$/.test(String(rawId)) || !Number.isInteger(Number(rawId)) || Number(rawId) < 1 || Number(rawId) > 2147483647)) claimError('reverseMatch', 409)
  const update = { ref: job.ref, awb: row.AWB, status_id: rawId == null ? null : Number(rawId), status_name: boundedPdcText(row.Status, 200, true), reason: boundedPdcText(row.Reason, 500),
    status_date: row.StatusDate ? parsePdcStatusDate(row.StatusDate, settings.status_timezone) : null, source: 'reconciliation', observed_at: job.observed_at }
  if (operation.action === 'recover') await finishReverse(actor.db, job, { state: 'created', ref: job.ref, awb: row.AWB })
  return persistPdcUpdate(actor.db, update)
}
