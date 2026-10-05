import { createError, setHeader } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { getPdcSettings } from '../../utils/pdcShipping'
import { isShippingEncryptionReady } from '../../utils/shippingSecrets'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const { supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'settings.edit'
  })
  const settings = await getPdcSettings(supabaseAdmin)
  const [cityCountResult, jobCountResult] = await Promise.all([
    supabaseAdmin
      .from('shipping_city_mappings')
      .select('*', { count: 'exact', head: true })
      .eq('provider', 'pdc'),
    supabaseAdmin
      .from('shipping_order_jobs')
      .select('*', { count: 'exact', head: true })
      .in('state', ['queued', 'blocked', 'submitting', 'label_pending', 'failed'])
  ])
  const encounteredError = cityCountResult.error || jobCountResult.error

  if (encounteredError) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Courier settings are unavailable.'
    })
  }

  const { data: mappings, error: mappingError } = await supabaseAdmin.from('shipping_status_mappings')
    .select('provider_status_id, provider_label, normalized_state, provider_aliases').eq('provider', 'pdc').order('provider_status_id')
  if (mappingError) throw createError({ statusCode: 503, statusMessage: 'Courier mappings are unavailable.' })
  return {
    mappings: mappings || [],
    settings: {
      id: settings.id,
      display_name: settings.display_name,
      base_url: settings.base_url,
      api_mode: settings.api_mode,
      status_timezone: settings.status_timezone,
      cities_cache: settings.cities_cache || [],
      products_cache: settings.products_cache || [],
      cities_synced_at: settings.cities_synced_at,
      products_synced_at: settings.products_synced_at,
      company_id: settings.company_id,
      product_id: Number(settings.product_id),
      origin_city_id: settings.origin_city_id ? Number(settings.origin_city_id) : null,
      origin_address: settings.origin_address || '',
      origin_phone: settings.origin_phone || '',
      origin_contact_name: settings.origin_contact_name || '',
      default_weight_kg: Number(settings.default_weight_kg),
      shipment_type_id: Number(settings.shipment_type_id),
      label_template_id: Number(settings.label_template_id),
      allow_open_shipment: Boolean(settings.allow_open_shipment),
      all_must_valid: Boolean(settings.all_must_valid),
      is_enabled: Boolean(settings.is_enabled),
      auto_create_labels: Boolean(settings.auto_create_labels),
      access_token_configured: Boolean(settings.access_token_encrypted),
      webhook_secret_configured: Boolean(settings.webhook_secret_encrypted),
      encryption_ready: isShippingEncryptionReady(),
      live_requests_enabled: useRuntimeConfig().shippingLiveRequestsEnabled === true,
      city_mapping_count: cityCountResult.count || 0,
      pending_job_count: jobCountResult.count || 0,
      updated_at: settings.updated_at
    }
  }
})
