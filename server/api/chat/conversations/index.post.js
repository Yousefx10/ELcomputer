import { createError } from 'h3'
import { chatActorHash, chatContact, chatError, chatUuid, loadChatConversation, readChatJson, requireChatVisitor } from '../../../utils/liveChat'
import { enforceChatNetworkLimit } from '../../../utils/liveChatRateLimit'

export default defineEventHandler(async (event) => {
  const actor = await requireChatVisitor(event)
  const body = await readChatJson(event)
  const key = chatUuid(body.creationKey, 'Creation key')
  if (body.orderId && actor.kind === 'guest') {
    throw createError({ statusCode: 403, statusMessage: 'Sign in to link an order.' })
  }
  const orderId = body.orderId ? chatUuid(body.orderId, 'Order') : null
  const contact = actor.kind === 'guest'
    ? chatContact(body.name, body.email, body.mobile)
    : chatContact(actor.profile.full_name || actor.profile.email,
      actor.profile.email, actor.profile.phone || body.mobile)
  const initialMessage = body.initialMessage
  if (initialMessage !== undefined && (typeof initialMessage !== 'string'
    || !initialMessage.trim() || initialMessage.length > 10000)) {
    throw createError({ statusCode: 400, statusMessage: 'Message is invalid.' })
  }
  const args = {
    p_actor_id: actor.id, p_is_guest: actor.kind === 'guest',
    p_name: contact.name, p_email: contact.email, p_mobile: contact.mobile,
    p_order_id: orderId, p_creation_key: key, p_subject_hash: chatActorHash(actor.id)
  }
  const isFirstMessage = initialMessage !== undefined
  await enforceChatNetworkLimit(event, actor,
    isFirstMessage ? 'conversation_message' : 'conversation', initialMessage ?? null)
  const { data, error } = await actor.supabase.rpc(
    isFirstMessage ? 'chat_start_with_message' : 'chat_create_or_resume',
    isFirstMessage ? { ...args, p_body: initialMessage,
      p_message_key: chatUuid(body.messageKey, 'Submission key') } : args
  )
  if (error) chatError(error, 'Could not start conversation.', event)
  const id = isFirstMessage ? data?.conversationId : data
  return { item: await loadChatConversation(actor, id),
    messageId: isFirstMessage ? data?.messageId : null,
    ticketId: isFirstMessage ? data?.ticketId || null : null }
})
