import { getQuery } from 'h3'
import { chatRouteId, loadChatConversation, loadChatMessages, requireChatStaff } from '../../../../utils/liveChat'

export default defineEventHandler(async (event) => {
  const actor = await requireChatStaff(event)
  const id = chatRouteId(event)
  await loadChatConversation(actor, id, true)
  return loadChatMessages(actor, id, getQuery(event), true)
})
