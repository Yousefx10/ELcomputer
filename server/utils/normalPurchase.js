import { createError } from 'h3'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { controlledAddressHash, controlledPaymentRuntime, controlledPurchaseScope, controlledReviewToken, verifyControlledOrder } from './controlledPurchase.js'
import { toMinorUnits } from './payments/paymob.js'

export const publicPurchasingEnabled = runtime => runtime.public?.purchasingEnabled === true || runtime.public?.purchasingEnabled === 'true'
const fail = (statusCode = 403) => { throw createError({ statusCode, statusMessage: 'This purchase is unavailable.' }) }

export const normalPurchaseScope = (runtime, user, options) => publicPurchasingEnabled(runtime)
  ? null : controlledPurchaseScope(runtime, user, options)

// The browser keeps its ordinary cart and recovery envelope. The grant's cart
// UUID is the single durable command identity across tabs or replacement carts.
// A signed review also binds the original browser cart; changing it cannot reuse
// a reviewed command. All routes share the same SQL receipt, including the older
// controlled API, so another browser/cart cannot allocate a second order.
const reviewToken = (scope, quoteId, browserCartId) => createHmac('sha256', Buffer.from(scope.review_key, 'hex'))
  .update('normal-checkout-review-v1\n' + controlledReviewToken(scope, quoteId) + '\n' + browserCartId).digest('hex')

export const authorizeNormalCheckout = ({ runtime, user, cartId, order, items, commit = false, quoteId, signature, now }) => {
  const scope = normalPurchaseScope(runtime, user, now === undefined ? undefined : { now })
  if (!scope) return { scope: null, cartId, browserCartId: cartId, runtime }
  if (order.payment_method !== 'card' || order.shipping_method !== 'shipping' || order.shipping_company_id !== scope.shipping_company_id
    || order.coupon_code || controlledAddressHash(order) !== scope.address_sha256
    || items.length !== 1 || items[0].product_id !== scope.product_id || items[0].variant_id !== scope.variant_id || items[0].quantity !== 1) fail()
  if (commit && (!/^[a-f0-9]{64}$/.test(signature || '')
    || !timingSafeEqual(Buffer.from(reviewToken(scope, quoteId, cartId), 'hex'), Buffer.from(signature, 'hex')))) fail(409)
  return { scope, cartId: scope.cart_id, browserCartId: cartId, runtime: controlledPaymentRuntime(runtime) }
}

export const authorizeNormalQuote = (context, review) => {
  if (!context.scope) return review
  const scope = context.scope
  if (review.isPreorder !== false || review.lines?.length !== 1 || review.lines[0].productId !== scope.product_id
    || review.lines[0].variantId !== scope.variant_id || review.lines[0].quantity !== 1 || toMinorUnits(review.totalAmount) !== scope.total_minor) fail(409)
  return { ...review, reviewToken: reviewToken(scope, review.quoteId, context.browserCartId) }
}

export const normalPaymentAuthorization = ({ runtime, user, db }) => {
  const scope = normalPurchaseScope(runtime, user)
  if (!scope) return { runtime }
  if (!scope.payment_enabled) fail()
  return {
    runtime: controlledPaymentRuntime(runtime),
    authorizeOrder: async (order, attempt) => {
      controlledPurchaseScope(runtime, user)
      await verifyControlledOrder(db, scope, order, attempt)
    }
  }
}

export const safePurchaseCapability = scope => scope ? {
  available: true, restricted: true, productId: scope.product_id, variantId: scope.variant_id,
  shippingCompanyId: scope.shipping_company_id, expiresAt: scope.expires_at,
  paymentEnabled: scope.payment_enabled
} : { available: true, restricted: false }
