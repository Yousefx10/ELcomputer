import { buildCouponResponse, getValidatedCoupon } from '../../utils/coupons'
import { reviewCheckout } from '../../utils/checkoutReview'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const { order, supabaseAdmin, review } = await reviewCheckout(event, { requireCoupon: true })
  const validated = await getValidatedCoupon(supabaseAdmin, order.coupon_code, Number(review.orderValue))
  return { coupon: buildCouponResponse(validated.coupon, Number(review.discountAmount)) }
})
