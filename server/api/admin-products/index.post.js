import { createError } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import {
  ensureProductCommerceReferences,
  initializePrimaryWarehouseInventoryForProduct,
  isMissingSchemaError,
  normalizeAdminProductPayload
} from '../../utils/adminProducts'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'products.add'
  })

  const body = await readBody(event)
  const normalizedPayload = normalizeAdminProductPayload(body)
  const {
    variants,
    ...payload
  } = normalizedPayload

  if (payload.is_serialized && !payload.primary_warehouse_id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A primary warehouse is required for serialized inventory.'
    })
  }

  if (payload.is_serialized && (!variants.length || payload.stock_quantity < 1)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Add at least one model and one individually tracked item.'
    })
  }

  const initialSerializedQuantity = payload.is_serialized
    ? payload.stock_quantity
    : 0

  if (payload.is_serialized) {
    payload.stock_quantity = 0
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

  const { data: productRecord, error: productError } = await supabaseAdmin
    .from('products')
    .insert(payload)
    .select('id')
    .single()

  if (productError || !productRecord?.id) {
    throw createError({
      statusCode: isMissingSchemaError(productError) ? 500 : 400,
      statusMessage: isMissingSchemaError(productError)
        ? 'Run the latest serialized inventory migration first, then try again.'
        : productError?.message || 'Could not create this product.'
    })
  }

  try {
    if (payload.is_serialized) {
      const { error: serializedInventoryError } = await supabaseAdmin.rpc(
        'commerce_add_serialized_inventory',
        {
          p_product_id: productRecord.id,
          p_warehouse_id: payload.primary_warehouse_id,
          p_variants: variants,
          p_notes: 'Initial serialized inventory created with the product.',
          p_admin_id: adminUser.id
        }
      )

      if (serializedInventoryError) {
        throw serializedInventoryError
      }
    } else {
      await initializePrimaryWarehouseInventoryForProduct({
        supabaseAdmin,
        productId: productRecord.id,
        stockQuantity: payload.stock_quantity,
        costPrice: payload.cost_price,
        primaryWarehouseId: payload.primary_warehouse_id
      })
    }
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
    id: productRecord.id,
    createdItems: initialSerializedQuantity
  }
})
