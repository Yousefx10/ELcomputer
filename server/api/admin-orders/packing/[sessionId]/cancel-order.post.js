import { createError, getRouterParam, readBody } from 'h3'
import { recordAdminActivity } from '../../../../utils/adminLogs'
import { requireAdminRequest } from '../../../../utils/adminRequest'
import {
  assertPackingSessionOwner, getOrderPackingSession, isOrderPackingUuid, ORDER_PACKING_ELIGIBLE_STATUSES,
  ORDER_PACKING_SESSIONS_TABLE, throwOrderPackingDatabaseError
} from '../../../../utils/orderPacking'

// Confirm Orders -> Problem -> Cancel order. Only an order still waiting to be confirmed.
export default defineEventHandler(async event => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'dashboard.orders' })
  const sessionId = String(getRouterParam(event, 'sessionId') || '').trim()
  if (!isOrderPackingUuid(sessionId)) throw createError({ statusCode: 400, statusMessage: 'A valid packing session is required.' })
  const reason = String((await readBody(event))?.reason || '').trim().slice(0, 500)
  const session = await getOrderPackingSession(supabaseAdmin, sessionId)
  assertPackingSessionOwner(session, adminUser.id)
  const released = await supabaseAdmin.from(ORDER_PACKING_SESSIONS_TABLE).update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', sessionId).eq('admin_user_id', adminUser.id).eq('status', 'active').select('id').maybeSingle()
  if (released.error) throwOrderPackingDatabaseError(released.error, 'Could not cancel this order.')
  if (!released.data) throw createError({ statusCode: 409, statusMessage: 'This packing session was already closed.' })
  const { data: order, error } = await supabaseAdmin.from('customer_orders').update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', session.order_id).in('status', ORDER_PACKING_ELIGIBLE_STATUSES).is('packing_completed_at', null).select('id, order_number, status, payment_status').maybeSingle()
  if (error) throwOrderPackingDatabaseError(error, 'Could not cancel this order.')
  if (!order) throw createError({ statusCode: 409, statusMessage: 'This order can no longer be cancelled here.' })
  await recordAdminActivity({ supabaseAdmin, adminUser, actionKey: 'orders.status.update', description: `Cancelled order ${order.order_number || session.order_id.slice(0, 8)} from Confirm Orders.`,
    metadata: { order_id: order.id, order_number: order.order_number || null, next_status: 'cancelled', payment_status: order.payment_status, reason: reason || null, packing_session_id: sessionId } })
  return { order: { id: order.id, order_number: order.order_number, status: order.status, payment_status: order.payment_status } }
})
