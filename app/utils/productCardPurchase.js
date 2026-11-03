import { allowsCartBackorder } from './backorder.js'

export const productCardVariantFields = 'id,product_id,name,code,sku,color_name,color_hex,stock_quantity,is_active,sale_price,option_values'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Two active rows are enough to prove a choice exists. Never fetch private
// inventory, infer a Default ID, or select an arbitrary first option.
export const readProductCardVariants = async (client, productId) => {
  if (!uuid.test(String(productId))) throw Error('Invalid product reference')
  const { data, error } = await client.from('storefront_product_variants')
    .select(productCardVariantFields).eq('product_id', productId).eq('is_active', true)
    .order('id').limit(2).abortSignal(AbortSignal.timeout(10000))
  if (error || !Array.isArray(data) || data.length > 2) throw Error('Options unavailable')
  if (data.some(row => !uuid.test(String(row?.id)) || row.product_id !== productId || row.is_active !== true
    || !Number.isFinite(Number(row.stock_quantity)) || Number(row.stock_quantity) < 0)
    || new Set(data.map(row => row.id)).size !== data.length) throw Error('Invalid options')
  return data
}

export const productCardPurchase = (product, settings = {}, variants = null, restricted = false) => {
  const allowBackorder = allowsCartBackorder({ ...product, allow_out_of_stock_purchases: Boolean(settings?.allow_out_of_stock_purchases) }, settings)
  if (!product?.id || product.is_published === false || product.selling_mode === 'coming_soon') return { kind: 'unavailable', allowBackorder }
  if (product.selling_mode === 'preorder') return { kind: 'preorder', allowBackorder }
  if (restricted || typeof product.is_serialized !== 'boolean') return { kind: 'options', allowBackorder }
  let variant = null
  if (product.is_serialized) {
    if (!Array.isArray(variants)) return { kind: 'options', allowBackorder }
    if (variants.length > 1) return { kind: 'options', allowBackorder }
    if (!variants.length) return { kind: 'unavailable', allowBackorder }
    variant = variants[0]
  } else if (product.has_variants === true || Number(product.variant_count) > 0
    || [product.variants, product.product_variants].some(rows => Array.isArray(rows) && rows.some(row => row?.is_active !== false))) {
    return { kind: 'options', allowBackorder }
  }
  const stock = Number(variant ? variant.stock_quantity : product.stock_quantity)
  if (!Number.isFinite(stock) || stock < 0 || stock < 1 && !allowBackorder) return { kind: 'unavailable', allowBackorder }
  return { kind: 'direct', variant, stock, allowBackorder }
}
