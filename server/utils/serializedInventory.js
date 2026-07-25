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

export const normalizeSerializedBatchRows = (variants = []) => {
  if (!Array.isArray(variants) || !variants.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Add at least one product model.'
    })
  }

  const rows = variants.map((variant, index) => {
    const name = String(variant?.name || '').trim()
    const code = String(variant?.code || name)
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '-')
      .replace(/[^A-Z0-9_-]/g, '')
    const sku = String(variant?.sku || '').trim() || null
    const colorName = String(variant?.color_name || '').trim() || name
    const colorHex = String(variant?.color_hex || '').trim() || null
    const quantity = Number.parseInt(variant?.quantity, 10)

    if (!name || !code) {
      throw createError({
        statusCode: 400,
        statusMessage: `Model ${index + 1} requires a name and code.`
      })
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
      throw createError({
        statusCode: 400,
        statusMessage: `Quantity for ${name} must be between 1 and 1,000.`
      })
    }

    if (colorHex && !/^#[0-9a-f]{6}$/i.test(colorHex)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Color for ${name} must use a six-digit hex value.`
      })
    }

    return {
      id: isInventoryUuid(variant?.id) ? String(variant.id) : null,
      name,
      code,
      sku,
      color_name: colorName,
      color_hex: colorHex,
      quantity
    }
  })

  const codes = rows.map((row) => row.code.toLowerCase())
  if (new Set(codes).size !== codes.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Every model code in the batch must be unique.'
    })
  }

  return rows
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
