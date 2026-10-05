import { createError } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { recordAdminActivity } from '../../utils/adminLogs'
import { readPaymentCallbackBody } from '../../utils/payments/body'
import { shippingStates } from '../../../app/utils/shipmentTracking'

export default defineEventHandler(async event => {
  const { supabaseAdmin, adminUser } = await requireAdminRequest(event, { permission: 'settings.edit' })
  let body
  try { body = JSON.parse(await readPaymentCallbackBody(event, 8192, 2000)) } catch { throw createError({ statusCode: 400, statusMessage: 'Invalid courier mapping.' }) }
  const id = Number(body?.provider_status_id)
  const label = body?.provider_label
  const aliases = body?.provider_aliases
  if (!Number.isInteger(id) || id <= 0 || id > 2147483647 || !shippingStates.includes(body?.normalized_state)
    || typeof label !== 'string' || !label.trim() || label.length > 200 || /[\x00-\x1f\x7f]/.test(label)
    || !Array.isArray(aliases) || aliases.length > 20 || aliases.some(a => typeof a !== 'string' || a.length > 200 || /[\x00-\x1f\x7f]/.test(a))) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid courier mapping.' })
  }
  const { error } = await supabaseAdmin.from('shipping_status_mappings').upsert({
    provider: 'pdc', provider_status_id: id, provider_label: label.trim(), normalized_state: body.normalized_state,
    provider_aliases: [...new Set(aliases.map(a => a.trim()).filter(Boolean))], updated_at: new Date().toISOString()
  }, { onConflict: 'provider,provider_status_id' })
  if (error) throw createError({ statusCode: 503, statusMessage: 'Courier mapping could not be saved.' })
  await recordAdminActivity({ supabaseAdmin, adminUser, actionKey: 'shipping.pdc.mapping.update', description: 'Updated PDC status mapping.', metadata: { provider_status_id: id, normalized_state: body.normalized_state } })
  return { saved: true }
})
