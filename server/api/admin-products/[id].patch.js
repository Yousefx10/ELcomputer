import { createError } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import {
  ensureProductCommerceReferences,
  isMissingSchemaError,
  normalizeAdminProductPayload,
  pickMutableProductFields,
  syncPrimaryWarehouseInventoryForProductUpdate
} from '../../utils/adminProducts'

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'products.edit'
  })

  const productId = String(event.context.params?.id || '').trim()

  if (!productId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Product ID is required.'
    })
  }

  const body = await readBody(event)
  const normalizedPayload = normalizeAdminProductPayload(body)
  const {
    variants: _variants,
    ...payload
  } = normalizedPayload

  const { data: previousProduct, error: previousProductError } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('id', productId)
    .maybeSingle()

  if (previousProductError || !previousProduct) {
    throw createError({
      statusCode: 404,
      statusMessage: previousProductError?.message || 'Product not found.'
    })
  }

  const wasSerialized = Boolean(previousProduct.is_serialized)

  if (wasSerialized !== Boolean(payload.is_serialized)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Inventory tracking mode cannot be changed after a product is created.'
    })
  }

  if (
    wasSerialized &&
    String(previousProduct.primary_warehouse_id || '') !== String(payload.primary_warehouse_id || '')
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Move serialized items with inventory tools before changing the primary warehouse.'
    })
  }

  if (wasSerialized) {
    payload.stock_quantity = Number(previousProduct.stock_quantity || 0)
  }

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

  const { error: updateError } = await supabaseAdmin
    .from('products')
    .update(payload)
    .eq('id', productId)

  if (updateError) {
    throw createError({
      statusCode: isMissingSchemaError(updateError) ? 500 : 400,
      statusMessage: isMissingSchemaError(updateError)
        ? 'Run the latest serialized inventory migration first, then try again.'
        : updateError.message
    })
  }

  try {
    if (!wasSerialized) {
      await syncPrimaryWarehouseInventoryForProductUpdate({
        supabaseAdmin,
        productId,
        previousProduct,
        nextProduct: payload
      })
    }
  } catch (error) {
    await supabaseAdmin
      .from('products')
      .update(pickMutableProductFields(previousProduct))
      .eq('id', productId)

    throw createError({
      statusCode: error?.statusCode || (isMissingSchemaError(error) ? 500 : 400),
      statusMessage: isMissingSchemaError(error)
        ? 'Run the latest Commerce SQL changes first, then try again.'
        : error.message || 'Could not sync primary warehouse inventory.'
    })
  }

  return {
    id: productId
  }
})
