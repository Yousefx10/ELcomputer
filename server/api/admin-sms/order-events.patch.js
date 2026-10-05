import { createError } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { recordAdminActivity } from '../../utils/adminLogs'
import { readSmsBody, smsHandler } from '../../utils/sms/admin.js'
import { getOrderSmsSettings, validateOrderSmsSetting } from '../../utils/sms/orderEvents.js'
export default defineEventHandler(smsHandler(async event => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'sms.settings.manage' })
  const body = await readSmsBody(event, 4096)
  const payload = await validateOrderSmsSetting(supabaseAdmin, body)
  const current = (await getOrderSmsSettings(supabaseAdmin)).find(row => row.event_type === payload.event_type)
  if (current.config_revision !== body.config_revision) throw createError({ statusCode: 409, statusMessage: 'Reload order SMS settings before saving.' })
  const query = current.updated_at
    ? supabaseAdmin.from('sms_order_event_settings').update({ ...payload, updated_by: adminUser.id }).eq('event_type', payload.event_type).eq('config_revision', body.config_revision)
    : supabaseAdmin.from('sms_order_event_settings').insert({ ...payload, updated_by: adminUser.id })
  const { data, error } = await query.select('event_type,is_enabled,template_en_id,template_ar_id,config_revision,updated_at').single()
  if (error) throw createError({ statusCode: 409, statusMessage: 'Order SMS settings could not be saved.' })
  await recordAdminActivity({ supabaseAdmin, adminUser, actionKey: 'sms.order_event.update', description: 'Saved order SMS settings.',
    metadata: { event_type: payload.event_type, enabled: payload.is_enabled, template_en_id: payload.template_en_id, template_ar_id: payload.template_ar_id } })
  return { event: data }
}))
