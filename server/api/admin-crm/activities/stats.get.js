import { createError, getQuery } from 'h3'
import { requireAdminRequest } from '../../../utils/adminRequest'
import {
  getCrmQueryValue,
  throwCrmDatabaseError
} from '../../../utils/crmActivities'
import {
  CRM_REPORTING_PERIODS,
  CRM_REPORTING_TIME_ZONE,
  getCrmReportingPeriodRange
} from '../../../utils/crmReportingPeriods'

const applyRange = (queryBuilder, column, range) => {
  return queryBuilder
    .gte(column, range.start)
    .lt(column, range.end)
}

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event)
  const query = getQuery(event)
  const period = getCrmQueryValue(query.period).toLowerCase() || 'today'

  if (!CRM_REPORTING_PERIODS.has(period)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid CRM reporting period is required.'
    })
  }

  const range = getCrmReportingPeriodRange(period)
  const [
    callsResult,
    raisedTicketsResult,
    closedTicketsResult
  ] = await Promise.all([
    applyRange(
      supabaseAdmin
        .from('commerce_crm_activities')
        .select('id', { count: 'exact', head: true })
        .eq('activity_type', 'call'),
      'occurred_at',
      range
    ),
    applyRange(
      supabaseAdmin
        .from('commerce_crm_activities')
        .select('id', { count: 'exact', head: true })
        .eq('activity_type', 'case'),
      'occurred_at',
      range
    ),
    applyRange(
      supabaseAdmin
        .from('commerce_crm_activities')
        .select('id', { count: 'exact', head: true })
        .eq('activity_type', 'case')
        .eq('status', 'closed'),
      'effective_at',
      range
    )
  ])

  const encounteredError = callsResult.error
    || raisedTicketsResult.error
    || closedTicketsResult.error

  if (encounteredError) {
    throwCrmDatabaseError(encounteredError, 'Could not load CRM activity statistics.')
  }

  return {
    period,
    timeZone: CRM_REPORTING_TIME_ZONE,
    from: range.start,
    toExclusive: range.end,
    stats: {
      calls: Number(callsResult.count || 0),
      raisedTickets: Number(raisedTicketsResult.count || 0),
      closedTickets: Number(closedTicketsResult.count || 0)
    }
  }
})
