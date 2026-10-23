import { createError, getQuery, setHeader } from 'h3'
import { requireAdminRequest } from '../../../../utils/adminRequest'
import { tariffCompanyId, tariffUuid, tariffRpc, tariffContext, tariffReadiness } from '../../../../utils/shippingTariffs'

export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const { supabaseAdmin: db, adminUser } = await requireAdminRequest(event, { permission: 'settings.edit' })
  const company = tariffCompanyId(event), query = getQuery(event)
  const revision = query.revision === undefined ? null : Number(query.revision)
  if (revision !== null && (!Number.isSafeInteger(revision) || revision < 1)) throw createError({ statusCode: 400, statusMessage: 'Invalid revision.' })
  const result = await tariffRpc(db, 'shipping_tariff_read', { p_admin: adminUser.id, p_company: company, p_tariff: query.tariff ? tariffUuid(query.tariff) : null, p_revision: revision })
  const context = await tariffContext(db)
  return { ...result, context, readiness: result.selected ? tariffReadiness(result.selected.document, context) : null, checkout_eligible: false }
})
