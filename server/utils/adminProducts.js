import { createError } from 'h3'

const PRODUCT_MUTABLE_FIELDS = [
  'title',
  'slug',
  'description',
  'long_description',
  'price',
  'old_price',
  'image_url',
  'category_id',
  'brand_id',
  'default_supplier_id',
  'primary_warehouse_id',
  'sku',
  'stock_quantity',
  'color_name',
  'color_hex',
  'is_serialized',
  'is_published',
  'selling_mode', 'expected_availability_date', 'availability_message',
  'preorder_active', 'preorder_starts_at', 'preorder_ends_at',
  'preorder_payment_mode', 'preorder_deposit_percent',
  'preorder_total_limit', 'preorder_customer_limit'
]

const normalizeText = (value) => {
  const normalizedValue = String(value || '').trim()
  return normalizedValue || null
}

const normalizeSlug = (value) => {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

const normalizeUuid = (value) => {
  const normalizedValue = String(value || '').trim()
  return normalizedValue || null
}

const normalizeBoolean = (value) => {
  if (typeof value === 'string') {
    return value.trim().toLowerCase() === 'true'
  }

  return value === true || value === 1
}

const normalizeVariantCode = (value) => {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9_-]/g, '')
}

export const normalizeSerializedVariants = (variants = [], {
  includeQuantity = true
} = {}) => {
  if (!Array.isArray(variants)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Product models must be a valid list.'
    })
  }

  if (!variants.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Every product requires at least one variant. Use Default when the product has no model or color options.'
    })
  }

  if (variants.length > 100) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A product cannot have more than 100 variants.'
    })
  }

  const normalizedVariants = variants.map((variant, index) => {
    const name = String(variant?.name || '').trim()
    const code = normalizeVariantCode(variant?.code || name)
    const quantity = includeQuantity ? Number(variant?.quantity) : 0
    const colorHex = normalizeText(variant?.color_hex)

    if (!name) {
      throw createError({
        statusCode: 400,
        statusMessage: `Model ${index + 1} requires a name.`
      })
    }

    if (!code) {
      throw createError({
        statusCode: 400,
        statusMessage: `Model ${index + 1} requires a code containing letters or numbers.`
      })
    }

    if (
      includeQuantity
      && (!Number.isInteger(quantity) || quantity < 0 || quantity > 1000)
    ) {
      throw createError({
        statusCode: 400,
        statusMessage: `Quantity for ${name} must be between 0 and 1,000.`
      })
    }

    if (colorHex && !/^#[0-9a-f]{6}$/i.test(colorHex)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Color for ${name} must use a six-digit hex value, such as #2563EB.`
      })
    }

    const normalizedVariant = {
      id: normalizeUuid(variant?.id),
      name,
      code,
      sku: normalizeText(variant?.sku),
      color_name: normalizeText(variant?.color_name) || name,
      color_hex: colorHex
    }

    if (includeQuantity) {
      normalizedVariant.quantity = quantity
    }

    return normalizedVariant
  })

  const codes = normalizedVariants.map((variant) => variant.code.toLowerCase())
  if (new Set(codes).size !== codes.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Every model code must be unique within this product.'
    })
  }

  const skus = normalizedVariants
    .map((variant) => String(variant.sku || '').toLowerCase())
    .filter(Boolean)

  if (new Set(skus).size !== skus.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Every model SKU must be unique.'
    })
  }

  return normalizedVariants
}

export const isMissingSchemaError = (error) => {
  return error?.code === '42P01' ||
    error?.code === '42703' ||
    error?.code === '42883' ||
    error?.code === 'PGRST202' ||
    error?.code === 'PGRST204' ||
    error?.code === 'PGRST205'
}

export const normalizeAdminProductPayload = (body = {}, {
  catalogDefinitionsOnly = false
} = {}) => {
  const title = String(body?.title || '').trim()
  const slug = normalizeSlug(body?.slug || title)
  const price = Number(body?.price)
  const stockQuantity = Number.parseInt(body?.stock_quantity, 10)
  const oldPriceValue = String(body?.old_price ?? '').trim()
  const oldPrice = oldPriceValue ? Number(oldPriceValue) : null
  const isSerialized = catalogDefinitionsOnly
    ? true
    : normalizeBoolean(body?.is_serialized)
  const variants = isSerialized
    ? normalizeSerializedVariants(body?.variants || [], {
        includeQuantity: !catalogDefinitionsOnly
      })
    : []

  if (!title) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Title is required.'
    })
  }

  if (!slug) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Slug is required.'
    })
  }

  if (!Number.isFinite(price) || price < 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Price must be a valid positive number.'
    })
  }

  if (!isSerialized && (!Number.isInteger(stockQuantity) || stockQuantity < 0)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Stock quantity cannot be negative.'
    })
  }

  if (oldPrice !== null && (!Number.isFinite(oldPrice) || oldPrice < 0)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Old price must be empty or a valid positive number.'
    })
  }

  const sellingMode = String(body?.selling_mode || 'normal').trim().toLowerCase()
  if (!['normal', 'coming_soon', 'preorder'].includes(sellingMode)) {
    throw createError({ statusCode: 400, statusMessage: 'Choose a valid selling status.' })
  }
  if (sellingMode === 'preorder' && price <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'A preorder needs a price above zero.' })
  }
  const dateValue = value => {
    const text = String(value || '').trim()
    if (!text) return null
    const parsed = new Date(`${text}T00:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
      throw createError({ statusCode: 400, statusMessage: 'Enter a valid expected availability date.' })
    }
    return text
  }
  const instantValue = (value, label) => {
    const text = String(value || '').trim()
    if (!text) return null
    const date = new Date(text)
    if (Number.isNaN(date.getTime())) throw createError({ statusCode: 400, statusMessage: `Enter a valid ${label}.` })
    return date.toISOString()
  }
  const optionalLimit = (value, label) => {
    if (value === '' || value === null || value === undefined) return null
    const limit = Number(value)
    if (!Number.isInteger(limit) || limit < 1) throw createError({ statusCode: 400, statusMessage: `${label} must be a positive whole number.` })
    return limit
  }
  const preorderPaymentMode = String(body?.preorder_payment_mode || 'full').trim().toLowerCase()
  const depositPercent = body?.preorder_deposit_percent === '' || body?.preorder_deposit_percent == null
    ? null : Number(body.preorder_deposit_percent)
  if (sellingMode === 'preorder' && (
    !['full', 'deposit'].includes(preorderPaymentMode)
    || (preorderPaymentMode === 'deposit' && (!Number.isFinite(depositPercent) || depositPercent <= 0 || depositPercent >= 100 || !/^\d{1,2}(?:\.\d{1,2})?$/.test(String(body.preorder_deposit_percent))))
  )) throw createError({ statusCode: 400, statusMessage: 'Deposit must be above 0% and below 100%.' })
  const startsAt = sellingMode === 'preorder' ? instantValue(body?.preorder_starts_at, 'preorder start') : null
  const endsAt = sellingMode === 'preorder' ? instantValue(body?.preorder_ends_at, 'preorder close') : null
  if (startsAt && endsAt && endsAt <= startsAt) throw createError({ statusCode: 400, statusMessage: 'Preorder close must be after its start.' })
  const availabilityMessage = sellingMode === 'normal' ? null : normalizeText(body?.availability_message)
  if (availabilityMessage?.length > 500) throw createError({ statusCode: 400, statusMessage: 'Customer message must be 500 characters or fewer.' })

  return {
    title,
    slug,
    description: normalizeText(body?.description),
    long_description: normalizeText(body?.long_description),
    price,
    old_price: oldPrice,
    image_url: normalizeText(body?.image_url),
    category_id: normalizeUuid(body?.category_id),
    brand_id: normalizeUuid(body?.brand_id),
    default_supplier_id: normalizeUuid(body?.default_supplier_id),
    primary_warehouse_id: normalizeUuid(body?.primary_warehouse_id),
    sku: normalizeText(body?.sku),
    stock_quantity: catalogDefinitionsOnly
      ? 0
      : isSerialized
        ? variants.reduce((total, variant) => total + variant.quantity, 0)
        : stockQuantity,
    color_name: normalizeText(body?.color_name),
    color_hex: normalizeText(body?.color_hex),
    is_serialized: isSerialized,
    variants,
    is_published: normalizeBoolean(body?.is_published),
    selling_mode: sellingMode,
    expected_availability_date: sellingMode === 'normal' ? null : dateValue(body?.expected_availability_date),
    availability_message: availabilityMessage,
    preorder_active: sellingMode === 'preorder' ? normalizeBoolean(body?.preorder_active) : true,
    preorder_starts_at: startsAt,
    preorder_ends_at: endsAt,
    preorder_payment_mode: sellingMode === 'preorder' ? preorderPaymentMode : 'full',
    preorder_deposit_percent: sellingMode === 'preorder' && preorderPaymentMode === 'deposit' ? depositPercent : null,
    preorder_total_limit: sellingMode === 'preorder' ? optionalLimit(body?.preorder_total_limit, 'Total preorder limit') : null,
    preorder_customer_limit: sellingMode === 'preorder' ? optionalLimit(body?.preorder_customer_limit, 'Per-customer limit') : null
  }
}

export const pickMutableProductFields = (record = {}) => {
  return PRODUCT_MUTABLE_FIELDS.reduce((payload, field) => {
    payload[field] = record?.[field] ?? null
    return payload
  }, {})
}

export const ensureProductCommerceReferences = async (supabaseAdmin, payload) => {
  if (payload.default_supplier_id) {
    const { data: supplier, error } = await supabaseAdmin
      .from('commerce_crm_accounts')
      .select('id, account_type, is_active')
      .eq('id', payload.default_supplier_id)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!supplier || supplier.account_type !== 'supplier' || !supplier.is_active) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Default supplier must be an active supplier record.'
      })
    }
  }

  if (payload.primary_warehouse_id) {
    const { data: warehouse, error } = await supabaseAdmin
      .from('commerce_warehouses')
      .select('id, is_active')
      .eq('id', payload.primary_warehouse_id)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!warehouse || !warehouse.is_active) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Primary warehouse must be an active warehouse.'
      })
    }
  }
}

export const syncPrimaryWarehouseInventoryForProductUpdate = async ({
  supabaseAdmin,
  productId,
  previousProduct,
  nextProduct
}) => {
  const previousWarehouseId = String(previousProduct?.primary_warehouse_id || '').trim() || null
  const nextWarehouseId = String(nextProduct?.primary_warehouse_id || '').trim() || null
  const previousStockQuantity = Number(previousProduct?.stock_quantity || 0)
  const nextStockQuantity = Number(nextProduct?.stock_quantity || 0)
  const stockDelta = nextStockQuantity - previousStockQuantity

  if (
    previousWarehouseId &&
    previousWarehouseId !== nextWarehouseId &&
    (previousStockQuantity > 0 || nextStockQuantity > 0)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Use Commerce transfer or inventory tools before changing the primary warehouse for a stocked product.'
    })
  }

  if (!nextWarehouseId) {
    return
  }

  const { data: inventoryRow, error: inventoryError } = await supabaseAdmin
    .from('commerce_warehouse_inventory')
    .select('id, quantity, average_cost')
    .eq('warehouse_id', nextWarehouseId)
    .eq('product_id', productId)
    .maybeSingle()

  if (inventoryError) {
    throw inventoryError
  }

  if (!inventoryRow) {
    if (nextStockQuantity <= 0) {
      return
    }

    const { error } = await supabaseAdmin
      .from('commerce_warehouse_inventory')
      .insert({
        warehouse_id: nextWarehouseId,
        product_id: productId,
        quantity: nextStockQuantity,
        average_cost: Number(previousProduct?.cost_price || 0),
        updated_at: new Date().toISOString()
      })

    if (error) {
      throw error
    }

    return
  }

  const nextWarehouseQuantity = previousWarehouseId === nextWarehouseId
    ? Number(inventoryRow.quantity || 0) + stockDelta
    : nextStockQuantity

  if (nextWarehouseQuantity < 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Primary warehouse inventory cannot become negative from this manual stock change.'
    })
  }

  const { error } = await supabaseAdmin
    .from('commerce_warehouse_inventory')
    .update({
      quantity: nextWarehouseQuantity,
      updated_at: new Date().toISOString()
    })
    .eq('id', inventoryRow.id)

  if (error) {
    throw error
  }
}
