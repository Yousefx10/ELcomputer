import { createError } from 'h3'
import { createHash, createHmac, timingSafeEqual, randomUUID } from 'node:crypto'
import { normalizeCheckoutCommand, throwCheckoutError } from './checkoutCommand.js'
import { getPaymobConfig, toMinorUnits } from './payments/paymob.js'
import { initiateOrderPayment } from './payments/index.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const fields = ['enabled', 'customer_id', 'cart_id', 'product_id', 'variant_id', 'shipping_company_id', 'total_minor', 'address_sha256', 'starts_at', 'expires_at', 'payment_enabled', 'review_key']
const fail = (statusCode = 403) => { throw createError({ statusCode, statusMessage: 'This purchase is unavailable.' }) }
const addressFields = ['first_name', 'last_name', 'email', 'phone', 'street_address', 'city', 'governorate']
export const controlledAddressHash = order => createHash('sha256').update(JSON.stringify(addressFields.map(k => String(order[k] || '').trim()))).digest('hex')

export const controlledPurchaseScope = (runtime, user, { now = Date.now(), readOnly = false } = {}) => {
  let scope
  try {
    const input = runtime.controlledPurchase
    scope = typeof input === 'string' ? JSON.parse(input) : input
  } catch { fail() }
  if (!scope || Array.isArray(scope) || Object.keys(scope).length !== fields.length || fields.some(k => !(k in scope)) || Object.keys(scope).some(k => !fields.includes(k))) fail()
  if (scope.enabled !== true || !['customer_id', 'cart_id', 'product_id', 'variant_id', 'shipping_company_id'].every(k => UUID.test(scope[k] || ''))
    || !Number.isSafeInteger(scope.total_minor) || scope.total_minor < 1 || scope.total_minor > 999999999999
    || !/^[a-f0-9]{64}$/.test(scope.address_sha256) || !/^[a-f0-9]{64}$/.test(scope.review_key) || typeof scope.payment_enabled !== 'boolean') fail()
  const start = Date.parse(scope.starts_at), end = Date.parse(scope.expires_at)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 3600000
    || new Date(start).toISOString() !== scope.starts_at || new Date(end).toISOString() !== scope.expires_at) fail()
  if (!user || user.id !== scope.customer_id || user.is_anonymous === true || !user.email_confirmed_at) fail()
  if (!readOnly && (now < start || now >= end)) fail()
  return Object.freeze({ ...scope })
}

// This runtime is request-local, after exact scope/Auth checks. The global gates
// and the public purchase/provider routes remain unchanged.
const paymentRuntime = runtime => {
  if (runtime.paymobMode !== 'live' || runtime.paymobCardIntegrationMode !== 'live') fail()
  return { ...runtime, paymobEnabled: true, paymobLiveRequestsEnabled: true }
}
const token = (scope, quoteId) => createHmac('sha256', Buffer.from(scope.review_key, 'hex'))
  .update('controlled-purchase-quote-v1\n' + JSON.stringify(fields.filter(k => k !== 'review_key').map(k => scope[k])) + '\n' + quoteId).digest('hex')
const validToken = (scope, quoteId, signature) => /^[a-f0-9]{64}$/.test(signature || '')
  && timingSafeEqual(Buffer.from(token(scope, quoteId), 'hex'), Buffer.from(signature, 'hex'))
const rpc = async (db, name, args) => {
  const result = await db.rpc(name, args)
  if (result.error) throwCheckoutError(result.error)
  return result.data
}
const snapshot = async (db, scope, orderId) => {
  const query = db.from('customer_orders').select('id,user_id,checkout_cart_id,shipping_company_id,order_number,status,payment_status,payment_method,is_preorder,total_amount,currency,first_name,last_name,email,phone,street_address,city,governorate')
    .eq('user_id', scope.customer_id).eq('checkout_cart_id', scope.cart_id)
  const result = await (orderId ? query.eq('id', orderId) : query).maybeSingle()
  if (result.error) fail(503)
  return result.data
}
const verifyOrder = async (db, scope, order, attempt) => {
  if (!order || order.user_id !== scope.customer_id || order.checkout_cart_id !== scope.cart_id || order.shipping_company_id !== scope.shipping_company_id
    || order.payment_method !== 'card' || order.is_preorder || order.currency !== 'EGP' || toMinorUnits(order.total_amount) !== scope.total_minor
    || controlledAddressHash(order) !== scope.address_sha256) fail(409)
  const items = await db.from('customer_order_items').select('product_id,variant_id,quantity').eq('order_id', order.id)
  if (items.error) fail(503)
  if (items.data?.length !== 1 || items.data[0].product_id !== scope.product_id || items.data[0].variant_id !== scope.variant_id || items.data[0].quantity !== 1) fail(409)
  if (attempt && (Number(attempt.amount_minor) !== scope.total_minor || attempt.currency !== 'EGP' || attempt.mode !== 'live')) fail(409)
}
const safeOrder = order => order ? { id: order.id, orderNumber: order.order_number, status: order.status, paymentStatus: order.payment_status, totalMinor: toMinorUnits(order.total_amount) } : null

export const controlledPurchase = async ({ db, user, runtime, action, input = {}, now = Date.now(), fetcher }) => {
  const scope = controlledPurchaseScope(runtime, user, { now, readOnly: action === 'view' })
  const allowed = { view: [], quote: ['address', 'locale'], order: ['address', 'locale', 'quote_id', 'review_token'], pay: ['order_id', 'locale'] }[action]
  if (!allowed || !input || Array.isArray(input) || Object.keys(input).some(k => !allowed.includes(k))) fail(400)
  const active = now >= Date.parse(scope.starts_at) && now < Date.parse(scope.expires_at)
  if (action === 'view') {
    const existing = await snapshot(db, scope)
    if (existing) await verifyOrder(db, scope, existing)
    const product = await db.from('products').select('id,title,price').eq('id', scope.product_id).maybeSingle()
    const variant = await db.from('product_variants').select('id,name').eq('id', scope.variant_id).eq('product_id', scope.product_id).maybeSingle()
    const company = await db.from('commerce_shipping_companies').select('id,name,client_shipping_price,checkout_governorates').eq('id', scope.shipping_company_id).maybeSingle()
    if (product.error || variant.error || company.error || !product.data || !variant.data || !company.data) fail(503)
    let attempt = null
    if (existing) {
      const result = await db.from('payment_attempts').select('status,expires_at').eq('order_id', existing.id).eq('provider', 'paymob').maybeSingle()
      if (result.error) fail(503)
      attempt = result.data
    }
    return { active, paymentEnabled: active && scope.payment_enabled, expiresAt: scope.expires_at, quantity: 1,
      product: product.data, variant: variant.data, delivery: company.data, totalMinor: scope.total_minor, order: safeOrder(existing), attempt }
  }
  const scopedRuntime = paymentRuntime(runtime)
  getPaymobConfig(scopedRuntime)
  if (action === 'pay') {
    if (!scope.payment_enabled || !UUID.test(input.order_id || '') || ![undefined, 'en', 'ar'].includes(input.locale)) fail()
    const order = await snapshot(db, scope, input.order_id)
    await verifyOrder(db, scope, order)
    return initiateOrderPayment({ db, userId: user.id, orderId: order.id, locale: input.locale, runtime: scopedRuntime, fetcher,
      authorizeOrder: async (current, attempt) => {
        // Recheck time on both sides of the durable claim. Callback reconciliation
        // deliberately does not depend on this grant or its expiration.
        controlledPurchaseScope(runtime, user)
        await verifyOrder(db, scope, current, attempt)
      }, returnPath: '/account/controlled-purchase' })
  }
  const { order, items } = normalizeCheckoutCommand({ cart_id: scope.cart_id,
    items: [{ id: scope.product_id, variant_id: scope.variant_id, quantity: 1 }], address: input.address,
    shipping_method: 'shipping', shipping_company_id: scope.shipping_company_id, payment_method: 'card', locale: input.locale }, user)
  if (controlledAddressHash(order) !== scope.address_sha256) fail(409)
  if (action === 'quote') {
    const review = await rpc(db, 'commerce_checkout_quote', { p_user_id: user.id, p_cart_id: scope.cart_id, p_order: order, p_items: items })
    if (review.isPreorder !== false || review.lines?.length !== 1 || review.lines[0].productId !== scope.product_id
      || review.lines[0].variantId !== scope.variant_id || review.lines[0].quantity !== 1 || toMinorUnits(review.totalAmount) !== scope.total_minor) fail(409)
    return { ...review, reviewToken: token(scope, review.quoteId) }
  }
  if (!UUID.test(input.quote_id || '') || !validToken(scope, input.quote_id, input.review_token)) fail(409)
  order.order_number = `ORD-${new Date(now).toISOString().slice(0, 10).replace(/-/g, '')}-${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`
  const result = await rpc(db, 'commerce_checkout_command', { p_user_id: user.id, p_cart_id: scope.cart_id, p_quote_id: input.quote_id, p_order: order, p_items: items })
  const created = result.order || result
  const saved = await snapshot(db, scope, created.id || result.order_id || result.orderId)
  await verifyOrder(db, scope, saved)
  return { order: safeOrder(saved) }
}
