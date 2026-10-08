import { createError } from 'h3'
import { claimTypes, claimStatuses, claimActionPermissions, claimResolutions } from '../../app/utils/afterSalesClaims.js'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const claimError = (code, statusCode = 400) => { throw createError({ statusCode, statusMessage: 'Could not complete this claim request.', data: { code } }) }
export const claimUuid = value => uuid.test(value || '') ? value : claimError('input')
export const exact = (body, allowed) => {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !allowed.includes(key))) claimError('input')
}
const text = (value, required = true, maximum = 4000) => {
  if (typeof value !== 'string' || value.trim().length > maximum || (required && !value.trim())) claimError('input')
  return value.trim()
}
const evidenceIds = values => {
  if (!Array.isArray(values) || values.length > 5 || new Set(values).size !== values.length) claimError('input')
  return values.map(claimUuid)
}
export const validateClaimForm = (body, preview = false) => {
  exact(body, ['item_id', 'claim_type', 'quantity', 'description', 'reason_key', 'opened', 'packaging', 'serials', 'attachment_ids', 'idempotency_key', 'locale'])
  if (!claimTypes.includes(body.claim_type) || !Number.isInteger(body.quantity) || body.quantity < 1 || body.quantity > 99) claimError('input')
  for (const key of ['opened', 'packaging']) if (body[key] !== undefined && body[key] !== null && typeof body[key] !== 'boolean') claimError('input')
  const serials = body.serials ?? []
  if (!Array.isArray(serials) || serials.length > body.quantity) claimError('input')
  const normalizedSerials = serials.map(value => text(value, true, 120))
  if (new Set(normalizedSerials).size !== normalizedSerials.length) claimError('input')
  const reason = body.reason_key == null ? null : text(body.reason_key, true, 64)
  if (reason !== null && !/^[a-z][a-z0-9_]{0,63}$/.test(reason)) claimError('input')
  if (body.claim_type === 'return' && normalizedSerials.length || body.claim_type === 'warranty' && reason !== null) claimError('input')
  const form = { claim_type: body.claim_type, quantity: body.quantity, reason_key: reason,
    opened: body.opened ?? null, packaging: body.packaging ?? null, serials: normalizedSerials, attachment_ids: evidenceIds(body.attachment_ids ?? []) }
  if (!preview) {
    if (!['en', 'ar'].includes(body.locale)) claimError('input')
    Object.assign(form, { item_id: claimUuid(body.item_id), idempotency_key: claimUuid(body.idempotency_key), description: text(body.description), locale: body.locale })
  }
  return form
}
export const validateClaimAction = (body, staff = false) => {
  exact(body, ['action', 'revision', 'text', 'resolution', 'require_evidence', 'attachment_ids'])
  if (!Number.isInteger(body.revision) || body.revision < 1 || !(staff ? Object.hasOwn(claimActionPermissions, body.action) : ['respond', 'cancel'].includes(body.action))) claimError('input')
  const input = { text: text(body.text ?? '', !staff || !['review', 'inspect'].includes(body.action)) }
  if (staff) {
    if (body.attachment_ids !== undefined) claimError('input')
    if (body.resolution !== undefined) {
      if (body.action !== 'select_resolution' || !claimResolutions.includes(body.resolution)) claimError('input')
      input.resolution = body.resolution
    }
    if (body.require_evidence !== undefined) {
      if (body.action !== 'request_information' || typeof body.require_evidence !== 'boolean') claimError('input')
      input.require_evidence = body.require_evidence
    }
  } else {
    if (body.resolution !== undefined || body.require_evidence !== undefined) claimError('input')
    input.attachment_ids = evidenceIds(body.attachment_ids ?? [])
    if (body.action === 'cancel' && input.attachment_ids.length) claimError('input')
  }
  return { action: body.action, revision: body.revision, input }
}
export const claimQuery = query => {
  const rawPage = query.page ?? '1'
  if (!/^\d{1,5}$/.test(String(rawPage)) || Number(rawPage) < 1 || Number(rawPage) > 10000 || typeof (query.search ?? '') !== 'string' || String(query.search ?? '').length > 100) claimError('input')
  if (query.type && !claimTypes.includes(query.type) || query.status && !claimStatuses.includes(query.status)) claimError('input')
  return { p_page: Number(rawPage), p_search: String(query.search ?? '').trim(), p_type: query.type || null, p_status: query.status || null }
}
