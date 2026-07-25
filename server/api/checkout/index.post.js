import { createError } from 'h3'
import { randomUUID } from 'node:crypto'
import { requireCustomerRequest } from '../../utils/customerRequest'
import {
  isStoreAnalyticsUuid,
  recordStoreOrderCreated
} from '../../utils/storeAnalytics'

const PHONE_PATTERN = /^01\d{9}$/
const MAX_ORDER_ITEMS = 100

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

  if (items.length > MAX_ORDER_ITEMS) {
    throw createError({
      statusCode: 400,
      statusMessage: `An order cannot contain more than ${MAX_ORDER_ITEMS} cart lines.`
    })
  }

  const aggregatedItems = new Map()

  items.forEach((item) => {
    const productId = String(item?.id || item?.product_id || '').trim().toLowerCase()
    const normalizedVariantId = String(item?.variant_id || '').trim().toLowerCase()
    const variantId = normalizedVariantId || null
    const quantity = Number(item?.quantity)

    if (
      !isStoreAnalyticsUuid(productId) ||
      (variantId && !isStoreAnalyticsUuid(variantId)) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 99
    ) {
      throw createError({
        statusCode: 400,
        statusMessage: 'A valid product and quantity are required.'
      })
    }

    const key = `${productId}:${variantId || 'default'}`
    const previousItem = aggregatedItems.get(key)

    const aggregatedQuantity = Number(previousItem?.quantity || 0) + quantity

    if (aggregatedQuantity > 99) {
      throw createError({
        statusCode: 400,
        statusMessage: 'A product option cannot have a quantity greater than 99.'
      })
    }

    aggregatedItems.set(key, {
      product_id: productId,
      variant_id: variantId,
      quantity: aggregatedQuantity
    })
  })

  return [...aggregatedItems.values()]
}

const generateOrderNumber = () => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const randomPart = randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()
  return `ORD-${datePart}-${randomPart}`
}

const isMissingSchemaError = (error) => {
  return error?.code === '42P01' ||
    error?.code === '42703' ||
    error?.code === '42883' ||
    error?.code === 'PGRST202' ||
    error?.code === 'PGRST204' ||
    error?.code === 'PGRST205'
}

const throwCheckoutDatabaseError = (error) => {
  const message = String(error?.message || '').replace(/^.*ERROR:\s*/i, '').trim()
  const isConflict = /stock|available|serialized unit|variant|already|cart/i.test(message)

  if (isMissingSchemaError(error)) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Run the latest serialized inventory migration first, then try again.'
    })
  }

  if (error?.code === '23505') {
    throw createError({
      statusCode: 409,
      statusMessage: 'The order could not be finalized because of a conflict. Please try again.'
    })
  }

  if (error?.code !== 'P0001') {
    console.error('Checkout transaction failed:', error?.code || 'unknown')

    throw createError({
      statusCode: 500,
      statusMessage: 'Could not create this order. Please try again.'
    })
  }

  throw createError({
    statusCode: isConflict ? 409 : 400,
    statusMessage: message || 'Could not create this order.'
  })
}

export default defineEventHandler(async (event) => {
  const { authUser, supabaseAdmin } = await requireCustomerRequest(event)
  const body = await readBody(event)
  const requestedCartId = String(body?.cart_id || '').trim()
  const cartId = isStoreAnalyticsUuid(requestedCartId)
    ? requestedCartId.toLowerCase()
    : null

  if (!cartId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid cart ID is required to place an order.'
    })
  }

  const { data: existingOrder, error: existingOrderError } = await supabaseAdmin
    .from('customer_orders')
    .select('id, order_number, subtotal_amount, discount_amount, total_amount')
    .eq('user_id', authUser.id)
    .eq('checkout_cart_id', cartId)
    .maybeSingle()

  if (existingOrderError) {
    if (!isMissingSchemaError(existingOrderError)) {
      console.error(
        'Could not check checkout idempotency:',
        existingOrderError.code || 'unknown'
      )
    }

    throw createError({
      statusCode: 500,
      statusMessage: isMissingSchemaError(existingOrderError)
        ? 'Run the latest serialized inventory migration first, then try again.'
        : 'Could not verify this cart. Please try again.'
    })
  }

  if (existingOrder) {
    return {
      order: {
        id: existingOrder.id,
        orderNumber: existingOrder.order_number,
        subtotalAmount: Number(existingOrder.subtotal_amount || 0),
        discountAmount: Number(existingOrder.discount_amount || 0),
        totalAmount: Number(existingOrder.total_amount || 0),
        coupon: null
      }
    }
  }

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

  const { data: siteSettings, error: siteSettingsError } = await supabaseAdmin
    .from('site_settings')
    .select('allow_out_of_stock_purchases')
    .eq('key', 'default')
    .maybeSingle()

  if (siteSettingsError && !isMissingSchemaError(siteSettingsError)) {
    console.error(
      'Could not load checkout settings:',
      siteSettingsError.code || 'unknown'
    )

    throw createError({
      statusCode: 500,
      statusMessage: 'Could not load the checkout settings. Please try again.'
    })
  }

  const allowOutOfStockPurchases = Boolean(siteSettings?.allow_out_of_stock_purchases)
  const fullName = [firstName, lastName].filter(Boolean).join(' ')
  const orderPayload = {
    order_number: generateOrderNumber(),
    coupon_code: couponCode || null,
    first_name: firstName,
    last_name: lastName || null,
    email,
    phone,
    street_address: streetAddress,
    city,
    governorate,
    shipping_method: shippingMethod,
    payment_method: paymentMethod
  }

  const { data: orderResult, error: orderError } = await supabaseAdmin.rpc(
    'commerce_create_customer_order',
    {
      p_user_id: authUser.id,
      p_order: orderPayload,
      p_items: orderItems,
      p_allow_out_of_stock: allowOutOfStockPurchases,
      p_cart_id: cartId
    }
  )

  if (orderError) {
    throwCheckoutDatabaseError(orderError)
  }

  const rpcResult = Array.isArray(orderResult)
    ? orderResult[0]
    : orderResult || {}
  let orderRecord = rpcResult.order && typeof rpcResult.order === 'object'
    ? rpcResult.order
    : rpcResult
  const orderId = orderRecord.id || rpcResult.order_id || rpcResult.orderId

  if (!orderId) {
    throw createError({
      statusCode: 500,
      statusMessage: 'The order transaction completed without returning an order ID.'
    })
  }

  if (!orderRecord.order_number) {
    const { data: storedOrder, error: storedOrderError } = await supabaseAdmin
      .from('customer_orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle()

    if (storedOrderError || !storedOrder) {
      if (storedOrderError) {
        console.error(
          'Could not load the created checkout order:',
          storedOrderError.code || 'unknown'
        )
      }

      throw createError({
        statusCode: 500,
        statusMessage: 'Could not load the created order.'
      })
    }

    orderRecord = storedOrder
  }

  const wasCreated = rpcResult.created !== false &&
    rpcResult.was_created !== false &&
    rpcResult.wasCreated !== false

  let profileUpdateError = null

  if (wasCreated) {
    const profileUpdateResult = await supabaseAdmin
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

    profileUpdateError = profileUpdateResult.error
  }

  if (profileUpdateError) {
    console.error('Could not update customer profile after checkout:', profileUpdateError.message)
  }

  if (wasCreated) {
    try {
      await recordStoreOrderCreated({
        event,
        supabaseAdmin,
        userId: authUser.id,
        orderId,
        cartId
      })
    } catch {
      console.error('Could not record checkout analytics.')
    }
  }

  return {
    order: {
      id: orderId,
      orderNumber: orderRecord.order_number,
      subtotalAmount: Number(orderRecord.subtotal_amount || 0),
      discountAmount: Number(orderRecord.discount_amount || 0),
      totalAmount: Number(orderRecord.total_amount || 0),
      coupon: null
    }
  }
})
