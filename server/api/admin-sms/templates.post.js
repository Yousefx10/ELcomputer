import { createError } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { recordAdminActivity } from '../../utils/adminLogs'
import { smsTemplateVariables } from '../../../app/utils/sms.js'
import { escapeSmsXml } from '../../utils/sms/vodafone.js'
import { getSmsSettings } from '../../utils/sms/settings.js'
import { readSmsBody, smsHandler } from '../../utils/sms/admin.js'
export default defineEventHandler(smsHandler(async event => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'sms.templates.manage' })
  const body = await readSmsBody(event, 32768)
  const invalid = () => { throw createError({ statusCode: 400, statusMessage: 'Invalid SMS template.' }) }
  if (typeof body.code !== 'string' || !/^[a-z][a-z0-9_]{1,79}$/.test(body.code) || typeof body.is_enabled !== 'boolean' || !['notification', 'campaign'].includes(body.traffic_type)) invalid()
  for (const [key, max] of [['name', 100], ['category', 50], ['text_en', 4000], ['text_ar', 4000], ['sender', 50]]) if (typeof body[key] !== 'string' || body[key].length > max) invalid()
  if (!body.name.trim() || !body.category.trim() || !body.text_en.trim() && !body.text_ar.trim()) invalid()
  let variables
  try { escapeSmsXml(body.text_en); escapeSmsXml(body.text_ar); variables = [...new Set([...smsTemplateVariables(body.text_en), ...smsTemplateVariables(body.text_ar)])].sort() } catch { invalid() }
  const settings = await getSmsSettings(supabaseAdmin)
  if (body.sender && !settings.sender_names.includes(body.sender)) invalid()
  const payload = { code: body.code, name: body.name.trim(), category: body.category.trim(), text_en: body.text_en, text_ar: body.text_ar,
    traffic_type: body.traffic_type, is_enabled: body.is_enabled, sender: body.sender, variables, updated_by: adminUser.id, updated_at: new Date().toISOString() }
  let query
  if (body.id) {
    if (!/^[0-9a-f-]{36}$/i.test(body.id)) invalid()
    query = supabaseAdmin.from('sms_templates').update(payload).eq('id', body.id)
  } else query = supabaseAdmin.from('sms_templates').insert({ ...payload, created_by: adminUser.id })
  const { data, error } = await query.select('*').single()
  if (error) throw createError({ statusCode: 409, statusMessage: 'SMS template could not be saved.' })
  await recordAdminActivity({ supabaseAdmin, adminUser, actionKey: 'sms.template.update', description: 'Saved an SMS template.',
    metadata: { template_id: data.id, code: data.code, enabled: data.is_enabled, traffic_type: data.traffic_type } })
  return { template: data }
}))
