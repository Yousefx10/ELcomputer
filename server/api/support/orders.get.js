import { requireCustomerRequest } from '../../utils/customerRequest'
import { throwSupportError } from '../../utils/supportTickets'

export default defineEventHandler(async (event) => {
  const { authUser, supabaseAdmin } = await requireCustomerRequest(event)
  const { data, error } = await supabaseAdmin.from('customer_orders')
    .select('id, order_number, created_at').eq('user_id', authUser.id)
    .order('created_at', { ascending: false }).limit(50)
  if (error) throwSupportError(error, 'Could not load orders.')
  return { items: data || [] }
})
