import { createError } from 'h3'
import { buildCouponResponse, getValidatedCoupon } from '../../utils/coupons'
import { requireCustomerRequest } from '../../utils/customerRequest'

const PHONE_PATTERN = /^01\d{9}$/

const normalizeRequiredText = (value, fieldLabel) => {
  const normalizedValue = String(value || '').trim()

  if (!normalizedValue) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldLabel} is required.`
    })
  }

  return normalizedValue
}

const normalizeOptionalText = (value) => {
  const normalizedValue = String(value || '').trim()
  return normalizedValue || null
}

const normalizeOrderItems = (items) => {
  if (!Array.isArray(items) || !items.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Your cart is empty.'
    })
  }

  return items.map((item) => {
    const productId = String(item?.id || item?.product_id || '').trim()
    const quantity = Number.parseInt(item?.quantity, 10)

    if (!productId || !Number.isFinite(quantity) || quantity < 1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'A valid product and quantity are required.'
      })
    }

    return {
      id: productId,
      quantity
    }
  })
}

const generateOrderNumber = () => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const randomPart = Math.floor(1000 + (Math.random() * 9000))
  return `ORD-${datePart}-${randomPart}`
}

export default defineEventHandler(async (event) => {
  const { authUser, supabaseAdmin } = await requireCustomerRequest(event)
  const body = await readBody(event)

  const orderItems = normalizeOrderItems(body?.items)
  const firstName = normalizeRequiredText(body?.address?.first_name, 'First name')
  const lastName = String(body?.address?.last_name || '').trim()
  const streetAddress = normalizeRequiredText(body?.address?.street_address, 'Street address')
  const city = normalizeRequiredText(body?.address?.city, 'City')
  const governorate = normalizeRequiredText(body?.address?.governorate, 'Governorate')
  const phone = normalizeRequiredText(body?.address?.phone, 'Phone')
  const email = normalizeRequiredText(body?.address?.email || authUser.email, 'Email')
  const shippingMethod = normalizeOptionalText(body?.shipping_method)
  const paymentMethod = normalizeOptionalText(body?.payment_method)
  const couponCode = String(body?.coupon_code || '').trim().toUpperCase()

  if (!PHONE_PATTERN.test(phone)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Phone number must start with 01 and contain 11 digits.'
    })
  }

  const productIds = [...new Set(orderItems.map((item) => item.id))]
  const { data: products, error: productsError } = await supabaseAdmin
    .from('products')
    .select(`
      id,
      title,
      slug,
      image_url,
      price,
      stock_quantity,
      is_published
    `)
    .in('id', productIds)

  if (productsError) {
    throw createError({
      statusCode: 500,
      statusMessage: productsError.message
    })
  }

  const productMap = new Map((products || []).map((product) => [String(product.id), product]))
  const missingItem = orderItems.find((item) => !productMap.has(item.id))

  if (missingItem) {
    throw createError({
      statusCode: 404,
      statusMessage: 'One or more products in the cart are no longer available.'
    })
  }

  const normalizedItems = orderItems.map((item) => {
    const product = productMap.get(item.id)

    if (!product.is_published) {
      throw createError({
        statusCode: 400,
        statusMessage: `${product.title} is no longer available.`
      })
    }

    if (Number(product.stock_quantity || 0) < item.quantity) {
      throw createError({
        statusCode: 400,
        statusMessage: `${product.title} does not have enough stock for the requested quantity.`
      })
    }

    const unitPrice = Number(product.price || 0)

    return {
      product_id: product.id,
      product_title: product.title,
      product_slug: product.slug || null,
      image_url: product.image_url || null,
      unit_price: unitPrice,
      quantity: item.quantity,
      line_total: Number((unitPrice * item.quantity).toFixed(2))
    }
  })

  const subtotalAmount = Number(normalizedItems.reduce((total, item) => total + item.line_total, 0).toFixed(2))
  const validatedCoupon = couponCode
    ? await getValidatedCoupon(supabaseAdmin, couponCode, subtotalAmount)
    : null
  const discountAmount = Number(validatedCoupon?.discountAmount || 0)
  const totalAmount = Number(Math.max(0, subtotalAmount - discountAmount).toFixed(2))
  const fullName = [firstName, lastName].filter(Boolean).join(' ')
  const orderNumber = generateOrderNumber()

  const { data: orderRecord, error: orderError } = await supabaseAdmin
    .from('customer_orders')
    .insert({
      user_id: authUser.id,
      order_number: orderNumber,
      status: 'in_progress',
      subtotal_amount: subtotalAmount,
      discount_amount: discountAmount,
      total_amount: totalAmount,
      coupon_code: validatedCoupon?.coupon?.code || null,
      first_name: firstName,
      last_name: lastName || null,
      email,
      phone,
      street_address: streetAddress,
      city,
      governorate,
      shipping_method: shippingMethod,
      payment_method: paymentMethod,
      updated_at: new Date().toISOString()
    })
    .select('*')
    .single()

  if (orderError) {
    throw createError({
      statusCode: 400,
      statusMessage: orderError.message
    })
  }

  const { error: orderItemsError } = await supabaseAdmin
    .from('customer_order_items')
    .insert(normalizedItems.map((item) => ({
      order_id: orderRecord.id,
      ...item
    })))

  if (orderItemsError) {
    await supabaseAdmin
      .from('customer_orders')
      .delete()
      .eq('id', orderRecord.id)

    throw createError({
      statusCode: 400,
      statusMessage: orderItemsError.message
    })
  }

  const { error: profileUpdateError } = await supabaseAdmin
    .from('customer_profiles')
    .upsert({
      id: authUser.id,
      email,
      full_name: fullName || authUser.email?.split('@')[0] || 'Customer',
      phone,
      address_line_1: streetAddress,
      city,
      state: governorate,
      country: 'Egypt',
      updated_at: new Date().toISOString()
    })

  if (validatedCoupon?.coupon) {
    const { error: couponUpdateError } = await supabaseAdmin
      .from('site_coupons')
      .update({
        usage_count: Number(validatedCoupon.coupon.usage_count || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', validatedCoupon.coupon.id)

    if (couponUpdateError) {
      console.error('Could not update coupon usage count:', couponUpdateError.message)
    }
  }

  if (profileUpdateError) {
    console.error('Could not update customer profile after checkout:', profileUpdateError.message)
  }

  return {
    order: {
      id: orderRecord.id,
      orderNumber: orderRecord.order_number,
      subtotalAmount,
      discountAmount,
      totalAmount,
      coupon: buildCouponResponse(validatedCoupon?.coupon, discountAmount)
    }
  }
})
