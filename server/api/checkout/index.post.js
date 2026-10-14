import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import { requireCustomerRequest } from '../../utils/customerRequest'
import { isStoreAnalyticsUuid, recordStoreOrderCreated } from '../../utils/storeAnalytics'
import { normalizeCheckoutCommand, throwCheckoutError } from '../../utils/checkoutCommand'
import { getPaymobConfig } from '../../utils/payments/paymob.js'

export default defineEventHandler(async event => {
  const { authUser, supabaseAdmin } = await requireCustomerRequest(event)
  const body = await readBody(event)
  const { cartId, order: orderPayload, items: orderItems } = normalizeCheckoutCommand(body, authUser)
  const quoteId = String(body?.quote_id || '').trim().toLowerCase()
  if (!isStoreAnalyticsUuid(quoteId)) throw createError({ statusCode: 409, statusMessage: 'Review checkout before confirming.', data: { code: 'checkout:quote' } })
  if (orderPayload.payment_method === 'card') {
    try { getPaymobConfig(useRuntimeConfig(event)) }
    catch {
      // A disabled gateway may recover a committed command. Only the guarded
      // RPC can verify its content; this lookup never returns an order itself.
      const existing = await supabaseAdmin.from('customer_orders').select('id').eq('user_id', authUser.id).eq('checkout_cart_id', cartId).maybeSingle()
      if (existing.error || !existing.data) throw createError({ statusCode: 400, statusMessage: 'The selected payment method is not available.' })
    }
  }
  orderPayload.order_number = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`
  setHeader(event, 'Cache-Control', 'private, no-store')
  const { data: orderResult, error: orderError } = await supabaseAdmin.rpc('commerce_checkout_command', {
    p_user_id: authUser.id, p_cart_id: cartId, p_quote_id: quoteId, p_order: orderPayload, p_items: orderItems
  })
  if (orderError) throwCheckoutError(orderError)
  const { first_name: firstName, last_name: lastName, email, phone, street_address: streetAddress, city, governorate } = orderPayload
  const fullName = [firstName, lastName].filter(Boolean).join(' ')
  const rpcResult = Array.isArray(orderResult)
    ? orderResult[0]
    : orderResult || {}
  let orderRecord = rpcResult.order && typeof rpcResult.order === 'object'
    ? rpcResult.order
    : rpcResult
  const orderId = orderRecord.id || rpcResult.order_id || rpcResult.orderId

  if (!orderId) {
    throw createError({
      statusCode: 500,
      statusMessage: 'The order transaction completed without returning an order ID.'
    })
  }

  if (!orderRecord.order_number) {
    const { data: storedOrder, error: storedOrderError } = await supabaseAdmin
      .from('customer_orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle()

    if (storedOrderError || !storedOrder) {
      if (storedOrderError) {
        console.error(
          'Could not load the created checkout order:',
          storedOrderError.code || 'unknown'
        )
      }

      throw createError({
        statusCode: 500,
        statusMessage: 'Could not load the created order.'
      })
    }

    orderRecord = storedOrder
  }

  const isPreorder = Boolean(orderRecord.is_preorder)
  const wasCreated = rpcResult.created !== false &&
    rpcResult.was_created !== false &&
    rpcResult.wasCreated !== false

  let profileUpdateError = null

  if (wasCreated) {
    const profileUpdateResult = await supabaseAdmin
      .from('customer_profiles')
      .upsert({
        id: authUser.id,
        email,
        full_name: fullName || authUser.email?.split('@')[0] || 'Customer',
        phone,
        address_line_1: streetAddress,
        city,
        state: governorate,
        country: 'Egypt',
        updated_at: new Date().toISOString()
      })

    profileUpdateError = profileUpdateResult.error
  }

  if (profileUpdateError) {
    console.error('Could not update customer profile after checkout:', profileUpdateError.message)
  }

  if (wasCreated) {
    try {
      await recordStoreOrderCreated({
        event,
        supabaseAdmin,
        userId: authUser.id,
        orderId,
        cartId,
        source: isPreorder ? 'preorder_checkout' : 'checkout'
      })
    } catch {
      console.error('Could not record checkout analytics.')
    }
  }

  return {
    order: {
      id: orderId,
      orderNumber: orderRecord.order_number,
      subtotalAmount: Number(orderRecord.subtotal_amount || 0),
      discountAmount: Number(orderRecord.discount_amount || 0),
      paymentFeeAmount: Number(orderRecord.payment_fee_amount || 0),
      totalAmount: Number(orderRecord.total_amount || 0),
      paymentMethod: orderRecord.payment_method,
      paymentProofStatus: orderRecord.payment_proof_status,
      isPreorder: Boolean(orderRecord.is_preorder),
      initialAmountDue: Number(orderRecord.initial_amount_due || 0),
      amountPaid: Number(orderRecord.amount_paid || 0),
      coupon: null
    }
  }
})
