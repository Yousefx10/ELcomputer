import { createError, readBody, setHeader } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { recordAdminActivity } from '../../utils/adminLogs'

export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'settings.edit' })
  const body = await readBody(event)
  const weight = Number(body?.parcelWeightKg)
  if (!['review', 'auto'].includes(body?.paidOrders) || !['review', 'auto'].includes(body?.codOrders) || !Number.isFinite(weight)) {
    throw createError({ statusCode: 400, statusMessage: 'Choose a valid order flow and parcel weight.' })
  }
  const { data, error } = await supabaseAdmin.rpc('order_flow_save', { p_admin: adminUser.id, p_paid: body.paidOrders, p_cod: body.codOrders, p_weight: weight })
  if (error) {
    const forbidden = error.code === '42501'
    throw createError({ statusCode: forbidden ? 403 : 400, statusMessage: forbidden ? 'Order flow permission is required.' : 'Choose a valid order flow and parcel weight.' })
  }
  await recordAdminActivity({ supabaseAdmin, adminUser, actionKey: 'settings.order-flow.update', description: 'Updated the order flow.',
    metadata: { paidOrders: data.paid_orders, codOrders: data.cod_orders, parcelWeightKg: Number(data.parcel_weight_kg) } })
  return { paidOrders: data.paid_orders, codOrders: data.cod_orders, parcelWeightKg: Number(data.parcel_weight_kg), paidSince: data.paid_auto_since, codSince: data.cod_auto_since }
})
