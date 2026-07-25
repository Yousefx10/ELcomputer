import { createError, getQuery } from 'h3'
import { requireAdminRequest } from '../../../utils/adminRequest'
import {
  isInventoryUuid,
  isMissingInventorySchemaError,
  normalizeInventoryPage,
  normalizeInventoryPageSize,
  normalizeInventoryStatus,
  normalizeInventoryToken
} from '../../../utils/serializedInventory'

const uniqueValues = (rows, getter) => {
  return [...new Set(rows.map(getter).filter(Boolean))]
}

const makeMap = (rows = []) => {
  return new Map(rows.map((row) => [String(row.id), row]))
}

const fetchRelatedRows = async (supabaseAdmin, table, ids, columns = '*') => {
  if (!ids.length) {
    return []
  }

  const { data, error } = await supabaseAdmin
    .from(table)
    .select(columns)
    .in('id', ids)

  if (error) {
    throw error
  }

  return data || []
}

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'products.view'
  })
  const query = getQuery(event)
  const page = normalizeInventoryPage(query.page)
  const pageSize = normalizeInventoryPageSize(query.pageSize || query.page_size)
  const status = normalizeInventoryStatus(query.status)
  const productId = String(query.productId || query.product_id || '').trim()
  const variantId = String(query.variantId || query.variant_id || '').trim()
  const warehouseId = String(query.warehouseId || query.warehouse_id || '').trim()
  const search = normalizeInventoryToken(query.search).slice(0, 120)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let itemsQuery = supabaseAdmin
    .from('commerce_serialized_units')
    .select('*', {
      count: 'exact'
    })
    .order('created_at', {
      ascending: false
    })
    .range(from, to)

  if (status) {
    itemsQuery = itemsQuery.eq('status', status)
  }

  if (isInventoryUuid(productId)) {
    itemsQuery = itemsQuery.eq('product_id', productId)
  }

  if (isInventoryUuid(variantId)) {
    itemsQuery = itemsQuery.eq('variant_id', variantId)
  }

  if (isInventoryUuid(warehouseId)) {
    itemsQuery = itemsQuery.eq('warehouse_id', warehouseId)
  }

  if (search) {
    if (isInventoryUuid(search)) {
      itemsQuery = itemsQuery.or(`id.eq.${search},qr_token.eq.${search}`)
    } else {
      const safeSearch = search.replace(/[%_,().]/g, ' ').trim()

      if (safeSearch) {
        itemsQuery = itemsQuery.ilike('unit_code', `%${safeSearch}%`)
      }
    }
  }

  const { data: unitRows, count, error } = await itemsQuery

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: isMissingInventorySchemaError(error)
        ? 'Run the serialized inventory migration first.'
        : error.message
    })
  }

  const units = unitRows || []

  try {
    const [
      products,
      variants,
      warehouses,
      orders
    ] = await Promise.all([
      fetchRelatedRows(
        supabaseAdmin,
        'products',
        uniqueValues(units, (unit) => unit.product_id),
        'id, title, sku'
      ),
      fetchRelatedRows(
        supabaseAdmin,
        'product_variants',
        uniqueValues(units, (unit) => unit.variant_id)
      ),
      fetchRelatedRows(
        supabaseAdmin,
        'commerce_warehouses',
        uniqueValues(units, (unit) => unit.warehouse_id),
        'id, name, code'
      ),
      fetchRelatedRows(
        supabaseAdmin,
        'customer_orders',
        uniqueValues(units, (unit) => unit.customer_order_id || unit.last_customer_order_id),
        'id, order_number, status, first_name, last_name, email, phone, created_at'
      )
    ])

    const productMap = makeMap(products)
    const variantMap = makeMap(variants)
    const warehouseMap = makeMap(warehouses)
    const orderMap = makeMap(orders)

    const items = units.map((unit) => {
      const orderId = unit.customer_order_id || unit.last_customer_order_id
      const order = orderMap.get(String(orderId || '')) || null

      return {
        ...unit,
        product: productMap.get(String(unit.product_id)) || null,
        variant: variantMap.get(String(unit.variant_id)) || null,
        warehouse: warehouseMap.get(String(unit.warehouse_id || '')) || null,
        order,
        customer_name: order
          ? [order.first_name, order.last_name].filter(Boolean).join(' ')
          : null
      }
    })

    return {
      items,
      pagination: {
        page,
        pageSize,
        total: Number(count || 0),
        totalPages: Math.max(1, Math.ceil(Number(count || 0) / pageSize))
      }
    }
  } catch (relatedError) {
    throw createError({
      statusCode: 500,
      statusMessage: relatedError.message
    })
  }
})
