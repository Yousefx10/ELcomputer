import { createError } from 'h3'
import { requireAdminRequest } from '../../../utils/adminRequest'
import {
  isInventoryUuid,
  isMissingInventorySchemaError,
  normalizeInventoryToken
} from '../../../utils/serializedInventory'

const fetchMaybeSingle = async (query) => {
  const { data, error } = await query.maybeSingle()

  if (error) {
    throw error
  }

  return data || null
}

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'products.view'
  })
  const token = normalizeInventoryToken(event.context.params?.token)

  if (!token) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Scan or enter an item code.'
    })
  }

  let unitQuery = supabaseAdmin
    .from('commerce_serialized_units')
    .select('*')

  unitQuery = isInventoryUuid(token)
    ? unitQuery.or(`id.eq.${token},qr_token.eq.${token}`)
    : unitQuery.eq('unit_code', token.toUpperCase())

  unitQuery = unitQuery.limit(1)

  let unit

  try {
    unit = await fetchMaybeSingle(unitQuery)
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: isMissingInventorySchemaError(error)
        ? 'Run the serialized inventory migration first.'
        : error.message
    })
  }

  if (!unit) {
    throw createError({
      statusCode: 404,
      statusMessage: 'No inventory item matches this code.'
    })
  }

  const orderId = unit.customer_order_id || unit.last_customer_order_id || null
  const orderItemId = unit.customer_order_item_id || unit.last_customer_order_item_id || null

  const [
    productResult,
    variantResult,
    warehouseResult,
    orderResult,
    orderItemResult,
    movementsResult
  ] = await Promise.all([
    supabaseAdmin
      .from('products')
      .select('id, title, slug, sku, image_url, price, cost_price, primary_warehouse_id, is_serialized')
      .eq('id', unit.product_id)
      .maybeSingle(),
    supabaseAdmin
      .from('product_variants')
      .select('*')
      .eq('id', unit.variant_id)
      .maybeSingle(),
    unit.warehouse_id
      ? supabaseAdmin
          .from('commerce_warehouses')
          .select('id, name, code, address_line_1, city, country')
          .eq('id', unit.warehouse_id)
          .maybeSingle()
      : Promise.resolve({
          data: null,
          error: null
        }),
    orderId
      ? supabaseAdmin
          .from('customer_orders')
          .select('*')
          .eq('id', orderId)
          .maybeSingle()
      : Promise.resolve({
          data: null,
          error: null
        }),
    orderItemId
      ? supabaseAdmin
          .from('customer_order_items')
          .select('*')
          .eq('id', orderItemId)
          .maybeSingle()
      : Promise.resolve({
          data: null,
          error: null
        }),
    supabaseAdmin
      .from('commerce_serialized_unit_movements')
      .select('*')
      .eq('unit_id', unit.id)
      .order('created_at', {
        ascending: false
      })
      .limit(100)
  ])

  const relatedError = [
    productResult.error,
    variantResult.error,
    warehouseResult.error,
    orderResult.error,
    orderItemResult.error,
    movementsResult.error
  ].find(Boolean)

  if (relatedError) {
    throw createError({
      statusCode: 500,
      statusMessage: relatedError.message
    })
  }

  const order = orderResult.data || null
  const movementRows = movementsResult.data || []
  const movementOrderIds = [
    ...new Set(
      movementRows
        .map((movement) => movement.customer_order_id)
        .filter(Boolean)
    )
  ]
  const actorIds = [
    ...new Set(
      movementRows
        .map((movement) => movement.actor_admin_id || movement.created_by)
        .filter(Boolean)
    )
  ]

  const [movementOrdersResult, actorsResult] = await Promise.all([
    movementOrderIds.length
      ? supabaseAdmin
          .from('customer_orders')
          .select('id, order_number')
          .in('id', movementOrderIds)
      : Promise.resolve({
          data: [],
          error: null
        }),
    actorIds.length
      ? supabaseAdmin
          .from('admin_users')
          .select('id, full_name, email')
          .in('id', actorIds)
      : Promise.resolve({
          data: [],
          error: null
        })
  ])

  if (movementOrdersResult.error || actorsResult.error) {
    throw createError({
      statusCode: 500,
      statusMessage: movementOrdersResult.error?.message || actorsResult.error?.message
    })
  }

  const movementOrderMap = new Map(
    (movementOrdersResult.data || []).map((row) => [String(row.id), row])
  )
  const actorMap = new Map(
    (actorsResult.data || []).map((row) => [String(row.id), row])
  )

  return {
    item: {
      ...unit,
      product: productResult.data || null,
      variant: variantResult.data || null,
      warehouse: warehouseResult.data || null,
      order,
      order_item: orderItemResult.data || null,
      purchaser: order
        ? {
            user_id: order.user_id || unit.customer_user_id || null,
            name: [order.first_name, order.last_name].filter(Boolean).join(' '),
            email: order.email || null,
            phone: order.phone || null,
            address: [
              order.street_address,
              order.city,
              order.governorate
            ].filter(Boolean).join(', ')
          }
        : null,
      movements: movementRows.map((movement) => {
        const actorId = movement.actor_admin_id || movement.created_by
        const actor = actorMap.get(String(actorId || ''))

        return {
          ...movement,
          order_number: movementOrderMap.get(String(movement.customer_order_id || ''))?.order_number || null,
          actor_name: actor?.full_name || actor?.email || null
        }
      })
    }
  }
})
