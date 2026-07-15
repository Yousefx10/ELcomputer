import { createError } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import {
  ensureProductCommerceReferences,
  initializePrimaryWarehouseInventoryForProduct,
  isMissingSchemaError,
  normalizeAdminProductPayload
} from '../../utils/adminProducts'

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'products.add'
  })

  const body = await readBody(event)
  const payload = normalizeAdminProductPayload(body)

  try {
    await ensureProductCommerceReferences(supabaseAdmin, payload)
  } catch (error) {
    if (error?.statusCode) {
      throw error
    }

    throw createError({
      statusCode: isMissingSchemaError(error) ? 500 : 400,
      statusMessage: isMissingSchemaError(error)
        ? 'Run the latest Commerce SQL changes first, then try again.'
        : error.message
    })
  }

  const { data: productRecord, error: productError } = await supabaseAdmin
    .from('products')
    .insert(payload)
    .select('id')
    .single()

  if (productError || !productRecord?.id) {
    throw createError({
      statusCode: 400,
      statusMessage: productError?.message || 'Could not create this product.'
    })
  }

  try {
    await initializePrimaryWarehouseInventoryForProduct({
      supabaseAdmin,
      productId: productRecord.id,
      stockQuantity: payload.stock_quantity,
      costPrice: payload.cost_price,
      primaryWarehouseId: payload.primary_warehouse_id
    })
  } catch (error) {
    await supabaseAdmin
      .from('products')
      .delete()
      .eq('id', productRecord.id)

    throw createError({
      statusCode: isMissingSchemaError(error) ? 500 : 400,
      statusMessage: isMissingSchemaError(error)
        ? 'Run the latest Commerce SQL changes first, then try again.'
        : error.message || 'Could not initialize primary warehouse inventory.'
    })
  }

  return {
    id: productRecord.id
  }
})
