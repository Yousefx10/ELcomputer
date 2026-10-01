import { createClient } from '@supabase/supabase-js'
import { createError } from 'h3'
import { discoverPublicPages, publicSiteUrl, sitemapXml, seoXmlEscape } from '../../app/utils/seo.js'
import { selectWithSeo } from '../../app/utils/seoQuery.js'
import { publicAiEntries } from '../../app/utils/aiReadiness.js'

export function publicSeoClient(event) {
  const config = useRuntimeConfig(event)
  const url = config.public.supabase?.url || config.public.supabaseUrl
  const key = config.public.supabase?.key
  if (!url || !key) throw createError({ statusCode: 503, statusMessage: 'Public content is unavailable.' })
  return { client: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }), config }
}

export async function readSeoSettings(client) {
  const result = await client.from('site_settings').select('*').eq('key', 'default').maybeSingle()
  if (result.error) throw createError({ statusCode: 503, statusMessage: 'Public settings are unavailable.' })
  return result.data || {}
}

// PostgREST caps each response. Read every page with stable ordering.
export async function readPublicRows(client, table, fields, filters, optional = '') {
  const rows = []
  let offset = 0
  let total = null
  for (;;) {
    const makeQuery = select => {
      let query = client.from(table).select(select, offset === 0 ? { count: 'exact' } : undefined).order('id').range(offset, offset + 999)
      for (const [key, value] of Object.entries(filters)) query = query.eq(key, value)
      return query
    }
    const result = optional ? await selectWithSeo(makeQuery, fields, optional) : await makeQuery(fields)
    if (result.error) throw createError({ statusCode: 503, statusMessage: 'Public sitemap content is unavailable.' })
    if (Number.isInteger(result.count)) total = result.count
    const batch = result.data || []
    rows.push(...batch)
    offset += batch.length
    if (!batch.length || total !== null && offset >= total || total === null && batch.length < 1000) return rows
  }
}

export const readPublicSeoDiscovery = defineCachedFunction(async () => {
  const { client, config } = publicSeoClient()
  const [settings, products, categories, brands, pages, helpCategories, helpArticles] = await Promise.all([
    readSeoSettings(client),
    readPublicRows(client, 'products', 'id,title,slug,category_id,brand_id,is_published', { is_published: true }),
    readPublicRows(client, 'categories', 'id,name,slug', {}),
    readPublicRows(client, 'brands', 'id,name,slug', {}),
    readPublicRows(client, 'site_pages', 'id,title,path,is_published,updated_at', { is_published: true }, 'seo_noindex'),
    readPublicRows(client, 'help_categories', 'id,slug,is_active', { is_active: true }),
    readPublicRows(client, 'help_articles', 'id,title,slug,category_id,status,published_at,updated_at', { status: 'published' })
  ])
  const records = { products, categories, brands, pages, helpCategories, helpArticles }
  const routes = discoverPublicPages(records)
  return { base: publicSiteUrl(settings, config.public.siteUrl), routes, storeName: settings.site_name || 'ELcomputer', aiEntries: publicAiEntries(routes, records) }
}, { name: 'public-seo-discovery', maxAge: 60, swr: false })

// Conservative chunks keep both URL count and XML byte size below sitemap limits.
export const SITEMAP_PAGE_SIZE = 5000
export function sitemapDocument({ base, routes }) {
  if (routes.length <= SITEMAP_PAGE_SIZE) return sitemapXml(routes, base)
  const pages = Math.ceil(routes.length / SITEMAP_PAGE_SIZE)
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Array.from({ length: pages }, (_, i) => `<sitemap><loc>${seoXmlEscape(`${base}/sitemap-pages/${i + 1}.xml`)}</loc></sitemap>`).join('')}</sitemapindex>`
}
