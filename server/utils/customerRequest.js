import { createError, getHeader } from 'h3'
import { getSupabaseAdminClient } from './supabaseAdmin'

export const requireCustomerRequest = async (event) => {
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

  const { data: customerProfile, error: customerProfileError } = await supabaseAdmin
    .from('customer_profiles')
    .select('*')
    .eq('id', authData.user.id)
    .maybeSingle()

  if (customerProfileError) {
    throw createError({
      statusCode: 500,
      statusMessage: customerProfileError.message
    })
  }

  if (customerProfile && customerProfile.is_active === false) {
    throw createError({
      statusCode: 403,
      statusMessage: 'This customer account is disabled.'
    })
  }

  return {
    authUser: authData.user,
    customerProfile,
    supabaseAdmin
  }
}
