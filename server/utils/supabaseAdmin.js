import { createClient } from '@supabase/supabase-js'
import { createError } from 'h3'
import { vpsStorage } from './privateFiles.js'

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
    // Supabase is the database only (STORAGE-VPS-01): this client's `.storage` is the VPS
    // private disk (server/utils/privateFiles.js). Supabase Storage is never called.
    Object.defineProperty(cachedSupabaseAdminClient, 'storage', { value: vpsStorage, enumerable: false, configurable: false, writable: false })
  }

  return cachedSupabaseAdminClient
}
