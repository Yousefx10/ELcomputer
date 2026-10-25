import { createError, getRouterParam, setHeader } from 'h3'
import { requireAdminRequest } from '../../../../utils/adminRequest'
import { readPaymentCallbackBody } from '../../../../utils/payments/body.js'
import { recordAdminActivity } from '../../../../utils/adminLogs'

export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'dashboard.orders' })
  const orderId = getRouterParam(event, 'id')
  let body
  try { body = JSON.parse(await readPaymentCallbackBody(event, 1024, 2000)) } catch { /* Refuse malformed or oversized input. */ }
  if (!/^[0-9a-f-]{36}$/i.test(orderId || '') || !body || body.confirmed !== true
    || Object.keys(body).some(key => !['awb', 'confirmed'].includes(key)) || !/^[A-Za-z0-9][A-Za-z0-9-]{0,99}$/.test(body.awb || '')) {
    throw createError({ statusCode: 400, statusMessage: 'Confirm the real airway bill for this order.' })
  }
  const { data, error } = await supabaseAdmin.rpc('shipping_order_record_manual_awb', { p_order_id: orderId, p_admin_id: adminUser.id, p_awb: body.awb })
  if (error) throw createError({ statusCode: 409, statusMessage: 'Review the original booking before recording an airway bill.' })
  await recordAdminActivity({ supabaseAdmin, adminUser, actionKey: 'orders.shipping.manual_awb', description: 'Recorded an administrator-verified PDC airway bill.', metadata: { order_id: orderId, awb: data.awb } })
  return data
})
