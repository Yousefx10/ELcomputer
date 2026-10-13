import { createError, setHeader } from 'h3'
import { normalizeAdminProductPayload, productValidationError, isMissingSchemaError } from './adminProducts.js'
import { warrantyFields } from '../../app/utils/warranty.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const fields = new Set([
  'request_id', 'expected_revision', 'title', 'slug', 'description', 'long_description',
  'price', 'old_price', 'image_url', 'category_id', 'brand_id', 'default_supplier_id',
  'primary_warehouse_id', 'sku', 'stock_quantity', 'color_name', 'color_hex',
  'is_serialized', 'is_published', 'variants', 'seo_title', 'seo_description', 'seo_image_url',
  ...warrantyFields, 'selling_mode', 'expected_availability_date', 'availability_message',
  'preorder_active', 'preorder_starts_at', 'preorder_ends_at', 'preorder_payment_mode',
  'preorder_deposit_percent', 'preorder_total_limit', 'preorder_customer_limit'
])

export function privateProductResponse(event) {
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
}

export function productId(value) {
  if (typeof value !== 'string' || !UUID.test(value)) productValidationError('Product ID is invalid.', 'id')
  return value.toLowerCase()
}

export function prepareProductSave(body, operation) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || JSON.stringify(body).length > 200000) {
    productValidationError('Product details are invalid or too long.')
  }
  if (Object.keys(body).some(key => !fields.has(key))) productValidationError('Product details contain unsupported fields.')
  if (typeof body.request_id !== 'string' || !UUID.test(body.request_id)) {
    productValidationError('Reload this form before saving.', 'request_id')
  }
  if (operation === 'update' && (!Number.isSafeInteger(body.expected_revision) || body.expected_revision < 0)) {
    productValidationError('Reload this product before saving.', 'expected_revision')
  }
  if (operation === 'create' && body.expected_revision != null) productValidationError('Product revision is invalid.', 'expected_revision')
  if (operation === 'update' && typeof body.is_serialized !== 'boolean') productValidationError('Product tracking mode is required.', 'is_serialized')
  if (operation === 'create' && body.is_serialized !== undefined && body.is_serialized !== true) productValidationError('New products require individual item tracking.', 'is_serialized')
  const serialized = operation === 'create' || body.is_serialized
  const { variants, ...payload } = normalizeAdminProductPayload(body, { catalogDefinitionsOnly: serialized })
  if (operation === 'create' && body.stock_quantity !== undefined && Number(body.stock_quantity) !== 0) {
    productValidationError('Receive stock through Procurement.', 'stock_quantity')
  }
  // Tracked quantity is a live inventory projection, never an editorial snapshot.
  if (serialized) delete payload.stock_quantity
  if (operation === 'update' && !warrantyFields.some(field => Object.hasOwn(body, field))) {
    for (const field of warrantyFields) delete payload[field]
  }
  return {
    p_request_id: body.request_id.toLowerCase(), p_operation: operation,
    p_expected_revision: operation === 'update' ? body.expected_revision : null,
    p_payload: payload, p_variants: variants
  }
}

export function throwProductSaveError(error) {
  const key = error?.message?.match(/^catalog:([a-z_]+)$/)?.[1]
  const messages = {
    conflict: [409, 'This product changed. Reload before saving.'],
    request_reused: [409, 'This save request was already used. Reload the form.'],
    unavailable: [409, 'The saved product is no longer available.'],
    not_found: [404, 'Product not found.'],
    permission: [403, 'You do not have permission to save this product.'],
    invalid: [400, 'Check the product details and try again.'],
    reference: [400, 'Choose an active supplier and warehouse.'],
    stock: [400, 'Use inventory tools to change stock or warehouse.'],
    tracking: [400, 'Inventory tracking mode cannot be changed.'],
    variants: [400, 'Check the product options and try again.'],
    erp: [409, 'Inventory fields are managed in Daftra.']
  }
  let result = messages[key]
  let reason = key
  if (!result && /^Move or delete this variant's extra images before deactivating it\.$/.test(error?.message || '')) {
    result = messages.variants; reason = 'variants'
  }
  if (!result && error?.code === '23505') { result = [409, 'This SKU or product URL is already used.']; reason = 'duplicate' }
  if (!result && error?.code === '23503') { result = [400, 'A selected reference is no longer available.']; reason = 'reference' }
  if (!result && ['23502', '23514', '22P02', '22003', '22023'].includes(error?.code)) { result = [400, 'Check the product details and try again.']; reason = 'validation' }
  if (!result && error?.code === '42501') { result = [403, 'You do not have permission to save this product.']; reason = 'permission' }
  if (!result && ['40001', '40P01', '55P03', '57014'].includes(error?.code)) { result = [409, 'This product changed. Reload before saving.']; reason = 'conflict' }
  if (!result && isMissingSchemaError(error)) { result = [503, 'Product saving is unavailable. Contact the store administrator.']; reason = 'schema' }
  const [statusCode, statusMessage] = result || [503, 'Save result is unknown. Retry to check it.']
  throw createError({ statusCode, statusMessage, data: { productSaveError: reason || 'unconfirmed' } })
}

export async function saveProduct(supabaseAdmin, adminUser, body, operation, id = null) {
  const input = prepareProductSave(body, operation)
  const { data, error } = await supabaseAdmin.rpc('catalog_save_product', {
    p_admin_id: adminUser.id, p_product_id: id, ...input
  })
  if (error) throwProductSaveError(error)
  if (!data?.id || !Number.isSafeInteger(data.revision)) throwProductSaveError({})
  return data
}
