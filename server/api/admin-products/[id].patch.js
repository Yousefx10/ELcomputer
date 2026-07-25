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
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, {
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
  const normalizedPayload = normalizeAdminProductPayload(body, {
    catalogDefinitionsOnly: wasSerialized
  })
  const {
    variants,
    ...payload
  } = normalizedPayload

  if (wasSerialized !== Boolean(payload.is_serialized)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Inventory tracking mode cannot be changed after a product is created.'
    })
  }

  const previousWarehouseId = String(previousProduct.primary_warehouse_id || '')
  const nextWarehouseId = String(payload.primary_warehouse_id || '')
  const isPrimaryWarehouseChanging = previousWarehouseId !== nextWarehouseId

  if (wasSerialized && !nextWarehouseId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A primary warehouse is required for individually tracked products.'
    })
  }

  if (wasSerialized && isPrimaryWarehouseChanging) {
    if (Number(previousProduct.stock_quantity || 0) !== 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Move serialized items with inventory tools before changing the primary warehouse.'
      })
    }

    const {
      count: serializedUnitCount,
      error: serializedUnitCountError
    } = await supabaseAdmin
      .from('commerce_serialized_units')
      .select('id', {
        count: 'exact',
        head: true
      })
      .eq('product_id', productId)

    if (serializedUnitCountError) {
      throw createError({
        statusCode: isMissingSchemaError(serializedUnitCountError) ? 500 : 400,
        statusMessage: isMissingSchemaError(serializedUnitCountError)
          ? 'Run the latest Commerce SQL changes first, then try again.'
          : serializedUnitCountError.message
      })
    }

    if (Number(serializedUnitCount || 0) > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'The primary warehouse cannot change after physical item IDs exist.'
      })
    }
  }

  if (wasSerialized) {
    payload.stock_quantity = Number(previousProduct.stock_quantity || 0)

    if (!variants.length) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Add at least one product option reference. Use Default when the product has no model or color options.'
      })
    }
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
    if (wasSerialized) {
      const { error: variantDefinitionsError } = await supabaseAdmin.rpc(
        'commerce_define_product_variants',
        {
          p_product_id: productId,
          p_variants: variants,
          p_admin_id: adminUser.id
        }
      )

      if (variantDefinitionsError) {
        throw variantDefinitionsError
      }
    } else {
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
        : error.message || (
            wasSerialized
              ? 'Could not update the product variant definitions.'
              : 'Could not sync primary warehouse inventory.'
          )
    })
  }

  return {
    id: productId
  }
})
