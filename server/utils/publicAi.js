import { createError, getRequestURL, setHeader, setResponseStatus } from 'h3'
import { aiBody, aiMarkdownPath, aiText, finishAiMarkdown, llmsText, productAiMarkdown, resolveAiResource } from '../../app/utils/aiReadiness.js'
import { canonicalUrl, seoPlainText, validPublicSlug } from '../../app/utils/seo.js'
import { publicSeoClient, readPublicSeoDiscovery, readSeoSettings } from './publicSeo.js'

const missing = () => createError({ statusCode: 404, statusMessage: 'Public resource not found.' })
const unavailable = () => createError({ statusCode: 503, statusMessage: 'Public content is unavailable.' })

// Nitro's generic error renderer replaces Cache-Control. Keep these public
// resource failures explicitly uncacheable, with no stack or database details.
export const publicAiHandler = handler => async event => {
  try { return await handler(event) } catch (error) {
    const status = [400, 404, 503].includes(error?.statusCode) ? error.statusCode : 503
    const message = status === 400 ? 'Query parameters are not supported.' : status === 404 ? 'Public resource not found.' : 'Public content is unavailable.'
    setResponseStatus(event, status)
    setHeader(event, 'Cache-Control', 'no-store')
    setHeader(event, 'Content-Type', 'application/json; charset=utf-8')
    setHeader(event, 'X-Content-Type-Options', 'nosniff')
    return { error: true, statusCode: status, message }
  }
}
async function one(query) {
  const { data, error } = await query.maybeSingle()
  if (error) throw unavailable()
  if (!data) throw missing()
  return data
}
async function many(query) {
  const { data, error, count } = await query
  if (error) throw unavailable()
  return { rows: data || [], count }
}
const byPosition = rows => [...(rows || [])].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))

// Public anon projections only. The existing preorder API supplies its public RPC result.
export async function readAiProduct(client, slug, fetchPreorder, fetchReviews) {
  const product = await one(client.from('products').select(`
    id,title,slug,description,long_description,price,sku,is_published,is_serialized,
    stock_quantity,selling_mode,expected_availability_date,availability_message,average_rating,
    brand:brands(name),
    specifications:product_specifications(label,value,sort_order),
    features:product_features(body,sort_order),
    variants:product_variants(name,sku,stock_quantity,is_active,color_name)
  `).eq('slug', slug).eq('is_published', true))
  // Reviews are not directly readable by anon in production. Reuse the public
  // review endpoint, retaining only its count and never its items/identities.
  product.reviewCount = null
  if (fetchReviews) {
    try {
      const result = await fetchReviews(product.id)
      if (Number.isInteger(result?.total) && result.total >= 0) product.reviewCount = result.total
    } catch { /* Optional aggregate stays absent when unavailable. */ }
  }
  product.reviewAverage = Number(product.average_rating || 0)
  product.specifications = byPosition(product.specifications)
  product.features = byPosition(product.features)
  let availability = null
  if (product.selling_mode === 'preorder') {
    try {
      const result = await fetchPreorder(product.id)
      if (typeof result?.available !== 'boolean') throw unavailable()
      availability = { available: result.available }
    } catch { throw unavailable() }
  }
  return { product, availability }
}

async function publicCatalog(client, resource) {
  const category = resource.kind === 'category'
  const record = await one(client.from(category ? 'categories' : 'brands').select('id,name,slug').eq('slug', resource.slug))
  const { rows, count } = await many(client.from('products').select('title,slug,price,selling_mode', { count: 'exact' })
    .eq(category ? 'category_id' : 'brand_id', record.id).eq('is_published', true).order('title').limit(25))
  const publicRows = rows.filter(item => validPublicSlug(item.slug) && seoPlainText(item.title))
  if (!publicRows.length || !String(record.name || '').trim()) throw missing()
  return { record, rows: publicRows, count }
}

export async function publicAiMarkdown(client, resource, discovery, settings, fetchPreorder, fetchReviews) {
  const { base } = discovery
  const canonical = canonicalUrl(base, resource.path, resource.locale, resource.query)
  let lines
  if (resource.kind === 'product') {
    const { product, availability } = await readAiProduct(client, resource.slug, fetchPreorder, fetchReviews)
    return productAiMarkdown(product, { base, locale: resource.locale, settings, availability })
  }
  if (resource.kind === 'page') {
    const page = await one(client.from('site_pages').select('title,content_markdown,path,is_published,seo_noindex')
      .eq('path', resource.path.slice(1)).eq('is_published', true).eq('seo_noindex', false))
    lines = [`# ${aiText(page.title, 500)}`, '', aiBody(page.content_markdown)]
  } else if (resource.kind === 'help') {
    const category = await one(client.from('help_categories').select('id,name,slug,is_active').eq('slug', resource.category).eq('is_active', true))
    const article = await one(client.from('help_articles').select('title,summary,content_markdown,status').eq('slug', resource.slug).eq('category_id', category.id).eq('status', 'published'))
    lines = [`# ${aiText(article.title, 500)}`, '', ...(article.summary ? [aiText(article.summary, 5000), ''] : []), aiBody(article.content_markdown)]
  } else if (resource.kind === 'category' || resource.kind === 'brand') {
    const { record, rows, count } = await publicCatalog(client, resource)
    lines = [`# ${aiText(record.name, 500)}`, '', `Published products: ${count ?? rows.length}.`, '', '## Products', '', ...rows.map(item => {
      const markdown = canonicalUrl(base, aiMarkdownPath(`/products/${item.slug}`), resource.locale)
      return `- [${aiText(item.title, 120)}](${markdown})`
    }), '', 'This list contains up to 25 products. Open each product for current prices and availability.']
  } else {
    const store = resource.kind === 'store'
    const entries = discovery.aiEntries.filter(item => store ? ['category', 'brand', 'page', 'help-index'].includes(item.kind) : item.kind === 'help').slice(0, 60)
    lines = [`# ${store ? aiText(discovery.storeName, 100) : 'Help Center'}`, '',
      ...(store ? [`${aiText(discovery.storeName, 100)} sells computers and electronics online in Egypt.`, ''] : []),
      '## Public information', '', ...entries.map(item => `- [${aiText(item.title, 120)}](${canonicalUrl(base, aiMarkdownPath(item.path, item.query), resource.locale)})`)]
  }
  return finishAiMarkdown(lines, canonical, resource.locale)
}

export async function serveAiMarkdown(event) {
  // Invalid requests and failures must not be cached as authoritative resources.
  setHeader(event, 'Cache-Control', 'no-store')
  const resource = resolveAiResource(getRequestURL(event).pathname)
  if (!resource) throw missing()
  if (getRequestURL(event).search) throw createError({ statusCode: 400, statusMessage: 'Query parameters are not supported.' })
  return servePublicAiResource(event, resource)
}

// Explicit URLs and HTML negotiation use this exact same reader/renderer.
export async function servePublicAiResource(event, resource) {
  setHeader(event, 'Cache-Control', 'no-store')
  const discovery = await readPublicSeoDiscovery()
  const { client } = publicSeoClient(event)
  const settings = await readSeoSettings(client)
  // Global Nitro fetch deliberately avoids forwarding visitor auth/cookies or
  // event context to these public APIs (event.$fetch would forward them).
  const markdown = await publicAiMarkdown(client, resource, discovery, settings,
    id => $fetch(`/api/preorders/${id}`),
    id => $fetch('/api/product-reviews', { query: { productId: id, pageSize: 1 } }))
  setHeader(event, 'Content-Type', 'text/markdown; charset=utf-8')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'X-Robots-Tag', 'noindex,follow')
  setHeader(event, 'Link', `<${canonicalUrl(discovery.base, resource.path, resource.locale, resource.query)}>; rel="canonical", <${discovery.base}/llms.txt>; rel="describedby"; type="text/markdown"`)
  // Product prices, stock and preorder cutoffs are live. Stable bodies use the SEO TTL.
  if (resource.kind !== 'product') setHeader(event, 'Cache-Control', 'public, max-age=60')
  return markdown
}

export async function serveLlms(event) {
  setHeader(event, 'Cache-Control', 'no-store')
  if (getRequestURL(event).search) throw createError({ statusCode: 400, statusMessage: 'Query parameters are not supported.' })
  const discovery = await readPublicSeoDiscovery()
  setHeader(event, 'Content-Type', 'text/markdown; charset=utf-8')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'Cache-Control', 'public, max-age=60')
  return llmsText({ base: discovery.base, storeName: discovery.storeName, entries: discovery.aiEntries })
}
