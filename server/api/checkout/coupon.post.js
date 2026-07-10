import { createError } from 'h3'
import { buildCouponResponse, getValidatedCoupon } from '../../utils/coupons'
import { getSupabaseAdminClient } from '../../utils/supabaseAdmin'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const subtotal = Number(body?.subtotal || 0)
  const code = String(body?.code || '')

  if (!code.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Coupon code is required.'
    })
  }

  const supabaseAdmin = getSupabaseAdminClient()
  const validatedCoupon = await getValidatedCoupon(supabaseAdmin, code, subtotal)

  return {
    coupon: buildCouponResponse(validatedCoupon?.coupon, validatedCoupon?.discountAmount || 0)
  }
})
