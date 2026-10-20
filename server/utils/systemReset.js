import { createClient } from '@supabase/supabase-js'
import { createError } from 'h3'
import { getResetConfirmation, getSystemResetScope } from './systemResetScopes.js'
import { removeResetMediaFiles } from './systemResetFiles.js'
import { isVpsPackingVideoPath, removePrivatePackingVideos } from './privatePackingVideos.js'

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
  if (manifest.format !== 2) throw new Error('This earlier reset needs operator review.')
  const progress = run.cleanup_progress || {}
  const pending = (kind, key = item => item) => (manifest[kind] || []).filter(item => !(progress[kind] || []).includes(key(item)))
  const checkpoint = (kind, items) => resetRpc(supabaseAdmin, 'system_reset_cleanup_checkpoint', {
    p_owner: ownerId, p_id: run.id, p_kind: kind, p_items: items
  })
  for (const [kind, bucket] of [
    ['documents', 'admin-documents'], ['support', 'support-attachments'], ['chat', 'chat-attachments'],
    ['packing', 'order-packing-videos'], ['labels', 'shipping-labels'], ['evidence', 'after-sales-evidence']
  ]) {
    const files = pending(kind)
    for (let offset = 0; offset < files.length; offset += 100) {
      const batch = files.slice(offset, offset + 100)
      const privateFiles = kind === 'packing' ? batch.filter(isVpsPackingVideoPath) : []
      if (privateFiles.length) await removePrivatePackingVideos(privateFiles)
      const legacyFiles = batch.filter(path => !privateFiles.includes(path))
      if (legacyFiles.length) {
        const { error } = await supabaseAdmin.storage.from(bucket).remove(legacyFiles)
        if (error) throw new Error('File cleanup failed. Retry to finish the reset.')
      }
      await checkpoint(kind, batch)
    }
  }
  const media = pending('media', file => file.path)
  for (let offset = 0; offset < media.length; offset += 100) {
    const batch = media.slice(offset, offset + 100)
    await removeResetMediaFiles(uploadsRoot, batch)
    // SQL confirms the existing reservations and retains deleted tombstones.
    await checkpoint('media', batch.map(file => file.path))
  }
  const users = pending('users')
  for (let offset = 0; offset < users.length; offset += 100) {
    const batch = users.slice(offset, offset + 100)
    for (const userId of batch) {
      if (userId === ownerId) throw new Error('The reset cannot delete the current owner.')
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
      if (error && error.status !== 404 && error.code !== 'user_not_found') throw new Error('Account cleanup failed. Retry to finish the reset.')
    }
    await checkpoint('users', batch)
  }
  return await resetRpc(supabaseAdmin, 'system_reset_finish', { p_owner: ownerId, p_id: run.id })
}
