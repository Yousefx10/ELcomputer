import { createError } from 'h3'
import { automatedSmsEvents, pdcSmsEvents, smsEventVariables, ORDER_SMS_MAX_SEGMENTS } from '../../../app/utils/orderSms.js'
import { estimateSmsSegments, normalizeSmsPhone, renderSmsTemplate, smsTemplateVariables } from '../../../app/utils/sms.js'
import { formatAccountMoney } from '../../../app/utils/accountOrders.js'
import { formatLocale } from '../../../app/utils/appearance.js'
import { formatCustomerOrderStatus } from '../../../app/utils/orderStatus.js'
import { getPaymentMethodLabel } from '../../../app/utils/paymentMethods.js'
import messageKeys from '../../../app/utils/uiMessageKeys.json' with { type: 'json' }
import arabic from '../../../i18n/locales/ar.json' with { type: 'json' }
import english from '../../../i18n/locales/en.json' with { type: 'json' }
import { shipmentReasonKey } from '../../../app/utils/shipmentTracking.js'
import { getSmsSettings, smsReadiness } from './settings.js'
import { createSmsService } from './service.js'

const check = result => {
  if (result.error) throw createError({ statusCode: 503, statusMessage: 'SMS intent storage is unavailable.' })
  return result.data
}
export const getOrderSmsSettings = async db => {
  const rows = check(await db.from('sms_order_event_settings').select('event_type,is_enabled,template_en_id,template_ar_id,config_revision,updated_at'))
  return automatedSmsEvents.map(event_type => rows.find(row => row.event_type === event_type) || {
    event_type, is_enabled: false, template_en_id: null, template_ar_id: null, config_revision: 0, updated_at: null
  })
}
export const validateOrderSmsSetting = async (db, body) => {
  const invalid = () => { throw createError({ statusCode: 400, statusMessage: 'Invalid notification settings.' }) }
  if (!body || !automatedSmsEvents.includes(body.event_type) || typeof body.is_enabled !== 'boolean' || !Number.isInteger(body.config_revision)) invalid()
  for (const key of ['template_en_id', 'template_ar_id']) {
    if (body[key] !== null && (typeof body[key] !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body[key]))) invalid()
    if (!body[key]) { if (body.is_enabled) invalid(); continue }
    // Disabling remains available if a previously bound template became invalid.
    if (!body.is_enabled) continue
    const template = check(await db.from('sms_templates').select('*').eq('id', body[key]).maybeSingle())
    if (!template || template.traffic_type !== 'notification') invalid()
    try {
      const text = template[key === 'template_ar_id' ? 'text_ar' : 'text_en']
      if (body.is_enabled && (!template.is_enabled || !text.trim())) invalid()
      if (smsTemplateVariables(text).some(variable => !smsEventVariables(body.event_type).includes(variable))) invalid()
    } catch { invalid() }
  }
  return { event_type: body.event_type, is_enabled: body.is_enabled, template_en_id: body.template_en_id, template_ar_id: body.template_ar_id }
}
const foldedMessageKeys = Object.fromEntries(Object.entries(messageKeys).map(([label, key]) => [label.toLowerCase(), key]))
const translatedLabel = (value, locale) => {
  if (locale !== 'ar') return value
  const key = foldedMessageKeys[value.toLowerCase()]
  return key?.split('.').reduce((object, part) => object?.[part], arabic) || value
}
export const renderOrderSms = (intent, reasonKey = null) => {
  const payload = intent.payload
  const text = intent.template_text
  const catalog = intent.locale === 'ar' ? arabic : english
  const reason = /^shipment\.reasons\.r\d+$/.test(reasonKey || '') ? reasonKey.split('.').reduce((object, part) => object?.[part], catalog) : null
  const known = pdcSmsEvents.includes(intent.event_type) ? {
    customer_name: String(payload.customer_name || ''), order_number: String(payload.order_number || ''),
    awb: String(payload.awb || ''), courier_name: 'PDC', delivery_reason: reason || catalog.sms.pdcNeutralReason
  } : {
    customer_name: String(payload.customer_name || ''), order_number: String(payload.order_number || ''),
    order_total: formatAccountMoney(payload.order_total, payload.currency, formatLocale(intent.locale)),
    currency: String(payload.currency || 'EGP'),
    order_status: translatedLabel(formatCustomerOrderStatus(payload.order_status), intent.locale),
    payment_method: translatedLabel(getPaymentMethodLabel(payload.payment_method), intent.locale)
  }
  const variables = {}
  for (const key of smsTemplateVariables(text)) {
    if (!smsEventVariables(intent.event_type).includes(key)) throw Error('Unsupported notification variable.')
    variables[key] = known[key]
  }
  return renderSmsTemplate(text, variables)
}
export const processOrderSmsEvents = async (db, { limit = 3 } = {}) => {
  const processed = []
  for (let index = 0; index < Math.min(3, Math.max(1, Number(limit) || 1)); index++) {
    const intent = check(await db.rpc('sms_claim_order_event'))
    if (!intent?.id) break
    let reason = 'storage_error'
    try {
      const settings = await getSmsSettings(db)
      if (!settings.is_enabled || !smsReadiness(settings).ready) {
        reason = settings.is_enabled ? 'provider_not_ready' : 'provider_disabled'; throw Error()
      }
      reason = 'invalid_phone'
      const recipient = normalizeSmsPhone(intent.payload.phone, { defaultCountry: settings.default_country, allowInternational: settings.allow_international })
      reason = 'invalid_template'
      let reasonKey = null
      if (pdcSmsEvents.includes(intent.event_type) && smsTemplateVariables(intent.template_text).includes('delivery_reason')) {
        reason = 'storage_error'
        const tracking = check(await db.from('shipping_webhook_events').select('reason_name').eq('id', intent.tracking_event_id).eq('shipment_job_id', intent.shipment_job_id).maybeSingle())
        if (!tracking) throw Error('Tracking event unavailable.')
        // Existing controlled customer reason categories only; raw text is never rendered/stored in SMS.
        reasonKey = shipmentReasonKey(tracking.reason_name)
      }
      reason = 'invalid_template'
      const text = renderOrderSms(intent, reasonKey)
      reason = 'segment_limit'
      if (estimateSmsSegments(text).segments > ORDER_SMS_MAX_SEGMENTS) throw Error()
      reason = 'invalid_template'
      if (!text.trim() || text.length > 4000) throw Error()
      reason = 'storage_error'
      const result = await createSmsService(db).sendNotification({
        recipients: [recipient], text, sender: intent.sender, idempotencyKey: intent.idempotency_key,
        triggerSource: pdcSmsEvents.includes(intent.event_type) ? 'pdc:' + intent.event_type.slice(4) : 'order:' + intent.event_type, expiresAt: new Date(intent.expires_at).toISOString(), priority: 20,
        orderEvent: { id: intent.id, token: intent.lease_token, templateId: intent.template_id }
      })
      processed.push({ id: intent.id, status: result.status === 'suppressed' ? 'suppressed' : 'queued' })
    } catch (error) {
      // Queue insertion and intent completion are one SQL transaction. An outage
      // leaves only a bounded local preparation retry; commerce is already committed.
      if (reason === 'storage_error' && error?.statusCode === 400) reason = 'invalid_template'
      check(await db.rpc('sms_finish_order_event', { p_id: intent.id, p_token: intent.lease_token, p_reason: reason }))
      processed.push({ id: intent.id, status: reason === 'storage_error' ? 'deferred' : 'suppressed' })
    }
  }
  return { processed }
}
