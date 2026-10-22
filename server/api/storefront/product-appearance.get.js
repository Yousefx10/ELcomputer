import { createClient } from '@supabase/supabase-js'
import { setHeader } from 'h3'
import { productPageStyle, normalizeProductPageConfig } from '../../../app/utils/productPage.js'

export default defineEventHandler(async event => {
  // Style changes must be visible after refresh, independently of content SWR.
  setHeader(event, 'Cache-Control', 'no-store')
  const config = useRuntimeConfig(event)
  const url = config.public.supabase?.url || config.public.supabaseUrl
  const key = config.public.supabase?.key
  const fallback = { style: 'classic', config: normalizeProductPageConfig(null) }
  if (!url || !key) return fallback
  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data, error } = await client.from('site_settings').select('product_page_style,product_page_config')
    .eq('key', 'default').maybeSingle().abortSignal(AbortSignal.timeout(8000))
  if (error) return fallback
  return { style: productPageStyle(data?.product_page_style), config: normalizeProductPageConfig(data?.product_page_config) }
})
