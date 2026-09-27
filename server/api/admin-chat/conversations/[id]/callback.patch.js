import { createError } from 'h3'
import { chatError, chatRouteId, loadChatConversation, readChatJson, requireChatStaff } from '../../../../utils/liveChat'

export default defineEventHandler(async (event) => {
  const actor = await requireChatStaff(event, 'support.reply')
  const id = chatRouteId(event)
  const body = await readChatJson(event)
  if (!['completed', 'cancelled'].includes(body.status)) {
    throw createError({ statusCode: 400, statusMessage: 'Callback status is invalid.' })
  }
  const { error } = await actor.supabase.rpc('chat_set_callback_status', {
    p_conversation_id: id,
    p_staff_id: actor.id,
    p_status: body.status
  })
  if (error) chatError(error, 'Could not update the callback request.')
  return { item: await loadChatConversation(actor, id, true) }
})
