import { createError, getRouterParam } from 'h3'
import { mapAdminUserRecord, normalizeAdminUserInput } from '../../utils/adminUsers'
import { recordAdminActivity } from '../../utils/adminLogs'
import { requireAdminRequest } from '../../utils/adminRequest'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'users.view'
  })

  const targetId = getRouterParam(event, 'id')

  if (!targetId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'User id is required.'
    })
  }

  const body = await readBody(event)
  const input = normalizeAdminUserInput(body, {
    requirePassword: false
  })

  const { data: existingRecord, error: existingError } = await supabaseAdmin
    .from('admin_users')
    .select('*')
    .eq('id', targetId)
    .single()

  if (existingError || !existingRecord) {
    throw createError({
      statusCode: 404,
      statusMessage: existingError?.message || 'Admin user not found.'
    })
  }

  if (
    adminUser.role !== 'owner' &&
    (existingRecord.role === 'owner' || input.role === 'owner')
  ) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only an owner can edit owner accounts or promote another admin to owner.'
    })
  }

  const isUpdatingSelf = adminUser.id === targetId
  const isRemovingOwnerAccess = existingRecord.role === 'owner' && (input.role !== 'owner' || !input.is_active)

  if (isUpdatingSelf && isRemovingOwnerAccess) {
    throw createError({
      statusCode: 400,
      statusMessage: 'You cannot remove your own owner access.'
    })
  }

  if (isRemovingOwnerAccess) {
    const { count: ownerCount, error: ownerCountError } = await supabaseAdmin
      .from('admin_users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'owner')
      .eq('is_active', true)

    if (ownerCountError) {
      throw createError({
        statusCode: 500,
        statusMessage: ownerCountError.message
      })
    }

    if ((ownerCount || 0) <= 1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'At least one active owner must remain.'
      })
    }
  }

  const authUpdatePayload = {}

  if (input.email !== existingRecord.email) {
    authUpdatePayload.email = input.email
  }

  if (input.password) {
    authUpdatePayload.password = input.password
  }

  if ((input.full_name || '') !== (existingRecord.full_name || '')) {
    authUpdatePayload.user_metadata = {
      full_name: input.full_name || ''
    }
  }

  if (Object.keys(authUpdatePayload).length) {
    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(targetId, authUpdatePayload)

    if (authUpdateError) {
      throw createError({
        statusCode: 400,
        statusMessage: authUpdateError.message
      })
    }
  }

  const { data, error } = await supabaseAdmin
    .from('admin_users')
    .update({
      email: input.email,
      full_name: input.full_name,
      role: input.role,
      permissions: input.permissions,
      is_active: input.is_active,
      updated_at: new Date().toISOString()
    })
    .eq('id', targetId)
    .select('*')
    .single()

  if (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error.message
    })
  }

  await recordAdminActivity({
    supabaseAdmin,
    adminUser,
    actionKey: 'users.admin.update',
    description: `Updated ${existingRecord.role} user ${existingRecord.full_name || existingRecord.email}.`,
    metadata: {
      target_user_id: targetId,
      target_email: input.email,
      target_role: input.role,
      is_active: input.is_active
    }
  })

  return {
    item: mapAdminUserRecord(data)
  }
})
