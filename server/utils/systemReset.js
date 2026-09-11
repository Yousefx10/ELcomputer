import { createClient } from '@supabase/supabase-js'
import { createError } from 'h3'
import { getResetConfirmation, getSystemResetScope } from './systemResetScopes.js'
import { removeResetMediaFiles } from './systemResetFiles.js'

export const validateResetInput = (body) => {
  const scope = getSystemResetScope(body?.scope)
  if (!scope || typeof body?.operationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.operationId)) {
    throw createError({ statusCode: 400, statusMessage: 'Choose a reset option first.' })
  }
  if (body.confirmation !== getResetConfirmation(scope.key)) {
    throw createError({ statusCode: 400, statusMessage: 'The confirmation text does not match.' })
  }
  if (typeof body.password !== 'string' || !body.password || body.password.length > 1024) {
    throw createError({ statusCode: 400, statusMessage: 'Enter your current owner password.' })
  }
  return scope
}

export const resetRpc = async (supabaseAdmin, name, args) => {
  const { data, error } = await supabaseAdmin.rpc(name, args)
  if (error) {
    const missing = ['PGRST202', '42883', '42P01'].includes(error.code)
    throw createError({
      statusCode: missing ? 503 : error.code === '42501' ? 403 : 409,
      statusMessage: missing ? 'System reset is not installed. Apply the owner reset migration first.' : error.message || 'The reset could not continue.'
    })
  }
  return data
}

export const verifyResetPassword = async ({ authUser, password, config, createAuthClient = createClient }) => {
  if (!authUser?.id || !authUser.email) {
    throw createError({ statusCode: 403, statusMessage: 'An owner account with email and password is required.' })
  }
  // A separate client prevents reauthentication from replacing the shared service-role session.
  const verifier = createAuthClient(config.public.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  })
  try {
    const { data, error } = await verifier.auth.signInWithPassword({ email: authUser.email, password })
    if (error || data?.user?.id !== authUser.id || !data?.session?.access_token) {
      throw createError({ statusCode: 403, statusMessage: 'Password verification failed. No reset was started.' })
    }
  } finally {
    // Revoke only the temporary verification session, never the owner's browser session.
    await verifier.auth.signOut({ scope: 'local' }).catch(() => {})
  }
}

export const finishResetCleanup = async ({ supabaseAdmin, run, ownerId, uploadsRoot }) => {
  if (run.status === 'completed') return { id: run.id, scope: run.scope, status: run.status, completed_at: run.completed_at }
  const manifest = run.manifest || {}
  const documents = manifest.documents || []
  for (let offset = 0; offset < documents.length; offset += 100) {
    const { error } = await supabaseAdmin.storage.from('admin-documents').remove(documents.slice(offset, offset + 100))
    if (error) throw new Error('Document cleanup failed. Retry to finish the reset.')
  }
  await removeResetMediaFiles(uploadsRoot, manifest.media || [])
  for (const userId of manifest.users || []) {
    if (userId === ownerId) throw new Error('The reset cannot delete the current owner.')
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (error && error.status !== 404 && error.code !== 'user_not_found') {
      throw new Error('Account cleanup failed. Retry to finish the reset.')
    }
  }
  return await resetRpc(supabaseAdmin, 'system_reset_finish', { p_owner: ownerId, p_id: run.id })
}
