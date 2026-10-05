import { createError } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { recordAdminActivity } from '../../utils/adminLogs'
import { getSmsSettings, publicSmsSettings, validateSmsSettings, smsDefaults } from '../../utils/sms/settings.js'
import { readSmsBody, smsHandler } from '../../utils/sms/admin.js'
export default defineEventHandler(smsHandler(async event => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'sms.settings.manage' })
  const body = await readSmsBody(event, 16384)
  const current = await getSmsSettings(supabaseAdmin)
  if (body.config_revision !== current.config_revision) throw createError({ statusCode: 409, statusMessage: 'SMS settings changed. Reload before saving.' })
  const update = validateSmsSettings(body, current)
  const payload = { ...update, config_revision: current.config_revision + 1, updated_by: adminUser.id, updated_at: new Date().toISOString() }
  const query = current._missing ? supabaseAdmin.from('sms_provider_settings').insert({ ...smsDefaults, ...payload })
    : supabaseAdmin.from('sms_provider_settings').update(payload).eq('id', 'vodafone').eq('config_revision', current.config_revision)
  const { data, error } = await query.select('*').maybeSingle()
  if (error) throw createError({ statusCode: 503, statusMessage: 'SMS settings could not be saved.' })
  if (!data) throw createError({ statusCode: 409, statusMessage: 'SMS settings changed. Reload before saving.' })
  await recordAdminActivity({ supabaseAdmin, adminUser, actionKey: 'sms.settings.update', description: 'Updated Vodafone SMS settings.',
    metadata: { enabled: data.is_enabled, changed_fields: Object.keys(update).filter(key => !key.endsWith('_encrypted')),
      account_id_changed: Boolean(update.account_id_encrypted), password_changed: Boolean(update.password_encrypted), hash_secret_changed: Boolean(update.hash_secret_encrypted) } })
  return { settings: publicSmsSettings(data) }
}))
