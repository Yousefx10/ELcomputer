import { createError } from 'h3'
import { requireAdminRequest } from '../../../utils/adminRequest'
import {
  isInventoryUuid,
  normalizeSerializedBatchRows,
  throwInventoryDatabaseError
} from '../../../utils/serializedInventory'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'products.edit'
  })
  const body = await readBody(event)
  const productId = String(body?.product_id || '').trim()
  const warehouseId = String(body?.warehouse_id || '').trim()
  const notes = String(body?.notes || '').trim() || null

  if (!isInventoryUuid(productId) || !isInventoryUuid(warehouseId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid serialized product and warehouse are required.'
    })
  }

  const variants = normalizeSerializedBatchRows(body?.variants)

  const { data: product, error: productError } = await supabaseAdmin
    .from('products')
    .select('id, is_serialized, primary_warehouse_id')
    .eq('id', productId)
    .maybeSingle()

  if (productError) {
    throw createError({
      statusCode: 500,
      statusMessage: productError.message
    })
  }

  if (!product?.is_serialized) {
    throw createError({
      statusCode: 400,
      statusMessage: 'This product does not use serialized inventory.'
    })
  }

  if (String(product.primary_warehouse_id || '') !== warehouseId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Receive serialized items into this product’s primary warehouse.'
    })
  }

  const { data, error } = await supabaseAdmin.rpc(
    'commerce_add_serialized_inventory',
    {
      p_product_id: productId,
      p_warehouse_id: warehouseId,
      p_variants: variants,
      p_notes: notes,
      p_admin_id: adminUser.id
    }
  )

  if (error) {
    throwInventoryDatabaseError(error, 'Could not create serialized inventory.')
  }

  const result = Array.isArray(data)
    ? data[0]
    : data

  return {
    createdCount: Number(result?.created_count || result?.createdCount || 0),
    variantCount: Number(result?.variant_count || result?.variantCount || variants.length),
    batchId: result?.batch_id || result?.batchId || null
  }
})
