import { createError, getQuery } from 'h3'
import { loadChatOrders } from '../../utils/liveChatContext'
import { requireChatVisitor } from '../../utils/liveChat'

export default defineEventHandler(async (event) => {
  const actor = await requireChatVisitor(event)
  if (actor.kind !== 'customer') {
    throw createError({ statusCode: 403, statusMessage: 'Sign in to view orders.' })
  }
  const number = String(getQuery(event).number || '').trim()
  if (number && !/^[A-Za-z0-9-]{1,64}$/.test(number)) {
    throw createError({ statusCode: 400, statusMessage: 'Order number is invalid.' })
  }
  return { items: await loadChatOrders(actor, actor.id, number) }
})
