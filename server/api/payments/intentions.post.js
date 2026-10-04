import { createError, readBody } from 'h3'
import { requireCustomerRequest } from '../../utils/customerRequest'
import { paymentHandler, initiateOrderPayment, paymentNoStore, throwPaymentError } from '../../utils/payments/index.js'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export default paymentHandler(async event => {
  paymentNoStore(event)
  const { authUser, supabaseAdmin } = await requireCustomerRequest(event)
  const body = await readBody(event)
  if (!body || Object.keys(body).some(key => !['order_id', 'locale'].includes(key)) || !UUID.test(body.order_id || '') || !['en', 'ar', undefined].includes(body.locale)) {
    throw createError({ statusCode: 400, statusMessage: 'A valid order reference is required.' })
  }
  try { return await initiateOrderPayment({ db: supabaseAdmin, userId: authUser.id, orderId: body.order_id, locale: body.locale, runtime: useRuntimeConfig(event) }) }
  catch (error) { throwPaymentError(error) }
})
