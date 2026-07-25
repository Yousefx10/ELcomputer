import { createError } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import {
  ensureProductCommerceReferences,
  isMissingSchemaError,
  normalizeAdminProductPayload
} from '../../utils/adminProducts'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'products.add'
  })

  const body = await readBody(event)
  const normalizedPayload = normalizeAdminProductPayload(body, {
    catalogDefinitionsOnly: true
  })
  const {
    variants,
    ...payload
  } = normalizedPayload

  if (!payload.primary_warehouse_id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A primary warehouse is required for individually tracked products.'
    })
  }

  if (!variants.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Add at least one product option reference. Use Default when the product has no model or color options.'
    })
  }

  payload.is_serialized = true
  payload.stock_quantity = 0
  payload.cost_price = 0

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
    const { error: variantDefinitionsError } = await supabaseAdmin.rpc(
      'commerce_define_product_variants',
      {
        p_product_id: productRecord.id,
        p_variants: variants,
        p_admin_id: adminUser.id
      }
    )

    if (variantDefinitionsError) {
      throw variantDefinitionsError
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
        : error.message || 'Could not define the product variants.'
    })
  }

  return {
    id: productRecord.id,
    createdItems: 0
  }
})
