import { createError, getRouterParam } from 'h3'
import { recordAdminActivity } from '../../../../utils/adminLogs'
import { requireAdminRequest } from '../../../../utils/adminRequest'
import {
  assertPackingSessionOwner,
  getOrderPackingSession,
  isOrderPackingUuid,
  ORDER_PACKING_SESSIONS_TABLE,
  throwOrderPackingDatabaseError
} from '../../../../utils/orderPacking'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'dashboard.orders'
  })
  const sessionId = String(getRouterParam(event, 'sessionId') || '').trim()

  if (!isOrderPackingUuid(sessionId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid packing session is required.'
    })
  }

  const session = await getOrderPackingSession(supabaseAdmin, sessionId)
  assertPackingSessionOwner(session, adminUser.id)

  const { data: order, error: orderError } = await supabaseAdmin
    .from('customer_orders')
    .select('id, order_number')
    .eq('id', session.order_id)
    .maybeSingle()

  if (orderError) {
    throwOrderPackingDatabaseError(orderError, 'Could not load the order being released.')
  }

  const { data: releasedSession, error: releaseError } = await supabaseAdmin
    .from(ORDER_PACKING_SESSIONS_TABLE)
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString()
    })
    .eq('id', sessionId)
    .eq('admin_user_id', adminUser.id)
    .eq('status', 'active')
    .select('*')
    .maybeSingle()

  if (releaseError) {
    throwOrderPackingDatabaseError(releaseError, 'Could not release this packing session.')
  }

  if (!releasedSession) {
    throw createError({
      statusCode: 409,
      statusMessage: 'This packing session was already closed.'
    })
  }

  const orderReference = order?.order_number
    || `Order #${String(session.order_id || '').slice(0, 8)}`

  await recordAdminActivity({
    supabaseAdmin,
    adminUser,
    actionKey: 'orders.packing.release',
    description: `Released packing order ${orderReference} back to the confirmation queue.`,
    metadata: {
      order_id: session.order_id,
      order_number: order?.order_number || null,
      packing_session_id: sessionId,
      processor_admin_user_id: adminUser.id
    }
  })

  return {
    session: releasedSession,
    orderId: session.order_id
  }
})
