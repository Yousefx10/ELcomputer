import { createError, getRouterParam, readBody } from 'h3'
import { requireCustomerRequest } from '../../../../utils/customerRequest'
import { requireCustomerTicket, requireSupportUuid, throwSupportError } from '../../../../utils/supportTickets'

export default defineEventHandler(async (event) => {
  const { authUser, supabaseAdmin } = await requireCustomerRequest(event)
  const ticket = await requireCustomerTicket(supabaseAdmin, authUser.id, getRouterParam(event, 'id'))
  const body = await readBody(event)
  if (!Array.isArray(body?.messageIds) || body.messageIds.length > 500) {
    throw createError({ statusCode: 400, statusMessage: 'Choose visible replies to mark as read.' })
  }
  const ids = [...new Set(body.messageIds.map(id => requireSupportUuid(id, 'Message')))]
  if (!ids.length) return { readCount: 0 }
  const { data, error } = await supabaseAdmin.from('support_ticket_messages')
    .update({ customer_read_at: new Date().toISOString() })
    .eq('ticket_id', ticket.id).in('id', ids)
    .eq('sender_type', 'staff').eq('is_internal', false)
    .is('customer_read_at', null).select('id')
  if (error) throwSupportError(error, 'Could not mark replies as read.')
  return { readCount: data?.length || 0 }
})
