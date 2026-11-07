import { setHeader } from 'h3'
import { requireCustomerRequest } from '../../utils/customerRequest'
import { readOpenOrderShipments } from '../../utils/publicTracking'

// The signed-in customer's undelivered orders, shown on the tracking page.
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const { authUser, supabaseAdmin } = await requireCustomerRequest(event)
  return { orders: await readOpenOrderShipments(supabaseAdmin, authUser.id) }
})
