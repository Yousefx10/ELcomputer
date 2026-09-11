import { createError, getQuery, setHeader } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { systemResetScopes, getSystemResetScope, publicResetScope } from '../../utils/systemResetScopes.js'
import { resetRpc } from '../../utils/systemReset.js'
import { listResetMediaFiles } from '../../utils/systemResetFiles.js'
import { getUploadsRootDirectory } from '../../utils/uploads'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { role: 'owner' })
  const query = getQuery(event)
  const { data: pending, error } = await supabaseAdmin.from('system_reset_runs')
    .select('id, owner_id, scope, status, created_at').eq('status', 'cleanup_pending').maybeSingle()
  if (error) throw createError({ statusCode: 503, statusMessage: 'System reset is not installed. Apply the owner reset migration first.' })
  const response = { scopes: systemResetScopes.map(publicResetScope), pending: pending ? { ...pending, canResume: pending.owner_id === adminUser.id } : null }
  if (typeof query.operationId === 'string' && /^[0-9a-f-]{36}$/i.test(query.operationId)) {
    const { data: operation, error: operationError } = await supabaseAdmin.from('system_reset_runs')
      .select('id, scope, status, completed_at').eq('id', query.operationId).eq('owner_id', adminUser.id).maybeSingle()
    if (operationError) throw createError({ statusCode: 503, statusMessage: 'Could not check the previous reset.' })
    response.operation = operation
  }
  if (!query.scope) return response
  const scope = getSystemResetScope(query.scope)
  if (!scope) throw createError({ statusCode: 400, statusMessage: 'Unsupported reset option.' })
  response.plan = await resetRpc(supabaseAdmin, 'system_reset_plan', { p_owner: adminUser.id, p_scope: scope.key })
  if (scope.mediaFiles) response.plan.mediaFiles = (await listResetMediaFiles(getUploadsRootDirectory())).length
  return response
})
