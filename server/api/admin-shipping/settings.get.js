import { createError } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { getPdcSettings } from '../../utils/pdcShipping'
import { isShippingEncryptionReady } from '../../utils/shippingSecrets'

export default defineEventHandler(async (event) => {
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
      statusMessage: encounteredError.message
    })
  }

  return {
    settings: {
      id: settings.id,
      display_name: settings.display_name,
      base_url: settings.base_url,
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
