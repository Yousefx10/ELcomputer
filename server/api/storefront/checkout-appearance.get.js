import { createClient } from '@supabase/supabase-js'
import { setHeader } from 'h3'

// Presentation only. Any failure falls back to Classic, the original layout.
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'no-store')
  const config = useRuntimeConfig(event)
  const url = config.public.supabase?.url || config.public.supabaseUrl
  const key = config.public.supabase?.key
  const fallback = { checkout_style: 'classic' }
  if (!url || !key) return fallback
  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data, error } = await client.from('site_settings').select('checkout_style')
    .eq('key', 'default').maybeSingle().abortSignal(AbortSignal.timeout(8000))
  if (error) return fallback
  return { checkout_style: data?.checkout_style === 'modern' ? 'modern' : 'classic' }
})
