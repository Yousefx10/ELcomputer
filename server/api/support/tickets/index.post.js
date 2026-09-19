import { createError, readBody } from 'h3'
import { requireCustomerRequest } from '../../../utils/customerRequest'
import { requireCustomerTicket, requireSupportUuid, supportIdempotencyKey, supportText, throwSupportError } from '../../../utils/supportTickets'

export default defineEventHandler(async (event) => {
  const { authUser, supabaseAdmin } = await requireCustomerRequest(event)
  const body = await readBody(event)
  const subject = supportText(body?.subject, 'Subject', 160)
  const message = supportText(body?.message, 'Message', 10000)
  const orderId = body?.orderId ? requireSupportUuid(body.orderId, 'Order') : null
  const categoryId = body?.categoryId ? requireSupportUuid(body.categoryId, 'Category') : null
  const key = supportIdempotencyKey(body?.idempotencyKey)
  if (orderId) {
    const { data, error } = await supabaseAdmin.from('customer_orders').select('id')
      .eq('id', orderId).eq('user_id', authUser.id).maybeSingle()
    if (error) throwSupportError(error, 'Could not check order.')
    if (!data) throw createError({ statusCode: 400, statusMessage: 'Choose one of your orders.' })
  }
  const { data: id, error } = await supabaseAdmin.rpc('support_create_ticket', {
    p_customer_id: authUser.id, p_order_id: orderId, p_category_id: categoryId,
    p_subject: subject, p_body: message, p_idempotency_key: key
  })
  if (error) throwSupportError(error, 'Could not create ticket.')
  const ticket = await requireCustomerTicket(supabaseAdmin, authUser.id, id)
  const { data: firstMessage, error: firstMessageError } = await supabaseAdmin
    .from('support_ticket_messages').select('id')
    .eq('ticket_id', ticket.id).eq('sender_id', authUser.id)
    .eq('idempotency_key', key).maybeSingle()
  if (firstMessageError) throwSupportError(firstMessageError, 'Could not load ticket message.')
  return { item: ticket, messageId: firstMessage?.id || null }
})
