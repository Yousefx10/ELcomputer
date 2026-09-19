import { getRouterParam, readBody } from 'h3'
import { requireAdminRequest } from '../../../../utils/adminRequest'
import { messageFields, requireStaffTicket, supportIdempotencyKey, supportText, throwSupportError } from '../../../../utils/supportTickets'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'support.reply' })
  const ticket = await requireStaffTicket(supabaseAdmin, getRouterParam(event, 'id'))
  const body = await readBody(event)
  const message = supportText(body?.message, 'Message', 10000)
  const name = supportText(adminUser.full_name || adminUser.email || 'Support', 'Name', 160)
  const { data: messageId, error } = await supabaseAdmin.rpc('support_add_message', {
    p_ticket_id: ticket.id, p_sender_id: adminUser.id, p_sender_type: 'staff',
    p_sender_name: name, p_body: message, p_internal: body?.internal === true,
    p_idempotency_key: supportIdempotencyKey(body?.idempotencyKey)
  })
  if (error) throwSupportError(error, 'Could not send message.')
  const { data, error: readError } = await supabaseAdmin.from('support_ticket_messages')
    .select(messageFields).eq('id', messageId).eq('ticket_id', ticket.id).maybeSingle()
  if (readError) throwSupportError(readError, 'Could not load message.')
  return { item: data }
})
