import { createError } from 'h3'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const unavailable = () => { throw createError({ statusCode: 403, statusMessage: 'This purchase is unavailable.' }) }
export const betaPurchasingEnabled = runtime => [true, 'true'].includes(runtime.public?.betaPurchasingEnabled)

// Deployment-specific identities stay in private, reviewed runtime configuration.
export const betaPurchasePolicy = runtime => {
  if (!betaPurchasingEnabled(runtime)) return null
  let policy
  try { policy = typeof runtime.betaPurchasePolicy === 'string' ? JSON.parse(runtime.betaPurchasePolicy) : runtime.betaPurchasePolicy } catch { unavailable() }
  if (!policy || Array.isArray(policy) || Object.keys(policy).some(k => !['shipping_company_id', 'excluded_product_ids', 'customer_ids', 'starts_at', 'expires_at', 'payment_methods'].includes(k))
    || !uuid.test(policy.shipping_company_id || '') || !Array.isArray(policy.excluded_product_ids)
    || policy.excluded_product_ids.length > 1000 || policy.excluded_product_ids.some(id => !uuid.test(id))) unavailable()
  // Existing deployments stay CARD-only until their reviewed runtime opts in.
  if (policy.payment_methods !== undefined && (!Array.isArray(policy.payment_methods)
    || !policy.payment_methods.length || policy.payment_methods.length > 2
    || new Set(policy.payment_methods).size !== policy.payment_methods.length
    || policy.payment_methods.some(method => !['card', 'cash'].includes(method)))) unavailable()
  if (policy.customer_ids !== undefined && (!Array.isArray(policy.customer_ids) || !policy.customer_ids.length
    || policy.customer_ids.length > 100 || policy.customer_ids.some(id => !uuid.test(id)))) unavailable()
  if (policy.starts_at !== undefined || policy.expires_at !== undefined) {
    const start = Date.parse(policy.starts_at), end = Date.parse(policy.expires_at), now = Date.now()
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > now || end <= now || end <= start || end - start > 3600000) unavailable()
  }
  return { ...policy, shipping_company_id: policy.shipping_company_id.toLowerCase(),
    excluded_product_ids: policy.excluded_product_ids.map(id => id.toLowerCase()),
    ...(policy.customer_ids ? { customer_ids: policy.customer_ids.map(id => id.toLowerCase()) } : {}) }
}

export const authorizeBetaCustomer = (runtime, user) => {
  const policy = betaPurchasePolicy(runtime)
  if (policy?.customer_ids && !policy.customer_ids.includes(String(user?.id || '').toLowerCase())) unavailable()
}

export const authorizeBetaCheckout = (runtime, order, items, user) => {
  const policy = betaPurchasePolicy(runtime)
  if (!policy) return
  authorizeBetaCustomer(runtime, user)
  if (!(policy.payment_methods || ['card']).includes(order.payment_method) || order.shipping_method !== 'shipping' || order.shipping_company_id !== policy.shipping_company_id
    || order.coupon_code || !Array.isArray(items) || !items.length
    || items.some(item => policy.excluded_product_ids.includes(item.product_id))) unavailable()
}

export const betaPurchaseCapability = runtime => {
  const policy = betaPurchasePolicy(runtime)
  return policy ? { beta: true, paymentMethods: policy.payment_methods || ['card'], excludedProductIds: policy.excluded_product_ids } : {}
}
