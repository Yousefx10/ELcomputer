import { createError, getRouterParam } from 'h3'
import { requireAdminRequest } from '../../../../utils/adminRequest'
import { getPdcSettings } from '../../../../utils/pdcShipping'
import { requirePdcReadAccess, reconcilePdcShipment } from '../../../../utils/pdcLookups'

export default defineEventHandler(async event => {
  const { supabaseAdmin } = await requireAdminRequest(event, { permission: 'dashboard.orders' })
  const id = getRouterParam(event, 'id')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id || '')) throw createError({ statusCode: 404, statusMessage: 'Order not found.' })
  const settings = await getPdcSettings(supabaseAdmin)
  requirePdcReadAccess(settings)
  return reconcilePdcShipment(supabaseAdmin, settings, id)
})
