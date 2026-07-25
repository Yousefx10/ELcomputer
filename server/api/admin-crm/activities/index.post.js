import { createError } from 'h3'
import { recordAdminActivity } from '../../../utils/adminLogs'
import { requireAdminRequest } from '../../../utils/adminRequest'
import {
  assertCrmDateNotFuture,
  CRM_ACTIVITY_TYPES,
  CRM_CASE_PRIORITIES,
  isCrmUuid,
  optionalCrmText,
  parseCrmDateTime,
  requireCrmText,
  throwCrmDatabaseError
} from '../../../utils/crmActivities'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event)
  const body = await readBody(event)
  const accountId = String(body?.accountId || '').trim()
  const activityType = String(body?.activityType || '').trim().toLowerCase()

  if (!isCrmUuid(accountId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid CRM contact is required.'
    })
  }

  if (!CRM_ACTIVITY_TYPES.has(activityType)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Choose either a call or a case.'
    })
  }

  const subject = requireCrmText(body?.subject, 'Subject', 200)
  const notes = optionalCrmText(body?.notes, 'Notes')
  const occurredAt = parseCrmDateTime(
    body?.occurredAt,
    activityType === 'call' ? 'Call date' : 'Raised date'
  )
  assertCrmDateNotFuture(
    occurredAt,
    activityType === 'call' ? 'Call date' : 'Raised date'
  )
  const requestedPriority = String(body?.priority || '').trim().toLowerCase()
  const priority = activityType === 'case'
    ? requestedPriority || 'normal'
    : null

  if (activityType === 'case' && !CRM_CASE_PRIORITIES.has(priority)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid case priority is required.'
    })
  }

  const { data: contact, error: contactError } = await supabaseAdmin
    .from('commerce_crm_accounts')
    .select('id, name, entity_type, account_type')
    .eq('id', accountId)
    .maybeSingle()

  if (contactError) {
    throwCrmDatabaseError(contactError, 'Could not check the CRM contact.')
  }

  if (!contact) {
    throw createError({
      statusCode: 404,
      statusMessage: 'CRM contact not found.'
    })
  }

  const now = new Date().toISOString()
  const { data: activity, error: insertError } = await supabaseAdmin
    .from('commerce_crm_activities')
    .insert({
      crm_account_id: accountId,
      activity_type: activityType,
      status: activityType === 'call' ? 'completed' : 'raised',
      subject,
      notes,
      priority,
      occurred_at: occurredAt,
      created_by: adminUser.id,
      created_at: now,
      updated_at: now
    })
    .select('id')
    .single()

  if (insertError) {
    throwCrmDatabaseError(insertError, 'Could not save the CRM activity.')
  }

  const isCall = activityType === 'call'

  await recordAdminActivity({
    supabaseAdmin,
    adminUser,
    actionKey: isCall
      ? 'commerce.crm.call.create'
      : 'commerce.crm.case.raise',
    description: isCall
      ? `Recorded a call with ${contact.name}.`
      : `Raised a case for ${contact.name}.`,
    metadata: {
      crm_activity_id: activity.id,
      crm_account_id: contact.id,
      crm_contact_name: contact.name,
      crm_entity_type: contact.entity_type,
      crm_account_type: contact.account_type
    }
  })

  return {
    success: true,
    id: activity.id
  }
})
