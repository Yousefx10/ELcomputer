import { getQuery } from 'h3'
import { chatRouteId, chatUnreadItem, loadChatConversation, loadChatMessages, loadChatUnreadSummary, requireChatVisitor } from '../../../utils/liveChat'
import { loadChatAttachmentPolicy } from '../../../utils/liveChatAttachments'

export default defineEventHandler(async (event) => {
  const actor = await requireChatVisitor(event)
  const id = chatRouteId(event)
  const item = await loadChatConversation(actor, id)
  const messages = await loadChatMessages(actor, id, getQuery(event))
  const summaries = await loadChatUnreadSummary(actor, [id])
  return { item: chatUnreadItem(item, summaries), messages,
    attachmentPolicy: await loadChatAttachmentPolicy(actor) }
})
