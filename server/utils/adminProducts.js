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
  'cost_price',
  'color_name',
  'color_hex',
  'is_serialized',
  'is_published'
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

export const normalizeSerializedVariants = (variants = []) => {
  if (!Array.isArray(variants)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Product models must be a valid list.'
    })
  }

  const normalizedVariants = variants.map((variant, index) => {
    const name = String(variant?.name || '').trim()
    const code = normalizeVariantCode(variant?.code || name)
    const quantity = Number(variant?.quantity)
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

    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 1000) {
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

    return {
      id: normalizeUuid(variant?.id),
      name,
      code,
      sku: normalizeText(variant?.sku),
      color_name: normalizeText(variant?.color_name) || name,
      color_hex: colorHex,
      quantity
    }
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

export const normalizeAdminProductPayload = (body = {}) => {
  const title = String(body?.title || '').trim()
  const slug = normalizeSlug(body?.slug || title)
  const price = Number(body?.price)
  const stockQuantity = Number.parseInt(body?.stock_quantity, 10)
  const costPrice = Number(body?.cost_price || 0)
  const oldPriceValue = String(body?.old_price ?? '').trim()
  const oldPrice = oldPriceValue ? Number(oldPriceValue) : null
  const isSerialized = normalizeBoolean(body?.is_serialized)
  const variants = isSerialized
    ? normalizeSerializedVariants(body?.variants || [])
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

  if (!Number.isFinite(costPrice) || costPrice < 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Product cost cannot be negative.'
    })
  }

  if (oldPrice !== null && (!Number.isFinite(oldPrice) || oldPrice < 0)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Old price must be empty or a valid positive number.'
    })
  }

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
    stock_quantity: isSerialized
      ? variants.reduce((total, variant) => total + variant.quantity, 0)
      : stockQuantity,
    cost_price: costPrice,
    color_name: normalizeText(body?.color_name),
    color_hex: normalizeText(body?.color_hex),
    is_serialized: isSerialized,
    variants,
    is_published: normalizeBoolean(body?.is_published)
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
      .select('id, account_type')
      .eq('id', payload.default_supplier_id)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!supplier || supplier.account_type !== 'supplier') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Default supplier must be an existing supplier record.'
      })
    }
  }

  if (payload.primary_warehouse_id) {
    const { data: warehouse, error } = await supabaseAdmin
      .from('commerce_warehouses')
      .select('id')
      .eq('id', payload.primary_warehouse_id)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!warehouse) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Primary warehouse must be an existing warehouse.'
      })
    }
  }
}

export const initializePrimaryWarehouseInventoryForProduct = async ({
  supabaseAdmin,
  productId,
  stockQuantity,
  costPrice,
  primaryWarehouseId
}) => {
  if (!productId || !primaryWarehouseId || Number(stockQuantity || 0) <= 0) {
    return
  }

  const { error } = await supabaseAdmin
    .from('commerce_warehouse_inventory')
    .upsert({
      warehouse_id: primaryWarehouseId,
      product_id: productId,
      quantity: Number(stockQuantity || 0),
      average_cost: Number(costPrice || 0),
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'warehouse_id,product_id'
    })

  if (error) {
    throw error
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
        average_cost: Number(nextProduct?.cost_price || previousProduct?.cost_price || 0),
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
