import { getQuery } from 'h3'
import { chatError, chatRouteId, chatUnreadItem, loadChatConversation, loadChatMessages, loadChatUnreadSummary, requireChatStaff } from '../../../utils/liveChat'
import { loadChatAttachmentPolicy } from '../../../utils/liveChatAttachments'

export default defineEventHandler(async (event) => {
  const actor = await requireChatStaff(event)
  const id = chatRouteId(event)
  const item = await loadChatConversation(actor, id, true)
  const messages = await loadChatMessages(actor, id, getQuery(event), true)
  const summaries = await loadChatUnreadSummary(actor, [id])
  const settings = await actor.supabase.from('chat_settings')
    .select('ticket_conversion_enabled,transfers_enabled,reopen_enabled')
    .eq('singleton', true).maybeSingle()
  if (settings.error) chatError(settings.error, 'Could not load chat settings.')
  return { item: chatUnreadItem(item, summaries), messages,
    attachmentPolicy: await loadChatAttachmentPolicy(actor),
    workflow: {
      ticketConversionEnabled: settings.data?.ticket_conversion_enabled === true,
      transfersEnabled: settings.data?.transfers_enabled === true,
      reopenEnabled: settings.data?.reopen_enabled === true
    } }
})
