import { createError } from 'h3'
import { chatRouteId, loadChatConversation, readChatJson, requireChatVisitor } from '../../../../utils/liveChat'
import { relayChatTyping } from '../../../../utils/liveChatTyping'

export default defineEventHandler(async (event) => {
  const actor = await requireChatVisitor(event)
  const id = chatRouteId(event)
  const item = await loadChatConversation(actor, id)
  await readChatJson(event)
  if (item.status !== 'active') throw createError({ statusCode: 409, statusMessage: 'Chat is not active.' })
  return relayChatTyping(actor, id, `chat:staff:${id}`, 'customer')
})
