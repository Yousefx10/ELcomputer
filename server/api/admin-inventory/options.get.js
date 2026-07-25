import { createError } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { isMissingInventorySchemaError } from '../../utils/serializedInventory'

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'products.view'
  })

  const [
    productsResult,
    warehousesResult
  ] = await Promise.all([
    supabaseAdmin
      .from('products')
      .select('id, title, sku')
      .eq('is_serialized', true)
      .order('title'),
    supabaseAdmin
      .from('commerce_warehouses')
      .select('id, name, code')
      .eq('is_active', true)
      .order('name')
  ])

  const error = productsResult.error || warehousesResult.error

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
    warehouses: warehousesResult.data || []
  }
})
