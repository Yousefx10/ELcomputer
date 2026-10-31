import { catalogPage, catalogPageExists, normalizeSearchTerm } from '../../app/utils/catalogListing.js'
import { validPublicSlug } from '../../app/utils/seo.js'
const tracking = key => /^(utm_[a-z0-9_]{1,40}|gclid|fbclid|msclkid)$/i.test(key)
const sort = new Set(['relevance', 'popularity', 'average-rating', 'latest', 'price-asc', 'price-desc'])
const oldSort = { date: 'latest', price: 'price-asc', 'price-desc': 'price-desc', popularity: 'popularity', rating: 'average-rating', relevance: 'relevance' }
const aliases = { paged: 'page', 'product-page': 'page', s: 'q', min_price: 'min', max_price: 'max' }
export function legacyCollectionIntent(raw, method = 'GET') {
  if (!['GET', 'HEAD'].includes(method) || typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null
  if (/^\/(?:ar\/)?(?:shop|product-category)(?:\/|\?|$)/.test(raw) && /%(?:2e|2f|5c)|\/\.\.?(?:\/|$)/i.test(raw.split('?')[0])) return { invalid: true }
  const url = new URL(raw, 'http://legacy.invalid'), localized = url.pathname.startsWith('/ar/') || url.pathname === '/ar', path = url.pathname.replace(/^\/ar(?=\/|$)/, '')
  const match = path.match(/^\/(shop|product-category\/([^/]+))(?:\/page\/([^/]+))?\/?$/)
  if (!match) return /^(\/shop\/|\/product-category\/)/.test(path) ? { invalid: true } : null
  const kind = match[1] === 'shop' ? 'shop' : 'category', slug = match[2], query = {}, seen = new Set()
  let invalid = raw.length > 4096 || kind === 'category' && !validPublicSlug(slug) || [...url.searchParams].length > 32
  for (const [original, value] of url.searchParams) {
    const key = aliases[original] || original
    if (seen.has(key) || value.length > 256 || /[\x00-\x1f\x7f]/.test(value)) { invalid = true; continue }
    seen.add(key)
    if (key === 'post_type' && value === 'product') continue
    if (key === 'orderby') { if (!oldSort[value] || seen.has('sort')) invalid = true; else { query.sort = oldSort[value]; seen.add('sort') } }
    else if (tracking(key)) query[key] = value
    else if (['page', 'category', 'brand', 'q', 'sort', 'status', 'min', 'max'].includes(key)) query[key] = value
    else invalid = true
  }
  if (kind === 'category') { if (query.category && query.category !== slug) invalid = true; query.category = slug }
  if (query.category && !validPublicSlug(query.category) || query.brand && !validPublicSlug(query.brand)) invalid = true
  if (query.sort && !sort.has(query.sort) || query.status && !['instock', 'unavailable'].includes(query.status)) invalid = true
  if (query.q != null) { query.q = normalizeSearchTerm(query.q); if (!query.q || query.q.length > 120) invalid = true }
  for (const key of ['min', 'max']) if (query[key] != null && (!/^\d+(?:\.\d{1,2})?$/.test(query[key]) || !Number.isFinite(Number(query[key])))) invalid = true
  if (query.min != null && query.max != null && Number(query.min) > Number(query.max)) invalid = true
  const pathPage = match[3] == null ? null : catalogPage(match[3]), page = catalogPage(query.page ?? match[3])
  if (!page || match[3] != null && (!pathPage || query.page != null && page !== pathPage)) invalid = true
  if (page > 1) query.page = String(page); else delete query.page
  const filtered = Object.keys(query).some(key => key !== 'page' && !tracking(key))
  const destination = kind === 'shop' && !filtered ? '/shop' : query.brand && !query.category && Object.keys(query).every(key => ['brand', 'page'].includes(key) || tracking(key)) ? '/brand/'+query.brand : '/search'
  const output = new URLSearchParams()
  for (const key of ['category', 'brand', 'q', 'min', 'max', 'sort', 'status', 'page', ...Object.keys(query).filter(tracking).sort()]) if (query[key] != null && !(destination.startsWith('/brand/') && key === 'brand')) output.set(key, query[key])
  const target = (localized ? '/ar' : '') + destination + (output.size ? '?'+output.toString() : '')
  return { kind, slug, query, page, invalid: Boolean(invalid), target, canonical: kind === 'shop' && path === '/shop' && !filtered && url.pathname + url.search === target }
}
export async function resolveLegacyCollection(intent, readCount) {
  if (intent.invalid) return { status: 404 }
  if (intent.canonical) return { status: 200 }
  const count = await readCount(intent.query)
  if (count == null || !Number.isInteger(count) || count < 0) return { status: 503 }
  if (count === 0 || !catalogPageExists(intent.page, count)) return { status: 404 }
  return { status: 301, location: intent.target }
}
