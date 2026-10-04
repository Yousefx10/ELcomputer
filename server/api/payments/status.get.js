import { createError, getQuery } from 'h3'
import { requireCustomerRequest } from '../../utils/customerRequest'
import { paymentHandler, paymentNoStore } from '../../utils/payments/index.js'
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
  const { data: order, error } = await supabaseAdmin.from('customer_orders').select('id, order_number, payment_status, payment_method, status').eq('id', orderId).eq('user_id', authUser.id).maybeSingle()
  if (error) throw createError({ statusCode: 503, statusMessage: 'Payment status unavailable.' })
  if (!order) throw createError({ statusCode: 404, statusMessage: 'Order not found.' })
  const attemptResult = await supabaseAdmin.from('payment_attempts').select('status, mode, expires_at').eq('order_id', orderId).eq('provider', 'paymob').maybeSingle()
  if (attemptResult.error) throw createError({ statusCode: 503, statusMessage: 'Payment status unavailable.' })
  const attempt = attemptResult.data
  const status = order.payment_status === 'paid' ? 'paid' : order.status === 'cancelled' ? 'cancelled'
    : attempt?.status === 'succeeded' ? (attempt.mode === 'test' ? 'test_succeeded' : 'processing')
    : attempt?.status === 'failed' ? 'failed'
    : attempt && new Date(attempt.expires_at).getTime() <= Date.now() ? 'expired' : attempt?.status || 'not_started'
  return { orderId, orderNumber: order.order_number, status, mode: attempt?.mode || null }
})
