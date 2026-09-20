import { getQuery } from 'h3'
import { chatRouteId, loadChatConversation, loadChatMessages, requireChatVisitor } from '../../../utils/liveChat'

export default defineEventHandler(async (event) => {
  const actor = await requireChatVisitor(event)
  const id = chatRouteId(event)
  const item = await loadChatConversation(actor, id)
  const messages = await loadChatMessages(actor, id, getQuery(event))
  return { item, messages }
})
