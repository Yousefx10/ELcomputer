import { createError } from 'h3'
import { chatError } from './liveChat'

export const chatSettingsFields = [
  'is_enabled', 'availability_override', 'business_timezone', 'weekly_hours',
  'welcome_message', 'offline_message', 'guest_contact_rule',
  'customer_send_cooldown_seconds', 'max_message_length', 'attachments_enabled',
  'allowed_attachment_mimes', 'max_attachment_bytes', 'max_attachments_per_message',
  'transfers_enabled', 'reopen_enabled', 'offline_behavior',
  'ticket_conversion_enabled', 'updated_at'
].join(',')

export const chatSettingsExpectedAt = (value) => {
  if (typeof value !== 'string' || !value || Number.isNaN(Date.parse(value))) {
    throw createError({ statusCode: 400, statusMessage: 'Settings version is invalid.' })
  }
  return value
}

export const loadLiveChatSettings = async (supabase) => {
  const now = new Date().toISOString()
  const [settingsResult, availabilityResult, auditResult] = await Promise.all([
    supabase.from('chat_settings').select(chatSettingsFields).eq('singleton', true).maybeSingle(),
    supabase.rpc('chat_availability_details', { p_at: now }),
    supabase.from('admin_activity_logs')
      .select('id,author_name,author_email,description,metadata,created_at')
      .eq('action_key', 'chat.settings.updated').order('created_at', { ascending: false }).limit(10)
  ])
  if (settingsResult.error) chatError(settingsResult.error, 'Could not load Live Chat settings.')
  if (!settingsResult.data) throw createError({ statusCode: 503, statusMessage: 'Live Chat settings are unavailable.' })
  if (availabilityResult.error) chatError(availabilityResult.error, 'Could not evaluate Live Chat availability.')
  if (auditResult.error) chatError(auditResult.error, 'Could not load Live Chat settings history.')
  return { settings: settingsResult.data, availability: availabilityResult.data,
    audit: auditResult.data || [] }
}

export const throwChatSettingsError = (error) => {
  if (error?.message === 'CHAT_SETTINGS_STALE') {
    throw createError({ statusCode: 409, statusMessage: 'Settings changed in another session. Reload and try again.' })
  }
  if (error?.code === '42501') throw createError({ statusCode: 403, statusMessage: 'Settings access denied.' })
  if (['22023', '23514', '22P02'].includes(error?.code)) {
    throw createError({ statusCode: 400, statusMessage: 'Live Chat settings are invalid.' })
  }
  chatError(error, 'Could not save Live Chat settings.')
}
