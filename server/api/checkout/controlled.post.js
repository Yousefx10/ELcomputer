import { createError } from 'h3'
import { requireCustomerRequest } from '../../utils/customerRequest'
import { paymentHandler } from '../../utils/payments/index.js'
import { readPaymentCallbackBody } from '../../utils/payments/body.js'
import { controlledPurchase } from '../../utils/controlledPurchase.js'

export default paymentHandler(async event => {
  const { authUser, supabaseAdmin } = await requireCustomerRequest(event)
  let body
  try { body = JSON.parse(await readPaymentCallbackBody(event, 8192, 2000)) } catch { throw createError({ statusCode: 400, statusMessage: 'Invalid purchase.' }) }
  const { action, ...input } = body || {}
  if (!['quote', 'order', 'pay'].includes(action)) throw createError({ statusCode: 400, statusMessage: 'Invalid purchase.' })
  return controlledPurchase({ db: supabaseAdmin, user: authUser, runtime: useRuntimeConfig(event), action, input })
})
