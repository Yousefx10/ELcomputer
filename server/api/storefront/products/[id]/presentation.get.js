import { createClient } from '@supabase/supabase-js'
import { createError, setHeader } from 'h3'

export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'no-store')
  const id = event.context.params?.id
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '')) throw createError({ statusCode: 404, statusMessage: 'Product not found.' })
  const config = useRuntimeConfig(event), url = config.public.supabase?.url || config.public.supabaseUrl, key = config.public.supabase?.key
  if (!url || !key) throw createError({ statusCode: 503, statusMessage: 'Product details are unavailable.' })
  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data, error } = await client.rpc('get_product_presentation', { p_product_id: id }, { get: true }).abortSignal(AbortSignal.timeout(10000))
  if (error) throw createError({ statusCode: 503, statusMessage: 'Product details are unavailable.' })
  if (!data) throw createError({ statusCode: 404, statusMessage: 'Product not found.' })
  return data
})
