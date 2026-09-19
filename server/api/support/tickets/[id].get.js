import { getRouterParam } from 'h3'
import { requireCustomerRequest } from '../../../utils/customerRequest'
import { loadTicketOrder, loadTicketThread, requireCustomerTicket } from '../../../utils/supportTickets'

export default defineEventHandler(async (event) => {
  const { authUser, supabaseAdmin } = await requireCustomerRequest(event)
  const ticket = await requireCustomerTicket(supabaseAdmin, authUser.id, getRouterParam(event, 'id'))
  const [thread, order] = await Promise.all([
    loadTicketThread(supabaseAdmin, ticket), loadTicketOrder(supabaseAdmin, { ...ticket, customer_id: authUser.id })
  ])
  return { ticket, order, ...thread }
})
