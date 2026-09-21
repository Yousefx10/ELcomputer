import { createError } from 'h3'
import { chatError, chatRouteId, chatUuid, loadChatConversation, readChatJson, requireChatVisitor } from '../../../../utils/liveChat'

export default defineEventHandler(async (event) => {
  const actor = await requireChatVisitor(event)
  if (actor.kind !== 'customer') {
    throw createError({ statusCode: 403, statusMessage: 'Sign in to link an order.' })
  }
  const id = chatRouteId(event)
  await loadChatConversation(actor, id)
  const body = await readChatJson(event)
  if (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0) {
    throw createError({ statusCode: 400, statusMessage: 'Conversation revision is invalid.' })
  }
  const orderId = body.orderId === null ? null : chatUuid(body.orderId, 'Order')
  const { error } = await actor.supabase.rpc('chat_set_order', {
    p_conversation_id: id, p_actor_id: actor.id, p_actor_kind: 'customer',
    p_order_id: orderId, p_expected_revision: body.expectedRevision
  })
  if (error) chatError(error, 'Could not link order.')
  return { item: await loadChatConversation(actor, id) }
})
