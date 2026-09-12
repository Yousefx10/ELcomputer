import { setHeader } from 'h3'
import { requireAdminRequest } from '../../../utils/adminRequest'
import {
  getAdminActiveOrderPackingSession,
  getAdminActivePackingWorkSession
} from '../../../utils/orderPacking'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'dashboard.orders'
  })

  setHeader(event, 'Cache-Control', 'private, no-store')

  const [workSession, packingSession] = await Promise.all([
    getAdminActivePackingWorkSession(supabaseAdmin, adminUser.id),
    getAdminActiveOrderPackingSession(supabaseAdmin, adminUser.id)
  ])

  return {
    workSession,
    activePackingSessionId: packingSession?.id || null
  }
})
