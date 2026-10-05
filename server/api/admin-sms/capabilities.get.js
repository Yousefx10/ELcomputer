import { requireAdminRequest } from '../../utils/adminRequest'
import { getSmsSettings, smsReadiness } from '../../utils/sms/settings.js'
import { smsHandler } from '../../utils/sms/admin.js'
export default defineEventHandler(smsHandler(async event => {
  const { supabaseAdmin } = await requireAdminRequest(event, { permission: 'sms.view' })
  const settings = await getSmsSettings(supabaseAdmin)
  return { enabled: settings.is_enabled, ready: smsReadiness(settings).ready, sender_names: settings.sender_names,
    default_sender: settings.default_sender, batch_size: settings.batch_size, default_country: settings.default_country, allow_international: settings.allow_international }
}))
