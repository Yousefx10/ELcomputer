import { createError } from 'h3'
import { requireCustomerRequest } from './customerRequest'
import { normalizeCheckoutCommand, throwCheckoutError } from './checkoutCommand'
import { getPaymobConfig } from './payments/paymob.js'
import { requireCodCheckoutSchema } from './codCheckout'
import { authorizeNormalCheckout, authorizeNormalQuote } from './normalPurchase.js'

// Both preview actions use the same authenticated, server-priced SQL review.
// Coupon usage is consumed only by the existing durable checkout transaction.
export const reviewCheckout = async (event, { requireCoupon = false } = {}) => {
  const { authUser, supabaseAdmin } = await requireCustomerRequest(event)
  const { cartId, order, items } = normalizeCheckoutCommand(await readBody(event), authUser, { review: true })
  const context = authorizeNormalCheckout({ runtime: useRuntimeConfig(event), user: authUser, cartId, order, items })
  if (requireCoupon && !order.coupon_code) throw createError({ statusCode: 400, statusMessage: 'Coupon code is required.' })
  await requireCodCheckoutSchema(supabaseAdmin, order.payment_method)
  if (order.payment_method === 'card') {
    try { getPaymobConfig(context.runtime) }
    catch { throw createError({ statusCode: 400, statusMessage: 'The selected payment method is not available.' }) }
  }
  const { data, error } = await supabaseAdmin.rpc('commerce_checkout_quote', {
    p_user_id: authUser.id, p_cart_id: context.cartId, p_order: order, p_items: items
  })
  if (error) throwCheckoutError(error)
  return { order, supabaseAdmin, review: authorizeNormalQuote(context, data) }
}
