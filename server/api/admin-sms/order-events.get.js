import { requireAdminRequest } from '../../utils/adminRequest'
import { smsHandler } from '../../utils/sms/admin.js'
import { getOrderSmsSettings } from '../../utils/sms/orderEvents.js'
export default defineEventHandler(smsHandler(async event => {
  const { supabaseAdmin } = await requireAdminRequest(event, { permission: 'sms.settings.view' })
  return { events: await getOrderSmsSettings(supabaseAdmin) }
}))
