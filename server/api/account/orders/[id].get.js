import { readCourierName } from '../../../utils/courierName'
import { createError, getRouterParam, setHeader } from 'h3'
import { requireCustomerRequest } from '../../../utils/customerRequest'
import { readCustomerShipment } from '../../../utils/customerShipment'
import { throwRequestDatabaseError } from '../../../utils/requestDatabaseError'
import { readOwnedAfterSalesEntitlements } from '../../../utils/afterSalesPolicy.js'
import { readCustomerPayment } from '../../../utils/payments/customerStatus.js'
import { readBillSummary } from '../../../utils/customerBills.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const { authUser, supabaseAdmin } = await requireCustomerRequest(event)
  const orderId = getRouterParam(event, 'id')
  if (!UUID.test(orderId || '')) throw createError({ statusCode: 404, statusMessage: 'Order not found.' })

  const { data: order, error: orderError } = await supabaseAdmin.from('customer_orders')
    .select('id, order_number, user_id, status, payment_status, paid_at, packing_completed_at, payment_method, payment_fee_amount, payment_proof_status, payment_proof_file_name, payment_proof_uploaded_at, shipping_review_status, shipping_method, shipping_company_id, shipping_company_name, shipping_fee_amount, first_name, last_name, street_address, city, governorate, phone, subtotal_amount, discount_amount, delivery_discount_amount, total_amount, is_preorder, initial_amount_due, amount_paid, preorder_fulfillment_state, stock_fulfillment_state, fulfillment_message, currency, created_at, updated_at')
    .eq('id', orderId).eq('user_id', authUser.id).maybeSingle()
  if (orderError) throwRequestDatabaseError('Customer order', orderError)
  if (!order) throw createError({ statusCode: 404, statusMessage: 'Order not found.' })

  const [itemsResult, shippingResult, afterSales, customerPayment] = await Promise.all([
    supabaseAdmin.from('customer_order_items')
      .select('id, product_id, variant_id, variant_name, variant_code, variant_sku, variant_color_name, variant_color_hex, variant_options, product_title, product_slug, image_url, quantity, unit_price, line_total, is_preorder, preorder_payment_mode, preorder_deposit_percent, expected_availability_date, availability_message, initial_amount_due, warranty_status, warranty_duration_value, warranty_duration_unit, warranty_start_basis, warranty_snapshot_at')
      .eq('order_id', order.id).order('created_at'),
    readCustomerShipment(supabaseAdmin, order.id),
    readOwnedAfterSalesEntitlements(supabaseAdmin, order.id, authUser.id),
    readCustomerPayment(supabaseAdmin, order)
  ])
  if (itemsResult.error) throwRequestDatabaseError('Customer order items', itemsResult.error)

  const current=await requireCustomerRequest(event)
  const finalOwner=await supabaseAdmin.from('customer_orders').select('id').eq('id',order.id).eq('user_id',current.authUser.id).maybeSingle()
  if(current.authUser.id!==authUser.id||finalOwner.error||!finalOwner.data)throw createError({statusCode:404,statusMessage:'Order not found.'})
  const { user_id: _owner, ...safeOrder } = order
  safeOrder.customer_payment = customerPayment
  const policies = new Map(afterSales.map(row => [row.id, row.after_sales]))
  return { order: safeOrder, items: (itemsResult.data || []).map(item => ({ ...item, after_sales: policies.get(item.id) || null })), shipping: shippingResult || null, courierName: shippingResult ? await readCourierName(supabaseAdmin) : '',
    bill: await readBillSummary(supabaseAdmin, order.id) }
})
