import { createError, setHeader } from 'h3'
import { requireAdminRequest } from '../../../../utils/adminRequest'
import { readPaymentCallbackBody } from '../../../../utils/payments/body'
import { tariffCompanyId, tariffUuid, tariffRpc, tariffContext, normalizeTariffRequest, tariffDiff, tariffReadiness } from '../../../../utils/shippingTariffs'

export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const { supabaseAdmin: db, adminUser } = await requireAdminRequest(event, { permission: 'settings.edit' })
  const company = tariffCompanyId(event)
  let body
  try { body = JSON.parse(await readPaymentCallbackBody(event, 2000000, 5000)) } catch (error) { throw createError({ statusCode: error.statusCode || 400, statusMessage: 'Invalid tariff request.' }) }
  if (!body || Array.isArray(body) || !['preview', 'save', 'verify'].includes(body.action) || Object.keys(body).some(k => !['action', 'tariff_id', 'command_id', 'expected_revision', 'document'].includes(k))) throw createError({ statusCode: 400, statusMessage: 'Invalid tariff request.' })
  const id = tariffUuid(body.tariff_id), revision = body.expected_revision
  if (!Number.isSafeInteger(revision) || revision < 0 || revision > 2147483646) throw createError({ statusCode: 400, statusMessage: 'Invalid tariff revision.' })
  const document = normalizeTariffRequest(body.document)
  if (body.action === 'preview') {
    const current = await tariffRpc(db, 'shipping_tariff_read', { p_admin: adminUser.id, p_company: company, p_tariff: revision === 0 ? null : id, p_revision: null })
    if (revision > 0 && current.selected?.revision !== revision) throw createError({ statusCode: 409, statusMessage: 'Tariff changed. Reload before saving.' })
    const context = await tariffContext(db), readiness = tariffReadiness(document, context)
    return { document, diff: tariffDiff(revision === 0 ? {} : current.selected.document, document), readiness, checkout_eligible: false }
  }
  // Verification freezes a reviewed version; it never enables checkout pricing.
  // SQL validates verification atomically after checking a durable command receipt.
  // A lost acknowledgement can replay even after the current revision changes.
  return tariffRpc(db, 'shipping_tariff_save', { p_admin: adminUser.id, p_company: company, p_tariff: id, p_command: tariffUuid(body.command_id), p_expected: revision, p_document: document, p_verify: body.action === 'verify' })
})
