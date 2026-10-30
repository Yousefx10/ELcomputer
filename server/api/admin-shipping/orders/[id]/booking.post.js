import { createError, getRouterParam, setHeader } from 'h3'
import { requireAdminRequest } from '../../../../utils/adminRequest'
import { readPaymentCallbackBody } from '../../../../utils/payments/body.js'
import { operatePdcOrder } from '../../../../utils/pdcOrderShipping.js'
import { measuredParcelWeight } from '../../../../../app/utils/parcelWeight.js'
export default defineEventHandler(async event => {
  const authorize = () => requireAdminRequest(event, { permission: 'dashboard.orders' })
  const { adminUser, supabaseAdmin } = await authorize()
  setHeader(event, 'Cache-Control', 'private, no-store')
  const orderId = getRouterParam(event, 'id')
  let body
  try { body = JSON.parse(await readPaymentCallbackBody(event, 1024, 2000)) } catch { throw createError({ statusCode: 400, statusMessage: 'Choose a courier action.' }) }
  const fields = body?.action === 'book' ? ['action', 'actual_weight_kg', 'weight_confirmed'] : ['action']
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId || '') || !body || Array.isArray(body) || Object.keys(body).some(k => !fields.includes(k)) || !['book','recover','label'].includes(body.action)) throw createError({ statusCode: 400, statusMessage: 'Choose a courier action.' })
  if (body.action === 'book' && (body.weight_confirmed !== true || measuredParcelWeight(body.actual_weight_kg) === null)) throw createError({ statusCode: 400, statusMessage: 'Measure and confirm the packed parcel weight.' })
  return operatePdcOrder({ db: supabaseAdmin, adminId: adminUser.id, orderId, action: body.action, actualWeightKg: body.actual_weight_kg, weightConfirmed: body.weight_confirmed, runtime: useRuntimeConfig(event), authorize })
})
