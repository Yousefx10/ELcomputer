import { createError, defineEventHandler, setHeader, setResponseStatus } from 'h3'
import { getPaymobConfig, createPaymobIntention, buildIntentionRequest, PaymentError } from './paymob.js'

// Provider boundary: checkout knows only order IDs and normalized capabilities.
export const paymentProviders = { paymob: { configure: getPaymobConfig, createIntention: createPaymobIntention } }
export const paymentNoStore = event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Referrer-Policy', 'no-referrer')
}
export const throwPaymentError = error => {
  throw createError({ statusCode: error instanceof PaymentError ? error.statusCode : 503,
    statusMessage: 'Payment could not be confirmed. Check your order before trying again.' })
}
// Handle API failures here so Nitro's generic 404 renderer cannot replace privacy headers
// or echo callback URLs/query payloads into an error response.
export const paymentHandler = handler => defineEventHandler(async event => {
  paymentNoStore(event)
  try { return await handler(event) }
  catch (error) {
    const candidate = Number(error?.statusCode)
    const statusCode = Number.isInteger(candidate) && candidate >= 400 && candidate <= 599 ? candidate : 503
    setResponseStatus(event, statusCode)
    return { error: true, statusCode, statusMessage: 'Payment could not be confirmed. Check your order before trying again.' }
  }
})
const rpc = async (db, name, params) => {
  const result = await db.rpc(name, params)
  if (result.error) throw new PaymentError('payment_database_unavailable', result.error.code === 'P0001' ? 409 : 503)
  return result.data
}
export const initiateOrderPayment = async ({ db, userId, orderId, locale, runtime, fetcher = fetch }) => {
  const config = paymentProviders.paymob.configure(runtime)
  const { data: order, error } = await db.from('customer_orders').select('id, user_id, order_number, status, payment_status, payment_method, is_preorder, total_amount, currency, first_name, last_name, email, phone, street_address, city, governorate')
    .eq('id', orderId).eq('user_id', userId).maybeSingle()
  if (error) throw new PaymentError('payment_database_unavailable')
  if (!order) throw new PaymentError('order_not_found', 404)
  if (order.payment_method !== 'card' || order.is_preorder) throw new PaymentError('order_not_payable', 409)
  const claimed = await rpc(db, 'commerce_claim_payment_attempt', { p_order_id: orderId, p_user_id: userId, p_mode: config.mode, p_integration_id: config.integrationId })
  const attempt = claimed.attempt
  if (attempt.mode !== config.mode || attempt.integration_id !== config.integrationId) throw new PaymentError('configuration_changed', 409)
  if (!claimed.created) {
    if (!attempt.client_secret || !['pending', 'failed'].includes(attempt.status) || new Date(attempt.expires_at).getTime() <= Date.now()) throw new PaymentError('payment_requires_review', 409)
    return { provider: 'paymob', mode: config.mode, publicKey: config.publicKey, clientSecret: attempt.client_secret, methods: ['card'], orderId }
  }
  try {
    const payload = buildIntentionRequest(config, order, attempt, locale)
    const result = await paymentProviders.paymob.createIntention(config, payload, fetcher)
    await rpc(db, 'commerce_store_payment_intention', { p_attempt_id: attempt.id, p_intention_id: result.intentionId, p_provider_order_id: result.providerOrderId, p_client_secret: result.clientSecret })
    return { provider: 'paymob', mode: config.mode, publicKey: config.publicKey, clientSecret: result.clientSecret, methods: ['card'], orderId }
  } catch (error) {
    // Never send provider error/body/billing data to logs or the customer.
    await db.from('payment_attempts').update({ error_code: error instanceof PaymentError ? error.code : 'intention_uncertain', updated_at: new Date().toISOString() })
      .eq('id', attempt.id).eq('status', 'initiated')
    throw error
  }
}
