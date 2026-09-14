import { createClient } from '@supabase/supabase-js'
import { createError } from 'h3'

const publicResult = (result) => ({
  data: result.data || null,
  error: result.error
    ? { code: result.error.code, message: result.error.message }
    : null
})

export default defineCachedEventHandler(async (event) => {
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
  const results = await Promise.all([
    supabase.from('site_settings').select('*').eq('key', 'default').maybeSingle(),
    supabase.from('site_hero_banners').select('*').order('sort_order').order('created_at'),
    supabase.from('site_top_bar_messages').select('*').order('sort_order').order('created_at'),
    supabase.from('site_links').select('*').order('location').order('section_title').order('sort_order').order('created_at'),
    supabase.from('site_offer_cards').select('*').order('sort_order').order('created_at'),
    supabase.from('site_pages').select('id, title, path').eq('is_published', true).eq('show_in_navbar', true).order('created_at'),
    supabase.from('categories').select('id, name, slug').order('name')
  ])

  return results.map(publicResult)
}, {
  maxAge: 15,
  staleMaxAge: 60,
  swr: true,
  name: 'storefront-content'
})
