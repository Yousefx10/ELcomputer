import { createError } from 'h3'
import { chatRouteId, loadChatConversation, readChatJson, requireChatStaff } from '../../../../utils/liveChat'
import { relayChatTyping } from '../../../../utils/liveChatTyping'

export default defineEventHandler(async (event) => {
  const actor = await requireChatStaff(event, 'support.reply')
  const id = chatRouteId(event)
  const item = await loadChatConversation(actor, id, true)
  await readChatJson(event)
  if (item.status !== 'active' || item.assigned_admin_id !== actor.id) {
    throw createError({ statusCode: 409, statusMessage: 'Only the assigned agent can type here.' })
  }
  return relayChatTyping(actor, id, `chat:public:${id}`, 'staff')
})
