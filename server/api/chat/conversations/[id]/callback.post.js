import { createError } from 'h3'
import { chatError, chatRouteId, loadChatConversation, readChatJson, requireChatVisitor } from '../../../../utils/liveChat'
import { chatCallbackMobile } from '../../../../utils/liveChatContact'

const mobilePattern = /^\+?[0-9 ()-]{7,30}$/

export default defineEventHandler(async (event) => {
  const actor = await requireChatVisitor(event)
  const id = chatRouteId(event)
  const body = await readChatJson(event)
  const conversation = await loadChatConversation(actor, id)
  const supplied = typeof body.mobile === 'string' ? body.mobile.trim() : ''
  if (supplied && !mobilePattern.test(supplied)) {
    throw createError({ statusCode: 400, statusMessage: 'Enter a valid mobile number.' })
  }
  const mobile = chatCallbackMobile(actor, conversation, supplied)
  if (!mobilePattern.test(mobile)) {
    throw createError({ statusCode: 400, statusMessage: 'Enter a mobile number for the callback.' })
  }
  const { data, error } = await actor.supabase.rpc('chat_request_callback', {
    p_conversation_id: id,
    p_actor_id: actor.id,
    p_is_guest: actor.kind === 'guest',
    p_mobile: mobile
  })
  if (error) chatError(error, 'Could not request a call.')
  return { callback: data, item: await loadChatConversation(actor, id) }
})
