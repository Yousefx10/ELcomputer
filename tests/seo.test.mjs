import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildSeo, seoHead, seoText, seoTitle, seoExcerpt, publicSiteUrl, canonicalUrl, productSeoFields, productSchema, breadcrumbs, siteSchema, searchSeoPolicy, discoverPublicPages, sitemapXml, robotsText, jsonLdString } from '../app/utils/seo.js'
import { normalizeSeoFields } from '../server/utils/seoFields.js'
import { selectWithSeo } from '../app/utils/seoQuery.js'
import { createResetDatabase } from './helpers/resetDatabase.mjs'
const settings = { site_name: 'ELcomputer', seo_site_url: 'https://shop.example', seo_default_description: 'Computers and accessories.', seo_social_image_url: '/uploads/share.jpg' }
const product = { is_published: true, slug: 'test-mouse', title: 'Test Mouse', description: 'A real mouse.', image_url: '/uploads/mouse.jpg', price: 500, stock_quantity: 3, sku: 'MOUSE-1', brand: { name: 'Example' }, reviewCount: 2, reviewAverage: 4.5 }

test('homepage SSR head has defaults, canonical, social metadata and reciprocal locale links', () => {
  const seo = buildSeo({ settings })
  assert.equal(seo.title, 'ELcomputer')
  assert.equal(seo.description, 'Computers and accessories.')
  assert.equal(seo.canonical, 'https://shop.example/')
  const head = seoHead(seo)
  assert.equal(head.meta.find(item => item.property === 'og:image').content, 'https://shop.example/uploads/share.jpg')
  assert.deepEqual(seo.alternates.map(item => item.lang), ['en', 'ar', 'x-default'])
  assert.equal(seo.alternates[1].href, 'https://shop.example/ar')
  assert.equal(buildSeo({ settings, locale: 'ar', path: '/ar' }).canonical, 'https://shop.example/ar')
})

test('product overrides and automatic fallbacks do not translate catalog or duplicate store names', () => {
  const custom = { ...product, seo_title: 'Mouse SEO | ELcomputer', seo_description: 'Custom description', seo_image_url: '/uploads/custom.jpg' }
  const seo = buildSeo({ settings, path: `/products/${product.slug}`, ...productSeoFields(custom) })
  assert.equal(seo.title, 'Mouse SEO | ELcomputer')
  assert.equal(seo.description, 'Custom description')
  assert.equal(seo.image, 'https://shop.example/uploads/custom.jpg')
  assert.equal(seo.canonical, 'https://shop.example/products/test-mouse')
  assert.equal(buildSeo({ settings, locale: 'ar', path: '/ar/products/test-mouse', ...productSeoFields(product) }).title, 'Test Mouse | ELcomputer')
  assert.equal(seoTitle('Test Mouse - ELcomputer | ELcomputer', 'ELcomputer'), 'Test Mouse | ELcomputer')
  assert.equal(productSeoFields({ title: 'Mouse', long_description: 'Long description' }).description, 'Long description')
})

test('minimal product produces valid metadata without invented images, reviews, brand or offers', () => {
  const minimal = { title: 'Simple item', slug: 'simple-item', is_published: true }
  const schema = productSchema(minimal, settings.seo_site_url, 'en')
  assert.equal(schema.name, 'Simple item')
  for (const key of ['image', 'aggregateRating', 'brand', 'sku', 'offers', 'description']) assert.equal(key in schema, false)
  const seo = buildSeo({ settings, ...productSeoFields(minimal) })
  assert.equal(seo.description, settings.seo_default_description)
  assert.equal(seo.image, 'https://shop.example/uploads/share.jpg')
  assert.equal(productSchema({ ...minimal, is_published: false }, settings.seo_site_url, 'en'), null)
})

test('Product JSON-LD uses public aggregate, stock and authoritative parent price conservatively', () => {
  const schema = productSchema(product, settings.seo_site_url, 'en')
  assert.equal(schema.offers.price, 500)
  assert.equal(schema.offers.priceCurrency, 'EGP')
  assert.equal(schema.offers.availability, 'https://schema.org/InStock')
  assert.equal(schema.aggregateRating.reviewCount, 2)
  assert.equal(schema.aggregateRating.ratingValue, 4.5)
  assert.equal('itemCondition' in schema.offers, false)
  assert.equal(productSchema({ ...product, reviewCount: null }, settings.seo_site_url, 'en').aggregateRating, undefined)
  const serialized = { ...product, is_serialized: true, variants: [{ is_active: true, stock_quantity: 0 }, { is_active: false, stock_quantity: 9 }] }
  assert.equal(productSchema(serialized, settings.seo_site_url, 'en').offers.availability, 'https://schema.org/OutOfStock')
  assert.equal(productSchema({ ...product, selling_mode: 'coming_soon' }, settings.seo_site_url, 'en').offers, undefined)
  assert.equal(productSchema({ ...product, selling_mode: 'preorder' }, settings.seo_site_url, 'en', { available: false }).offers, undefined)
  assert.equal(productSchema({ ...product, selling_mode: 'preorder' }, settings.seo_site_url, 'en', { available: true }).offers.availability, 'https://schema.org/PreOrder')
})

test('category and brand identity survives canonical cleanup; combinations, sorting and pagination do not index', () => {
  const categories = [{ id: 'c', slug: 'mice', name: 'Mice' }], brands = [{ id: 'b', slug: 'example', name: 'Example' }]
  const policy = searchSeoPolicy({ category: 'mice', utm_source: 'test' }, categories, brands, 2)
  assert.equal(policy.index, true)
  assert.deepEqual(policy.query, { category: 'mice' })
  const seo = buildSeo({ settings, path: '/ar/search', locale: 'ar', query: policy.query, title: policy.record.name })
  assert.equal(seo.canonical, 'https://shop.example/ar/search?category=mice')
  assert.equal(seo.title, 'Mice | ELcomputer')
  for (const query of [{}, { q: 'mouse' }, { category: 'mice', sort: 'price-asc' }, { category: 'mice', min: '20' }, { category: 'mice', brand: 'example' }, { category: 'invalid' }, { category: 'mice', page: '2' }]) assert.equal(searchSeoPolicy(query, categories, brands, 2).index, false)
  assert.deepEqual(searchSeoPolicy({ category: 'mice', page: '2' }, categories, brands, 2).query, { category: 'mice', page: 2 })
  assert.equal(searchSeoPolicy({ brand: 'example' }, categories, brands, 1).index, false)
  assert.equal(searchSeoPolicy({ brand: 'example' }, categories, brands, 1).path, '/brand/example')
  assert.equal(searchSeoPolicy({ category: 'mice' }, categories, brands, 0).index, false)
})

test('private routes always noindex and never carry structured data or locale alternates', () => {
  for (const path of ['/account', '/ar/account/orders/secret', '/dashboard', '/checkout', '/cart', '/login', '/signup', '/support']) {
    const seo = buildSeo({ settings, path, structuredData: [product] })
    assert.equal(seo.robots, 'noindex,follow', path)
    assert.deepEqual(seo.structuredData, [])
    assert.deepEqual(seo.alternates, [])
  }
})

test('discovery excludes unpublished, empty, invalid, noindex, private and inactive help records', () => {
  const routes = discoverPublicPages({ products: [{ ...product, category_id: 'c', brand_id: 'b' }, { ...product, slug: 'hidden', is_published: false }], categories: [{ id: 'c', slug: 'mice', name: 'Mice' }, { id: 'empty', slug: 'empty', name: 'Empty' }], brands: [{ id: 'b', slug: 'example', name: 'Example' }], pages: [{ path: 'about', is_published: true }, { path: 'hidden', is_published: false }, { path: 'secret', is_published: true, seo_noindex: true }, { path: 'account/orders', is_published: true }, { path: 'ar/fake', is_published: true }, { path: '../bad', is_published: true }], helpCategories: [{ id: 'hc', slug: 'orders', is_active: true }, { id: 'inactive', slug: 'old', is_active: false }], helpArticles: [{ slug: 'delivery', category_id: 'hc', status: 'published' }, { slug: 'draft', category_id: 'hc', status: 'draft' }, { slug: 'old', category_id: 'inactive', status: 'published' }] })
  assert.ok(routes.some(item => item.path === '/products/test-mouse'))
  assert.ok(routes.some(item => item.query?.category === 'mice'))
  assert.ok(routes.some(item => item.path === '/brand/example'))
  assert.ok(routes.some(item => item.path === '/about'))
  assert.ok(routes.some(item => item.path === '/help/orders/delivery'))
  assert.equal(routes.length, 8)
  const xml = sitemapXml(routes, settings.seo_site_url)
  assert.match(xml, /https:\/\/shop.example\/ar\/products\/test-mouse/)
  assert.match(xml, /hreflang="x-default"/)
  assert.doesNotMatch(xml, /hidden|secret|empty|inactive|draft|old|account/)
  assert.equal((xml.match(/<loc>/g) || []).length, 16)
})

test('robots permits public crawling, protects internal routes and references the canonical sitemap', () => {
  const robots = robotsText(settings.seo_site_url)
  assert.match(robots, /Sitemap: https:\/\/shop.example\/sitemap.xml/)
  assert.match(robots, /Disallow: \/ar\/dashboard/)
  assert.doesNotMatch(robots, /^Disallow:\s*\/$/m)
  assert.doesNotMatch(robots, /GPT|Claude|AI|llms/)
  assert.doesNotMatch(robots, /Disallow: \/(?:cart|checkout|login)/)
})

test('stored metadata and JSON-LD cannot execute HTML, use unsafe images or override origin', () => {
  const text = seoText('<script>alert(1)</script><b>Mouse</b> **works** [Guide](https://example.test)')
  assert.equal(text, 'Mouse works Guide')
  assert.equal(seoText('Mousepad 900*400*4 mm USB_ID'), 'Mousepad 900*400*4 mm USB_ID')
  const json = jsonLdString({ name: '</script><script>alert(1)</script>&\u2028' })
  assert.doesNotMatch(json, /<|>/)
  assert.equal(JSON.parse(json).name, '</script><script>alert(1)</script>&\u2028')
  assert.equal(buildSeo({ settings, image: 'javascript:alert(1)' }).image, 'https://shop.example/uploads/share.jpg')
  assert.equal(publicSiteUrl({ seo_site_url: 'https://user:pass@bad.example' }, settings.seo_site_url), settings.seo_site_url)
  assert.equal(publicSiteUrl({ seo_site_url: 'https://bad.example/path' }, settings.seo_site_url), settings.seo_site_url)
  assert.equal(canonicalUrl(settings.seo_site_url, '/products/test-mouse?utm_source=x#reviews'), 'https://shop.example/products/test-mouse')
  assert.ok(seoExcerpt('word '.repeat(100)).length <= 160)
  const schema = siteSchema({ site_name: 'ELcomputer', footer_address: 'address address', footer_phone: 'placeholder' }, settings.seo_site_url)
  assert.equal(schema[0].address, undefined)
  assert.equal(schema[0].telephone, undefined)
  assert.equal(breadcrumbs([{ name: 'Home', path: '/' }], settings.seo_site_url, 'ar').itemListElement[0].item, 'https://shop.example/ar')
})

test('compatibility reads retry only missing SEO columns, never hide database failures', async () => {
  let calls = 0
  const result = await selectWithSeo(async fields => { calls++; return fields.includes('seo_') ? { error: { code: '42703' } } : { data: { title: 'Product' } } }, 'title')
  assert.equal(result.data.title, 'Product')
  assert.equal(calls, 2)
  calls = 0
  await selectWithSeo(async () => { calls++; return { error: { code: '42501' } } }, 'title')
  assert.equal(calls, 1)
})

test('additive migration installs nullable overrides without changing data, content or RLS', async () => {
  const db = await createResetDatabase()
  try {
    const setting = (await db.query("insert into public.site_settings(key,site_name) values('seo-test','Existing store') returning site_name,seo_site_title,seo_default_description,seo_social_image_url,seo_site_url")).rows[0]
    assert.equal(setting.site_name, 'Existing store')
    assert.equal(setting.seo_site_title, null)
    const cms = (await db.query("insert into public.site_pages(title,path,content_markdown) values('Original','seo-test','Saved English content') returning content_markdown,seo_noindex,seo_title")).rows[0]
    assert.equal(cms.content_markdown, 'Saved English content')
    assert.equal(cms.seo_noindex, false)
    assert.equal(cms.seo_title, null)
    const fields = (await db.query("select table_name,column_name from information_schema.columns where table_schema='public' and table_name in ('products','categories','brands','site_pages') and column_name like 'seo_%'")).rows
    assert.equal(fields.length, 13)
    const migration = readFileSync(new URL('../supabase/migrations/20261001120000_public_seo.sql', import.meta.url), 'utf8')
    assert.doesNotMatch(migration, /update\s+public|create table|disable row level|grant /i)
  } finally { await db.close() }
})


test('private metadata drops customer identifiers and authoritative SKU punctuation survives', () => {
  const seo = buildSeo({ settings, path: '/ar/account/orders/customer-secret', locale: 'ar', title: 'Customer Name', query: { email: 'private@example.test' } })
  assert.equal(seo.title, 'My Account | ELcomputer')
  assert.equal(seo.canonical, 'https://shop.example/ar/account')
  assert.doesNotMatch(JSON.stringify(seo), /customer-secret|Customer Name|private@example/)
  assert.equal(productSchema({ ...product, sku: 'MOUSE_ID-1' }, settings.seo_site_url, 'en').sku, 'MOUSE_ID-1')
  assert.equal(productSchema({ ...product, stock_quantity: 0 }, settings.seo_site_url, 'en', null, { allow_out_of_stock_purchases: true }).offers.availability, 'https://schema.org/BackOrder')
  assert.equal(canonicalUrl(settings.seo_site_url, '//wrong.example/path'), 'https://shop.example/wrong.example/path')
})

test('editor normalization preserves optional overrides and rejects unsafe image URLs', () => {
  assert.deepEqual(normalizeSeoFields({}), {})
  assert.deepEqual(normalizeSeoFields({ seo_title: '  Mouse_ID <b>SEO</b> ', seo_description: '', seo_image_url: '/uploads/share.jpg' }), { seo_title: 'Mouse_ID SEO', seo_description: null, seo_image_url: '/uploads/share.jpg' })
  assert.throws(() => normalizeSeoFields({ seo_image_url: 'javascript:alert(1)' }), /valid social image/)
  assert.equal(seoHead(buildSeo({ settings: { site_name: 'ELcomputer' } })).meta.some(item => item.property === 'og:image'), false)
})


test('sitemap database pagination handles lower PostgREST caps and splits large catalogs', async () => {
  globalThis.defineCachedFunction = handler => handler
  const { readPublicRows, sitemapDocument, SITEMAP_PAGE_SIZE } = await import('../server/utils/publicSeo.js')
  delete globalThis.defineCachedFunction
  const records = Array.from({ length: 1001 }, (_, id) => ({ id, slug: `product-${id}` }))
  const offsets = []
  let offset = 0, requestCount = false
  const client = { from: table => {
    assert.equal(table, 'products')
    const query = {
      select: (fields, options) => { assert.equal(fields, 'id,slug'); requestCount = !!options?.count; return query },
      order: field => { assert.equal(field, 'id'); return query },
      range: start => { offset = start; offsets.push(start); return query },
      eq: (field, value) => { assert.equal(field, 'is_published'); assert.equal(value, true); return query },
      then: resolve => Promise.resolve({ data: records.slice(offset, offset + 750), count: requestCount ? records.length : null }).then(resolve)
    }
    return query
  } }
  assert.equal((await readPublicRows(client, 'products', 'id,slug', { is_published: true })).length, 1001)
  assert.deepEqual(offsets, [0, 750])
  const index = sitemapDocument({ base: settings.seo_site_url, routes: Array.from({ length: SITEMAP_PAGE_SIZE + 1 }, () => ({ path: '/' })) })
  assert.match(index, /<sitemapindex/)
  assert.match(index, /sitemap-pages\/2.xml/)
})
