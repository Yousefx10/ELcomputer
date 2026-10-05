import { createError } from 'h3'
import { validatePdcBaseUrl } from './pdcShipping.js'
import { validatePdcTimezone } from './pdcTracking.js'
import { encryptShippingSecret, decryptShippingSecret, shippingSecretsMatch } from './shippingSecrets.js'

const fail = label => { throw createError({ statusCode: 400, statusMessage: `${label} is invalid.` }) }
const text = (value, limit, label) => {
  if (value == null) return ''
  if (typeof value !== 'string' || value.length > limit || /[\x00-\x1f\x7f]/.test(value)) fail(label)
  return value.trim()
}
const positive = (value, label, optional = false) => {
  if (optional && (value == null || value === '')) return null
  const number = Number(value)
  if (!Number.isInteger(number) || number <= 0 || number > 2147483647) fail(label)
  return number
}
export const validatePdcSettings = (body, current) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Settings')
  const api_mode = body.api_mode ?? current.api_mode ?? 'production'
  const company_id = text(body.company_id, 40, 'Company ID')
  if (!/^\d+$/.test(company_id)) fail('Company ID')
  const phone = text(body.origin_phone, 40, 'Pickup phone').replace(/\s+/g, '')
  if (phone && !/^01\d{9}$/.test(phone)) fail('Pickup phone')
  const weight = Number(body.default_weight_kg)
  if (!Number.isFinite(weight) || weight <= 0 || weight > 99999.999) fail('Default weight')
  const type = positive(body.shipment_type_id, 'Shipment type')
  if (![1, 3, 5].includes(type)) fail('Shipment type')
  const update = {
    api_mode, base_url: validatePdcBaseUrl(body.base_url ?? current.base_url, api_mode),
    status_timezone: validatePdcTimezone(body.status_timezone ?? current.status_timezone),
    company_id, product_id: positive(body.product_id, 'Product ID'),
    display_name: text(body.display_name, 100, 'Provider name') || 'PDC Courier',
    origin_city_id: positive(body.origin_city_id, 'Pickup city', true), origin_phone: phone || null,
    origin_address: text(body.origin_address, 1000, 'Pickup address') || null,
    origin_contact_name: text(body.origin_contact_name, 100, 'Pickup contact') || null,
    default_weight_kg: weight, shipment_type_id: type, label_template_id: positive(body.label_template_id, 'Label template')
  }
  for (const key of ['allow_open_shipment', 'all_must_valid', 'is_enabled', 'auto_create_labels']) {
    if (typeof body[key] !== 'boolean') fail('Settings')
    update[key] = body[key]
  }
  const token = text(body.access_token, 4096, 'Access Token')
  const secret = text(body.webhook_secret, 4096, 'Webhook Secret')
  if (secret && secret.length < 32) fail('Webhook Secret')
  if (secret && (token || current.access_token_encrypted) && shippingSecretsMatch(secret, token || decryptShippingSecret(current.access_token_encrypted))) fail('Webhook Secret')
  if (token && !secret && current.webhook_secret_encrypted && shippingSecretsMatch(token, decryptShippingSecret(current.webhook_secret_encrypted))) fail('Access Token')
  if (token) update.access_token_encrypted = encryptShippingSecret(token)
  if (secret) update.webhook_secret_encrypted = encryptShippingSecret(secret)
  if (api_mode !== current.api_mode || update.base_url !== current.base_url || company_id !== current.company_id || token) {
    Object.assign(update, { cities_cache: [], products_cache: [], cities_synced_at: null, products_synced_at: null })
  }
  return update
}
