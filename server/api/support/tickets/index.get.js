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
  return { items: data || [], total: count || 0, page, pageSize }
})
