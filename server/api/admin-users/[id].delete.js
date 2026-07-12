import { createError, getRouterParam } from 'h3'
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

  if (existingRecord.role === 'owner' && adminUser.role !== 'owner') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only an owner can delete an owner account.'
    })
  }

  if (existingRecord.role === 'owner' && existingRecord.is_active) {
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

  const { error } = await supabaseAdmin.auth.admin.deleteUser(targetId)

  if (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error.message
    })
  }

  return {
    success: true,
    deletedId: targetId,
    deletedBy: adminUser.id
  }
})
