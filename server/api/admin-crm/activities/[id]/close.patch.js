import { createError, getRouterParam } from 'h3'
import { recordAdminActivity } from '../../../../utils/adminLogs'
import { requireAdminRequest } from '../../../../utils/adminRequest'
import {
  assertCrmDateNotFuture,
  getCrmRelatedRecord,
  isCrmUuid,
  optionalCrmText,
  parseCrmDateTime,
  throwCrmDatabaseError
} from '../../../../utils/crmActivities'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event)
  const activityId = String(getRouterParam(event, 'id') || '').trim()

  if (!isCrmUuid(activityId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid ticket is required.'
    })
  }

  const body = await readBody(event)
  const closedAt = parseCrmDateTime(body?.closedAt, 'Closed date')
  assertCrmDateNotFuture(closedAt, 'Closed date')
  const resolution = optionalCrmText(body?.resolution, 'Resolution')

  const { data: existingCase, error: existingCaseError } = await supabaseAdmin
    .from('commerce_crm_activities')
    .select(`
      id,
      crm_account_id,
      activity_type,
      status,
      subject,
      occurred_at,
      contact:commerce_crm_accounts!commerce_crm_activities_crm_account_id_fkey (
        id,
        name,
        entity_type,
        account_type
      )
    `)
    .eq('id', activityId)
    .maybeSingle()

  if (existingCaseError) {
    throwCrmDatabaseError(existingCaseError, 'Could not load the ticket.')
  }

  if (!existingCase) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Ticket not found.'
    })
  }

  if (existingCase.activity_type !== 'case') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Only a ticket can be closed.'
    })
  }

  if (existingCase.status !== 'raised') {
    throw createError({
      statusCode: 409,
      statusMessage: 'This ticket has already been closed.'
    })
  }

  if (Date.parse(closedAt) < Date.parse(existingCase.occurred_at)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'The closed date cannot be before the raised date.'
    })
  }

  const { data: updatedCase, error: updateError } = await supabaseAdmin
    .from('commerce_crm_activities')
    .update({
      status: 'closed',
      closed_at: closedAt,
      resolution,
      closed_by: adminUser.id,
      updated_at: new Date().toISOString()
    })
    .eq('id', activityId)
    .eq('activity_type', 'case')
    .eq('status', 'raised')
    .select('id')
    .maybeSingle()

  if (updateError) {
    throwCrmDatabaseError(updateError, 'Could not close the ticket.')
  }

  if (!updatedCase) {
    throw createError({
      statusCode: 409,
      statusMessage: 'This ticket was already closed by another administrator.'
    })
  }

  const contact = getCrmRelatedRecord(existingCase, 'contact')

  await recordAdminActivity({
    supabaseAdmin,
    adminUser,
    actionKey: 'commerce.crm.case.close',
    description: `Closed the ticket "${existingCase.subject}" for ${contact?.name || 'a CRM contact'}.`,
    metadata: {
      crm_activity_id: activityId,
      crm_account_id: existingCase.crm_account_id,
      crm_contact_name: contact?.name || '',
      crm_entity_type: contact?.entity_type || '',
      crm_account_type: contact?.account_type || ''
    }
  })

  return {
    success: true,
    id: updatedCase.id
  }
})
