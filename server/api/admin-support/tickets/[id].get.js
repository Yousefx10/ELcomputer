import { getRouterParam } from 'h3'
import { requireAdminRequest } from '../../../utils/adminRequest'
import { loadTicketOrder, loadTicketThread, requireStaffTicket, throwSupportError } from '../../../utils/supportTickets'

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event, { permission: 'support.view' })
  const ticket = await requireStaffTicket(supabaseAdmin, getRouterParam(event, 'id'))
  const [thread, order, eventsResult, categoryResult, assigneeResult] = await Promise.all([
    loadTicketThread(supabaseAdmin, ticket, true),
    loadTicketOrder(supabaseAdmin, ticket, true),
    supabaseAdmin.from('support_ticket_events').select('id, actor_type, event_type, old_value, new_value, created_at')
      .eq('ticket_id', ticket.id).order('created_at').limit(500),
    ticket.category_id ? supabaseAdmin.from('help_categories').select('id, name').eq('id', ticket.category_id).maybeSingle() : Promise.resolve({ data: null }),
    ticket.assigned_admin_id ? supabaseAdmin.from('admin_users').select('id, full_name, email').eq('id', ticket.assigned_admin_id).maybeSingle() : Promise.resolve({ data: null })
  ])
  if (eventsResult.error) throwSupportError(eventsResult.error, 'Could not load ticket history.')
  let orderItems = []
  if (order) {
    const result = await supabaseAdmin.from('customer_order_items')
      .select('product_title, quantity, unit_price, line_total').eq('order_id', order.id).limit(100)
    if (result.error) throwSupportError(result.error, 'Could not load order items.')
    orderItems = result.data || []
  }
  return { ticket, order, orderItems, category: categoryResult.data || null,
    assignee: assigneeResult.data || null, events: eventsResult.data || [], ...thread }
})
