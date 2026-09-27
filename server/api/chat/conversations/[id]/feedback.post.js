import { createError } from 'h3'
import { chatError, chatRouteId, loadChatConversation, readChatJson, requireChatVisitor } from '../../../../utils/liveChat'

export default defineEventHandler(async (event) => {
  const actor = await requireChatVisitor(event)
  const id = chatRouteId(event)
  const body = await readChatJson(event)
  if (typeof body.resolved !== 'boolean' || !Number.isInteger(body.rating)
    || body.rating < 1 || body.rating > 5) {
    throw createError({ statusCode: 400, statusMessage: 'Choose an answer and rating.' })
  }
  await loadChatConversation(actor, id)
  const { data, error } = await actor.supabase.rpc('chat_submit_resolution_feedback', {
    p_conversation_id: id,
    p_actor_id: actor.id,
    p_is_guest: actor.kind === 'guest',
    p_resolved: body.resolved,
    p_rating: body.rating
  })
  if (error) chatError(error, 'Could not save your feedback.')
  return { feedback: data, item: await loadChatConversation(actor, id) }
})
