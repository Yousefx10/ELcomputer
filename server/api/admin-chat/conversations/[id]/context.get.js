import { createError, getQuery } from 'h3'
import { chatRouteId, loadChatConversation, requireChatStaff } from '../../../../utils/liveChat'
import { loadChatContext } from '../../../../utils/liveChatContext'

export default defineEventHandler(async (event) => {
  const actor = await requireChatStaff(event)
  const chat = await loadChatConversation(actor, chatRouteId(event), true)
  const number = String(getQuery(event).number || '').trim()
  if (number && !/^[A-Za-z0-9-]{1,64}$/.test(number)) {
    throw createError({ statusCode: 400, statusMessage: 'Order number is invalid.' })
  }
  return await loadChatContext(actor, chat, number)
})
