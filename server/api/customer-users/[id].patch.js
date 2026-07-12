import { createError, getRouterParam } from 'h3'
import { mapCustomerProfileRecord } from '../../utils/customerUsers'
import { requireAdminRequest } from '../../utils/adminRequest'

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'users.view'
  })

  const targetId = getRouterParam(event, 'id')

  if (!targetId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Customer user id is required.'
    })
  }

  const body = await readBody(event)

  if (typeof body?.is_active !== 'boolean') {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid active status is required.'
    })
  }

  const { data: existingRecord, error: existingError } = await supabaseAdmin
    .from('customer_profiles')
    .select('*')
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

  const { data, error } = await supabaseAdmin
    .from('customer_profiles')
    .update({
      is_active: body.is_active,
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

  return {
    item: mapCustomerProfileRecord(data)
  }
})
