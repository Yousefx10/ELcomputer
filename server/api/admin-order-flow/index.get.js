import { createError, setHeader } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'

// Settings → Order flow: automatic or review-first courier booking, plus orders waiting.
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const { supabaseAdmin } = await requireAdminRequest(event, { permission: 'settings.view' })
  const [{ data, error }, waiting] = await Promise.all([
    supabaseAdmin.from('commerce_order_flow_settings').select('paid_orders,cod_orders,parcel_weight_kg,status_follows_courier,acting_admin_id,paid_auto_since,cod_auto_since,updated_at').eq('id', 'default').maybeSingle(),
    supabaseAdmin.rpc('order_auto_courier_waiting')
  ])
  if (error || !data || waiting.error) throw createError({ statusCode: 503, statusMessage: 'Order flow is unavailable.' })
  const runtime = useRuntimeConfig()
  return {
    paidOrders: data.paid_orders, codOrders: data.cod_orders, parcelWeightKg: Number(data.parcel_weight_kg),
    statusFollowsCourier: data.status_follows_courier === true, paidSince: data.paid_auto_since, codSince: data.cod_auto_since, updatedAt: data.updated_at,
    courierReady: runtime.shippingLiveRequestsEnabled === true || [true, 'true'].includes(runtime.pdcManualCodEnabled),
    waiting: Array.isArray(waiting.data) ? waiting.data : []
  }
})
