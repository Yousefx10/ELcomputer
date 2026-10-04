import { createError } from 'h3'
import { validPublicSlug } from '../../app/utils/seo.js'
import { normalizeBrandPage, brandUrl } from '../../app/utils/brandPage.js'
import { brandPublicSelect } from './brandPages.js'

export const BRAND_PAGE_SIZE = 12
export function brandProductFilters(query = {}) {
  const allowed = ['category', 'status', 'sort', 'page']
  if (Object.entries(query).some(([key, value]) => !allowed.includes(key) || typeof value !== 'string')) throw createError({ statusCode: 400, statusMessage: 'Invalid product filters.' })
  const category = validPublicSlug(query.category) ? query.category : ''
  const status = ['instock', 'unavailable'].includes(query.status) ? query.status : ''
  const sort = ['latest', 'price-asc', 'price-desc', 'popularity', 'average-rating'].includes(query.sort) ? query.sort : 'latest'
  const page = /^[1-9][0-9]{0,5}$/.test(query.page || '') ? Number(query.page) : 1
  return { category, status, sort, page }
}

export async function readStorefrontBrand(client, slug, query = {}) {
  if (!validPublicSlug(slug)) throw createError({ statusCode: 404, statusMessage: 'Brand not found.' })
  const filters = brandProductFilters(query)
  const { data: record, error } = await client.from('brands').select(brandPublicSelect).eq('slug', slug).maybeSingle()
  if (error) throw createError({ statusCode: 503, statusMessage: 'Brand content is unavailable.' })
  if (!record || !record.name?.trim()) throw createError({ statusCode: 404, statusMessage: 'Brand not found.' })
  const brand = { id: record.id, name: record.name, slug: record.slug, logo_url: brandUrl(record.logo_url),
    seo_title: record.seo_title, seo_description: record.seo_description, seo_image_url: brandUrl(record.seo_image_url), brand_page: normalizeBrandPage(record.brand_page) }
  const categoriesResult = await client.from('categories').select('id,name,name_ar,slug').order('name')
  if (categoriesResult.error) throw createError({ statusCode: 503, statusMessage: 'Product filters are unavailable.' })
  const categories = categoriesResult.data || []
  const selectedCategory = categories.find(item => item.slug === filters.category)
  const productsQuery = page => {
    let q = client.from('storefront_products').select(`id,title,slug,description,price,old_price,image_url,stock_quantity,is_serialized,selling_mode,is_featured,is_top_seller,average_rating,
      category:categories(id,name,name_ar,slug),brand:brands(id,name,slug,logo_url)`, { count: 'exact' }).eq('is_published', true).eq('brand_id', brand.id)
    if (filters.category) q = q.eq('category_id', selectedCategory?.id || '00000000-0000-0000-0000-000000000000')
    if (filters.status === 'instock') q = q.gt('stock_quantity', 0)
    if (filters.status === 'unavailable') q = q.eq('stock_quantity', 0)
    const order = { 'price-asc': ['price', true], 'price-desc': ['price', false], popularity: ['popularity_score', false], 'average-rating': ['average_rating', false], latest: ['created_at', false] }[filters.sort]
    return q.order(order[0], { ascending: order[1] }).order('id').range((page - 1) * BRAND_PAGE_SIZE, page * BRAND_PAGE_SIZE - 1)
  }
  let result = await productsQuery(filters.page)
  if (result.error) throw createError({ statusCode: 503, statusMessage: 'Brand products are unavailable.' })
  const total = result.count || 0, pages = Math.max(1, Math.ceil(total / BRAND_PAGE_SIZE)), page = Math.min(filters.page, pages)
  if (page !== filters.page && total) result = await productsQuery(page)
  if (result.error) throw createError({ statusCode: 503, statusMessage: 'Brand products are unavailable.' })
  return { brand, categories, products: result.data || [], total, pages, page, filters }
}
