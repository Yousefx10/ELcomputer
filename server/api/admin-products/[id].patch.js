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
  const payload = normalizeAdminProductPayload(body)

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
      statusCode: 400,
      statusMessage: updateError.message
    })
  }

  try {
    await syncPrimaryWarehouseInventoryForProductUpdate({
      supabaseAdmin,
      productId,
      previousProduct,
      nextProduct: payload
    })
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
