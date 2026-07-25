import { createError, getHeader, readBody, setHeader } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabaseAdmin'
import {
  ensureStoreAnalyticsSession,
  getOptionalStoreAnalyticsUserId,
  isStoreAnalyticsUuid,
  markStoreAnalyticsInternalCarts
} from '../../utils/storeAnalytics'
import { assertStoreAnalyticsRateLimit } from '../../utils/storeAnalyticsRateLimit'

const MAX_EVENTS_PER_REQUEST = 20
const MAX_REQUEST_BYTES = 32768
const MAX_PATH_LENGTH = 500
const MAX_SOURCE_LENGTH = 50
const MAX_QUANTITY = 999
const MAX_DURATION_MS = 30 * 60 * 1000

const PUBLIC_EVENT_NAMES = new Set([
  'page_view',
  'product_view',
  'product_dwell',
  'add_to_cart',
  'remove_from_cart',
  'cart_quantity_changed',
  'cart_cleared',
  'checkout_started'
])

const EVENT_FIELDS = new Set([
  'eventId',
  'eventName',
  'path',
  'productId',
  'cartId',
  'quantity',
  'resultingQuantity',
  'durationMs',
  'source'
])

const PRODUCT_EVENT_NAMES = new Set([
  'product_view',
  'product_dwell',
  'add_to_cart',
  'remove_from_cart',
  'cart_quantity_changed'
])

const CART_EVENT_NAMES = new Set([
  'add_to_cart',
  'remove_from_cart',
  'cart_quantity_changed',
  'cart_cleared',
  'checkout_started'
])

const SOURCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$/
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/

const invalidPayload = () => {
  return createError({
    statusCode: 400,
    statusMessage: 'Invalid analytics event payload.'
  })
}

const validateRequestSize = (event) => {
  const contentLength = Number(getHeader(event, 'content-length'))

  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    throw createError({
      statusCode: 413,
      statusMessage: 'Analytics event payload is too large.'
    })
  }
}

const normalizeOptionalPath = (value) => {
  if (value === undefined || value === null || value === '') {
    return null
  }

  if (typeof value !== 'string') {
    throw invalidPayload()
  }

  const path = value.trim()

  if (
    !path
    || path.length > MAX_PATH_LENGTH
    || !path.startsWith('/')
    || path.includes('?')
    || path.includes('#')
    || CONTROL_CHARACTER_PATTERN.test(path)
  ) {
    throw invalidPayload()
  }

  return path
}

const normalizeOptionalUuid = (value) => {
  if (value === undefined || value === null || value === '') {
    return null
  }

  if (!isStoreAnalyticsUuid(value)) {
    throw invalidPayload()
  }

  return String(value).toLowerCase()
}

const normalizeOptionalInteger = (value, minimum, maximum) => {
  if (value === undefined || value === null || value === '') {
    return null
  }

  if (
    typeof value !== 'number'
    || !Number.isSafeInteger(value)
    || value < minimum
    || value > maximum
  ) {
    throw invalidPayload()
  }

  return value
}

const normalizeOptionalSource = (value) => {
  if (value === undefined || value === null || value === '') {
    return null
  }

  if (typeof value !== 'string') {
    throw invalidPayload()
  }

  const source = value.trim()

  if (
    !source
    || source.length > MAX_SOURCE_LENGTH
    || !SOURCE_PATTERN.test(source)
  ) {
    throw invalidPayload()
  }

  return source
}

const normalizeEvent = (eventRecord) => {
  if (
    !eventRecord
    || typeof eventRecord !== 'object'
    || Array.isArray(eventRecord)
    || Object.keys(eventRecord).some((key) => !EVENT_FIELDS.has(key))
    || !isStoreAnalyticsUuid(eventRecord.eventId)
  ) {
    throw invalidPayload()
  }

  const eventName = String(eventRecord.eventName || '').trim()

  if (!PUBLIC_EVENT_NAMES.has(eventName)) {
    throw invalidPayload()
  }

  const productId = normalizeOptionalUuid(eventRecord.productId)
  const cartId = normalizeOptionalUuid(eventRecord.cartId)
  const path = normalizeOptionalPath(eventRecord.path)
  const quantity = normalizeOptionalInteger(eventRecord.quantity, 1, MAX_QUANTITY)
  const resultingQuantity = normalizeOptionalInteger(
    eventRecord.resultingQuantity,
    0,
    MAX_QUANTITY
  )
  const durationMs = normalizeOptionalInteger(
    eventRecord.durationMs,
    0,
    MAX_DURATION_MS
  )
  const source = normalizeOptionalSource(eventRecord.source)

  if (
    (PRODUCT_EVENT_NAMES.has(eventName) && !productId)
    || (CART_EVENT_NAMES.has(eventName) && !cartId)
    || (eventName === 'page_view' && !path)
    || (eventName === 'product_dwell' && durationMs === null)
  ) {
    throw invalidPayload()
  }

  return {
    eventId: String(eventRecord.eventId).toLowerCase(),
    eventName,
    path,
    productId,
    cartId,
    quantity,
    resultingQuantity,
    durationMs,
    source
  }
}

const validateProductIds = async (supabaseAdmin, events) => {
  const productIds = [
    ...new Set(events.map((eventRecord) => eventRecord.productId).filter(Boolean))
  ]

  if (!productIds.length) {
    return
  }

  const { data, error } = await supabaseAdmin
    .from('products')
    .select('id')
    .in('id', productIds)

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Analytics events could not be recorded.'
    })
  }

  const existingProductIds = new Set((data || []).map((product) => String(product.id)))

  if (productIds.some((productId) => !existingProductIds.has(productId))) {
    throw invalidPayload()
  }
}

export default defineEventHandler(async (event) => {
  assertStoreAnalyticsRateLimit(event, {
    scope: 'events',
    limit: 240
  })
  validateRequestSize(event)

  let body

  try {
    body = await readBody(event)
  } catch {
    throw invalidPayload()
  }

  if (
    !body
    || typeof body !== 'object'
    || Array.isArray(body)
    || Object.keys(body).some((key) => key !== 'events')
    || !Array.isArray(body.events)
    || body.events.length < 1
    || body.events.length > MAX_EVENTS_PER_REQUEST
  ) {
    throw invalidPayload()
  }

  const normalizedEvents = body.events.map(normalizeEvent)
  const uniqueEvents = [
    ...new Map(
      normalizedEvents.map((eventRecord) => [eventRecord.eventId, eventRecord])
    ).values()
  ]
  let supabaseAdmin

  try {
    supabaseAdmin = getSupabaseAdminClient()
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Analytics events could not be recorded.'
    })
  }

  const userId = await getOptionalStoreAnalyticsUserId(event, supabaseAdmin)

  let identity

  try {
    identity = await ensureStoreAnalyticsSession({
      event,
      supabaseAdmin,
      userId
    })
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Analytics events could not be recorded.'
    })
  }

  if (identity.isInternal) {
    try {
      await markStoreAnalyticsInternalCarts({
        supabaseAdmin,
        cartIds: uniqueEvents
          .map((eventRecord) => eventRecord.cartId)
          .filter(Boolean)
      })
    } catch {
      throw createError({
        statusCode: 500,
        statusMessage: 'Analytics events could not be recorded.'
      })
    }

    setHeader(event, 'Cache-Control', 'no-store')

    return {
      success: true,
      accepted: 0,
      excluded: true
    }
  }

  await validateProductIds(supabaseAdmin, uniqueEvents)

  const rows = uniqueEvents.map((eventRecord) => ({
    event_id: eventRecord.eventId,
    session_id: identity.sessionId,
    visitor_id: identity.visitorId,
    user_id: identity.userId,
    event_name: eventRecord.eventName,
    path: eventRecord.path,
    product_id: eventRecord.productId,
    cart_id: eventRecord.cartId,
    quantity: eventRecord.quantity,
    resulting_quantity: eventRecord.resultingQuantity,
    duration_ms: eventRecord.durationMs,
    source: eventRecord.source
  }))

  const { data, error } = await supabaseAdmin
    .from('store_analytics_events')
    .upsert(rows, {
      onConflict: 'event_id',
      ignoreDuplicates: true
    })
    .select('event_id')

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Analytics events could not be recorded.'
    })
  }

  setHeader(event, 'Cache-Control', 'no-store')

  return {
    success: true,
    accepted: (data || []).length
  }
})
