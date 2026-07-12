import { createError } from 'h3'
import { mapAdminUserRecord, normalizeAdminUserInput } from '../../utils/adminUsers'
import { requireAdminRequest } from '../../utils/adminRequest'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'users.view'
  })

  const body = await readBody(event)
  const input = normalizeAdminUserInput(body, {
    requirePassword: true
  })

  if (input.role === 'owner' && adminUser.role !== 'owner') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only an owner can create another owner account.'
    })
  }

  const { data: createdUserData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: input.full_name
      ? {
          full_name: input.full_name
        }
      : {}
  })

  if (createUserError || !createdUserData.user) {
    throw createError({
      statusCode: 400,
      statusMessage: createUserError?.message || 'Could not create the auth user.'
    })
  }

  const { data, error } = await supabaseAdmin
    .from('admin_users')
    .insert({
      id: createdUserData.user.id,
      email: input.email,
      full_name: input.full_name,
      role: input.role,
      permissions: input.permissions,
      is_active: input.is_active,
      created_by: adminUser.id,
      updated_at: new Date().toISOString()
    })
    .select('*')
    .single()

  if (error) {
    await supabaseAdmin.auth.admin.deleteUser(createdUserData.user.id)

    throw createError({
      statusCode: 400,
      statusMessage: error.message
    })
  }

  return {
    item: mapAdminUserRecord(data)
  }
})
