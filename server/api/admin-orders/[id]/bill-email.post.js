import { createError, getRouterParam, setHeader } from 'h3'
import { requireAdminRequest } from '../../../utils/adminRequest'
import { queueBillEmail, billEmailSkipMessage } from '../../../utils/customerBills'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
// Dashboard → order → Send bill again. Logged; at most once per 2 minutes and 5 times a day.
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'dashboard.orders' })
  const orderId = getRouterParam(event, 'id')
  if (!UUID.test(orderId || '')) throw createError({ statusCode: 404, statusMessage: 'Order not found.' })
  let result
  try { result = await queueBillEmail(supabaseAdmin, orderId, { actor: adminUser.id }) }
  catch (error) { throw createError({ statusCode: error?.statusCode === 403 ? 403 : 503, statusMessage: error?.statusCode === 503 && error.statusMessage ? error.statusMessage : 'The bill email could not be sent.' }) }
  if (!result.queued) throw createError({ statusCode: 409, statusMessage: result.skipped ? billEmailSkipMessage(result.skipped) : 'The bill email could not be sent.' })
  return { queued: true }
})
