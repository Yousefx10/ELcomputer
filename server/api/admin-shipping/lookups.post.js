import { createError } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { recordAdminActivity } from '../../utils/adminLogs'
import { getPdcSettings } from '../../utils/pdcShipping'
import { requirePdcReadAccess, requestPdcLookup, normalizePdcLookup } from '../../utils/pdcLookups'
import { readPaymentCallbackBody } from '../../utils/payments/body'

export default defineEventHandler(async event => {
  const { supabaseAdmin, adminUser } = await requireAdminRequest(event, { permission: 'settings.edit' })
  let body
  try { body = JSON.parse(await readPaymentCallbackBody(event, 1024, 2000)) } catch { throw createError({ statusCode: 400, statusMessage: 'Invalid lookup request.' }) }
  if (!['sync', 'test'].includes(body?.action)) throw createError({ statusCode: 400, statusMessage: 'Invalid lookup request.' })
  const settings = await getPdcSettings(supabaseAdmin)
  requirePdcReadAccess(settings)
  const { data: claimed, error: claimError } = await supabaseAdmin.rpc('shipping_claim_pdc_lookup').abortSignal(AbortSignal.timeout(4000))
  if (claimError) throw createError({ statusCode: 503, statusMessage: 'Courier lookup is unavailable.' })
  if (!claimed) throw createError({ statusCode: 429, statusMessage: 'Try again in one minute.' })
  const products = normalizePdcLookup(await requestPdcLookup(settings, 'GetProducts'))
  let cities = []
  if (body.action === 'sync') {
    cities = normalizePdcLookup(await requestPdcLookup(settings, 'GetCities'))
    if (!cities.length || !products.length) throw createError({ statusCode: 502, statusMessage: 'Courier lookup is empty.' })
    const { data, error } = await supabaseAdmin.from('shipping_provider_settings').update({
      cities_cache: cities, products_cache: products, cities_synced_at: new Date().toISOString(), products_synced_at: new Date().toISOString()
    }).eq('id', 'pdc').eq('updated_at', settings.updated_at).select('id').maybeSingle()
    if (error || !data) throw createError({ statusCode: 409, statusMessage: 'Settings changed. Try again.' })
  }
  await recordAdminActivity({ supabaseAdmin, adminUser, actionKey: `shipping.pdc.${body.action}`,
    description: body.action === 'sync' ? 'Synced PDC lookups.' : 'Checked PDC connection.',
    metadata: { product_count: products.length, ...(body.action === 'sync' ? { city_count: cities.length } : {}) } })
  return { connected: true, product_count: products.length, ...(body.action === 'sync' ? { city_count: cities.length } : {}) }
})
