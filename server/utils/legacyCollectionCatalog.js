import { createError } from 'h3'
import { publicSeoClient, readPublicRows } from './publicSeo.js'
import { normalizePriceRange } from '../../app/utils/catalogListing.js'
import { categoryMatchesSearch } from '../../app/utils/categoryLocale.js'
export async function legacyCollectionCount(event, query) {
  const { client } = publicSeoClient(event), signal = event.context.legacyCollectionSignal || AbortSignal.timeout(5000)
  const [categories, brands] = await Promise.all([
    readPublicRows(client, 'categories', 'id,name,name_ar,slug', {}, '', { signal }),
    readPublicRows(client, 'brands', 'id,name,slug', {}, '', { signal })
  ])
  const category = categories.find(c => c.slug === query.category), brand = brands.find(b => b.slug === query.brand)
  if (query.category && !category || query.brand && !brand) return 0
  let request = client.from('storefront_products').select('id', { count: 'exact', head: true }).eq('is_published', true).abortSignal(signal)
  if (category) request = request.eq('category_id', category.id)
  if (brand) request = request.eq('brand_id', brand.id)
  if (query.status === 'instock') request = request.gt('stock_quantity', 0)
  if (query.status === 'unavailable') request = request.eq('stock_quantity', 0)
  if (query.q) {
    const term = query.q.toLocaleLowerCase()
    request = request.or([`title.ilike.%${query.q}%`, `description.ilike.%${query.q}%`, `long_description.ilike.%${query.q}%`, `sku.ilike.%${query.q}%`, ...categories.filter(c => categoryMatchesSearch(c, term)).map(c => `category_id.eq.${c.id}`), ...brands.filter(b => b.name.toLocaleLowerCase().includes(term)).map(b => `brand_id.eq.${b.id}`)].join(','))
  }
  if (query.min != null || query.max != null) {
    const bounds = await Promise.all([true, false].map(ascending => client.from('storefront_products').select('price').eq('is_published', true).order('price', { ascending }).limit(1).abortSignal(signal).maybeSingle()))
    if (bounds.some(r => r.error)) throw createError({ statusCode: 503, statusMessage: 'Public content is unavailable.' })
    const range = normalizePriceRange(query.min, query.max, { min: Number(bounds[0].data?.price || 0), max: Number(bounds[1].data?.price || 0) })
    if (query.min != null) request = request.gte('price', range.minPrice)
    if (query.max != null) request = request.lte('price', range.maxPrice)
  }
  const result = await request
  if (result.error || !Number.isInteger(result.count)) throw createError({ statusCode: 503, statusMessage: 'Public content is unavailable.' })
  return result.count
}
