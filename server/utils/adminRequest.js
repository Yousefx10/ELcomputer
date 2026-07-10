import { createError, getHeader } from 'h3'
import { hasAdminPermission } from '~/utils/adminPermissions'
import { mapAdminUserRecord } from './adminUsers'
import { getSupabaseAdminClient } from './supabaseAdmin'

export const requireAdminRequest = async (event, options = {}) => {
  const authorizationHeader = getHeader(event, 'authorization')

  if (!authorizationHeader?.startsWith('Bearer ')) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Missing authorization token.'
    })
  }

  const accessToken = authorizationHeader.slice('Bearer '.length)
  const supabaseAdmin = getSupabaseAdminClient()
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken)

  if (authError || !authData.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid or expired session.'
    })
  }

  const { data: adminRecord, error: adminError } = await supabaseAdmin
    .from('admin_users')
    .select('*')
    .eq('id', authData.user.id)
    .maybeSingle()

  if (adminError) {
    throw createError({
      statusCode: 500,
      statusMessage: adminError.message
    })
  }

  const adminUser = mapAdminUserRecord(adminRecord)

  if (!adminUser?.is_active) {
    throw createError({
      statusCode: 403,
      statusMessage: 'You do not have access to this resource.'
    })
  }

  if (options.role === 'owner' && adminUser.role !== 'owner') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Owner access is required.'
    })
  }

  if (options.permission && !hasAdminPermission(adminUser, options.permission)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'You do not have permission for this action.'
    })
  }

  return {
    authUser: authData.user,
    adminUser,
    supabaseAdmin
  }
}
