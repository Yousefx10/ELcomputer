import { requireCustomerRequest } from '../../utils/customerRequest'
import { normalizeCheckoutCommand, throwCheckoutError } from '../../utils/checkoutCommand'
import { getPaymobConfig } from '../../utils/payments/paymob.js'
import { createError } from 'h3'
import { requireCodCheckoutSchema } from '../../utils/codCheckout'

export default defineEventHandler(async event => {
  const { authUser, supabaseAdmin } = await requireCustomerRequest(event)
  const { cartId, order, items } = normalizeCheckoutCommand(await readBody(event), authUser, { review: true })
  await requireCodCheckoutSchema(supabaseAdmin, order.payment_method)
  if (order.payment_method === 'card') {
    try { getPaymobConfig(useRuntimeConfig(event)) }
    catch { throw createError({ statusCode: 400, statusMessage: 'The selected payment method is not available.' }) }
  }
  const { data, error } = await supabaseAdmin.rpc('commerce_checkout_quote', {
    p_user_id: authUser.id, p_cart_id: cartId, p_order: order, p_items: items
  })
  if (error) throwCheckoutError(error)
  setHeader(event, 'Cache-Control', 'private, no-store')
  return data
})
