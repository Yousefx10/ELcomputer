import { canonicalUrl, isPrivateSeoPath, robotsText, seoLocalizedPath, seoPlainText, seoText, unlocalizedPath, validCmsPath, validPublicSlug } from './seo.js'
import { visibleProductSpecifications } from './productDetail.js'

// These groups describe documented purposes, not a bot firewall.
export const AI_SEARCH_AGENTS = ['OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User']
export const AI_TRAINING_AGENTS = ['GPTBot', 'ClaudeBot', 'Google-Extended']
const enabled = value => ![false, 'false', '0', 0].includes(value)
export const aiPolicy = config => ({ search: enabled(config?.aiSearchAllowed), training: enabled(config?.aiTrainingAllowed) })

export function aiRobotsText(base, config = {}) {
  const policy = aiPolicy(config)
  const signals = search => `Content-signal: search=${search ? 'yes' : 'no'}, ai-input=${policy.search ? 'yes' : 'no'}, ai-train=${policy.training ? 'yes' : 'no'}`
  const inherited = robotsText(base).split('\n').filter(line => line.startsWith('Disallow:'))
  const privateRules = [...new Set([...inherited, ...['cart', 'checkout', 'login', 'signup', 'support'].flatMap(path => [`Disallow: /${path}`, `Disallow: /ar/${path}`])])]
  // The provider's search signal includes ordinary indexing. Keep it allowed
  // for wildcard/Googlebot; AI-specific search preferences stay scoped.
  return robotsText(base).replace('User-agent: *\n', `User-agent: *\n${signals(true)}\n`) + '\n' + [[AI_SEARCH_AGENTS, policy.search], [AI_TRAINING_AGENTS, policy.training]]
    .map(([agents, allow]) => `${agents.map(agent => `User-agent: ${agent}`).join('\n')}\n${signals(policy.search)}\n${(allow ? privateRules : ['Disallow: /']).join('\n')}\n`).join('\n')
}

// Escape stored copy as data. Authored links/images are not an attachment gateway.
export function aiText(value, limit = 20000) {
  const text = seoText(String(value ?? '').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/(?:https?:\/\/|\/\/)[^\s<>"']+/gi, ' ')
    .replace(/(?:\/(?:ar\/)?(?:account|dashboard|checkout|cart|api|uploads|storage|documents|packing-videos|support)\b)[^\s<>"']*/gi, ' '))
  return Array.from(text).slice(0, limit).join('').replace(/[\\`*_{}\[\]()#!|>~]/g, '\\$&')
}

export function aiBody(value) {
  const source = String(value || '').replace(/\r\n?/g, '\n').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
  const limited = Array.from(source).slice(0, 50000).join('')
  const body = limited.split('\n').map(line => {
    const heading = line.match(/^\s*#{1,6}\s+(.+)$/)
    const item = line.match(/^\s*(?:[-*+] |\d+\. )(.+)$/)
    return heading ? `### ${aiText(heading[1], 500)}` : item ? `- ${aiText(item[1], 5000)}` : aiText(line, 5000)
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim()
  return body + (source !== limited ? '\n\nContent continues on the canonical HTML page.' : '')
}

export function publicAiEntries(routes, records = {}) {
  const { products = [], categories = [], brands = [], pages = [], helpArticles = [], helpCategories = [] } = records
  const entries = []
  for (const route of routes) {
    let kind, title
    if (route.path === '/') { kind = 'store'; title = 'Store overview' }
    else if (route.path === '/help') { kind = 'help-index'; title = 'Help Center' }
    else if (route.path.startsWith('/products/')) { kind = 'product'; title = products.find(item => item.slug === route.path.slice(10) && item.is_published === true)?.title }
    else if (route.path === '/search' && validPublicSlug(route.query?.category)) { kind = 'category'; title = categories.find(item => item.slug === route.query.category)?.name }
    else if (/^\/brand\/[^/]+$/.test(route.path) && validPublicSlug(route.path.slice(7))) { kind = 'brand'; title = brands.find(item => item.slug === route.path.slice(7))?.name }
    else if (route.path === '/search' && validPublicSlug(route.query?.brand)) { kind = 'brand'; title = brands.find(item => item.slug === route.query.brand)?.name }
    else if (route.path.startsWith('/help/')) {
      const [, , category, slug] = route.path.split('/')
      const categoryId = helpCategories.find(item => item.slug === category && item.is_active === true)?.id
      kind = 'help'; title = helpArticles.find(item => item.slug === slug && item.category_id === categoryId && item.status === 'published')?.title
    } else if (validCmsPath(route.path.slice(1))) { kind = 'page'; title = pages.find(item => `/${item.path}` === route.path && item.is_published === true && item.seo_noindex !== true)?.title }
    if (kind && seoPlainText(title) && !isPrivateSeoPath(route.path)) entries.push({ kind, title: seoPlainText(title), path: route.path, query: route.query || {} })
  }
  return entries
}

export function aiMarkdownPath(path, query = {}) {
  path = unlocalizedPath(path)
  if (isPrivateSeoPath(path)) return ''
  if (path === '/') return '/ai/index.md'
  if (path === '/help') return '/ai/help/index.md'
  if (/^\/products\/[^/]+$/.test(path) && validPublicSlug(path.slice(10))) return `/ai${path}.md`
  if (/^\/brand\/[^/]+$/.test(path) && validPublicSlug(path.slice(7))) return `/ai/brands/${path.slice(7)}.md`
  if (path === '/search' && Object.keys(query).length === 1) {
    if (validPublicSlug(query.category)) return `/ai/categories/${query.category}.md`
    if (validPublicSlug(query.brand)) return `/ai/brands/${query.brand}.md`
  }
  if (/^\/help\/[^/]+\/[^/]+$/.test(path) && path.slice(6).split('/').every(validPublicSlug)) return `/ai${path}.md`
  if (validCmsPath(path.slice(1))) return `/ai/pages${path}/index.md`
  return ''
}

export function resolveAiResource(path) {
  const locale = /^\/ar(?:\/|$)/.test(path) ? 'ar' : 'en'
  const clean = unlocalizedPath(path)
  if (clean === '/ai/index.md') return { kind: 'store', path: '/', locale, query: {} }
  if (clean === '/ai/help/index.md') return { kind: 'help-index', path: '/help', locale, query: {} }
  const match = clean.match(/^\/ai\/(products|categories|brands)\/([^/]+)\.md$/)
  if (match && validPublicSlug(match[2])) return { kind: { products: 'product', categories: 'category', brands: 'brand' }[match[1]], slug: match[2], path: match[1] === 'products' ? `/products/${match[2]}` : match[1] === 'brands' ? `/brand/${match[2]}` : '/search', query: match[1] === 'categories' ? { category: match[2] } : {}, locale }
  const help = clean.match(/^\/ai\/help\/([^/]+)\/([^/]+)\.md$/)
  if (help && help.slice(1).every(validPublicSlug)) return { kind: 'help', category: help[1], slug: help[2], path: `/help/${help[1]}/${help[2]}`, query: {}, locale }
  const page = clean.match(/^\/ai\/pages\/(.+)\/index\.md$/)
  if (page && validCmsPath(page[1])) return { kind: 'page', path: `/${page[1]}`, query: {}, locale }
  return null
}

export function aiDiscoveryLinks(seo) {
  if (seo.robots !== 'index,follow') return []
  const canonical = new URL(seo.canonical)
  const query = Object.fromEntries(canonical.searchParams)
  const markdown = aiMarkdownPath(canonical.pathname, query)
  return [{ key: 'ai-describedby', rel: 'describedby', type: 'text/markdown', href: `${canonical.origin}/llms.txt` },
    ...(markdown ? [{ key: 'ai-markdown', rel: 'alternate', type: 'text/markdown', href: canonicalUrl(canonical.origin, markdown, seo.locale) }] : [])]
}

export const aiLinkHeader = links => links.map(link => `<${link.href}>; rel="${link.rel}"; type="text/markdown"`).join(', ')

// Only an explicit Markdown media range opts into negotiation. Browsers and
// generic */* clients retain HTML; equal explicit qualities prefer HTML.
export function prefersAiMarkdown(accept = '') {
  const ranges = String(accept).split(',').map(part => {
    const [type, ...parameters] = part.trim().toLowerCase().split(';').map(value => value.trim())
    const q = parameters.find(value => /^q\s*=/.test(value))?.split('=')[1]?.trim()
    return { type, quality: q === undefined ? 1 : /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(q) ? Number(q) : 0 }
  })
  const markdown = Math.max(0, ...ranges.filter(item => item.type === 'text/markdown').map(item => item.quality))
  if (!markdown) return false
  for (const type of ['text/html', 'text/*', '*/*']) {
    const matches = ranges.filter(item => item.type === type)
    if (matches.length) {
      const html = Math.max(...matches.map(item => item.quality))
      return markdown > html || markdown === html && type !== 'text/html'
    }
  }
  return true
}

export function aiHtmlResource(path, query = {}, queryKeys = Object.keys(query)) {
  const locale = /^\/ar(?:\/|$)/.test(path) ? 'ar' : 'en'
  const clean = unlocalizedPath(path)
  let identity = {}
  if (clean === '/search') {
    const keys = ['category', 'brand'].filter(key => validPublicSlug(query[key]))
    if (keys.length !== 1) return null
    identity = { [keys[0]]: query[keys[0]] }
  }
  const markdown = aiMarkdownPath(clean, identity)
  if (!markdown) return null
  return {
    resource: resolveAiResource(seoLocalizedPath(markdown, locale)),
    invalidQuery: queryKeys.some(key => !Object.hasOwn(identity, key))
  }
}

const link = (title, url) => `[${aiText(title, 120)}](${url})`
export function llmsText({ base, storeName = 'ELcomputer', entries = [] }) {
  const groups = [['Store', ['store']], ['Products', ['product']], ['Categories', ['category']], ['Brands', ['brand']], ['Customer Information', ['page']], ['Help', ['help-index', 'help']]]
  const output = [`# ${aiText(storeName, 100)}`, '', `> ${aiText(storeName, 100)} sells computers and electronics online in Egypt.`, '',
    'English is the default interface. Arabic interfaces use /ar. Authored content retains its saved language.',
    'Use canonical HTML URLs when citing pages. Prices and availability can change; check the current product page.', '']
  for (const [heading, kinds] of groups) {
    const items = entries.filter(item => kinds.includes(item.kind)).slice(0, heading === 'Products' ? 8 : 20)
    if (!items.length) continue
    output.push(`## ${heading}`, '')
    for (const item of items) {
      const markdown = aiMarkdownPath(item.path, item.query)
      if (markdown) output.push(`- ${link(item.title, canonicalUrl(base, markdown))}: HTML ${link('canonical page', canonicalUrl(base, item.path, 'en', item.query))}.`)
    }
    output.push('')
  }
  output.push('## Optional', '', `- ${link('Arabic store overview', canonicalUrl(base, '/ai/index.md', 'ar'))}: Arabic interface; authored content is unchanged.`, `- ${link('Public sitemap', `${base}/sitemap.xml`)}: Complete public HTML URL index; this guide contains a bounded selection.`, '')
  return output.join('\n')
}

export function productAiAvailability(product, settings = {}, availability = null) {
  if (product.selling_mode === 'coming_soon') return 'Coming soon; not currently purchasable'
  const variants = (product.variants || []).filter(item => item.is_active === true)
  if (product.is_serialized && !variants.length) return 'Options unavailable; not currently purchasable'
  if (product.selling_mode === 'preorder') return availability?.available === true ? 'Preorder; not immediate stock' : 'Preorder unavailable'
  const stock = product.is_serialized ? variants.reduce((sum, item) => sum + Math.max(0, Number(item.stock_quantity) || 0), 0) : Math.max(0, Number(product.stock_quantity) || 0)
  return stock > 0 ? 'In stock' : settings.allow_out_of_stock_purchases === true ? 'Backorder' : 'Out of stock'
}

export function productAiMarkdown(product, { base, locale = 'en', settings = {}, availability = null } = {}) {
  const lines = [`# ${aiText(product.title, 500)}`, '']
  if (product.brand?.name) lines.push(`Brand: ${aiText(product.brand.name, 500)}`)
  if (product.sku) lines.push(`SKU: ${aiText(product.sku, 500)}`)
  if (product.price != null && product.price !== '' && Number.isFinite(Number(product.price)) && Number(product.price) >= 0) lines.push(`Price: ${Number(product.price)} EGP`)
  lines.push(`Availability: ${productAiAvailability(product, settings, availability)}`)
  if (product.expected_availability_date && /^\d{4}-\d{2}-\d{2}/.test(product.expected_availability_date)) lines.push(`Expected availability: ${aiText(product.expected_availability_date, 100)}`)
  if (product.availability_message) lines.push(`Availability note: ${aiText(product.availability_message, 2000)}`)
  const description = product.long_description || product.description
  if (description) lines.push('', '## Description', '', aiBody(description))
  const specifications = visibleProductSpecifications(product.specifications || []).slice(0, 100)
  if (specifications.length) lines.push('', '## Specifications', '', ...specifications.map(item => `- ${aiText(item.label, 300)}: ${aiText(item.value, 1000)}`))
  const features = (product.features || []).filter(item => seoPlainText(item.body)).slice(0, 50)
  if (features.length) lines.push('', '## Features', '', ...features.map(item => `- ${aiText(item.body, 1000)}`))
  if (Number.isInteger(product.reviewCount) && product.reviewCount > 0 && Number(product.reviewAverage) >= 1 && Number(product.reviewAverage) <= 5) lines.push('', '## Reviews', '', `Public aggregate: ${Number(product.reviewAverage)} / 5 (${product.reviewCount} reviews).`)
  return finishAiMarkdown(lines, canonicalUrl(base, `/products/${product.slug}`, locale), locale)
}

export function finishAiMarkdown(lines, canonical, locale) {
  return [...lines, '', '## URL', '', canonical, '', `Interface locale: ${locale}. Authored content retains its saved language.`, ''].join('\n')
}
