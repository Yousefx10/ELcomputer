import { createClient } from '@supabase/supabase-js'
import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const supabaseUrl = config.public.supabase?.url || config.public.supabaseUrl
  const supabaseKey = config.public.supabase?.key

  if (!supabaseUrl || !supabaseKey) {
    throw createError({ statusCode: 500, statusMessage: 'Missing public Supabase configuration.' })
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  const { data, error } = await supabase
    .from('site_settings')
    .select('dashboard_layout')
    .eq('key', 'default')
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return {
    dashboard_layout: data?.dashboard_layout || 'standard'
  }
})
