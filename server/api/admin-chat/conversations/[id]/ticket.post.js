import { createError } from 'h3'
import { chatError, chatRouteId, loadChatConversation, readChatJson, requireChatStaff } from '../../../../utils/liveChat'
import { requireStaffTicket, supportText } from '../../../../utils/supportTickets'

export default defineEventHandler(async (event) => {
  const actor = await requireChatStaff(event, 'support.reply')
  const id = chatRouteId(event)
  const body = await readChatJson(event)
  const subject = supportText(body.subject, 'Subject', 160)
  if (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0) {
    throw createError({ statusCode: 400, statusMessage: 'Conversation revision is invalid.' })
  }
  const { data: ticketId, error } = await actor.supabase.rpc('chat_create_ticket', {
    p_conversation_id: id,
    p_staff_id: actor.id,
    p_subject: subject,
    p_expected_revision: body.expectedRevision
  })
  if (error) chatError(error, 'Could not create support ticket.')
  const [item, ticket] = await Promise.all([
    loadChatConversation(actor, id, true),
    requireStaffTicket(actor.supabase, ticketId)
  ])
  return { item, ticket }
})
