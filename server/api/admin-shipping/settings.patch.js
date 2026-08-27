import { createError } from 'h3'
import { recordAdminActivity } from '../../utils/adminLogs'
import { requireAdminRequest } from '../../utils/adminRequest'
import {
  PDC_PRODUCTION_BASE_URL,
  getPdcSettings
} from '../../utils/pdcShipping'
import { encryptShippingSecret } from '../../utils/shippingSecrets'

const cleanText = (value) => String(value || '').trim()

const positiveInteger = (value, label, { allowEmpty = false } = {}) => {
  if (allowEmpty && (value === null || value === undefined || value === '')) {
    return null
  }

  const number = Number(value)

  if (!Number.isInteger(number) || number <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `${label} is invalid.`
    })
  }

  return number
}

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'settings.edit'
  })
  const currentSettings = await getPdcSettings(supabaseAdmin)
  const body = await readBody(event)
  const originPhone = cleanText(body?.origin_phone).replace(/\s+/g, '')
  const defaultWeight = Number(body?.default_weight_kg)
  const shipmentTypeId = positiveInteger(body?.shipment_type_id, 'Shipment type')
  const accessToken = cleanText(body?.access_token)
  const webhookSecret = cleanText(body?.webhook_secret)

  if (originPhone && !/^01\d{9}$/.test(originPhone)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Pickup phone must contain 11 digits.'
    })
  }

  if (!Number.isFinite(defaultWeight) || defaultWeight <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Default weight is invalid.'
    })
  }

  if (![1, 3, 5].includes(shipmentTypeId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Shipment type is invalid.'
    })
  }

  if (webhookSecret && webhookSecret.length < 32) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Webhook secret needs at least 32 characters.'
    })
  }

  const runtimeConfig = useRuntimeConfig()
  const liveRequestsEnabled = runtimeConfig.shippingLiveRequestsEnabled === true
  const updatePayload = {
    display_name: cleanText(body?.display_name) || 'PDC Courier',
    base_url: PDC_PRODUCTION_BASE_URL,
    company_id: cleanText(body?.company_id),
    product_id: positiveInteger(body?.product_id, 'Product id'),
    origin_city_id: positiveInteger(body?.origin_city_id, 'Pickup city', { allowEmpty: true }),
    origin_address: cleanText(body?.origin_address) || null,
    origin_phone: originPhone || null,
    origin_contact_name: cleanText(body?.origin_contact_name) || null,
    default_weight_kg: defaultWeight,
    shipment_type_id: shipmentTypeId,
    label_template_id: positiveInteger(body?.label_template_id, 'Label template'),
    allow_open_shipment: Boolean(body?.allow_open_shipment),
    all_must_valid: Boolean(body?.all_must_valid),
    is_enabled: liveRequestsEnabled && Boolean(body?.is_enabled),
    auto_create_labels: Boolean(body?.auto_create_labels),
    updated_by: adminUser.id,
    updated_at: new Date().toISOString()
  }

  if (!updatePayload.company_id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Company id is required.'
    })
  }

  if (accessToken) {
    updatePayload.access_token_encrypted = encryptShippingSecret(accessToken)
  }

  if (webhookSecret) {
    updatePayload.webhook_secret_encrypted = encryptShippingSecret(webhookSecret)
  }

  const { data, error } = await supabaseAdmin
    .from('shipping_provider_settings')
    .update(updatePayload)
    .eq('id', 'pdc')
    .select('*')
    .single()

  if (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error.message
    })
  }

  if (data.is_enabled && data.auto_create_labels) {
    const { error: queueError } = await supabaseAdmin
      .rpc('queue_eligible_paid_orders_for_shipping')

    if (queueError) {
      throw createError({
        statusCode: 500,
        statusMessage: queueError.message
      })
    }
  }

  await recordAdminActivity({
    supabaseAdmin,
    adminUser,
    actionKey: 'shipping.pdc.settings.update',
    description: 'Updated PDC shipping settings.',
    metadata: {
      provider: 'pdc',
      token_changed: Boolean(accessToken),
      webhook_secret_changed: Boolean(webhookSecret),
      auto_create_labels: Boolean(data.auto_create_labels),
      live_enabled: Boolean(data.is_enabled)
    }
  })

  return {
    saved: true,
    live_enabled: Boolean(data.is_enabled),
    access_token_configured: Boolean(data.access_token_encrypted || currentSettings.access_token_encrypted),
    webhook_secret_configured: Boolean(data.webhook_secret_encrypted || currentSettings.webhook_secret_encrypted)
  }
})
