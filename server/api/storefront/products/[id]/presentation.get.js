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
  return withMemberImages(client, data)
})

// Linked choices show each product's own main photo. A failed lookup keeps text choices.
async function withMemberImages(client, data) {
  const members = Array.isArray(data?.family?.members) ? data.family.members : []
  const ids = members.map(row => row?.product_id).filter(id => typeof id === 'string').slice(0, 32)
  if (!ids.length) return data
  const { data: rows, error } = await client.from('storefront_products').select('id,image_url')
    .in('id', ids).eq('is_published', true).abortSignal(AbortSignal.timeout(6000))
  if (error || !Array.isArray(rows)) return data
  const images = new Map(rows.filter(row => typeof row.image_url === 'string' && row.image_url).map(row => [row.id, row.image_url]))
  return { ...data, family: { ...data.family, members: members.map(row => images.has(row.product_id) ? { ...row, image_url: images.get(row.product_id) } : row) } }
}
