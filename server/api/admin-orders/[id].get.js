import { createError, getRouterParam } from 'h3'
import { normalizeAdminOrderItemRecord, normalizeAdminOrderRecord } from '../../utils/adminOrders'
import { requireAdminRequest } from '../../utils/adminRequest'

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event)
  const orderId = getRouterParam(event, 'id')

  if (!orderId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Order id is required.'
    })
  }

  const [
    { data: orderRecord, error: orderError },
    { data: orderItems, error: orderItemsError }
  ] = await Promise.all([
    supabaseAdmin
      .from('customer_orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle(),
    supabaseAdmin
      .from('customer_order_items')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at')
  ])

  if (orderError) {
    throw createError({
      statusCode: 500,
      statusMessage: orderError.message
    })
  }

  if (!orderRecord) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Order not found.'
    })
  }

  if (orderItemsError) {
    throw createError({
      statusCode: 500,
      statusMessage: orderItemsError.message
    })
  }

  let customerProfile = null

  if (orderRecord.user_id) {
    const { data: customerProfileRecord, error: customerProfileError } = await supabaseAdmin
      .from('customer_profiles')
      .select(`
        id,
        email,
        full_name,
        phone,
        address_line_1,
        address_line_2,
        city,
        state,
        country,
        wallet_balance
      `)
      .eq('id', orderRecord.user_id)
      .maybeSingle()

    if (customerProfileError) {
      throw createError({
        statusCode: 500,
        statusMessage: customerProfileError.message
      })
    }

    customerProfile = customerProfileRecord || null
  }

  return {
    order: normalizeAdminOrderRecord(orderRecord),
    items: (orderItems || []).map(normalizeAdminOrderItemRecord),
    customer: customerProfile
  }
})
