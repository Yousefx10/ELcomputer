import { createError, getRouterParam, setHeader } from 'h3'
import { requireAdminRequest } from '../../../utils/adminRequest'
import { billFileName, readOrderBillPdf } from '../../../utils/customerBills'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
// Dashboard → order → Bill: the same PDF the customer receives.
export default defineEventHandler(async event => {
  for (const [k, v] of Object.entries({ 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' })) setHeader(event, k, v)
  const { supabaseAdmin } = await requireAdminRequest(event, { permission: 'dashboard.orders' })
  const orderId = getRouterParam(event, 'id')
  if (!UUID.test(orderId || '')) throw createError({ statusCode: 404, statusMessage: 'Order not found.' })
  const { data: bill, error } = await supabaseAdmin.rpc('order_bill_get', { p_order: orderId })
  if (error) throw createError({ statusCode: 503, statusMessage: 'The bill is unavailable. Try again later.' })
  if (!bill) throw createError({ statusCode: 404, statusMessage: 'The bill is not ready yet.' })
  const bytes = await readOrderBillPdf(bill)
  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Disposition', `attachment; filename="${billFileName(bill)}"`)
  return bytes
})
