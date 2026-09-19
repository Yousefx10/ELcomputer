import { requireCustomerRequest } from '../../utils/customerRequest'
import { throwSupportError } from '../../utils/supportTickets'

export default defineEventHandler(async (event) => {
  const { authUser, supabaseAdmin } = await requireCustomerRequest(event)
  const { data, error } = await supabaseAdmin.rpc('support_customer_unread_ticket_count', {
    p_customer_id: authUser.id
  })
  if (error) throwSupportError(error, 'Could not load unread replies.')
  return { unreadTicketCount: Number(data || 0) }
})
