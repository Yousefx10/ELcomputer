import { createError, readBody, setHeader } from 'h3'
import { recordAdminActivity } from '../../../utils/adminLogs'
import { requireAdminRequest } from '../../../utils/adminRequest'
import {
  getAdminActivePackingWorkSession,
  ORDER_PACKING_WORK_SESSIONS_TABLE,
  throwOrderPackingDatabaseError
} from '../../../utils/orderPacking'

const getOperatorName = (adminUser = {}) => {
  return String(adminUser.full_name || adminUser.email || 'Admin').trim().slice(0, 160)
}

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'dashboard.orders'
  })
  const body = await readBody(event)
  const action = String(body?.action || 'start').trim().toLowerCase()

  setHeader(event, 'Cache-Control', 'private, no-store')

  if (!['start', 'close'].includes(action)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Choose start or close.'
    })
  }

  const activeWorkSession = await getAdminActivePackingWorkSession(
    supabaseAdmin,
    adminUser.id
  )

  if (action === 'start') {
    if (activeWorkSession) {
      return { workSession: activeWorkSession, resumed: true }
    }

    const now = new Date().toISOString()
    const { data: workSession, error } = await supabaseAdmin
      .from(ORDER_PACKING_WORK_SESSIONS_TABLE)
      .insert({
        admin_user_id: adminUser.id,
        operator_name: getOperatorName(adminUser),
        operator_email: String(adminUser.email || '').trim().toLowerCase() || null,
        status: 'active',
        started_at: now,
        updated_at: now
      })
      .select('*')
      .single()

    if (error) {
      if (error.code === '23505') {
        const concurrentSession = await getAdminActivePackingWorkSession(
          supabaseAdmin,
          adminUser.id
        )

        if (concurrentSession) {
          return { workSession: concurrentSession, resumed: true }
        }
      }

      throwOrderPackingDatabaseError(error, 'Could not start your packing session.')
    }

    await recordAdminActivity({
      supabaseAdmin,
      adminUser,
      actionKey: 'orders.packing.work_session.start',
      description: 'Started a packing work session.',
      metadata: { work_session_id: workSession.id }
    })

    return { workSession, resumed: false }
  }

  if (!activeWorkSession) {
    return { workSession: null, alreadyClosed: true }
  }

  const { data: result, error } = await supabaseAdmin.rpc(
    'close_order_packing_work_session',
    {
      p_work_session_id: activeWorkSession.id,
      p_admin_user_id: adminUser.id,
      p_author_name: getOperatorName(adminUser),
      p_author_email: String(adminUser.email || '').trim().toLowerCase(),
      p_author_role: adminUser.role
    }
  )

  if (error) {
    throwOrderPackingDatabaseError(error, 'Could not close your packing session.')
  }

  return {
    workSession: {
      ...activeWorkSession,
      status: 'closed',
      closed_at: new Date().toISOString()
    },
    result,
    alreadyClosed: Boolean(result?.already_closed)
  }
})
