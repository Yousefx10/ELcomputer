import { createError, getRouterParam } from 'h3'
import { requireAdminRequest } from '../../../utils/adminRequest'
import {
  isCrmUuid,
  mapCrmActivity,
  throwCrmDatabaseError
} from '../../../utils/crmActivities'

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event)
  const activityId = String(getRouterParam(event, 'id') || '').trim()

  if (!isCrmUuid(activityId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid CRM activity is required.'
    })
  }

  const { data, error } = await supabaseAdmin
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
    `)
    .eq('id', activityId)
    .maybeSingle()

  if (error) {
    throwCrmDatabaseError(error, 'Could not load the CRM activity.')
  }

  if (!data) {
    throw createError({
      statusCode: 404,
      statusMessage: 'CRM activity not found.'
    })
  }

  return {
    item: mapCrmActivity(data)
  }
})
