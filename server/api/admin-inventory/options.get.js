import { createError } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { isMissingInventorySchemaError } from '../../utils/serializedInventory'

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'products.view'
  })

  const [
    productsResult,
    variantsResult,
    warehousesResult
  ] = await Promise.all([
    supabaseAdmin
      .from('products')
      .select('id, title, sku, stock_quantity, primary_warehouse_id')
      .eq('is_serialized', true)
      .order('title'),
    supabaseAdmin
      .from('product_variants')
      .select('*')
      .eq('is_active', true)
      .order('name'),
    supabaseAdmin
      .from('commerce_warehouses')
      .select('id, name, code')
      .eq('is_active', true)
      .order('name')
  ])

  const error = productsResult.error || variantsResult.error || warehousesResult.error

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: isMissingInventorySchemaError(error)
        ? 'Run the serialized inventory migration first.'
        : error.message
    })
  }

  return {
    products: productsResult.data || [],
    variants: variantsResult.data || [],
    warehouses: warehousesResult.data || []
  }
})
