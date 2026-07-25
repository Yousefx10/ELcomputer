import { createError } from 'h3'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const isInventoryUuid = (value) => {
  return UUID_PATTERN.test(String(value || '').trim())
}

export const isMissingInventorySchemaError = (error) => {
  return [
    '42P01',
    '42703',
    '42883',
    'PGRST202',
    'PGRST204',
    'PGRST205'
  ].includes(error?.code)
}

export const normalizeInventoryToken = (value) => {
  const rawValue = String(value || '').trim()

  if (!rawValue) {
    return ''
  }

  try {
    const url = new URL(rawValue)
    return decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '').trim()
  } catch {
    try {
      return decodeURIComponent(rawValue).trim()
    } catch {
      return rawValue
    }
  }
}

export const normalizeInventoryPage = (value, fallback = 1) => {
  const normalizedValue = Number.parseInt(value, 10)
  return Number.isInteger(normalizedValue) && normalizedValue > 0
    ? normalizedValue
    : fallback
}

export const normalizeInventoryPageSize = (value, fallback = 20) => {
  const normalizedValue = Number.parseInt(value, 10)

  if (!Number.isInteger(normalizedValue) || normalizedValue < 1) {
    return fallback
  }

  return Math.min(normalizedValue, 100)
}

export const normalizeInventoryStatus = (value, { allowEmpty = true } = {}) => {
  const normalizedValue = String(value || '').trim().toLowerCase()
  const allowedStatuses = new Set(['in_stock', 'sold', 'damaged', 'lost'])

  if (!normalizedValue && allowEmpty) {
    return ''
  }

  if (!allowedStatuses.has(normalizedValue)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Inventory status is not valid.'
    })
  }

  return normalizedValue
}

export const throwInventoryDatabaseError = (error, fallbackMessage) => {
  const message = String(error?.message || '').replace(/^.*ERROR:\s*/i, '').trim()
  const isMissingSchema = isMissingInventorySchemaError(error)
  const isConflict = /not enough|already returned|not sold|cannot|duplicate|unique/i.test(message)

  throw createError({
    statusCode: isMissingSchema
      ? 500
      : isConflict
        ? 409
        : 400,
    statusMessage: isMissingSchema
      ? 'Run the latest serialized inventory migration first, then try again.'
      : message || fallbackMessage
  })
}
