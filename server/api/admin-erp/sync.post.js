import { createError, readBody } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { recordAdminActivity } from '../../utils/adminLogs'
import { getErpSettings, processNextDaftraJob, retryDaftraJob, syncInventoryFromDaftra } from '../../utils/daftraSync'
import { hasAdminPermission } from '~/utils/adminPermissions'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event)
  const settings = await getErpSettings(supabaseAdmin)

  if (settings.erp_mode !== 'daftra' || settings.daftra_connection_status !== 'connected') {
    throw createError({ statusCode: 409, statusMessage: 'Daftra ERP is not active and connected.' })
  }

  const body = await readBody(event)
  const action = String(body?.action || 'order').trim()

  if (action === 'inventory') {
    if (!hasAdminPermission(adminUser, 'products.edit')) {
      throw createError({ statusCode: 403, statusMessage: 'Product editing permission is required.' })
    }

    const inventoryResult = await syncInventoryFromDaftra(supabaseAdmin)

    await recordAdminActivity({
      supabaseAdmin,
      adminUser,
      actionKey: 'erp.daftra.inventory-import',
      description: 'Refreshed website stock from Daftra.',
      metadata: inventoryResult
    })

    return { processed: true, inventory: inventoryResult }
  }

  if (action !== 'order') {
    throw createError({ statusCode: 400, statusMessage: 'Choose a valid synchronization action.' })
  }

  if (!hasAdminPermission(adminUser, 'dashboard.orders')) {
    throw createError({ statusCode: 403, statusMessage: 'Order access is required.' })
  }

  const jobId = String(body?.jobId || '').trim() || null

  if (jobId && body?.retry === true) {
    await retryDaftraJob(supabaseAdmin, jobId)
  }

  const result = await processNextDaftraJob(supabaseAdmin, jobId)

  await recordAdminActivity({
    supabaseAdmin,
    adminUser,
    actionKey: 'erp.daftra.sync',
    description: result.processed ? 'Synchronized an order with Daftra.' : 'Checked the Daftra sync queue.',
    metadata: { jobId: result.job?.id || jobId }
  })

  return result
})
