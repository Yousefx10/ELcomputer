import { getRouterParam, readBody } from 'h3'
import { requireCustomerRequest } from '../../../../utils/customerRequest'
import { messageFields, requireCustomerTicket, supportIdempotencyKey, supportText, throwSupportError } from '../../../../utils/supportTickets'

export default defineEventHandler(async (event) => {
  const { authUser, customerProfile, supabaseAdmin } = await requireCustomerRequest(event)
  const ticket = await requireCustomerTicket(supabaseAdmin, authUser.id, getRouterParam(event, 'id'))
  const body = await readBody(event)
  const message = supportText(body?.message, 'Message', 10000)
  const name = supportText(customerProfile?.full_name || authUser.email || 'Customer', 'Name', 160)
  const { data: messageId, error } = await supabaseAdmin.rpc('support_add_message', {
    p_ticket_id: ticket.id, p_sender_id: authUser.id, p_sender_type: 'customer',
    p_sender_name: name, p_body: message, p_internal: false,
    p_idempotency_key: supportIdempotencyKey(body?.idempotencyKey)
  })
  if (error) throwSupportError(error, 'Could not send reply.')
  const { data, error: readError } = await supabaseAdmin.from('support_ticket_messages')
    .select(messageFields).eq('id', messageId).eq('ticket_id', ticket.id)
    .eq('is_internal', false).maybeSingle()
  if (readError) throwSupportError(readError, 'Could not load reply.')
  return { item: data }
})
