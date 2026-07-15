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

  const aggregatedItems = new Map()

  items.forEach((item) => {
    const productId = String(item?.id || item?.product_id || '').trim()
    const quantity = Number.parseInt(item?.quantity, 10)

    if (!productId || !Number.isFinite(quantity) || quantity < 1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'A valid product and quantity are required.'
      })
    }

    aggregatedItems.set(productId, (aggregatedItems.get(productId) || 0) + quantity)
  })

  return Array.from(aggregatedItems.entries()).map(([id, quantity]) => {
    return {
      id,
      quantity
    }
  })
}

const generateOrderNumber = () => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const randomPart = Math.floor(1000 + (Math.random() * 9000))
  return `ORD-${datePart}-${randomPart}`
}

const isMissingSchemaError = (error) => {
  return error?.code === '42P01' || error?.code === '42703'
}

const buildWarehouseInventoryKey = (productId, warehouseId) => {
  return `${String(productId)}:${String(warehouseId)}`
}

const reduceProductAndWarehouseStockQuantities = async ({
  supabaseAdmin,
  items,
  productMap,
  warehouseInventoryMap,
  allowOutOfStockPurchases
}) => {
  const updatedProducts = []
  const updatedWarehouseRows = []

  try {
    for (const item of items) {
      const product = productMap.get(String(item.product_id))
      const currentStock = Number(product?.stock_quantity || 0)
      const nextStockQuantity = allowOutOfStockPurchases
        ? Math.max(0, currentStock - item.quantity)
        : currentStock - item.quantity

      let updateQuery = supabaseAdmin
        .from('products')
        .update({
          stock_quantity: nextStockQuantity
        })
        .eq('id', item.product_id)

      if (!allowOutOfStockPurchases) {
        updateQuery = updateQuery.gte('stock_quantity', item.quantity)
      }

      const { data: updatedProduct, error: stockUpdateError } = await updateQuery
        .select('id, stock_quantity')
        .maybeSingle()

      if (stockUpdateError) {
        throw createError({
          statusCode: 500,
          statusMessage: stockUpdateError.message
        })
      }

      if (!updatedProduct) {
        throw createError({
          statusCode: 409,
          statusMessage: `${product?.title || 'This product'} no longer has enough stock for checkout.`
        })
      }

      updatedProducts.push({
        id: item.product_id,
        previousStockQuantity: currentStock
      })

      const primaryWarehouseId = String(product?.primary_warehouse_id || '').trim()

      if (!primaryWarehouseId) {
        continue
      }

      const warehouseInventoryKey = buildWarehouseInventoryKey(item.product_id, primaryWarehouseId)
      const currentWarehouseInventory = warehouseInventoryMap.get(warehouseInventoryKey)

      if (!currentWarehouseInventory) {
        if (!allowOutOfStockPurchases) {
          throw createError({
            statusCode: 409,
            statusMessage: `${product?.title || 'This product'} is linked to a primary warehouse, but no warehouse inventory is configured for checkout.`
          })
        }

        const { data: insertedInventoryRow, error: insertWarehouseError } = await supabaseAdmin
          .from('commerce_warehouse_inventory')
          .insert({
            warehouse_id: primaryWarehouseId,
            product_id: item.product_id,
            quantity: 0,
            average_cost: Number(product?.cost_price || 0),
            updated_at: new Date().toISOString()
          })
          .select('id, quantity')
          .single()

        if (insertWarehouseError) {
          throw createError({
            statusCode: 500,
            statusMessage: insertWarehouseError.message
          })
        }

        updatedWarehouseRows.push({
          id: insertedInventoryRow.id,
          previousQuantity: null
        })

        warehouseInventoryMap.set(warehouseInventoryKey, {
          id: insertedInventoryRow.id,
          quantity: 0
        })

        continue
      }

      const currentWarehouseQuantity = Number(currentWarehouseInventory.quantity || 0)
      const nextWarehouseQuantity = allowOutOfStockPurchases
        ? Math.max(0, currentWarehouseQuantity - item.quantity)
        : currentWarehouseQuantity - item.quantity

      let warehouseUpdateQuery = supabaseAdmin
        .from('commerce_warehouse_inventory')
        .update({
          quantity: nextWarehouseQuantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentWarehouseInventory.id)

      if (!allowOutOfStockPurchases) {
        warehouseUpdateQuery = warehouseUpdateQuery.gte('quantity', item.quantity)
      }

      const { data: updatedWarehouseRow, error: warehouseUpdateError } = await warehouseUpdateQuery
        .select('id, quantity')
        .maybeSingle()

      if (warehouseUpdateError) {
        throw createError({
          statusCode: 500,
          statusMessage: warehouseUpdateError.message
        })
      }

      if (!updatedWarehouseRow) {
        throw createError({
          statusCode: 409,
          statusMessage: `${product?.title || 'This product'} no longer has enough stock in its primary warehouse for checkout.`
        })
      }

      updatedWarehouseRows.push({
        id: currentWarehouseInventory.id,
        previousQuantity: currentWarehouseQuantity
      })

      warehouseInventoryMap.set(warehouseInventoryKey, {
        ...currentWarehouseInventory,
        quantity: nextWarehouseQuantity
      })
    }
  } catch (error) {
    await Promise.all(
      updatedWarehouseRows.map(async (warehouseRow) => {
        if (warehouseRow.previousQuantity === null) {
          const { error: rollbackDeleteError } = await supabaseAdmin
            .from('commerce_warehouse_inventory')
            .delete()
            .eq('id', warehouseRow.id)

          if (rollbackDeleteError) {
            console.error('Could not roll back inserted warehouse inventory row:', rollbackDeleteError.message)
          }

          return
        }

        const { error: rollbackWarehouseError } = await supabaseAdmin
          .from('commerce_warehouse_inventory')
          .update({
            quantity: warehouseRow.previousQuantity,
            updated_at: new Date().toISOString()
          })
          .eq('id', warehouseRow.id)

        if (rollbackWarehouseError) {
          console.error('Could not roll back warehouse inventory:', rollbackWarehouseError.message)
        }
      })
    )

    await Promise.all(
      updatedProducts.map(async (updatedProduct) => {
        const { error: rollbackError } = await supabaseAdmin
          .from('products')
          .update({
            stock_quantity: updatedProduct.previousStockQuantity
          })
          .eq('id', updatedProduct.id)

        if (rollbackError) {
          console.error('Could not roll back product stock:', rollbackError.message)
        }
      })
    )

    throw error
  }
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

  let allowOutOfStockPurchases = false
  const { data: siteSettings, error: siteSettingsError } = await supabaseAdmin
    .from('site_settings')
    .select('allow_out_of_stock_purchases')
    .eq('key', 'default')
    .maybeSingle()

  if (siteSettingsError && !isMissingSchemaError(siteSettingsError)) {
    throw createError({
      statusCode: 500,
      statusMessage: siteSettingsError.message
    })
  }

  allowOutOfStockPurchases = Boolean(siteSettings?.allow_out_of_stock_purchases)

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
      cost_price,
      primary_warehouse_id,
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

  const primaryWarehouseIds = [
    ...new Set(
      (products || [])
        .map((product) => String(product.primary_warehouse_id || '').trim())
        .filter(Boolean)
    )
  ]

  let warehouseInventoryMap = new Map()

  if (primaryWarehouseIds.length) {
    const { data: warehouseInventoryRows, error: warehouseInventoryError } = await supabaseAdmin
      .from('commerce_warehouse_inventory')
      .select('id, warehouse_id, product_id, quantity')
      .in('product_id', productIds)
      .in('warehouse_id', primaryWarehouseIds)

    if (warehouseInventoryError) {
      throw createError({
        statusCode: 500,
        statusMessage: warehouseInventoryError.message
      })
    }

    warehouseInventoryMap = new Map(
      (warehouseInventoryRows || []).map((row) => [
        buildWarehouseInventoryKey(row.product_id, row.warehouse_id),
        row
      ])
    )
  }

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

    if (!allowOutOfStockPurchases && Number(product.stock_quantity || 0) < item.quantity) {
      throw createError({
        statusCode: 400,
        statusMessage: `${product.title} does not have enough stock for the requested quantity.`
      })
    }

    const primaryWarehouseId = String(product.primary_warehouse_id || '').trim()
    if (primaryWarehouseId && !allowOutOfStockPurchases) {
      const warehouseInventoryRow = warehouseInventoryMap.get(
        buildWarehouseInventoryKey(product.id, primaryWarehouseId)
      )

      if (!warehouseInventoryRow) {
        throw createError({
          statusCode: 400,
          statusMessage: `${product.title} is linked to a primary warehouse, but no warehouse inventory is configured yet.`
        })
      }

      if (Number(warehouseInventoryRow.quantity || 0) < item.quantity) {
        throw createError({
          statusCode: 400,
          statusMessage: `${product.title} does not have enough stock in its primary warehouse.`
        })
      }
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
      status: 'pending_payment',
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

  try {
    await reduceProductAndWarehouseStockQuantities({
      supabaseAdmin,
      items: normalizedItems,
      productMap,
      warehouseInventoryMap,
      allowOutOfStockPurchases
    })
  } catch (stockError) {
    const { error: cleanupError } = await supabaseAdmin
      .from('customer_orders')
      .delete()
      .eq('id', orderRecord.id)

    if (cleanupError) {
      console.error('Could not clean up order after stock update failure:', cleanupError.message)
    }

    throw stockError
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
