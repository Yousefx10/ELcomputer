import { createError, getQuery } from 'h3'
import { requireAdminRequest } from '../../../utils/adminRequest'
import {
  getCrmQueryValue,
  isCrmUuid,
  throwCrmDatabaseError
} from '../../../utils/crmActivities'

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event)
  const query = getQuery(event)
  const accountId = getCrmQueryValue(query.accountId)
  const requestedCaseId = getCrmQueryValue(query.caseId)

  if (!isCrmUuid(accountId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid CRM contact is required.'
    })
  }

  if (requestedCaseId && !isCrmUuid(requestedCaseId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid case is required.'
    })
  }

  const openCasesQuery = supabaseAdmin
    .from('commerce_crm_activities')
    .select('id, subject, priority, occurred_at')
    .eq('crm_account_id', accountId)
    .eq('activity_type', 'case')
    .eq('status', 'raised')
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(100)

  const [
    openCasesResult,
    requestedCaseResult
  ] = await Promise.all([
    openCasesQuery,
    requestedCaseId
      ? supabaseAdmin
          .from('commerce_crm_activities')
          .select('id, subject, priority, occurred_at')
          .eq('id', requestedCaseId)
          .eq('crm_account_id', accountId)
          .eq('activity_type', 'case')
          .eq('status', 'raised')
          .maybeSingle()
      : Promise.resolve({
          data: null,
          error: null
        })
  ])

  const encounteredError = openCasesResult.error || requestedCaseResult.error

  if (encounteredError) {
    throwCrmDatabaseError(encounteredError, 'Could not load raised cases.')
  }

  const openCasesById = new Map(
    (openCasesResult.data || []).map((record) => [record.id, record])
  )

  if (requestedCaseResult.data) {
    openCasesById.set(requestedCaseResult.data.id, requestedCaseResult.data)
  }

  return {
    items: [...openCasesById.values()].map((record) => ({
      id: record.id,
      subject: record.subject || '',
      priority: record.priority || 'normal',
      occurredAt: record.occurred_at
    }))
  }
})
