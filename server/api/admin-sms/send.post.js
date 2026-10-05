import { createError } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { recordAdminActivity } from '../../utils/adminLogs'
import { hasAdminPermission } from '../../../app/utils/adminPermissions.js'
import { createSmsService } from '../../utils/sms/service.js'
import { readSmsBody, smsHandler } from '../../utils/sms/admin.js'
export default defineEventHandler(smsHandler(async event => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'sms.view' })
  const body = await readSmsBody(event, 32768)
  if (typeof body.idempotencyKey !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.idempotencyKey)) throw createError({ statusCode: 400, statusMessage: 'An SMS request key is required.' })
  if (!['notification', 'campaign'].includes(body.trafficType)) throw createError({ statusCode: 400, statusMessage: 'Choose an SMS traffic type.' })
  const campaign = body.trafficType === 'campaign'
  if (!hasAdminPermission(adminUser, campaign ? 'sms.campaign.send' : 'sms.notification.send')) throw createError({ statusCode: 403, statusMessage: 'You do not have permission for this action.' })
  if (campaign && body.campaignConfirmed !== true) throw createError({ statusCode: 400, statusMessage: 'Confirm the campaign recipient list.' })
  const sms = createSmsService(supabaseAdmin)
  const input = { recipients: body.recipients, text: body.text, sender: body.sender, templateCode: body.templateCode,
    variables: body.variables, locale: body.locale, idempotencyKey: `manual:${adminUser.id}:${body.idempotencyKey}`,
    triggeredBy: adminUser.id, triggerSource: 'dashboard_manual', priority: 10 }
  const result = await (campaign ? sms.sendCampaign(input) : sms.sendNotification(input))
  if (!result.reused) await recordAdminActivity({ supabaseAdmin, adminUser, actionKey: campaign ? 'sms.campaign.initiated' : 'sms.notification.initiated',
    description: campaign ? 'Queued a manual SMS campaign.' : 'Queued a manual notification SMS.',
    metadata: { batch_id: result.id, traffic_type: body.trafficType, recipient_count: body.recipients.length, external_trx_id: result.external_trx_id } })
  return result
}))
