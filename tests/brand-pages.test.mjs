import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { normalizeBrandPage, visibleBrandRows, brandUrl, brandVideo, brandSlug } from '../app/utils/brandPage.js'
import { normalizeBrandPayload } from '../server/utils/brandPages.js'
import { readStorefrontBrand, brandProductFilters } from '../server/utils/storefrontBrands.js'
import { brandSeoFields, buildSeo, discoverPublicPages, sitemapXml, searchSeoPolicy, validCmsPath } from '../app/utils/seo.js'
import { aiDiscoveryLinks, aiHtmlResource, aiMarkdownPath, publicAiEntries, resolveAiResource } from '../app/utils/aiReadiness.js'
import { renderSafeMarkdown } from '../app/utils/markdown.js'
globalThis.defineCachedFunction = fn => fn
const { publicAiMarkdown } = await import('../server/utils/publicAi.js')
const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const content = { hero: { image: '/uploads/brands/hero.webp', mobile_image: '/uploads/brands/phone.webp', title: 'Designed for play', text: 'Authored brand copy.', cta_label: 'Explore', cta_url: '#brand-products', alignment: 'center', overlay: 0.6 }, background: { image: '/uploads/brands/background.webp', color: '#102030' }, story: { title: 'Our story', content: '**Real story**\n\nBuilt for everyday work.', supporting: 'Supporting facts.' }, rows: [
  { id: 'row-a', layout: 'one', items: [{ id: 'image-a', type: 'image', url: '/uploads/brands/detail.webp', alt: 'Keyboard on a desk', caption: 'A real detail', link: '/products/keyboard' }] },
  { id: 'row-b', layout: 'two', items: [{ id: 'image-b', type: 'image', url: 'https://images.example/keyboard.webp' }, { id: 'video-b', type: 'video', url: 'https://youtu.be/abcdefghijk', poster: '/uploads/brands/poster.webp', caption: 'Product film' }] }
] }
const brand = { id: 'b', name: 'Example', slug: 'example', logo_url: '/uploads/brands/logo.webp', brand_page: content }

test('brand editor payload saves optional content, stable row order and immutable English identity', () => {
  const before = JSON.stringify(content)
  const saved = normalizeBrandPayload({ name: 'Renamed brand', slug: 'اسم', brand_page: content }, 'example')
  assert.equal(saved.slug, 'example')
  assert.equal(saved.brand_page.hero.image, content.hero.image)
  assert.deepEqual(saved.brand_page.background, content.background)
  assert.deepEqual(saved.brand_page.story, content.story)
  assert.deepEqual(saved.brand_page.rows.map(row => row.id), ['row-a', 'row-b'])
  assert.equal(saved.brand_page.rows[1].items[1].type, 'video')
  const reordered = { ...content, rows: [...content.rows].reverse() }
  assert.deepEqual(normalizeBrandPayload({ name: 'Example', brand_page: reordered }).brand_page.rows.map(row => row.id), ['row-b', 'row-a'])
  assert.equal(normalizeBrandPayload({ name: 'New English Brand' }).slug, 'new-english-brand')
  assert.equal(brandSlug('عربي', 'example'), 'example')
  assert.throws(() => normalizeBrandPayload({ name: 'عربي' }), /English name/)
  assert.equal(JSON.stringify(content), before)
  assert.equal(normalizeBrandPage({ hero: { overlay: 0 } }).hero.overlay, 0.55)
  const partial = normalizeBrandPayload({ name: 'Minimal' })
  assert.deepEqual(visibleBrandRows(partial.brand_page), [])
  assert.equal(partial.brand_page.hero.image, '')
  assert.equal(partial.brand_page.story.content, '')
})

test('public content allowlist and URL model reject executable embeds, credentials and malformed rows', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,x', '//evil.example', '/\\evil.example', 'https://user:pass@example.com/a', 'http://example.com/a', '/%2fevil.example']) assert.equal(brandUrl(url), '')
  for (const url of ['https://evil.example/embed/x', '<iframe src="x"></iframe>', 'https://youtube.com.evil.example/watch?v=abcdefghijk', 'https://youtu.be/bad']) assert.equal(brandVideo(url), null)
  assert.equal(brandVideo('https://youtu.be/abcdefghijk?autoplay=1').url, 'https://www.youtube-nocookie.com/embed/abcdefghijk')
  assert.equal(brandVideo('https://vimeo.com/12345').url, 'https://player.vimeo.com/video/12345')
  assert.equal(brandVideo('https://cdn.example/film.mp4').type, 'file')
  for (const bad of [ { rows: [...content.rows, content.rows[0]] }, { rows: [{ id: 'r', layout: 'two', items: Array(3).fill(content.rows[0].items[0]) }] }, { hero: { image: 'javascript:alert(1)' } }, { background: { color: 'red; background:url(x)' } }, { rows: Array(31).fill(content.rows[0]) } ]) assert.throws(() => normalizeBrandPayload({ name: 'Example', brand_page: bad }))
  const publicPage = normalizeBrandPage({ ...content, private_metadata: 'PRIVATE', hero: { ...content.hero, admin_notes: 'PRIVATE' } })
  assert.ok(!JSON.stringify(publicPage).includes('PRIVATE'))
  const html = renderSafeMarkdown('<script>alert(1)</script>\n\n[unsafe](javascript:alert)')
  assert.ok(!html.includes('<script>'))
  assert.ok(!html.includes('href="javascript:'))
})

function fixtureClient(records = [brand]) {
  const products = Array.from({ length: 27 }, (_, i) => ({ id: `p${String(i).padStart(2, '0')}`, title: `Product ${i}`, slug: `product-${i}`, brand_id: i === 26 ? 'other' : 'b', category_id: i % 2 ? 'c1' : 'c2', is_published: i !== 25, price: i, stock_quantity: i % 2, created_at: i }))
  const calls = []
  return { calls, from(table) {
    let rows = table === 'brands' ? [...records] : table === 'categories' ? [{ id: 'c1', name: 'Keyboard', name_ar: 'لوحات المفاتيح', slug: 'keyboard' }, { id: 'c2', name: 'Mouse', slug: 'mouse' }] : [...products], range = null
    const q = { select(fields) { calls.push({ table, fields }); return q }, eq(key, value) { calls.push({ table, key, value }); rows = rows.filter(row => row[key] === value); return q }, gt(key, value) { rows = rows.filter(row => row[key] > value); return q }, order(key, { ascending = true } = {}) { rows.sort((a,b) => (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0) * (ascending ? 1 : -1)); return q }, range(a,b) { range = [a,b]; return q }, limit(n) { range = [0,n-1]; return q }, maybeSingle() { return Promise.resolve({ data: rows[0] || null }) }, then(resolve) { return Promise.resolve({ data: range ? rows.slice(range[0], range[1]+1) : rows, count: rows.length }).then(resolve) } }
    return q
  } }
}

test('brand reader returns only published brand products, with bounded pages and working filters', async () => {
  const client = fixtureClient()
  const first = await readStorefrontBrand(client, 'example')
  assert.equal(first.total, 25)
  assert.equal(first.pages, 3)
  assert.equal(first.products.length, 12)
  assert.ok(first.products.every(p => p.brand_id === 'b' && p.is_published))
  const last = await readStorefrontBrand(client, 'example', { page: '999' })
  assert.equal(last.page, 3)
  assert.equal(last.products.length, 1)
  const filtered = await readStorefrontBrand(client, 'example', { category: 'keyboard', status: 'instock', sort: 'price-asc' })
  assert.equal(filtered.total, 12)
  assert.ok(filtered.products.every(p => p.category_id === 'c1' && p.stock_quantity > 0))
  assert.ok(client.calls.some(call => call.table === 'storefront_products' && call.key === 'brand_id' && call.value === 'b'))
  await assert.rejects(readStorefrontBrand(client, 'unknown'), error => error.statusCode === 404)
  await assert.rejects(readStorefrontBrand(client, 'عربي'), error => error.statusCode === 404)
  for (const query of [{ category: ['keyboard'] }, { constructor: 'x' }, { private: 'x' }]) assert.throws(() => brandProductFilters(query), error => error.statusCode === 400)
  const minimal = await readStorefrontBrand(fixtureClient([{ id: 'empty', name: 'Empty', slug: 'empty' }]), 'empty')
  assert.equal(minimal.total, 0)
  assert.equal(minimal.brand.brand_page.rows.length, 0)
})

test('brand route, sitemap and old filter canonical converge on one English identity in both locales', () => {
  const records = { brands: [brand], products: [{ title: 'Product', slug: 'product', is_published: true, brand_id: 'b' }], pages: [{ title: 'Collision', path: 'brand/example', is_published: true }] }
  const routes = discoverPublicPages(records)
  assert.equal(routes.filter(r => r.path === '/brand/example').length, 1)
  assert.ok(!routes.some(r => r.query?.brand))
  assert.equal(validCmsPath('brand/example'), false)
  const xml = sitemapXml(routes, 'https://store.example')
  assert.match(xml, /https:\/\/store.example\/ar\/brand\/example/)
  assert.doesNotMatch(xml, /brand=example/)
  const policy = searchSeoPolicy({ brand: 'example' }, [], [brand], 25)
  assert.equal(policy.path, '/brand/example'); assert.equal(policy.index, false)
  for (const locale of ['en', 'ar']) {
    const seo = buildSeo({ path: '/brand/example', locale, ...brandSeoFields(brand) })
    assert.ok(seo.canonical.endsWith(`${locale === 'ar' ? '/ar' : ''}/brand/example`))
    assert.equal(seo.alternates.length, 3)
    assert.equal(seo.image, 'https://new.elcomputer.net/uploads/brands/hero.webp')
    assert.match(seo.description, /Real story/)
    assert.ok(aiDiscoveryLinks(seo).some(link => link.href.endsWith('/ai/brands/example.md')))
  }
  assert.equal(brandSeoFields({ ...brand, seo_title: 'Saved SEO', seo_description: 'Saved description' }).title, 'Saved SEO')
  assert.equal(publicAiEntries(routes, records).find(entry => entry.kind === 'brand').path, '/brand/example')
  assert.equal(aiMarkdownPath('/ar/brand/example'), '/ai/brands/example.md')
  assert.deepEqual(resolveAiResource('/ar/ai/brands/example.md'), { kind: 'brand', slug: 'example', path: '/brand/example', query: {}, locale: 'ar' })
  assert.equal(aiHtmlResource('/ar/brand/example', { sort: 'latest' }).invalidQuery, true)
})

test('existing brand Markdown exposes authored public story but never media/admin metadata', async () => {
  const record = { ...brand, brand_page: { ...content, private_metadata: 'PRIVATE_LIBRARY', hero: { ...content.hero, secret: 'PRIVATE_SECRET' } }, admin_notes: 'PRIVATE_ADMIN' }
  const md = await publicAiMarkdown(fixtureClient([record]), resolveAiResource('/ar/ai/brands/example.md'), { base: 'https://store.example' }, {})
  assert.match(md, /Real story/)
  assert.match(md, /Designed for play/)
  assert.match(md, /Product film/)
  assert.match(md, /https:\/\/store.example\/ar\/brand\/example/)
  for (const secret of ['PRIVATE_LIBRARY', 'PRIVATE_SECRET', 'PRIVATE_ADMIN', 'row-a', 'poster.webp', 'youtube-nocookie']) assert.ok(!md.includes(secret))
  const empty = await publicAiMarkdown(fixtureClient([{ id: 'empty', name: 'Empty', slug: 'empty' }]), resolveAiResource('/ai/brands/empty.md'), { base: 'https://store.example' }, {})
  assert.match(empty, /Published products: 0/)
})

test('additive content migration preserves populated identities, relationships, policies and atomic content', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create table public.brands(id uuid primary key, name text not null, slug text unique not null, logo_url text); alter table brands enable row level security;
      create policy brands_read on brands for select to anon,authenticated using(true); create policy brands_edit on brands for update to authenticated using(current_setting('app.can_edit',true)='yes') with check(current_setting('app.can_edit',true)='yes');
      grant usage on schema public to anon,authenticated; grant select on brands to anon,authenticated; grant update on brands to authenticated;
      create table products(id int primary key, brand_id uuid references brands);
      insert into brands values('00000000-0000-4000-8000-000000000001','Example','example',null); insert into products values(1,'00000000-0000-4000-8000-000000000001');`)
    const migration = read('supabase/migrations/20261003160000_brand_landing_pages.sql')
    await db.exec(migration); await db.exec(migration)
    assert.deepEqual((await db.query('select brand_page from brands')).rows[0].brand_page, {})
    assert.equal((await db.query("select count(*)::int as n from pg_policies where tablename='brands'")).rows[0].n, 2)
    await db.exec(`set role anon`)
    await assert.rejects(db.query('update brands set brand_page=$1', [content]))
    await db.exec(`reset role; set role authenticated; set app.can_edit='no'`)
    assert.equal((await db.query('update brands set brand_page=$1 returning id', [content])).rows.length, 0)
    await db.exec(`set app.can_edit='yes'`)
    await db.query('update brands set brand_page=$1', [normalizeBrandPage(content)])
    assert.equal((await db.query('select brand_page from brands')).rows[0].brand_page.rows.length, 2)
    await assert.rejects(db.query('update brands set brand_page=$1', [{ rows: 'invalid' }]))
    await assert.rejects(db.query('update brands set brand_page=$1', [{ rows: Array(31).fill({}) }]))
    await db.exec('reset role')
    assert.equal((await db.query('select slug from brands')).rows[0].slug, 'example')
    assert.equal((await db.query('select brand_id from products')).rows[0].brand_id, '00000000-0000-4000-8000-000000000001')
    const reordered = normalizeBrandPage(content); reordered.rows.reverse(); reordered.rows.pop()
    await db.query('update brands set brand_page=$1', [reordered])
    assert.equal((await db.query('select brand_page from brands')).rows[0].brand_page.rows[0].id, 'row-b')
  } finally { await db.close() }
})
