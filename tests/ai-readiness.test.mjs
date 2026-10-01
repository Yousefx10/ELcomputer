import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { aiBody, aiDiscoveryLinks, aiMarkdownPath, aiPolicy, aiRobotsText, aiText, llmsText, productAiAvailability, productAiMarkdown, publicAiEntries, resolveAiResource } from '../app/utils/aiReadiness.js'
import { buildSeo, discoverPublicPages, productSchema, robotsText, seoHead, sitemapXml } from '../app/utils/seo.js'

const base = 'https://store.example'
const privateValues = { customer_name: 'PRIVATE_CUSTOMER_NAME', customer_email: 'private-customer@example.test', customer_phone: 'PRIVATE_PHONE_01011112222', customer_address: 'PRIVATE_ADDRESS', order_id: 'PRIVATE_ORDER_321', support_message: 'PRIVATE_SUPPORT', chat_body: 'PRIVATE_CHAT', employee: 'PRIVATE_EMPLOYEE', admin_user: 'PRIVATE_ADMIN', internal_notes: 'PRIVATE_NOTES', cost_price: 'PRIVATE_COST_991', supplier_cost: 'PRIVATE_SUPPLIER_COST', service_role: 'PRIVATE_SERVICE_ROLE', attachment_url: 'https://storage.example/private/PRIVATE_ATTACHMENT' }
const product = { id: 'internal-id', title: 'Actual mouse 900*400*4', slug: 'mouse', description: 'Saved description.', price: 500, sku: 'SKU_1', is_published: true, stock_quantity: 3, selling_mode: 'normal', brand: { name: 'Real brand' }, specifications: [{ label: 'Connection', value: 'USB' }], features: [{ body: 'Actual feature' }], reviewCount: 2, reviewAverage: 4.5, ...privateValues }
const records = { products: [product, { ...product, slug: 'hidden', is_published: false }], categories: [{ id: 'c', name: 'Mice', slug: 'mice' }], brands: [{ id: 'b', name: 'Real brand', slug: 'real' }], pages: [{ title: 'Shipping policy', path: 'shipping-policy', is_published: true }, { title: 'Hidden SEO', path: 'noindex', is_published: true, seo_noindex: true }, { title: 'Private account', path: 'account/orders', is_published: true }], helpCategories: [{ id: 'h', slug: 'orders', is_active: true }], helpArticles: [{ title: 'Order guide', slug: 'guide', category_id: 'h', status: 'published' }, { title: 'Draft help', slug: 'draft', category_id: 'h', status: 'draft' }] }
records.products[0].category_id = 'c'; records.products[0].brand_id = 'b'
const discovery = { base, storeName: 'ELcomputer', routes: discoverPublicPages(records) }
discovery.aiEntries = publicAiEntries(discovery.routes, records)
const assertPrivateAbsent = text => { for (const value of Object.values(privateValues)) assert.ok(!text.includes(value), value); assert.ok(!text.includes('internal-id')) }

test('llms is a compact v2 Markdown guide derived from existing public discovery', () => {
  const text = llmsText({ base, storeName: 'ELcomputer', entries: discovery.aiEntries })
  assert.match(text, /^# ELcomputer\n\n> /)
  for (const heading of ['Store', 'Products', 'Categories', 'Brands', 'Customer Information', 'Help', 'Optional']) assert.ok(text.includes(`## ${heading}\n`))
  assert.ok(text.includes(`${base}/ai/products/mouse.md`))
  assert.ok(text.includes(`${base}/search?category=mice`))
  assert.ok(text.includes(`${base}/ar/ai/index.md`))
  assert.ok(text.includes(`${base}/sitemap.xml`))
  assert.doesNotMatch(text, /hidden|noindex|account\/orders|Draft help|\/api\/|\/dashboard|tracking|utm_/)
  assertPrivateAbsent(text)
})

test('optional missing data stays valid; very large catalogs cannot inflate llms', () => {
  const empty = llmsText({ base, entries: publicAiEntries(discoverPublicPages({}), {}) })
  assert.match(empty, /^# ELcomputer/); assert.ok(empty.includes('/ai/index.md'))
  const entries = Array.from({ length: 10000 }, (_, i) => ({ kind: 'product', title: `Product ${i} ${'x'.repeat(10000)}`, path: `/products/item-${i}`, query: {} }))
  const text = llmsText({ base, entries })
  assert.ok(Buffer.byteLength(text) < 10000)
  assert.equal((text.match(/HTML \[canonical page\]/g) || []).length, 8)
})

test('route allowlist rejects private, encoded, malformed and arbitrary Markdown resources', () => {
  for (const path of ['/ai/pages/account/orders/index.md', '/ar/ai/pages/dashboard/index.md', '/ai/pages/support/index.md', '/ai/pages/uploads/x/index.md', '/ai/pages/ai/hidden/index.md', '/ai/products/../secret.md', '/ai/products/%2faccount.md', '/ai/products/mouse.md/extra', '/ai/packing-videos/secret.md', '/ai/api/chat.md', '/ai/orders/123.md']) assert.equal(resolveAiResource(path), null, path)
  assert.equal(resolveAiResource('/ar/ai/products/mouse.md').locale, 'ar')
  assert.equal(resolveAiResource('/ai/categories/mice.md').query.category, 'mice')
  assert.equal(resolveAiResource('/ai/pages/policies/shipping/index.md').path, '/policies/shipping')
  assert.equal(aiMarkdownPath('/account/orders'), '')
  assert.equal(aiMarkdownPath('/search', { category: 'mice', sort: 'price' }), '')
})

test('discovery links follow v2 without changing canonical/schema or exposing noindex pages', () => {
  const seo = buildSeo({ settings: { seo_site_url: base }, path: '/products/mouse', locale: 'ar', structuredData: [productSchema(product, base, 'ar')] })
  const before = JSON.stringify(seoHead(seo))
  const links = aiDiscoveryLinks(seo)
  assert.equal(links[0].rel, 'describedby')
  assert.equal(links[1].type, 'text/markdown')
  assert.equal(links[1].href, `${base}/ar/ai/products/mouse.md`)
  assert.equal(JSON.stringify(seoHead(seo)), before)
  assert.deepEqual(aiDiscoveryLinks(buildSeo({ settings: { seo_site_url: base }, path: '/account' })), [])
  assert.deepEqual(aiDiscoveryLinks(buildSeo({ settings: { seo_site_url: base }, path: '/policy', index: false })), [])
  assert.ok(sitemapXml(discovery.routes, base).includes('/ar/products/mouse'))
})

test('AI policies default to existing public access and retain private restrictions in specific groups', () => {
  assert.deepEqual(aiPolicy({}), { search: true, training: true })
  const text = aiRobotsText(base)
  assert.ok(text.replace(/^Content-signal:.*\n/gm, '').startsWith(robotsText(base)))
  assert.match(text, /User-agent: OAI-SearchBot/)
  assert.match(text, /User-agent: Google-Extended/)
  assert.equal((text.match(/Disallow: \/api\//g) || []).length, 3)
  assert.equal((text.match(/Disallow: \/ar\/checkout/g) || []).length, 2)
  assert.doesNotMatch(text, /^Disallow: \/$/m)
})

test('training opt-out does not block AI search or normal Googlebot; search opt-out is independent', () => {
  const text = aiRobotsText(base, { aiTrainingAllowed: 'false' })
  const training = text.slice(text.indexOf('User-agent: GPTBot'))
  const search = text.slice(text.indexOf('User-agent: OAI-SearchBot'), text.indexOf('User-agent: GPTBot'))
  assert.match(training, /User-agent: Google-Extended\nContent-signal:[^\n]+\nDisallow: \/\n/)
  assert.doesNotMatch(search, /^Disallow: \/$/m)
  assert.doesNotMatch(text, /User-agent: Googlebot/)
  assert.equal(text.replace(/^Content-signal:.*\n/gm, '').split('\n\n')[0], robotsText(base).split('\n\n')[0])
  const blocked = aiRobotsText(base, { aiSearchAllowed: false, aiTrainingAllowed: true })
  assert.match(blocked.slice(blocked.indexOf('User-agent: OAI-SearchBot'), blocked.indexOf('User-agent: GPTBot')), /Disallow: \/\n/)
  assert.doesNotMatch(blocked.slice(blocked.indexOf('User-agent: GPTBot')), /^Disallow: \/$/m)
})

test('public product Markdown has actual price/specifications/aggregate and no private fields or identities', () => {
  const text = productAiMarkdown(product, { base })
  assert.ok(text.includes('Price: 500 EGP'))
  assert.ok(text.includes('Connection: USB'))
  assert.ok(text.includes('Public aggregate: 4.5 / 5 (2 reviews).'))
  assert.ok(text.includes('Availability: In stock'))
  assert.ok(text.includes('900\\*400\\*4'))
  assertPrivateAbsent(text)
  const minimal = productAiMarkdown({ title: 'Minimal', slug: 'minimal', is_published: true }, { base })
  assert.doesNotMatch(minimal, /Price:|Brand:|SKU:|## Reviews|## Specifications/)
})

test('availability uses storefront commerce rules without treating coming-soon or closed preorders as stock', () => {
  assert.match(productAiAvailability({ ...product, selling_mode: 'coming_soon' }), /Coming soon; not currently purchasable/)
  assert.equal(productAiAvailability({ ...product, selling_mode: 'preorder' }, {}, { available: true }), 'Preorder; not immediate stock')
  assert.equal(productAiAvailability({ ...product, selling_mode: 'preorder' }, {}, { available: false }), 'Preorder unavailable')
  assert.equal(productAiAvailability({ ...product, stock_quantity: 0 }), 'Out of stock')
  assert.equal(productAiAvailability({ ...product, stock_quantity: 0 }, { allow_out_of_stock_purchases: true }), 'Backorder')
  assert.equal(productAiAvailability({ ...product, is_serialized: true, variants: [{ is_active: true, stock_quantity: 0 }] }, { allow_out_of_stock_purchases: true }), 'Backorder')
  assert.match(productAiAvailability({ ...product, is_serialized: true, variants: [{ is_active: false, stock_quantity: 99 }] }), /Options unavailable/)
  const ar = productAiMarkdown(product, { base, locale: 'ar' })
  assert.ok(ar.includes(`${base}/ar/products/mouse`)); assert.ok(ar.includes('Actual mouse')); assert.ok(ar.includes('saved language'))
})

test('stored Markdown/HTML is safely rendered as data and cannot add private attachment URLs or headings', () => {
  const text = aiBody('# Heading\n\n<script>PRIVATE_SCRIPT</script>Saved text.\n- [Order](https://storage.example/private/secret?token=SECRET)\n![image](/uploads/private.pdf)\nhttps://storage.example/storage/v1/object/private/SECRET\n/account/orders/private-order')
  assert.match(text, /^### Heading/)
  assert.ok(text.includes('- Order'))
  assert.doesNotMatch(text, /PRIVATE_SCRIPT|<script>|https:\/\/storage|token=|SECRET|\/uploads\/|\/account\//)
  assert.equal(aiText('Text\n## injected\n[data](javascript:alert(1))'), 'Text injected data\\)')
  assert.equal(aiText('/storage/v1/object/private/SECRET /packing-videos/SECRET /documents/SECRET'), '')
})

function fakeClient(tables) {
  const calls = []
  return { calls, from(table) {
    let fields = '', head = false, filters = {}, limit = Infinity
    const result = () => {
      calls.push({ table, fields, filters, head })
      if (tables[table] instanceof Error) return { error: { code: 'XX000' } }
      const rows = (tables[table] || []).filter(item => Object.entries(filters).every(([key, value]) => item[key] === value))
      return { data: head ? null : rows.slice(0, limit), count: rows.length, error: null }
    }
    const query = { select(value, options) { fields = value; head = options?.head; return query }, eq(key, value) { filters[key] = value; return query }, order() { return query }, limit(value) { limit = value; return query }, async maybeSingle() { const response = result(); return { ...response, data: response.data?.[0] || null } }, then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject) } }
    return query
  } }
}
globalThis.defineCachedFunction = fn => fn
const { publicAiMarkdown, readAiProduct } = await import('../server/utils/publicAi.js')

test('public readers recheck publication/noindex, select only public fields and emit no private CMS/help metadata', async () => {
  const db = fakeClient({ site_pages: [{ path: 'policy', title: 'Policy', content_markdown: '# Public terms\n\nActual terms.', is_published: true, seo_noindex: false, ...privateValues }, { path: 'hidden', is_published: false, seo_noindex: false }, { path: 'noindex', is_published: true, seo_noindex: true }], help_categories: [{ id: 'h', slug: 'orders', name: 'Orders', is_active: true }], help_articles: [{ category_id: 'h', slug: 'guide', title: 'Guide', content_markdown: 'Saved help.', status: 'published', ...privateValues }, { category_id: 'h', slug: 'draft', title: 'PRIVATE_DRAFT', status: 'draft' }] })
  const page = await publicAiMarkdown(db, resolveAiResource('/ai/pages/policy/index.md'), discovery, {})
  const help = await publicAiMarkdown(db, resolveAiResource('/ar/ai/help/orders/guide.md'), discovery, {})
  assertPrivateAbsent(page); assertPrivateAbsent(help)
  assert.ok(help.includes(`${base}/ar/help/orders/guide`))
  for (const path of ['/ai/pages/hidden/index.md', '/ai/pages/noindex/index.md', '/ai/help/orders/draft.md']) await assert.rejects(publicAiMarkdown(db, resolveAiResource(path), discovery, {}), error => error.statusCode === 404)
  assert.ok(db.calls.filter(x => x.table === 'site_pages').every(x => x.filters.is_published === true && x.filters.seo_noindex === false))
  assert.ok(db.calls.filter(x => x.table === 'help_articles').every(x => x.filters.status === 'published'))
  assert.ok(db.calls.every(x => !x.fields.includes('*') && !/created_by|updated_by|customer|cost_price/.test(x.fields)))
})

test('product read uses aggregate-only reviews and authoritative preorder API, failing safely when unavailable', async () => {
  const db = fakeClient({ products: [{ ...product, selling_mode: 'preorder', average_rating: 4.5 }], product_reviews: [{ product_id: product.id, rating: 4, ...privateValues }] })
  let calledId
  const value = await readAiProduct(db, 'mouse', async id => { calledId = id; return { available: true, order_id: 'PRIVATE_ORDER_321' } }, async () => ({ total: 1, items: [privateValues] }))
  assert.equal(calledId, product.id); assert.deepEqual(value.availability, { available: true })
  assert.equal(value.product.reviewCount, 1)
  const text = productAiMarkdown(value.product, { base, availability: value.availability }); assertPrivateAbsent(text)
  assert.ok(!db.calls.some(x => x.table === 'product_reviews'))
  assert.ok(!('items' in value.product))
  await assert.rejects(readAiProduct(db, 'mouse', async () => { throw Error('PRIVATE_SERVICE_ROLE') }), error => error.statusCode === 503 && !error.message.includes('PRIVATE_SERVICE_ROLE'))
  await assert.rejects(readAiProduct(db, 'hidden', async () => ({})), error => error.statusCode === 404)
})

test('AI readers do not introduce privileged credentials, arbitrary table queries, content negotiation or migrations', () => {
  const source = readFileSync(new URL('../server/utils/publicAi.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /getSupabaseAdminClient|supabaseServiceRoleKey|service_role|\.from\(['"](?:customer|admin|support|chat|supplier)/)
  assert.doesNotMatch(source, /readBody|getHeader\([^)]*accept/i)
  assert.doesNotMatch(source, /=> event\.\$fetch/)
  assert.ok(source.includes("'Cache-Control', 'no-store'"))
  assert.ok(source.includes("'X-Content-Type-Options', 'nosniff'"))
})
