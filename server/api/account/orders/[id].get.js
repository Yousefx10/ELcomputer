import { createError, getRouterParam } from 'h3'
import { requireCustomerRequest } from '../../../utils/customerRequest'
import { throwRequestDatabaseError } from '../../../utils/requestDatabaseError'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default defineEventHandler(async event => {
  const { authUser, supabaseAdmin } = await requireCustomerRequest(event)
  const orderId = getRouterParam(event, 'id')
  if (!UUID.test(orderId || '')) throw createError({ statusCode: 404, statusMessage: 'Order not found.' })

  const { data: order, error: orderError } = await supabaseAdmin.from('customer_orders')
    .select('id, order_number, user_id, status, payment_status, paid_at, shipping_review_status, shipping_method, payment_method, first_name, last_name, street_address, city, governorate, phone, subtotal_amount, discount_amount, total_amount, currency, created_at, updated_at')
    .eq('id', orderId).eq('user_id', authUser.id).maybeSingle()
  if (orderError) throwRequestDatabaseError('Customer order', orderError)
  if (!order) throw createError({ statusCode: 404, statusMessage: 'Order not found.' })

  const [itemsResult, shippingResult] = await Promise.all([
    supabaseAdmin.from('customer_order_items')
      .select('id, product_id, product_title, product_slug, image_url, quantity, unit_price, line_total')
      .eq('order_id', order.id).order('created_at'),
    supabaseAdmin.from('shipping_order_jobs')
      .select('provider, state, awb, provider_status_name, provider_status_at')
      .eq('order_id', order.id).maybeSingle()
  ])
  if (itemsResult.error) throwRequestDatabaseError('Customer order items', itemsResult.error)
  if (shippingResult.error) throwRequestDatabaseError('Customer shipment', shippingResult.error)

  const { user_id: _owner, ...safeOrder } = order
  return { order: safeOrder, items: itemsResult.data || [], shipping: shippingResult.data || null }
})
