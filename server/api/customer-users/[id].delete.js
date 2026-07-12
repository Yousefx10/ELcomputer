import { createError, getRouterParam } from 'h3'
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
      statusMessage: 'Customer user id is required.'
    })
  }

  const { data: existingRecord, error: existingError } = await supabaseAdmin
    .from('customer_profiles')
    .select('id, email, full_name')
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

  await recordAdminActivity({
    supabaseAdmin,
    adminUser,
    actionKey: 'users.customer.delete',
    description: `Deleted customer user ${existingRecord.full_name || existingRecord.email}.`,
    metadata: {
      target_user_id: targetId,
      target_email: existingRecord.email || ''
    }
  })

  return {
    success: true,
    deletedId: targetId,
    deletedBy: adminUser.id
  }
})
