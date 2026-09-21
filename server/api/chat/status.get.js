import { setHeader } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabaseAdmin'
import { chatError } from '../../utils/liveChat'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  const supabase = getSupabaseAdminClient()
  const result = await supabase.from('chat_settings')
    .select('is_enabled,welcome_message,offline_message,offline_behavior,guest_contact_rule,customer_send_cooldown_seconds,max_message_length,attachments_enabled,allowed_attachment_mimes,max_attachment_bytes,max_attachments_per_message')
    .eq('singleton', true).maybeSingle()
  if (['42P01', 'PGRST205'].includes(result.error?.code)) {
    return { enabled: false, available: false }
  }
  if (result.error) chatError(result.error, 'Could not load chat status.')
  if (!result.data?.is_enabled) return { enabled: false, available: false }
  const availability = await supabase.rpc('chat_live_available')
  if (availability.error) chatError(availability.error, 'Could not load chat availability.')
  return {
    enabled: true,
    available: availability.data === true,
    welcomeMessage: result.data.welcome_message,
    offlineMessage: result.data.offline_message,
    offlineBehavior: result.data.offline_behavior,
    guestContactRule: result.data.guest_contact_rule,
    cooldownSeconds: result.data.customer_send_cooldown_seconds,
    maxMessageLength: result.data.max_message_length,
    attachmentsEnabled: result.data.attachments_enabled === true
      && Number(result.data.max_attachments_per_message) > 0,
    allowedAttachmentMimes: result.data.allowed_attachment_mimes || [],
    maxAttachmentBytes: Number(result.data.max_attachment_bytes || 0),
    maxAttachmentsPerMessage: Number(result.data.max_attachments_per_message || 0)
  }
})
