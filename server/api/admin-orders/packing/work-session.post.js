import { createError, readBody, setHeader } from 'h3'
import { recordAdminActivity } from '../../../utils/adminLogs'
import { requireAdminRequest } from '../../../utils/adminRequest'
import {
  getAdminActiveOrderPackingSession,
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

  const activePackingSession = await getAdminActiveOrderPackingSession(
    supabaseAdmin,
    adminUser.id
  )

  if (activePackingSession) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Complete or release the open order first.'
    })
  }

  const now = new Date().toISOString()
  const { data: workSession, error } = await supabaseAdmin
    .from(ORDER_PACKING_WORK_SESSIONS_TABLE)
    .update({
      status: 'closed',
      closed_at: now,
      updated_at: now
    })
    .eq('id', activeWorkSession.id)
    .eq('admin_user_id', adminUser.id)
    .eq('status', 'active')
    .select('*')
    .maybeSingle()

  if (error) {
    throwOrderPackingDatabaseError(error, 'Could not close your packing session.')
  }

  if (!workSession) {
    throw createError({
      statusCode: 409,
      statusMessage: 'This packing session was already closed.'
    })
  }

  await recordAdminActivity({
    supabaseAdmin,
    adminUser,
    actionKey: 'orders.packing.work_session.close',
    description: 'Closed a packing work session.',
    metadata: { work_session_id: workSession.id }
  })

  return { workSession, alreadyClosed: false }
})
