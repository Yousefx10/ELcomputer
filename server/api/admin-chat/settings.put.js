import { readChatJson, setPrivateChatResponse } from '../../utils/liveChat'
import { requireAdminRequest } from '../../utils/adminRequest'
import { chatSettingsExpectedAt, loadLiveChatSettings, throwChatSettingsError } from '../../utils/liveChatSettings'
import { normalizeChatSettings } from '../../utils/liveChatSettingsValidation'

export default defineEventHandler(async (event) => {
  setPrivateChatResponse(event)
  const { authUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'settings.edit' })
  const body = await readChatJson(event)
  const settings = normalizeChatSettings(body.settings)
  const expected = chatSettingsExpectedAt(body.expectedUpdatedAt)
  const { error } = await supabaseAdmin.rpc('chat_update_settings', {
    p_actor_id: authUser.id,
    p_expected_updated_at: expected,
    p_settings: settings
  })
  if (error) throwChatSettingsError(error)
  return await loadLiveChatSettings(supabaseAdmin)
})
