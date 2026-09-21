import { createError } from 'h3'
import { chatError, chatRouteId, loadChatConversation, loadChatUnreadSummary, readChatJson, requireChatStaff } from '../../../../utils/liveChat'

export default defineEventHandler(async (event) => {
  const actor = await requireChatStaff(event)
  const id = chatRouteId(event)
  await loadChatConversation(actor, id, true)
  const body = await readChatJson(event)
  if (!Number.isSafeInteger(body.sequence) || body.sequence < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Read marker is invalid.' })
  }
  const { error } = await actor.supabase.rpc('chat_mark_read', {
    p_conversation_id: id, p_actor_id: actor.id,
    p_actor_kind: 'staff', p_sequence: body.sequence
  })
  if (error) chatError(error, 'Could not mark messages read.')
  return (await loadChatUnreadSummary(actor, [id])).get(id)
})
