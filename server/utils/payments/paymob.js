import { createHmac, timingSafeEqual } from 'node:crypto'
import { configuredPaymobMethods } from './methods.js'

export class PaymentError extends Error {
  constructor(code, statusCode = 503) { super(code); this.code = code; this.statusCode = statusCode }
}
const enabled = value => value === true || value === 'true'
export const getPaymobConfig = runtime => {
  if (!enabled(runtime.paymobEnabled)) throw new PaymentError('gateway_disabled')
  const mode = runtime.paymobMode || 'test'
  if (!['test', 'live'].includes(mode)) throw new PaymentError('invalid_mode')
  // Foundation phase cannot send live requests, even with otherwise valid keys.
  if (mode === 'live') throw new PaymentError('live_mode_unavailable')
  const secretKey = String(runtime.paymobSecretKey || '')
  const publicKey = String(runtime.paymobPublicKey || '')
  const hmacSecret = String(runtime.paymobHmacSecret || '')
  const integrationId = Number(runtime.paymobCardIntegrationId)
  if (!secretKey.startsWith(`egy_sk_${mode}_`) || !publicKey.startsWith(`egy_pk_${mode}_`)
    || !hmacSecret || !Number.isSafeInteger(integrationId) || integrationId < 1
    || runtime.paymobCardIntegrationMode !== mode) throw new PaymentError('invalid_configuration')
  const origin = new URL(String(runtime.public?.siteUrl || ''))
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') {
    throw new PaymentError('invalid_origin')
  }
  let methods
  try { methods = configuredPaymobMethods(runtime, mode) } catch { throw new PaymentError('invalid_configuration') }
  return { provider: 'paymob', methods, mode, secretKey, publicKey, hmacSecret, integrationId, origin: origin.origin }
}

// Parse fixed decimals without binary floating-point multiplication or rounding.
export const toMinorUnits = value => {
  const match = String(value).match(/^(\d{1,12})(?:\.(\d{1,2}))?$/)
  if (!match) throw new PaymentError('invalid_amount', 409)
  const result = Number(BigInt(match[1]) * BigInt(100) + BigInt((match[2] || '').padEnd(2, '0')))
  if (!Number.isSafeInteger(result) || result <= 0) throw new PaymentError('invalid_amount', 409)
  return result
}

export const buildIntentionRequest = (config, order, attempt, locale = 'en') => {
  const amount = toMinorUnits(order.total_amount)
  if (order.currency !== 'EGP' || amount !== Number(attempt.amount_minor)) throw new PaymentError('order_changed', 409)
  return {
    amount, currency: 'EGP', payment_methods: [config.integrationId],
    // One authoritative payable snapshot includes discount and configured fee.
    items: [{ name: order.order_number || order.id, amount, quantity: 1 }],
    billing_data: {
      first_name: order.first_name, last_name: order.last_name || 'NA', email: order.email,
      phone_number: order.phone, street: order.street_address, city: order.city,
      state: order.governorate, country: 'EG', apartment: 'NA', floor: 'NA', building: 'NA', postal_code: 'NA'
    },
    special_reference: attempt.id, expiration: 1800,
    notification_url: `${config.origin}/api/payments/paymob/webhook`,
    redirection_url: `${config.origin}${locale === 'ar' ? '/ar' : ''}/checkout/payment-result?order_id=${order.id}`
  }
}

export const createPaymobIntention = async (config, payload, fetcher = fetch, timeoutMs = 10000) => {
  let response
  try {
    response = await fetcher('https://accept.paymob.com/v1/intention/', {
      method: 'POST', headers: { Authorization: `Token ${config.secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(timeoutMs)
    })
  } catch { throw new PaymentError('intention_uncertain', 502) }
  // No automatic POST retries: timeout/5xx may have created an intention remotely.
  if (!response.ok) throw new PaymentError(response.status >= 500 ? 'intention_uncertain' : 'provider_rejected', 502)
  let data
  try { data = await response.json() } catch { throw new PaymentError('intention_uncertain', 502) }
  const detail = data?.intention_detail
  if (typeof data?.id !== 'string' || !data.id.startsWith(`pi_${config.mode}_`) || data.id.length > 160
    || !Number.isSafeInteger(data.intention_order_id) || data.intention_order_id < 1
    || typeof data.client_secret !== 'string' || !data.client_secret.startsWith(`egy_csk_${config.mode}_`) || data.client_secret.length > 512
    || detail?.amount !== payload.amount || detail?.currency !== payload.currency
    || data.special_reference !== payload.special_reference) throw new PaymentError('intention_uncertain', 502)
  return { intentionId: data.id, providerOrderId: String(data.intention_order_id), clientSecret: data.client_secret }
}

// Official POST obj field order. These fields are verified; unsigned extras never identify an order.
export const PAYMOB_HMAC_FIELDS = [
  'amount_cents', 'created_at', 'currency', 'error_occured', 'has_parent_transaction', 'id',
  'integration_id', 'is_3d_secure', 'is_auth', 'is_capture', 'is_refunded', 'is_standalone_payment',
  'is_voided', 'order.id', 'owner', 'pending', 'source_data.pan', 'source_data.sub_type', 'source_data.type', 'success'
]
export const hmacMessage = transaction => PAYMOB_HMAC_FIELDS.map(path => {
  const value = path.split('.').reduce((obj, key) => obj?.[key], transaction)
  if (!['string', 'boolean', 'number'].includes(typeof value) || String(value).length > 256) throw new PaymentError('invalid_callback', 400)
  return String(value)
}).join('')
export const verifyPaymobHmac = (transaction, signature, secret) => {
  if (typeof signature !== 'string' || !/^[a-f0-9]{128}$/i.test(signature) || !secret) return false
  try {
    const expected = createHmac('sha512', secret).update(hmacMessage(transaction)).digest()
    return timingSafeEqual(expected, Buffer.from(signature, 'hex'))
  } catch { return false }
}
export const normalizePaymobCallback = (transaction, config) => {
  for (const field of ['pending', 'success', 'error_occured', 'is_auth', 'is_capture', 'is_refunded', 'is_voided', 'is_standalone_payment', 'has_parent_transaction']) {
    if (typeof transaction[field] !== 'boolean') throw new PaymentError('invalid_callback', 400)
  }
  for (const value of [transaction.id, transaction.order?.id, transaction.amount_cents, transaction.integration_id]) {
    if (!Number.isSafeInteger(value) || value < 1) throw new PaymentError('invalid_callback', 400)
  }
  if (transaction.integration_id !== config.integrationId || transaction.currency !== 'EGP' || transaction.source_data?.type !== 'card') {
    throw new PaymentError('callback_context_mismatch', 409)
  }
  // Authorization-only, refunds, voids, captures and child transactions are separate future workflows.
  if (transaction.is_auth || transaction.is_capture || transaction.is_refunded || transaction.is_voided
    || transaction.has_parent_transaction || !transaction.is_standalone_payment) throw new PaymentError('unsupported_transaction', 422)
  return {
    provider_order_id: String(transaction.order.id), transaction_id: String(transaction.id),
    integration_id: config.integrationId, mode: config.mode, currency: transaction.currency, amount_minor: transaction.amount_cents,
    status: transaction.pending ? 'pending' : transaction.success && !transaction.error_occured ? 'succeeded' : 'failed'
  }
}
