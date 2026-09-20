import { getQuery } from 'h3'
import { chatRouteId, loadChatConversation, loadChatMessages, requireChatVisitor } from '../../../../utils/liveChat'

export default defineEventHandler(async (event) => {
  const actor = await requireChatVisitor(event)
  const id = chatRouteId(event)
  await loadChatConversation(actor, id)
  return loadChatMessages(actor, id, getQuery(event))
})
