import { createError } from 'h3'
import { isStoreAnalyticsUuid } from './storeAnalytics'
import { normalizePaymentMethod } from '~/utils/paymentMethods'
import { checkoutStreetAddress } from '~/utils/checkoutAddress'

export const normalizeCheckoutCommand = (body, user, { review = false } = {}) => {
  const invalid = message => { throw createError({ statusCode: 400, statusMessage: message }) }
  if (!body || Object.keys(body).some(key => !['cart_id', 'quote_id', 'review_token', 'items', 'coupon_code', 'address', 'shipping_method', 'shipping_company_id', 'payment_method', 'locale'].includes(key))) invalid('A valid checkout request is required.')
  const cartId = String(body?.cart_id || '').trim().toLowerCase()
  if (!isStoreAnalyticsUuid(cartId)) invalid('Refresh your cart before checkout.')
  if (!Array.isArray(body?.items) || !body.items.length || body.items.length > 100) invalid('A valid cart is required.')
  const lines = new Map()
  for (const item of body.items) {
    if (Object.keys(item || {}).some(key => !['id', 'product_id', 'variant_id', 'quantity'].includes(key))) invalid('Cart financial values must come from the store.')
    const product = String(item?.id || item?.product_id || '').trim().toLowerCase()
    const variant = String(item?.variant_id || '').trim().toLowerCase() || null
    const quantity = Number(item?.quantity)
    if (!isStoreAnalyticsUuid(product) || variant && !isStoreAnalyticsUuid(variant) || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) invalid('A valid product and quantity are required.')
    const key = `${product}:${variant || ''}`
    const total = (lines.get(key)?.quantity || 0) + quantity
    if (total > 99) invalid('A product option cannot have a quantity greater than 99.')
    lines.set(key, { product_id: product, variant_id: variant, quantity: total })
  }
  const text = value => String(value || '').trim()
  const address = body?.address || {}
  const order = Object.fromEntries(['first_name', 'last_name', 'street_address', 'city', 'governorate', 'phone'].map(key => [key, text(address[key])]))
  order.street_address = checkoutStreetAddress(address)
  order.email = text(address.email || user.email)
  if (!review) {
    if (!text(address.street_address)) invalid('Complete your delivery details.')
    for (const key of ['first_name', 'street_address', 'city', 'governorate', 'email']) if (!order[key]) invalid('Complete your delivery details.')
    if (!/^01\d{9}$/.test(order.phone)) invalid('Phone number must start with 01 and contain 11 digits.')
  }
  order.payment_method = normalizePaymentMethod(body?.payment_method)
  if (!order.payment_method) invalid('Choose a valid payment method.')
  order.shipping_method = text(body?.shipping_method || 'shipping')
  if (order.shipping_method !== 'shipping') invalid('Choose an available delivery method.')
  const shippingCompany = text(body?.shipping_company_id).toLowerCase()
  if (shippingCompany && (!isStoreAnalyticsUuid(shippingCompany) || !['cash', 'card'].includes(order.payment_method))) invalid('Choose an available delivery option.')
  if (shippingCompany) order.shipping_company_id = shippingCompany
  order.coupon_code = text(body?.coupon_code).toUpperCase() || null
  if (body?.locale !== undefined && !['en', 'ar'].includes(body.locale)) invalid('Choose a supported checkout language.')
  order.locale = body?.locale || 'en'
  return { cartId, order, items: [...lines.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value) }
}

export const throwCheckoutError = error => {
  const code = String(error?.message || '')
  const conflicts = {
    'checkout:conflict': 'This checkout changed. Review your cart before ordering.',
    'checkout:legacy': 'Review this order in My Account before ordering again.',
    'checkout:retired': 'This checkout was reset. Start a new cart.',
    'checkout:quote': 'This quote expired or changed. Review checkout again.',
    'checkout:unavailable': 'A product is no longer available. Refresh your cart.',
    'checkout:coupon': 'The coupon is no longer valid for this order.',
    'checkout:delivery': 'Choose delivery for your governorate.',
    'checkout:stock': 'This item has no available warehouse stock.'
  }
  const conflict = Object.keys(conflicts).find(key => code.includes(key))
  if (conflict) throw createError({ statusCode: 409, statusMessage: conflicts[conflict], data: { code: conflict } })
  if (error?.code === '42501') throw createError({ statusCode: 403, statusMessage: code === 'Confirm your account email before ordering.' ? code : 'A current customer account is required.' })
  // A business exception is a confirmed SQL rollback. Existing stock/preorder
  // guards must let the customer review again instead of retaining an invalid
  // command as though its acknowledgement were still uncertain.
  if (error?.code === 'P0001') throw createError({ statusCode: 409, statusMessage: code, data: { code: 'checkout:quote' } })
  if (error?.code === '23505' || error?.code === '55P03' || error?.code === '40P01') {
    throw createError({ statusCode: 409, statusMessage: 'Checkout is busy. Retry the same request.' })
  }
  throw createError({ statusCode: 500, statusMessage: 'Could not confirm checkout. Retry the same request.' })
}
