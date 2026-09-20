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
    auth: { autoRefreshToken: false, persistSession: false }
  })
  const { data, error } = await supabase.from('site_settings')
    .select('account_dashboard_style').eq('key', 'default').maybeSingle()

  if (error) {
    // The public response stays generic; the database detail belongs in server logs.
    console.error('Could not read account appearance:', error)
    throw createError({ statusCode: 500, statusMessage: 'Could not load account appearance.' })
  }

  return { account_dashboard_style: data?.account_dashboard_style === 'classic' ? 'classic' : 'modern' }
})
