import { requireAdminRequest } from '../../utils/adminRequest'
import { setPrivateChatResponse } from '../../utils/liveChat'
import { loadLiveChatSettings } from '../../utils/liveChatSettings'

export default defineEventHandler(async (event) => {
  setPrivateChatResponse(event)
  const { supabaseAdmin } = await requireAdminRequest(event, { permission: 'settings.view' })
  return await loadLiveChatSettings(supabaseAdmin)
})
