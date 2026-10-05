import { createError } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { smsHandler } from '../../utils/sms/admin.js'
export default defineEventHandler(smsHandler(async event => {
  const { supabaseAdmin } = await requireAdminRequest(event, { permission: 'sms.templates.view' })
  const { data, error } = await supabaseAdmin.from('sms_templates').select('*').order('code').limit(200)
  if (error) throw createError({ statusCode: 503, statusMessage: 'SMS templates are unavailable.' })
  return { templates: data || [] }
}))
