import { createError, getRouterParam } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, {
    role: 'owner'
  })

  const targetId = getRouterParam(event, 'id')

  if (!targetId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Customer user id is required.'
    })
  }

  const { data: existingRecord, error: existingError } = await supabaseAdmin
    .from('customer_profiles')
    .select('id')
    .eq('id', targetId)
    .maybeSingle()

  if (existingError) {
    throw createError({
      statusCode: 500,
      statusMessage: existingError.message
    })
  }

  if (!existingRecord) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Customer user not found.'
    })
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
