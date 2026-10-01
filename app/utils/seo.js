// Shared by SSR pages, dashboard previews and public discovery. No browser dependencies.
export const DEFAULT_SITE_URL = 'https://new.elcomputer.net'
export const SEO_FIELDS = ['seo_title', 'seo_description', 'seo_image_url']
const PRIVATE_ROOTS = new Set(['account', 'dashboard', 'cart', 'checkout', 'login', 'signup', 'support', 'api', 'uploads', '_nuxt'])
const RESERVED_ROOTS = new Set([...PRIVATE_ROOTS, 'ar', 'products', 'search', 'reviews', 'help', 'robots.txt', 'sitemap.xml', 'sitemap-pages'])
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function seoPlainText(value) {
  return String(value ?? '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, ' ')
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g, token => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' })[token])
    .replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function seoText(value) {
  return seoPlainText(value).replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(^|\s)#{1,6}\s+/g, '$1')
    .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '$2')
    .replace(/(^|\s)[*_](\S(?:[\s\S]*?\S)?)[*_](?=\s|[.,!?;:]|$)/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1').replace(/\s+/g, ' ').trim()
}

export function seoExcerpt(value, limit = 160, markdown = true) {
  const text = markdown ? seoText(value) : seoPlainText(value)
  if (text.length <= limit) return text
  const start = text.slice(0, limit - 1)
  const space = start.lastIndexOf(' ')
  return `${space > limit * 0.6 ? start.slice(0, space) : start}…`
}

export function publicSiteUrl(settings = {}, fallback = DEFAULT_SITE_URL) {
  for (const value of [settings.seo_site_url, fallback, DEFAULT_SITE_URL]) {
    try {
      const url = new URL(value)
      if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash) return url.origin
    } catch { /* Invalid saved URL falls back to the configured origin. */ }
  }
  return DEFAULT_SITE_URL
}

export function seoImage(value, base) {
  if (!value || (!/^https?:\/\//i.test(value) && !/^\/(?!\/)/.test(value))) return ''
  try {
    const url = new URL(value, base)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''
  } catch { return '' }
}

export function unlocalizedPath(path = '/') {
  return (String(path).split(/[?#]/)[0].replace(/^\/ar(?=\/|$)/, '') || '/').replace(/\/$/, '') || '/'
}
export const seoLocalizedPath = (path, locale) => locale === 'ar' ? `/ar${unlocalizedPath(path) === '/' ? '' : unlocalizedPath(path)}` : unlocalizedPath(path)
export const isPrivateSeoPath = path => PRIVATE_ROOTS.has(unlocalizedPath(path).split('/')[1])
export const privateSeoLabel = path => ({ account: 'My Account', dashboard: 'Dashboard', cart: 'Cart', checkout: 'Checkout', login: 'Login', signup: 'Sign Up' })[unlocalizedPath(path).split('/')[1]] || 'Page'
export const validPublicSlug = value => typeof value === 'string' && value.length <= 200 && SLUG.test(value)
export const validCmsPath = value => typeof value === 'string' && value.length <= 160 && value.split('/').every(validPublicSlug) && !RESERVED_ROOTS.has(value.split('/')[0])

export function canonicalUrl(base, path, locale = 'en', query = {}) {
  const url = new URL('/' + seoLocalizedPath(path, locale).replace(/^\/+/, '').replace(/\\/g, '%5C'), base)
  // Callers pass only deliberate identity parameters; never copy route.query.
  for (const [key, value] of Object.entries(query)) if (value !== '' && value != null) url.searchParams.set(key, String(value))
  return url.href
}

export function seoTitle(title, store) {
  const name = seoExcerpt(store || 'ELcomputer', 70, false)
  let text = seoPlainText(title) || name
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  text = text.replace(new RegExp(`(?:\\s*[|–—-]\\s*${escaped})+$`, 'i'), '').trim()
  if (text.toLowerCase() === name.toLowerCase()) return name
  return `${seoExcerpt(text, Math.max(35, 100 - name.length - 3), false)} | ${name}`
}

export function buildSeo({ settings = {}, siteUrl, path = '/', locale = 'en', title, description, image, index = true, query = {}, type = 'website', structuredData = [], privateTitle } = {}) {
  const base = publicSiteUrl(settings, siteUrl)
  const store = seoText(settings.site_name) || 'ELcomputer'
  const privatePath = isPrivateSeoPath(path)
  const canonical = canonicalUrl(base, privatePath ? '/' + unlocalizedPath(path).split('/')[1] : path, locale, privatePath ? {} : query)
  const allowed = index && !isPrivateSeoPath(path)
  const text = seoExcerpt(seoText(description) || seoText(settings.seo_default_description) || (locale === 'ar' ? `تصفح منتجات ${store} وأسعارها وتوفرها.` : `Browse ${store} products, prices, and availability.`))
  return {
    title: seoTitle(privatePath ? privateTitle || privateSeoLabel(path) : title || settings.seo_site_title || settings.landing_page_title || store, store),
    description: text, canonical, locale, store, type,
    image: seoImage(image, base) || seoImage(settings.seo_social_image_url, base),
    robots: allowed ? 'index,follow' : 'noindex,follow',
    alternates: allowed ? ['en', 'ar', 'x-default'].map(lang => ({ lang, href: canonicalUrl(base, path, lang === 'ar' ? 'ar' : 'en', query) })) : [],
    structuredData: allowed ? structuredData : []
  }
}

export function jsonLdString(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}

export function seoHead(seo) {
  const meta = (property, content) => ({ key: property, property, content })
  return {
    title: seo.title,
    meta: [
      { key: 'description', name: 'description', content: seo.description },
      { key: 'robots', name: 'robots', content: seo.robots },
      meta('og:title', seo.title), meta('og:description', seo.description), meta('og:url', seo.canonical), meta('og:type', seo.type), meta('og:site_name', seo.store),
      meta('og:locale', seo.locale === 'ar' ? 'ar_EG' : 'en_US'), meta('og:locale:alternate', seo.locale === 'ar' ? 'en_US' : 'ar_EG'),
      ...(seo.image ? [{ key: 'og:image', property: 'og:image', content: seo.image }] : []),
      { key: 'twitter:card', name: 'twitter:card', content: seo.image ? 'summary_large_image' : 'summary' },
      { key: 'twitter:title', name: 'twitter:title', content: seo.title },
      { key: 'twitter:description', name: 'twitter:description', content: seo.description },
      ...(seo.image ? [{ key: 'twitter:image', name: 'twitter:image', content: seo.image }] : [])
    ],
    link: [{ key: 'canonical', rel: 'canonical', href: seo.canonical }, ...seo.alternates.map(item => ({ key: `locale-${item.lang}`, rel: 'alternate', hreflang: item.lang, href: item.href }))],
    script: seo.structuredData.length ? [{ key: 'public-schema', type: 'application/ld+json', innerHTML: jsonLdString({ '@context': 'https://schema.org', '@graph': seo.structuredData }) }] : []
  }
}

export function breadcrumbs(items, base, locale) {
  return { '@type': 'BreadcrumbList', itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: seoText(item.name), item: canonicalUrl(base, item.path, locale, item.query) })) }
}

export function siteSchema(settings, base) {
  const name = seoText(settings.site_name) || 'ELcomputer'
  const logo = seoImage(settings.site_logo_light_url || settings.site_logo_url, base)
  return [
    { '@type': 'Organization', '@id': `${base}/#organization`, name, url: `${base}/`, ...(logo ? { logo } : {}) },
    { '@type': 'WebSite', '@id': `${base}/#website`, name, url: `${base}/`, publisher: { '@id': `${base}/#organization` } }
  ]
}

export function catalogSeoFields(record = {}, settings = {}, locale = 'en') {
  const store = seoText(settings.site_name) || 'ELcomputer'
  const name = seoText(record.name)
  return { title: record.seo_title || name,
    description: record.seo_description || settings.seo_default_description || (name ? locale === 'ar' ? `تصفح منتجات ${name} لدى ${store}.` : `Browse ${name} products at ${store}.` : ''),
    image: record.seo_image_url || record.image_url || record.logo_url }
}

export function productSeoFields(product = {}) {
  return { title: product.seo_title || product.title, description: product.seo_description || product.description || product.long_description, image: product.seo_image_url || product.image_url }
}

export function productSchema(product, base, locale, availability = null, settings = {}) {
  if (!product || product.is_published !== true || !validPublicSlug(product.slug) || !seoText(product.title)) return null
  const url = canonicalUrl(base, `/products/${product.slug}`, locale)
  const image = seoImage(product.image_url, base)
  const description = seoExcerpt(product.description || product.long_description, 5000)
  const brand = seoPlainText(product.brand?.name)
  const schema = { '@type': 'Product', '@id': `${url}#product`, name: seoPlainText(product.title), url,
    ...(image ? { image: [image] } : {}), ...(description ? { description } : {}),
    ...(String(product.sku || '').trim() ? { sku: String(product.sku).trim() } : {}), ...(brand ? { brand: { '@type': 'Brand', name: brand } } : {}) }
  // Coming Soon cannot be purchased. No offer until purchasing is available.
  // Preorder availability comes from the same authoritative RPC used by the page.
  const canOffer = product.selling_mode !== 'coming_soon' && (product.selling_mode !== 'preorder' || availability?.available === true)
  const price = product.price
  if (canOffer && price != null && price !== '' && Number.isFinite(Number(price)) && Number(price) >= 0) {
    const variants = (product.variants || []).filter(variant => variant.is_active === true)
    const stock = product.is_serialized ? variants.reduce((sum, variant) => sum + Math.max(0, Number(variant.stock_quantity) || 0), 0) : Math.max(0, Number(product.stock_quantity) || 0)
    schema.offers = { '@type': 'Offer', url, price: Number(price), priceCurrency: 'EGP', availability: `https://schema.org/${product.selling_mode === 'preorder' ? 'PreOrder' : stock > 0 ? 'InStock' : !product.is_serialized && settings.allow_out_of_stock_purchases === true ? 'BackOrder' : 'OutOfStock'}` }
  }
  if (Number.isInteger(product.reviewCount) && product.reviewCount > 0 && Number(product.reviewAverage) >= 1 && Number(product.reviewAverage) <= 5) {
    schema.aggregateRating = { '@type': 'AggregateRating', ratingValue: Number(product.reviewAverage), reviewCount: product.reviewCount, bestRating: 5, worstRating: 1 }
  }
  return schema
}

export function searchSeoPolicy(query = {}, categories = [], brands = [], totalCount = 0) {
  const category = categories.find(item => item.slug === query.category && validPublicSlug(item.slug))
  const brand = brands.find(item => item.slug === query.brand && validPublicSlug(item.slug))
  const identity = category && !query.brand ? { category: category.slug } : brand && !query.category ? { brand: brand.slug } : {}
  const record = identity.category ? category : identity.brand ? brand : null
  const extra = Object.keys(query).some(key => !['category', 'brand', 'page'].includes(key) && !/^(utm_.+|gclid|fbclid|msclkid)$/.test(key))
  const page = typeof query.page === 'string' && /^[1-9]\d*$/.test(query.page) ? Number(query.page) : 1
  return { record, query: { ...identity, ...(record && page > 1 ? { page } : {}) }, index: Boolean(record && !extra && page === 1 && Number(totalCount) > 0) }
}

export function discoverPublicPages({ products = [], categories = [], brands = [], pages = [], helpCategories = [], helpArticles = [] } = {}) {
  const published = products.filter(item => item.is_published === true && validPublicSlug(item.slug) && seoText(item.title))
  const categoryIds = new Set(published.map(item => item.category_id))
  const brandIds = new Set(published.map(item => item.brand_id))
  const routes = [{ path: '/' }, { path: '/help' }, { path: '/reviews' }]
  published.forEach(item => routes.push({ path: `/products/${item.slug}`, updated: item.updated_at }))
  categories.filter(item => categoryIds.has(item.id) && validPublicSlug(item.slug) && seoText(item.name)).forEach(item => routes.push({ path: '/search', query: { category: item.slug } }))
  brands.filter(item => brandIds.has(item.id) && validPublicSlug(item.slug) && seoText(item.name)).forEach(item => routes.push({ path: '/search', query: { brand: item.slug } }))
  pages.filter(item => item.is_published === true && item.seo_noindex !== true && validCmsPath(item.path)).forEach(item => routes.push({ path: `/${item.path}`, updated: item.updated_at }))
  helpArticles.filter(item => item.status === 'published' && validPublicSlug(item.slug)).forEach(item => {
    const category = helpCategories.find(category => category.id === item.category_id && category.is_active === true && validPublicSlug(category.slug))
    if (category) routes.push({ path: `/help/${category.slug}/${item.slug}`, updated: item.updated_at || item.published_at })
  })
  return routes.filter((item, i, all) => all.findIndex(other => other.path === item.path && JSON.stringify(other.query) === JSON.stringify(item.query)) === i)
}

export const seoXmlEscape = value => String(value).replace(/[<>&"']/g, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character])
export function sitemapXml(routes, base) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${routes.flatMap(route => ['en', 'ar'].map(locale => {
    const lastmod = route.updated && Number.isFinite(Date.parse(route.updated)) ? `<lastmod>${new Date(route.updated).toISOString()}</lastmod>` : ''
    return `<url><loc>${seoXmlEscape(canonicalUrl(base, route.path, locale, route.query))}</loc>${lastmod}${['en', 'ar', 'x-default'].map(lang => `<xhtml:link rel="alternate" hreflang="${lang}" href="${seoXmlEscape(canonicalUrl(base, route.path, lang === 'ar' ? 'ar' : 'en', route.query))}"/>`).join('')}</url>`
  })).join('')}</urlset>`
}

export function robotsText(base) {
  // Allow crawling of UI pages so crawlers can see noindex. Authentication protects private data.
  return `User-agent: *\n${['/api/', '/uploads/', '/dashboard', '/account', '/ar/dashboard', '/ar/account'].map(path => `Disallow: ${path}\n`).join('')}\nSitemap: ${base}/sitemap.xml\n`
}
