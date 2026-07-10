import { createError } from 'h3'

const normalizeCouponCode = (value) => {
  return String(value || '').trim().toUpperCase()
}

const isCouponDateStarted = (coupon) => {
  if (!coupon?.starts_at) {
    return true
  }

  return new Date(coupon.starts_at).getTime() <= Date.now()
}

const isCouponDateExpired = (coupon) => {
  if (!coupon?.ends_at) {
    return false
  }

  return new Date(coupon.ends_at).getTime() < Date.now()
}

export const getCouponDiscountAmount = (coupon, subtotal) => {
  const normalizedSubtotal = Number(subtotal || 0)
  const discountValue = Number(coupon?.discount_value || 0)

  if (normalizedSubtotal <= 0 || discountValue <= 0) {
    return 0
  }

  if (coupon.discount_type === 'percentage') {
    return Number(Math.min(normalizedSubtotal, (normalizedSubtotal * discountValue) / 100).toFixed(2))
  }

  return Number(Math.min(normalizedSubtotal, discountValue).toFixed(2))
}

export const validateCouponRecord = (coupon, subtotal) => {
  if (!coupon) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Coupon not found.'
    })
  }

  if (!coupon.is_active) {
    throw createError({
      statusCode: 400,
      statusMessage: 'This coupon is currently disabled.'
    })
  }

  if (!isCouponDateStarted(coupon)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'This coupon is not active yet.'
    })
  }

  if (isCouponDateExpired(coupon)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'This coupon has expired.'
    })
  }

  if (Number(coupon.minimum_order_amount || 0) > Number(subtotal || 0)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Minimum order amount is ${Number(coupon.minimum_order_amount || 0)} EGP.`
    })
  }

  if (
    coupon.usage_limit !== null &&
    coupon.usage_limit !== undefined &&
    Number(coupon.usage_count || 0) >= Number(coupon.usage_limit)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'This coupon has reached its usage limit.'
    })
  }
}

export const getValidatedCoupon = async (supabaseAdmin, code, subtotal) => {
  const normalizedCode = normalizeCouponCode(code)

  if (!normalizedCode) {
    return null
  }

  const { data: coupon, error } = await supabaseAdmin
    .from('site_coupons')
    .select('*')
    .eq('code', normalizedCode)
    .maybeSingle()

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message
    })
  }

  validateCouponRecord(coupon, subtotal)

  return {
    coupon,
    discountAmount: getCouponDiscountAmount(coupon, subtotal)
  }
}

export const buildCouponResponse = (coupon, discountAmount) => {
  if (!coupon) {
    return null
  }

  return {
    id: coupon.id,
    code: normalizeCouponCode(coupon.code),
    description: coupon.description || '',
    discountType: coupon.discount_type,
    discountValue: Number(coupon.discount_value || 0),
    minimumOrderAmount: Number(coupon.minimum_order_amount || 0),
    discountAmount: Number(discountAmount || 0)
  }
}
