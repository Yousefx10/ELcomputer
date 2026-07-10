import { createClient } from '@supabase/supabase-js'
import { createError } from 'h3'

let cachedSupabaseAdminClient

export const getSupabaseAdminClient = () => {
  const config = useRuntimeConfig()
  const supabaseUrl = config.public.supabaseUrl
  const serviceRoleKey = config.supabaseServiceRoleKey

  if (!supabaseUrl || !serviceRoleKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Missing Supabase service role configuration.'
    })
  }

  if (!cachedSupabaseAdminClient) {
    cachedSupabaseAdminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  }

  return cachedSupabaseAdminClient
}
