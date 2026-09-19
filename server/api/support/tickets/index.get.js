import { getQuery } from 'h3'
import { requireCustomerRequest } from '../../../utils/customerRequest'
import { customerTicketFields, throwSupportError } from '../../../utils/supportTickets'

export default defineEventHandler(async (event) => {
  const { authUser, supabaseAdmin } = await requireCustomerRequest(event)
  const query = getQuery(event)
  const page = Math.max(1, Math.min(1000, Number.parseInt(String(query.page || 1), 10) || 1))
  const pageSize = 20
  const { data, count, error } = await supabaseAdmin.from('support_tickets')
    .select(customerTicketFields, { count: 'exact' })
    .eq('customer_id', authUser.id)
    .order('updated_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)
  if (error) throwSupportError(error, 'Could not load tickets.')
  const tickets = data || []
  let unreadByTicket = new Map()
  if (tickets.length) {
    const { data: unread, error: unreadError } = await supabaseAdmin.rpc('support_customer_unread_counts', {
      p_customer_id: authUser.id,
      p_ticket_ids: tickets.map(ticket => ticket.id)
    })
    if (unreadError) throwSupportError(unreadError, 'Could not load unread replies.')
    unreadByTicket = new Map((unread || []).map(item => [item.ticket_id, Number(item.unread_count)]))
  }
  return { items: tickets.map(ticket => ({ ...ticket, unreadReplyCount: unreadByTicket.get(ticket.id) || 0 })),
    total: count || 0, page, pageSize }
})
