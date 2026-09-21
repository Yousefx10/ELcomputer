import { requireAdminRequest } from '../../utils/adminRequest'
import { loadLiveChatSettings } from '../../utils/liveChatSettings'

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event, { permission: 'settings.view' })
  return await loadLiveChatSettings(supabaseAdmin)
})
