import { assertExternalErpDomain } from '../../utils/erpOwnership'
import { createError, readBody } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { recordAdminActivity } from '../../utils/adminLogs'
import { processNextDaftraJob, retryDaftraJob } from '../../utils/daftraSync'
import { hasAdminPermission } from '~/utils/adminPermissions'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event)
  await assertExternalErpDomain(supabaseAdmin)

  const body = await readBody(event)
  const action = String(body?.action || 'order').trim()

  if (action === 'inventory') {
    if (!hasAdminPermission(adminUser, 'products.edit')) {
      throw createError({ statusCode: 403, statusMessage: 'Product editing permission is required.' })
    }

    const { data: jobId, error } = await supabaseAdmin.rpc('erp_queue_inventory_refresh', {})
    if (error) throw createError({ statusCode: 503, statusMessage: 'Could not queue the stock refresh.' })
    return { queued: true, jobId }

  }

  if (action !== 'order') {
    throw createError({ statusCode: 400, statusMessage: 'Choose a valid synchronization action.' })
  }

  const operations = [
    ...(hasAdminPermission(adminUser,'dashboard.orders') ? ['order.export'] : []),
    ...(hasAdminPermission(adminUser,'products.edit') ? ['inventory.import'] : [])
  ]
  if (!operations.length) throw createError({ statusCode:403,statusMessage:'ERP queue access is required.' })

  const jobId = String(body?.jobId || '').trim() || null
  if (jobId) {
    const {data:job,error}=await supabaseAdmin.from('erp_sync_jobs').select('operation').eq('id',jobId).eq('provider','daftra').maybeSingle()
    if(error) throw createError({statusCode:503,statusMessage:'Could not load the ERP job.'})
    if(!job || !operations.includes(job.operation)) throw createError({statusCode:403,statusMessage:'ERP job permission is required.'})
  }

  if (jobId && body?.retry === true) {
    await retryDaftraJob(supabaseAdmin, jobId)
  }

  const result = await processNextDaftraJob(supabaseAdmin, jobId, {operations})

  await recordAdminActivity({
    supabaseAdmin,
    adminUser,
    actionKey: 'erp.daftra.sync',
    description: result.processed ? 'Processed a Daftra synchronization job.' : 'Checked the Daftra sync queue.',
    metadata: { jobId: result.job?.id || jobId,operation:result.job?.operation,status:result.job?.status }
  })

  return result
})
