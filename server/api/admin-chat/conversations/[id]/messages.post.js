import { createError } from 'h3'
import { chatActorHash, chatError, chatRouteId, chatUuid, loadChatConversation, readChatJson, requireChatStaff } from '../../../../utils/liveChat'

export default defineEventHandler(async (event) => {
  const actor = await requireChatStaff(event, 'support.reply')
  const id = chatRouteId(event)
  await loadChatConversation(actor, id, true)
  const body = await readChatJson(event)
  if (typeof body.body !== 'string' || !body.body.trim() || body.body.length > 10000) {
    throw createError({ statusCode: 400, statusMessage: 'Message is invalid.' })
  }
  const key = chatUuid(body.idempotencyKey, 'Submission key')
  if (body.isInternal !== undefined && typeof body.isInternal !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'Message visibility is invalid.' })
  }
  const { data: messageId, error } = await actor.supabase.rpc('chat_send_message', {
    p_conversation_id: id, p_sender_id: actor.id, p_sender_kind: 'staff',
    p_sender_name: actor.name, p_body: body.body, p_key: key,
    p_subject_hash: chatActorHash(actor.id), p_internal: body.isInternal === true
  })
  if (error) chatError(error, 'Could not send message.')
  const result = await actor.supabase.from('chat_messages')
    .select('id,sequence_number,sender_kind,sender_name,body,is_internal,created_at')
    .eq('id', messageId).eq('conversation_id', id).single()
  if (result.error) chatError(result.error, 'Could not load sent message.')
  return { item: result.data }
})
