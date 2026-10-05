import { requireAdminRequest } from '../../utils/adminRequest'
import { getSmsSettings, publicSmsSettings } from '../../utils/sms/settings.js'
import { smsHandler } from '../../utils/sms/admin.js'
export default defineEventHandler(smsHandler(async event => {
  const { supabaseAdmin } = await requireAdminRequest(event, { permission: 'sms.settings.view' })
  return { settings: publicSmsSettings(await getSmsSettings(supabaseAdmin)) }
}))
