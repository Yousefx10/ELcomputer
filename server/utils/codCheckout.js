import { createError } from 'h3'

// Fail closed if application code arrives before its shipping migration.
// Check schema only: exact receipt recovery must survive price/stock/config changes.
export const requireCodCheckoutSchema = async (supabaseAdmin, method) => {
  if (!['cash', 'card'].includes(method)) return
  const { error } = await supabaseAdmin.from('customer_orders').select(method === 'card' ? 'shipping_fee_amount,card_checkout_verified' : 'shipping_fee_amount').limit(0)
  if (error) throw createError({ statusCode: 503, statusMessage: 'Checkout is not ready.' })
}
