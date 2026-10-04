import { createError, getQuery, readRawBody } from 'h3'
import { getSupabaseAdminClient } from '../../../utils/supabaseAdmin'
import { getPaymobConfig, normalizePaymobCallback, verifyPaymobHmac } from '../../../utils/payments/paymob.js'
import { paymentHandler, paymentNoStore, throwPaymentError } from '../../../utils/payments/index.js'
export default paymentHandler(async event => {
  paymentNoStore(event)
  let config
  try { config = getPaymobConfig(useRuntimeConfig(event)) } catch (error) { throwPaymentError(error) }
  const raw = await readRawBody(event, 'utf8')
  if (!raw || Buffer.byteLength(raw) > 65536) throw createError({ statusCode: 413, statusMessage: 'Invalid callback.' })
  let body
  try { body = JSON.parse(raw) } catch { throw createError({ statusCode: 400, statusMessage: 'Invalid callback.' }) }
  if (body?.type !== 'TRANSACTION' || !verifyPaymobHmac(body.obj, getQuery(event).hmac, config.hmacSecret)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid callback signature.' })
  }
  try {
    const transaction = normalizePaymobCallback(body.obj, config)
    const result = await getSupabaseAdminClient().rpc('commerce_reconcile_payment_transaction', { p_transaction: transaction })
    // Unknown provider order may be callback-before-intention-persistence; ask Paymob to retry.
    if (result.error) throw createError({ statusCode: result.error.code === 'P0001' ? 409 : 503, statusMessage: 'Callback could not be reconciled.' })
    return { received: true }
  } catch (error) {
    if (error?.statusMessage) throw error
    throwPaymentError(error)
  }
})
