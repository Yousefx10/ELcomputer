import { createError, getHeader } from 'h3'
import { chatError, chatRouteId, readChatJson, requireChatVisitor } from '../../../../utils/liveChat'

export default defineEventHandler(async (event) => {
  const actor = await requireChatVisitor(event)
  if (actor.kind !== 'customer') {
    throw createError({ statusCode: 403, statusMessage: 'Sign in to link a guest chat.' })
  }
  const guestBearer = getHeader(event, 'x-chat-guest-authorization')
  if (!guestBearer?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, statusMessage: 'Guest session is required.' })
  }
  const { data, error: authError } = await actor.supabase.auth.getUser(guestBearer.slice(7))
  if (authError || !data?.user || data.user.is_anonymous !== true || data.user.id === actor.id) {
    throw createError({ statusCode: 401, statusMessage: 'Guest session is invalid.' })
  }
  const id = chatRouteId(event)
  const body = await readChatJson(event)
  if (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0) {
    throw createError({ statusCode: 400, statusMessage: 'Conversation revision is invalid.' })
  }
  const result = await actor.supabase.rpc('chat_identify_guest', {
    p_conversation_id: id, p_guest_id: data.user.id,
    p_customer_id: actor.id, p_expected_revision: body.expectedRevision
  })
  if (result.error) chatError(result.error, 'Could not link guest chat.')
  return { id: result.data }
})
