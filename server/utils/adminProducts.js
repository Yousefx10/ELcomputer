import { createError } from 'h3'
import { normalizeSeoFields } from './seoFields.js'
import { normalizeProductWarranty, warrantyFields } from '../../app/utils/warranty.js'

const PRODUCT_MUTABLE_FIELDS = [
  'seo_title', 'seo_description', 'seo_image_url',
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
  ...warrantyFields,
  'selling_mode', 'expected_availability_date', 'availability_message',
  'preorder_active', 'preorder_starts_at', 'preorder_ends_at',
  'preorder_payment_mode', 'preorder_deposit_percent',
  'preorder_total_limit', 'preorder_customer_limit'
]

export const productValidationError = (message, field = '') => {
  throw createError({ statusCode: 400, statusMessage: message, data: { productSaveError: 'validation', field } })
}

const normalizeText = (value, maximum = 100000, field = '') => {
  if (value !== undefined && value !== null && typeof value !== 'string') {
    productValidationError('Enter text for this field.', field)
  }
  const normalizedValue = (value || '').trim()
  if (normalizedValue.length > maximum || normalizedValue.includes('\u0000')) {
    productValidationError('This field is too long or contains invalid characters.', field)
  }
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
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    productValidationError('Choose a valid reference.', 'reference')
  }
  const normalizedValue = value.toLowerCase()
  return normalizedValue || null
}

const normalizeBoolean = (value) => {
  if (value === undefined) return false
  if (typeof value !== 'boolean') productValidationError('Choose a valid option.')
  return value
}

export const normalizeProductMoney = (value, field, { optional = false } = {}) => {
  if (optional && (value === '' || value === null || value === undefined)) return null
  if (!['string', 'number'].includes(typeof value) || !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(String(value))) {
    productValidationError('Enter a price with up to two decimal places.', field)
  }
  return Number(value)
}

const normalizeProductQuantity = (value, field) => {
  if (!['string', 'number'].includes(typeof value) || !/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) > 2147483647) {
    productValidationError('Enter a valid whole stock quantity.', field)
  }
  return Number(value)
}

const normalizeSku = (value, field) => {
  if (typeof value === 'string' && /[\u0000-\u001f\u007f]/.test(value)) productValidationError('SKU contains invalid characters.', field)
  const sku = normalizeText(value, 120, field)
  return sku
}

const normalizeVariantCode = (value) => {
  const code = normalizeText(value, 80, 'variants')?.toUpperCase() || ''
  if (code && !/^[A-Z0-9_-]+$/.test(code)) productValidationError('Use letters, numbers, underscores or hyphens for option codes.', 'variants')
  return code
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
    if (!variant || typeof variant !== 'object' || Array.isArray(variant)) productValidationError('Choose valid product options.', 'variants')
    const name = normalizeText(variant?.name, 120, 'variants') || ''
    const code = normalizeVariantCode(variant.code == null || variant.code === '' ? name : variant.code)
    const quantity = includeQuantity ? normalizeProductQuantity(variant?.quantity, 'variants') : 0
    if (!includeQuantity && Object.hasOwn(variant, 'quantity')) productValidationError('Receive stock through Procurement.', 'variants')
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
      sku: normalizeSku(variant?.sku, 'variants'),
      color_name: normalizeText(variant?.color_name, 120, 'variants') || name,
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
  catalogDefinitionsOnly = false,
  previousProduct
} = {}) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) productValidationError('Product details are invalid.')
  let warranty
  try {
    warranty = normalizeProductWarranty(body, { previous: previousProduct })
  } catch (error) {
    throw createError({ statusCode: 400, statusMessage: error.message, data: { warrantyErrorKey: error.warrantyErrorKey } })
  }
  const title = normalizeText(body?.title, 500, 'title') || ''
  if (body.slug !== undefined && (typeof body.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug) || body.slug.length > 200)) {
    productValidationError('Use a valid English product URL.', 'slug')
  }
  const slug = normalizeSlug(body?.slug || title)
  const price = normalizeProductMoney(body?.price, 'price')
  const stockQuantity = Object.hasOwn(body, 'stock_quantity') ? normalizeProductQuantity(body.stock_quantity, 'stock_quantity') : null
  const oldPrice = normalizeProductMoney(body?.old_price, 'old_price', { optional: true })
  for (const field of ['image_url', 'seo_image_url']) {
    const value = normalizeText(body[field], 2048, field)
    if (value && !/^(https?:\/\/|\/(?!\/))[^\s<>"']+$/i.test(value)) productValidationError('Choose a valid product image.', field)
  }
  const productColor = normalizeText(body.color_hex, 7, 'color_hex')
  if (productColor && !/^#[0-9a-f]{6}$/i.test(productColor)) productValidationError('Choose a valid product color.', 'color_hex')
  if (Object.hasOwn(body, 'is_serialized')) normalizeBoolean(body.is_serialized)
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
    ...warranty,
    ...normalizeSeoFields(body),
    title,
    slug,
    description: normalizeText(body?.description, 10000, 'description'),
    long_description: normalizeText(body?.long_description),
    price,
    old_price: oldPrice,
    image_url: normalizeText(body?.image_url),
    category_id: normalizeUuid(body?.category_id),
    brand_id: normalizeUuid(body?.brand_id),
    default_supplier_id: normalizeUuid(body?.default_supplier_id),
    primary_warehouse_id: normalizeUuid(body?.primary_warehouse_id),
    sku: normalizeSku(body?.sku, 'sku'),
    stock_quantity: catalogDefinitionsOnly
      ? 0
      : isSerialized
        ? variants.reduce((total, variant) => total + variant.quantity, 0)
        : stockQuantity,
    color_name: normalizeText(body?.color_name, 120, 'color_name'),
    color_hex: productColor,
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
