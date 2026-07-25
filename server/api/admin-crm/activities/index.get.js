import { createError, getQuery } from 'h3'
import { requireAdminRequest } from '../../../utils/adminRequest'
import {
  CRM_ACTIVITY_STATUSES,
  CRM_ACTIVITY_TYPES,
  getCrmQueryValue,
  isCrmUuid,
  mapCrmActivity,
  parseCrmDateTime,
  throwCrmDatabaseError
} from '../../../utils/crmActivities'

const applyFilters = (queryBuilder, filters) => {
  let nextQuery = queryBuilder

  if (filters.accountId) {
    nextQuery = nextQuery.eq('crm_account_id', filters.accountId)
  }

  if (filters.activityType) {
    nextQuery = nextQuery.eq('activity_type', filters.activityType)
  }

  if (filters.status) {
    nextQuery = nextQuery.eq('status', filters.status)
  }

  if (filters.from) {
    nextQuery = nextQuery.gte('effective_at', filters.from)
  }

  if (filters.to) {
    nextQuery = nextQuery.lte('effective_at', filters.to)
  }

  return nextQuery
}

const getOptionalBoundary = (value, label) => {
  const normalizedValue = getCrmQueryValue(value)
  return normalizedValue ? parseCrmDateTime(normalizedValue, label) : ''
}

const getBoundedInteger = (value, fallback, maximum) => {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return fallback
  }

  return Math.min(maximum, Math.max(1, Math.trunc(numericValue)))
}

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event)
  const query = getQuery(event)
  const page = getBoundedInteger(query.page, 1, 100000)
  const pageSize = getBoundedInteger(query.pageSize, 10, 50)
  const accountId = getCrmQueryValue(query.accountId)
  const activityType = getCrmQueryValue(query.activityType).toLowerCase()
  const status = getCrmQueryValue(query.status).toLowerCase()
  const includeStats = getCrmQueryValue(query.includeStats).toLowerCase() !== 'false'
  const from = getOptionalBoundary(query.from, 'From date')
  const to = getOptionalBoundary(query.to, 'To date')

  if (accountId && !isCrmUuid(accountId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid CRM contact is required.'
    })
  }

  if (activityType && !CRM_ACTIVITY_TYPES.has(activityType)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid activity type is required.'
    })
  }

  if (status && !CRM_ACTIVITY_STATUSES.has(status)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid activity status is required.'
    })
  }

  if (from && to && Date.parse(from) > Date.parse(to)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'The from date must be before the to date.'
    })
  }

  const filters = {
    accountId,
    activityType,
    status,
    from,
    to
  }
  const rangeStart = (page - 1) * pageSize
  const rangeEnd = rangeStart + pageSize - 1

  const activityQuery = applyFilters(
    supabaseAdmin
      .from('commerce_crm_activities')
      .select(`
        id,
        crm_account_id,
        activity_type,
        status,
        subject,
        notes,
        priority,
        occurred_at,
        closed_at,
        effective_at,
        resolution,
        created_at,
        updated_at,
        contact:commerce_crm_accounts!commerce_crm_activities_crm_account_id_fkey (
          id,
          name,
          entity_type,
          account_type,
          is_active
        )
      `, { count: 'exact' }),
    filters
  )

  const [
    activitiesResult,
    statsResult
  ] = await Promise.all([
    activityQuery
      .order('effective_at', { ascending: false })
      .order('id', { ascending: false })
      .range(rangeStart, rangeEnd),
    includeStats
      ? supabaseAdmin.rpc('commerce_crm_get_activity_stats')
      : Promise.resolve({
          data: null,
          error: null
        })
  ])

  const encounteredError = activitiesResult.error || statsResult.error

  if (encounteredError) {
    throwCrmDatabaseError(encounteredError, 'Could not load CRM activities.')
  }

  return {
    items: (activitiesResult.data || []).map(mapCrmActivity),
    total: activitiesResult.count || 0,
    page,
    pageSize,
    stats: statsResult.data
      ? {
          calls: Number(statsResult.data.calls || 0),
          raisedCases: Number(statsResult.data.raisedCases || 0),
          closedCases: Number(statsResult.data.closedCases || 0)
        }
      : null
  }
})
