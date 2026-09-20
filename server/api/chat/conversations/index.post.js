import { createError } from 'h3'
import { chatActorHash, chatContact, chatError, chatUuid, loadChatConversation, readChatJson, requireChatVisitor } from '../../../utils/liveChat'

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
  const { data: id, error } = await actor.supabase.rpc('chat_create_or_resume', {
    p_actor_id: actor.id, p_is_guest: actor.kind === 'guest',
    p_name: contact.name, p_email: contact.email, p_mobile: contact.mobile,
    p_order_id: orderId, p_creation_key: key, p_subject_hash: chatActorHash(actor.id)
  })
  if (error) chatError(error, 'Could not start conversation.')
  return { item: await loadChatConversation(actor, id) }
})
