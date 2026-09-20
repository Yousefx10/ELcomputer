import { createError } from 'h3'
import { chatError, chatRouteId, chatUuid, loadChatConversation, readChatJson, requireChatStaff } from '../../../../utils/liveChat'

export default defineEventHandler(async (event) => {
  const actor = await requireChatStaff(event, 'support.reply')
  const id = chatRouteId(event)
  const body = await readChatJson(event)
  if (!['claim', 'transfer', 'close', 'reopen'].includes(body.action)
    || !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0) {
    throw createError({ statusCode: 400, statusMessage: 'Chat action is invalid.' })
  }
  const targetId = body.action === 'transfer' ? chatUuid(body.targetId, 'Agent') : null
  const { error } = await actor.supabase.rpc('chat_transition', {
    p_conversation_id: id, p_staff_id: actor.id,
    p_action: body.action, p_target_id: targetId,
    p_expected_revision: body.expectedRevision
  })
  if (error) chatError(error, 'Could not change conversation.')
  return { item: await loadChatConversation(actor, id, true) }
})
