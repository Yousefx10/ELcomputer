import { getQuery } from 'h3'
import { chatRouteId, chatUnreadItem, loadChatConversation, loadChatMessages, loadChatUnreadSummary, requireChatStaff } from '../../../utils/liveChat'

export default defineEventHandler(async (event) => {
  const actor = await requireChatStaff(event)
  const id = chatRouteId(event)
  const item = await loadChatConversation(actor, id, true)
  const messages = await loadChatMessages(actor, id, getQuery(event), true)
  const summaries = await loadChatUnreadSummary(actor, [id])
  return { item: chatUnreadItem(item, summaries), messages }
})
