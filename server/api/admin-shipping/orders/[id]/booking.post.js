import { createError, getRouterParam, setHeader } from 'h3'
import { requireAdminRequest } from '../../../../utils/adminRequest'
import { readPaymentCallbackBody } from '../../../../utils/payments/body.js'
import { operatePdcOrder } from '../../../../utils/pdcOrderShipping.js'
export default defineEventHandler(async event => {
  const authorize = () => requireAdminRequest(event, { permission: 'dashboard.orders' })
  const { adminUser, supabaseAdmin } = await authorize()
  setHeader(event, 'Cache-Control', 'private, no-store')
  const orderId = getRouterParam(event, 'id')
  let body
  try { body = JSON.parse(await readPaymentCallbackBody(event, 1024, 2000)) } catch { throw createError({ statusCode: 400, statusMessage: 'Choose a courier action.' }) }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId || '') || !body || Object.keys(body).some(k => k !== 'action') || !['book','recover','label'].includes(body.action)) throw createError({ statusCode: 400, statusMessage: 'Choose a courier action.' })
  return operatePdcOrder({ db: supabaseAdmin, adminId: adminUser.id, orderId, action: body.action, runtime: useRuntimeConfig(event), authorize })
})
