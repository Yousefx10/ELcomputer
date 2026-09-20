import { getQuery } from 'h3'
import { requireCustomerRequest } from '../../utils/customerRequest'
import { throwSupportError } from '../../utils/supportTickets'

export default defineEventHandler(async (event) => {
  const { authUser, supabaseAdmin } = await requireCustomerRequest(event)
  const requestedOrderId = String(getQuery(event).orderId || '')
  const { data, error } = await supabaseAdmin.from('customer_orders')
    .select('id, order_number, created_at').eq('user_id', authUser.id)
    .order('created_at', { ascending: false }).limit(50)
  if (error) throwSupportError(error, 'Could not load orders.')
  const items = data || []
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedOrderId)
    && !items.some(order => order.id === requestedOrderId)) {
    const { data: olderOrder, error: olderError } = await supabaseAdmin.from('customer_orders')
      .select('id, order_number, created_at').eq('id', requestedOrderId).eq('user_id', authUser.id).maybeSingle()
    if (olderError) throwSupportError(olderError, 'Could not load order.')
    if (olderOrder) items.push(olderOrder)
  }
  return { items }
})
