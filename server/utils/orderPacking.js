import { createError } from 'h3'
import {
  normalizeAdminOrderItemRecord,
  normalizeAdminOrderRecord
} from './adminOrders'

export const ORDER_PACKING_SESSIONS_TABLE = 'order_packing_sessions'
export const ORDER_PACKING_SCANS_TABLE = 'order_packing_scans'
export const CUSTOMER_MESSAGES_TABLE = 'customer_order_messages'
export const ORDER_PACKING_ELIGIBLE_STATUSES = ['pending_payment', 'processing']
export const ORDER_PACKING_ACTIVE_STATE = 'active'
export const ORDER_PACKING_COMPLETED_STATE = 'completed'
export const DEFAULT_PACKED_ORDER_STATUS = 'ready_to_deliver'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MISSING_PACKING_SCHEMA_CODES = new Set([
  '42P01',
  '42703',
  '42883',
  'PGRST202',
  'PGRST204',
  'PGRST205'
])

export const isOrderPackingUuid = (value) => {
  return UUID_PATTERN.test(String(value || '').trim())
}

export const isMissingOrderPackingSchemaError = (error) => {
  return MISSING_PACKING_SCHEMA_CODES.has(error?.code)
}

export const getOrderPackingDatabaseMessage = (error) => {
  return String(error?.message || '')
    .replace(/^.*ERROR:\s*/i, '')
    .trim()
}

export const throwOrderPackingDatabaseError = (
  error,
  fallbackMessage = 'Could not complete the order packing request.'
) => {
  const message = getOrderPackingDatabaseMessage(error)

  if (isMissingOrderPackingSchemaError(error)) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Run the latest order packing migration first, then try again.'
    })
  }

  const isConflict = error?.code === '23505'
    || /already|active session|claimed|locked|duplicate|wrong order|different order|not assigned|not active|not available|too many|complete|status changed|missing item|remaining/i.test(message)
  const isValidationError = error?.code === 'P0001'
    || error?.code === '22P02'
    || error?.code === '23503'
    || error?.code === '23514'

  throw createError({
    statusCode: isConflict ? 409 : isValidationError ? 400 : 500,
    statusMessage: message || fallbackMessage
  })
}

export const normalizePackingText = (value, maximumLength = 5000) => {
  return String(value || '').trim().slice(0, maximumLength)
}

export const normalizePackingScanToken = (value) => {
  const rawValue = String(value || '').trim()

  if (!rawValue) {
    return ''
  }

  if (/^https?:\/\//i.test(rawValue)) {
    try {
      const scannedUrl = new URL(rawValue)
      const queryToken = scannedUrl.searchParams.get('token')
        || scannedUrl.searchParams.get('code')
        || scannedUrl.searchParams.get('item')

      if (queryToken) {
        return decodeURIComponent(queryToken).trim()
      }

      const pathToken = scannedUrl.pathname.split('/').filter(Boolean).pop()
      return pathToken ? decodeURIComponent(pathToken).trim() : ''
    } catch {
      return ''
    }
  }

  try {
    return decodeURIComponent(rawValue).trim()
  } catch {
    return rawValue
  }
}

export const getPackingSessionState = (session = {}) => {
  const packingSession = session || {}

  return String(
    packingSession.state || packingSession.status || ''
  ).trim().toLowerCase()
}

export const getPackingSessionAdminId = (session = {}) => {
  const packingSession = session || {}

  return String(
    packingSession.started_by
    || packingSession.admin_user_id
    || packingSession.processor_admin_id
    || packingSession.processed_by
    || ''
  ).trim()
}

export const isActivePackingSession = (session) => {
  return getPackingSessionState(session) === ORDER_PACKING_ACTIVE_STATE
}

export const assertPackingSessionOwner = (session, adminUserId) => {
  if (!session) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Packing session not found.'
    })
  }

  if (!isActivePackingSession(session)) {
    throw createError({
      statusCode: 409,
      statusMessage: 'This packing session is no longer active.'
    })
  }

  if (getPackingSessionAdminId(session) !== String(adminUserId || '')) {
    throw createError({
      statusCode: 409,
      statusMessage: 'This order is being processed by another admin.'
    })
  }
}

const makeRecordMap = (rows = []) => {
  return new Map(rows.map((row) => [String(row.id), row]))
}

const getPackingScanOrderItemId = (scan = {}) => {
  return String(scan.order_item_id || scan.customer_order_item_id || '').trim()
}

const getPackingScanSerializedUnitId = (scan = {}) => {
  return String(scan.serialized_unit_id || scan.unit_id || '').trim()
}

const getPackingScanQuantity = (scan = {}) => {
  const quantity = Number(scan.quantity || 1)
  return Number.isInteger(quantity) && quantity > 0 ? quantity : 1
}

const normalizeSerializedUnit = (unit = {}) => {
  return {
    ...unit,
    id: String(unit.id || ''),
    customer_order_item_id: String(unit.customer_order_item_id || ''),
    unit_code: String(unit.unit_code || ''),
    serial_number: unit.serial_number || null,
    qr_token: unit.qr_token || null,
    status: String(unit.status || '')
  }
}

export const buildOrderPackingProgress = (items = []) => {
  const totalQuantity = items.reduce((sum, item) => {
    return sum + Math.max(0, Number(item.quantity || 0))
  }, 0)
  const scannedQuantity = items.reduce((sum, item) => {
    return sum + Math.max(0, Number(item.scanned_quantity || 0))
  }, 0)
  const remaining = Math.max(totalQuantity - scannedQuantity, 0)
  const completedItems = items.filter((item) => item.is_complete).length

  return {
    total_quantity: totalQuantity,
    scanned_quantity: scannedQuantity,
    remaining,
    total_items: items.length,
    completed_items: completedItems,
    is_complete: totalQuantity > 0 && remaining === 0,
    percentage: totalQuantity
      ? Math.min(100, Math.round((scannedQuantity / totalQuantity) * 100))
      : 0
  }
}

export const getOrderPackingSession = async (supabaseAdmin, sessionId) => {
  const { data, error } = await supabaseAdmin
    .from(ORDER_PACKING_SESSIONS_TABLE)
    .select('*')
    .eq('id', sessionId)
    .maybeSingle()

  if (error) {
    throwOrderPackingDatabaseError(error, 'Could not load this packing session.')
  }

  if (!data) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Packing session not found.'
    })
  }

  return data
}

export const getOrderPackingSessionsForOrders = async (
  supabaseAdmin,
  orderIds,
  statuses = [ORDER_PACKING_ACTIVE_STATE, ORDER_PACKING_COMPLETED_STATE]
) => {
  if (!orderIds.length) {
    return []
  }

  let query = supabaseAdmin
    .from(ORDER_PACKING_SESSIONS_TABLE)
    .select('*')
    .in('order_id', orderIds)
    .order('created_at', { ascending: false })

  if (statuses.length) {
    query = query.in('status', statuses)
  }

  const { data, error } = await query

  if (error) {
    throwOrderPackingDatabaseError(error, 'Could not load order packing locks.')
  }

  return data || []
}

export const getActiveOrderPackingSessions = async (supabaseAdmin, orderIds) => {
  const sessions = await getOrderPackingSessionsForOrders(
    supabaseAdmin,
    orderIds,
    [ORDER_PACKING_ACTIVE_STATE]
  )

  return sessions.filter(isActivePackingSession)
}

export const getAdminActiveOrderPackingSession = async (
  supabaseAdmin,
  adminUserId
) => {
  const { data, error } = await supabaseAdmin
    .from(ORDER_PACKING_SESSIONS_TABLE)
    .select('*')
    .eq('admin_user_id', adminUserId)
    .eq('status', ORDER_PACKING_ACTIVE_STATE)
    .order('started_at', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    throwOrderPackingDatabaseError(
      error,
      'Could not load the current packing session.'
    )
  }

  return data || null
}

export const getOrderPackingDetail = async ({
  supabaseAdmin,
  sessionId,
  session: providedSession
}) => {
  const session = providedSession
    || await getOrderPackingSession(supabaseAdmin, sessionId)
  const orderId = String(session.order_id || session.customer_order_id || '')

  if (!isOrderPackingUuid(orderId)) {
    throw createError({
      statusCode: 500,
      statusMessage: 'This packing session is not linked to a valid order.'
    })
  }

  const [
    orderResult,
    itemsResult,
    scansResult,
    messagesResult
  ] = await Promise.all([
    supabaseAdmin
      .from('customer_orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle(),
    supabaseAdmin
      .from('customer_order_items')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at'),
    supabaseAdmin
      .from(ORDER_PACKING_SCANS_TABLE)
      .select('*')
      .eq('session_id', session.id)
      .order('created_at'),
    supabaseAdmin
      .from(CUSTOMER_MESSAGES_TABLE)
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
  ])

  const primaryError = orderResult.error
    || itemsResult.error
    || scansResult.error
    || messagesResult.error

  if (primaryError) {
    throwOrderPackingDatabaseError(primaryError, 'Could not load the packing details.')
  }

  if (!orderResult.data) {
    throw createError({
      statusCode: 404,
      statusMessage: 'The order linked to this packing session was not found.'
    })
  }

  const rawItems = itemsResult.data || []
  const productIds = [
    ...new Set(rawItems.map((item) => item.product_id).filter(Boolean))
  ]
  const orderItemIds = rawItems.map((item) => item.id)

  const [
    productsResult,
    serializedUnitsResult,
    customerResult
  ] = await Promise.all([
    productIds.length
      ? supabaseAdmin
          .from('products')
          .select('id, sku, is_serialized')
          .in('id', productIds)
      : Promise.resolve({ data: [], error: null }),
    orderItemIds.length
      ? supabaseAdmin
          .from('commerce_serialized_units')
          .select(`
            id,
            customer_order_id,
            customer_order_item_id,
            product_id,
            variant_id,
            unit_code,
            serial_number,
            qr_token,
            status
          `)
          .in('customer_order_item_id', orderItemIds)
          .order('unit_code')
      : Promise.resolve({ data: [], error: null }),
    orderResult.data.user_id
      ? supabaseAdmin
          .from('customer_profiles')
          .select(`
            id,
            email,
            full_name,
            phone,
            address_line_1,
            address_line_2,
            city,
            state,
            country,
            wallet_balance
          `)
          .eq('id', orderResult.data.user_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ])

  const relatedError = productsResult.error
    || serializedUnitsResult.error
    || customerResult.error

  if (relatedError) {
    throwOrderPackingDatabaseError(relatedError, 'Could not load the packing item references.')
  }

  const productMap = makeRecordMap(productsResult.data || [])
  const scansByOrderItem = new Map()
  const unitsByOrderItem = new Map()

  for (const scan of scansResult.data || []) {
    const orderItemId = getPackingScanOrderItemId(scan)

    if (!orderItemId) {
      continue
    }

    const itemScans = scansByOrderItem.get(orderItemId) || []
    itemScans.push(scan)
    scansByOrderItem.set(orderItemId, itemScans)
  }

  for (const rawUnit of serializedUnitsResult.data || []) {
    const unit = normalizeSerializedUnit(rawUnit)
    const orderItemId = unit.customer_order_item_id

    if (!orderItemId) {
      continue
    }

    const itemUnits = unitsByOrderItem.get(orderItemId) || []
    itemUnits.push(unit)
    unitsByOrderItem.set(orderItemId, itemUnits)
  }

  const items = rawItems.map((rawItem) => {
    const item = normalizeAdminOrderItemRecord(rawItem)
    const product = productMap.get(String(item.product_id || '')) || {}
    const scans = scansByOrderItem.get(String(item.id)) || []
    const serializedUnits = unitsByOrderItem.get(String(item.id)) || []
    const scannedQuantity = scans.reduce((sum, scan) => {
      return sum + getPackingScanQuantity(scan)
    }, 0)
    const requiredQuantity = Math.max(0, Number(item.quantity || 0))

    return {
      ...item,
      product_sku: item.product_sku || product.sku || null,
      is_serialized: item.is_serialized ?? product.is_serialized ?? Boolean(
        item.variant_id || serializedUnits.length
      ),
      serialized_units: serializedUnits,
      scans,
      scanned_quantity: scannedQuantity,
      remaining: Math.max(requiredQuantity - scannedQuantity, 0),
      is_complete: requiredQuantity > 0 && scannedQuantity === requiredQuantity
    }
  })

  return {
    session,
    order: normalizeAdminOrderRecord(orderResult.data),
    customer: customerResult.data || null,
    items,
    messages: messagesResult.data || [],
    progress: buildOrderPackingProgress(items)
  }
}

export const findPackingScanMatch = async ({
  supabaseAdmin,
  detail,
  token
}) => {
  const normalizedToken = normalizePackingScanToken(token)
  const comparableToken = normalizedToken.toLowerCase()

  if (!normalizedToken) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Scan or enter an item code.'
    })
  }

  const expectedUnitMatches = []

  for (const item of detail.items || []) {
    for (const unit of item.serialized_units || []) {
      const unitTokens = [
        unit.id,
        unit.qr_token,
        unit.unit_code,
        unit.serial_number
      ].map((value) => String(value || '').trim().toLowerCase()).filter(Boolean)

      if (unitTokens.includes(comparableToken)) {
        expectedUnitMatches.push({ item, unit })
      }
    }
  }

  if (expectedUnitMatches.length === 1) {
    const [{ item, unit }] = expectedUnitMatches

    if (String(unit.customer_order_id || '') !== String(detail.order?.id || '')) {
      throw createError({
        statusCode: 409,
        statusMessage: 'This serialized item is assigned to a different order.'
      })
    }

    if (String(unit.status || '').toLowerCase() !== 'sold') {
      throw createError({
        statusCode: 409,
        statusMessage: `Item ${unit.unit_code || normalizedToken} is no longer assigned as sold inventory for this order.`
      })
    }

    const alreadyScanned = (item.scans || []).some((scan) => {
      return getPackingScanSerializedUnitId(scan) === String(unit.id)
    })

    if (alreadyScanned) {
      throw createError({
        statusCode: 409,
        statusMessage: `Item ${unit.unit_code || normalizedToken} has already been scanned.`
      })
    }

    if (Number(item.remaining || 0) <= 0) {
      throw createError({
        statusCode: 409,
        statusMessage: `${item.product_title || 'This item'} is already fully scanned.`
      })
    }

    return {
      kind: 'serialized_unit',
      token: normalizedToken,
      item,
      serializedUnit: unit
    }
  }

  if (expectedUnitMatches.length > 1) {
    throw createError({
      statusCode: 409,
      statusMessage: 'This item code matches more than one assigned unit.'
    })
  }

  let outsideUnit = null

  if (isOrderPackingUuid(normalizedToken)) {
    const { data, error } = await supabaseAdmin
      .from('commerce_serialized_units')
      .select('id, customer_order_id, customer_order_item_id, unit_code')
      .or(`id.eq.${normalizedToken},qr_token.eq.${normalizedToken}`)
      .limit(1)
      .maybeSingle()

    if (error) {
      throwOrderPackingDatabaseError(error, 'Could not validate the scanned inventory item.')
    }

    outsideUnit = data || null
  } else {
    const { data: unitCodeRecord, error: unitCodeError } = await supabaseAdmin
      .from('commerce_serialized_units')
      .select('id, customer_order_id, customer_order_item_id, unit_code')
      .eq('unit_code', normalizedToken.toUpperCase())
      .limit(1)
      .maybeSingle()

    if (unitCodeError) {
      throwOrderPackingDatabaseError(unitCodeError, 'Could not validate the scanned inventory item.')
    }

    outsideUnit = unitCodeRecord || null
  }

  if (outsideUnit) {
    throw createError({
      statusCode: 409,
      statusMessage: 'This serialized item is assigned to a different order.'
    })
  }

  const skuMatches = (detail.items || []).filter((item) => {
    const acceptedCodes = [
      item.product_sku,
      item.variant_sku,
      item.variant_code
    ].map((value) => String(value || '').trim().toLowerCase()).filter(Boolean)

    return acceptedCodes.includes(comparableToken)
  })

  if (!skuMatches.length) {
    throw createError({
      statusCode: 404,
      statusMessage: 'This scan does not match an item requested in the order.'
    })
  }

  if (skuMatches.length > 1) {
    throw createError({
      statusCode: 409,
      statusMessage: 'This SKU or code matches more than one order line.'
    })
  }

  const [item] = skuMatches

  if (item.is_serialized) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Scan the exact item ID or QR label for serialized inventory.'
    })
  }

  if (Number(item.remaining || 0) <= 0) {
    throw createError({
      statusCode: 409,
      statusMessage: `${item.product_title || 'This item'} is already fully scanned.`
    })
  }

  return {
    kind: item.variant_sku
      && String(item.variant_sku).trim().toLowerCase() === comparableToken
      ? 'variant_sku'
      : 'product_sku',
    token: normalizedToken,
    item,
    serializedUnit: null
  }
}
