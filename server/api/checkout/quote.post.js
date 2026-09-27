import { createError } from 'h3'
import { requireCustomerRequest } from '../../utils/customerRequest'
import { calculatePreorderAmounts } from '~/utils/preorder'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default defineEventHandler(async event => {
  const { supabaseAdmin } = await requireCustomerRequest(event)
  const body = await readBody(event)
  const items = body?.items
  if (!Array.isArray(items) || !items.length || items.length > 100) throw createError({ statusCode: 400, statusMessage: 'A valid cart is required.' })
  const productIds = [...new Set(items.map(item => String(item.id || '').toLowerCase()))]
  if (productIds.some(id => !UUID.test(id))) throw createError({ statusCode: 400, statusMessage: 'Invalid product.' })
  const { data: products, error } = await supabaseAdmin.from('products')
    .select('id, title, price, is_published, is_serialized, selling_mode, expected_availability_date, availability_message, preorder_active, preorder_starts_at, preorder_ends_at, preorder_payment_mode, preorder_deposit_percent, preorder_customer_limit')
    .in('id', productIds)
  if (error || products?.length !== productIds.length) throw createError({ statusCode: 409, statusMessage: 'A product is no longer available.' })
  const productMap = new Map(products.map(product => [product.id, product]))
  const modes = new Set(products.map(product => product.selling_mode))
  if (modes.size !== 1 || modes.has('coming_soon')) throw createError({ statusCode: 409, statusMessage: 'Place preorder and ready-to-ship items separately.' })
  const preorder = modes.has('preorder')
  if (preorder && body?.coupon_code) throw createError({ statusCode: 400, statusMessage: 'Coupons are not available for preorders.' })
  const variantIds = [...new Set(items.map(item => item.variant_id).filter(Boolean))]
  const variants = variantIds.length
    ? await supabaseAdmin.from('product_variants').select('id, product_id, is_active').in('id', variantIds)
    : { data: [], error: null }
  if (variants.error || variants.data?.length !== variantIds.length) throw createError({ statusCode: 409, statusMessage: 'A selected option is unavailable.' })
  const variantMap = new Map(variants.data.map(variant => [variant.id, variant]))
  const quantities = new Map()
  const lines = []
  let orderValueCents = 0
  let requiredNowCents = 0
  for (const item of items) {
    const product = productMap.get(String(item.id || '').toLowerCase())
    const quantity = Number(item.quantity)
    if (!product?.is_published || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw createError({ statusCode: 409, statusMessage: 'A product is no longer available.' })
    if (product.is_serialized && (!item.variant_id || variantMap.get(item.variant_id)?.product_id !== product.id || !variantMap.get(item.variant_id)?.is_active)) throw createError({ statusCode: 409, statusMessage: 'Select an available product option.' })
    if (!product.is_serialized && item.variant_id) throw createError({ statusCode: 409, statusMessage: 'This product has no options.' })
    if (preorder) {
      if (!product.preorder_active || product.preorder_starts_at && new Date() < new Date(product.preorder_starts_at) || product.preorder_ends_at && new Date() >= new Date(product.preorder_ends_at)) throw createError({ statusCode: 409, statusMessage: 'A preorder is not open.' })
    }
    quantities.set(product.id, (quantities.get(product.id) || 0) + quantity)
    const amounts = calculatePreorderAmounts(product.price, quantity, preorder ? product.preorder_payment_mode : 'full', product.preorder_deposit_percent)
    orderValueCents += Math.round(amounts.total * 100)
    requiredNowCents += Math.round(amounts.due * 100)
    lines.push({ productId: product.id, variantId: item.variant_id || null, title: product.title, quantity, ...amounts, paymentMode: preorder ? product.preorder_payment_mode : 'full', depositPercent: preorder ? product.preorder_deposit_percent : null, expectedAvailabilityDate: preorder ? product.expected_availability_date : null, availabilityMessage: preorder ? product.availability_message : null })
  }
  if (preorder && products.some(product => product.preorder_customer_limit && quantities.get(product.id) > product.preorder_customer_limit)) throw createError({ statusCode: 409, statusMessage: 'A preorder quantity exceeds its limit.' })
  const method = String(body?.payment_method || '').trim()
  let paymentFeeCents = 0
  if (method) {
    const { data: settings, error: settingsError } = await supabaseAdmin.from('site_settings')
      .select('payment_card_enabled,payment_card_fee,payment_bank_transfer_enabled,payment_bank_transfer_fee,payment_instapay_enabled,payment_instapay_fee,payment_paypal_enabled,payment_paypal_fee,payment_cash_enabled,payment_cash_fee')
      .eq('key', 'default').maybeSingle()
    if (settingsError || !settings || !['card','bank_transfer','instapay','paypal','cash'].includes(method) || !settings[`payment_${method}_enabled`]
      || preorder && !['bank_transfer','instapay'].includes(method)) throw createError({ statusCode: 400, statusMessage: 'The payment method is unavailable.' })
    paymentFeeCents = Math.round(Number(settings[`payment_${method}_fee`] || 0) * 100)
  }
  setHeader(event, 'Cache-Control', 'no-store')
  return { isPreorder: preorder, orderValue: orderValueCents / 100, paymentFee: paymentFeeCents / 100, requiredNow: (requiredNowCents + paymentFeeCents) / 100, remainingAfterPayment: (orderValueCents - requiredNowCents) / 100, lines }
})
