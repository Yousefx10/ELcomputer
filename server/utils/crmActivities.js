import { createError } from 'h3'

export const CRM_ACTIVITY_TYPES = new Set(['call', 'case'])
export const CRM_ACTIVITY_STATUSES = new Set(['completed', 'raised', 'closed'])
export const CRM_CASE_PRIORITIES = new Set(['low', 'normal', 'high', 'urgent'])

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const isCrmUuid = (value) => UUID_PATTERN.test(String(value || '').trim())

export const getCrmQueryValue = (value) => {
  return String(Array.isArray(value) ? value[0] : value || '').trim()
}

export const requireCrmText = (value, label, maximumLength) => {
  const normalizedValue = String(value || '').trim()

  if (!normalizedValue) {
    throw createError({
      statusCode: 400,
      statusMessage: `${label} is required.`
    })
  }

  if (normalizedValue.length > maximumLength) {
    throw createError({
      statusCode: 400,
      statusMessage: `${label} must be ${maximumLength} characters or fewer.`
    })
  }

  return normalizedValue
}

export const optionalCrmText = (value, label, maximumLength = 5000) => {
  const normalizedValue = String(value || '').trim()

  if (!normalizedValue) {
    return null
  }

  if (normalizedValue.length > maximumLength) {
    throw createError({
      statusCode: 400,
      statusMessage: `${label} must be ${maximumLength} characters or fewer.`
    })
  }

  return normalizedValue
}

export const parseCrmDateTime = (value, label) => {
  const normalizedValue = String(value || '').trim()
  const timestamp = Date.parse(normalizedValue)

  if (!normalizedValue || !Number.isFinite(timestamp)) {
    throw createError({
      statusCode: 400,
      statusMessage: `${label} is invalid.`
    })
  }

  return new Date(timestamp).toISOString()
}

export const assertCrmDateNotFuture = (value, label) => {
  const maximumTimestamp = Date.now() + (5 * 60 * 1000)

  if (Date.parse(value) > maximumTimestamp) {
    throw createError({
      statusCode: 400,
      statusMessage: `${label} cannot be in the future.`
    })
  }
}

export const getCrmRelatedRecord = (record, key) => {
  const relatedRecord = record?.[key]
  return Array.isArray(relatedRecord) ? relatedRecord[0] || null : relatedRecord || null
}

export const mapCrmContact = (record = {}) => ({
  id: record.id,
  name: record.name || '',
  entityType: record.entity_type === 'person' ? 'person' : 'company',
  accountType: record.account_type === 'supplier' ? 'supplier' : 'customer',
  isActive: record.is_active !== false
})

export const mapCrmActivity = (record = {}) => {
  const contact = getCrmRelatedRecord(record, 'contact')

  return {
    id: record.id,
    accountId: record.crm_account_id,
    activityType: record.activity_type,
    status: record.status,
    subject: record.subject || '',
    notes: record.notes || '',
    priority: record.priority || '',
    occurredAt: record.occurred_at,
    closedAt: record.closed_at || null,
    effectiveAt: record.effective_at || record.closed_at || record.occurred_at,
    resolution: record.resolution || '',
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    contact: contact ? mapCrmContact(contact) : null
  }
}

export const throwCrmDatabaseError = (error, fallbackMessage) => {
  const missingSchema = error?.code === '42P01'
    || error?.code === '42703'
    || error?.code === 'PGRST202'
    || error?.code === 'PGRST205'

  throw createError({
    statusCode: missingSchema ? 503 : 500,
    statusMessage: missingSchema
      ? 'CRM activities are not installed. Run the latest CRM migration first.'
      : error?.message || fallbackMessage
  })
}
