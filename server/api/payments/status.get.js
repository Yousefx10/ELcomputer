import { createError, getQuery } from 'h3'
import { requireCustomerRequest } from '../../utils/customerRequest'
import { paymentHandler, paymentNoStore } from '../../utils/payments/index.js'
import { readOwnedPaymentStatus } from '../../utils/payments/customerStatus.js'
export default paymentHandler(async event => {
  paymentNoStore(event)
  const { authUser, supabaseAdmin } = await requireCustomerRequest(event)
  const query = getQuery(event)
  let orderId = String(query.order_id || '')
  if (!orderId && /^\d{1,18}$/.test(String(query.provider_order_id || ''))) {
    // Unsigned redirect selector is just a lookup, constrained to this customer below.
    const { data, error } = await supabaseAdmin.from('payment_attempts').select('order_id').eq('provider', 'paymob').eq('provider_order_id', String(query.provider_order_id)).maybeSingle()
    if (error) throw createError({ statusCode: 503, statusMessage: 'Payment status unavailable.' })
    orderId = data?.order_id || ''
  }
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) throw createError({ statusCode: 404, statusMessage: 'Order not found.' })
  return readOwnedPaymentStatus(supabaseAdmin, authUser.id, orderId)
})
