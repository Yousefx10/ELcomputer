import {createHash} from 'node:crypto'
import { createError, getQuery } from 'h3'
import { getSupabaseAdminClient } from '../../../utils/supabaseAdmin'
import { getPaymobConfig, normalizePaymobCallback, verifyPaymobHmac, hmacMessage } from '../../../utils/payments/paymob.js'
import { paymentHandler, paymentNoStore, throwPaymentError } from '../../../utils/payments/index.js'
import { readPaymentCallbackBody } from '../../../utils/payments/body.js'
export default paymentHandler(async event => {
  paymentNoStore(event)
  let config
  try { config = getPaymobConfig(useRuntimeConfig(event), { callback: true }) } catch (error) { throwPaymentError(error) }
  const raw = await readPaymentCallbackBody(event)
  if (!raw) throw createError({ statusCode: 400, statusMessage: 'Invalid callback.' })
  let body
  try { body = JSON.parse(raw) } catch { throw createError({ statusCode: 400, statusMessage: 'Invalid callback.' }) }
  if (body?.type !== 'TRANSACTION' || !verifyPaymobHmac(body.obj, getQuery(event).hmac, config.hmacSecret)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid callback signature.' })
  }
  try {
    const transaction = {...normalizePaymobCallback(body.obj, config),evidence_sha256:createHash('sha256').update(hmacMessage(body.obj)).digest('hex'),signature_sha256:createHash('sha256').update(getQuery(event).hmac.toLowerCase()).digest('hex')}
    const result = await getSupabaseAdminClient().rpc('commerce_accept_payment_callback', { p_transaction: transaction })
    // Unknown signed mappings remain durable until intention persistence drains them.
    if (result.error) throw createError({ statusCode: result.error.code === 'P0001' ? 409 : 503, statusMessage: 'Callback could not be reconciled.' })
    return { received: true }
  } catch (error) {
    if (error?.statusMessage) throw error
    throwPaymentError(error)
  }
})
