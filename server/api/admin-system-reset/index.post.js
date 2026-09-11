import { createError, readBody, setHeader } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { validateResetInput, verifyResetPassword, resetRpc, finishResetCleanup } from '../../utils/systemReset.js'
import { listResetMediaFiles } from '../../utils/systemResetFiles.js'
import { getUploadsRootDirectory } from '../../utils/uploads'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  const { adminUser, authUser, supabaseAdmin } = await requireAdminRequest(event, { role: 'owner' })
  const body = await readBody(event)
  const scope = validateResetInput(body)
  const allowed = await resetRpc(supabaseAdmin, 'system_reset_check_attempt', { p_owner: adminUser.id })
  if (!allowed) {
    setHeader(event, 'Retry-After', '900')
    throw createError({ statusCode: 429, statusMessage: 'Too many reset attempts. Try again in 15 minutes.' })
  }
  await verifyResetPassword({ authUser, password: body.password, config: useRuntimeConfig() })
  body.password = ''
  const uploadsRoot = getUploadsRootDirectory()
  const { data: existing, error } = await supabaseAdmin.from('system_reset_runs').select('*').eq('id', body.operationId).maybeSingle()
  if (error) throw createError({ statusCode: 503, statusMessage: 'Could not check the reset request.' })
  if (existing && (existing.owner_id !== adminUser.id || existing.scope !== scope.key)) {
    throw createError({ statusCode: 409, statusMessage: 'Reset request does not match.' })
  }
  const run = existing || await resetRpc(supabaseAdmin, 'system_reset_begin', {
    p_owner: adminUser.id,
    p_scope: scope.key,
    p_id: body.operationId,
    p_media_files: scope.mediaFiles ? await listResetMediaFiles(uploadsRoot) : []
  })
  try {
    return await finishResetCleanup({ supabaseAdmin, run, ownerId: adminUser.id, uploadsRoot })
  } catch {
    throw createError({
      statusCode: 503,
      statusMessage: 'Data was reset, but cleanup or its completion log is pending. Retry this reset to finish.',
      data: { operationId: run.id, scope: run.scope, cleanupPending: true }
    })
  }
})
