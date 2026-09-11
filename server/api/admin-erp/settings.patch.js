import { createError, readBody } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { recordAdminActivity } from '../../utils/adminLogs'
import { getErpSettings, testAndRecordDaftraConnection } from '../../utils/daftraSync'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'settings.edit'
  })
  const body = await readBody(event)
  const mode = String(body?.mode || '').trim()

  if (!['built_in', 'daftra'].includes(mode)) {
    throw createError({ statusCode: 400, statusMessage: 'Choose a valid ERP mode.' })
  }

  const currentSettings = await getErpSettings(supabaseAdmin)

  if (currentSettings.migrationRequired) {
    throw createError({ statusCode: 500, statusMessage: 'Run the Daftra ERP migration first.' })
  }

  let connection = null

  if (mode === 'daftra') {
    connection = await testAndRecordDaftraConnection(supabaseAdmin)
  }

  const { error } = await supabaseAdmin
    .from('site_settings')
    .update({ erp_mode: mode, updated_at: new Date().toISOString() })
    .eq('key', 'default')

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  await recordAdminActivity({
    supabaseAdmin,
    adminUser,
    actionKey: 'settings.erp.mode-update',
    description: `Changed ERP mode to ${mode === 'daftra' ? 'Daftra' : 'built-in'}.`,
    metadata: { previousMode: currentSettings.erp_mode, mode }
  })

  return { mode, connection }
})
