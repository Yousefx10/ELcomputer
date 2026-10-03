import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { PGlite } from '@electric-sql/pglite'
import { getLocalizedCategoryName, categoryMatchesSearch, categoryNameFields } from '../app/utils/categoryLocale.js'
import { buildSeo, catalogSeoFields, searchSeoPolicy, sitemapXml, discoverPublicPages } from '../app/utils/seo.js'
globalThis.defineCachedFunction = fn => fn
const { publicAiMarkdown } = await import('../server/utils/publicAi.js')

const category = { id: 'c', name: 'Mice', name_ar: 'الفأرات', slug: 'mouse' }
const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8')

test('staff category translations have English fallback without mutating records', () => {
  const before = JSON.stringify(category)
  assert.equal(getLocalizedCategoryName(category, 'en'), 'Mice')
  assert.equal(getLocalizedCategoryName(category, 'ar'), 'الفأرات')
  for (const name_ar of [null, undefined, '', '   ']) assert.equal(getLocalizedCategoryName({ ...category, name_ar }, 'ar'), 'Mice')
  assert.equal(getLocalizedCategoryName({ name: 'Existing category' }, 'ar'), 'Existing category')
  assert.equal(getLocalizedCategoryName(null, 'ar'), '')
  assert.equal(JSON.stringify(category), before)
  assert.equal(categoryMatchesSearch(category, 'فأرات'), true)
  assert.equal(categoryMatchesSearch(category, 'mice'), true)
})

test('editor persists Arabic display names while preserving existing canonical slugs', () => {
  assert.deepEqual(categoryNameFields('Mice', ' الفأرات ', 'mouse'), { name: 'Mice', name_ar: 'الفأرات', slug: 'mouse' })
  assert.equal(categoryNameFields('Renamed English', 'اسم جديد', 'mouse').slug, 'mouse')
  assert.equal(categoryNameFields('Mice', '', 'mouse').name_ar, null)
  assert.equal(categoryNameFields('Gaming Mice', 'الفأرات').slug, 'gaming-mice')
  const editor = read('app/components/dashboard/catalog/CategoriesTab.vue')
  assert.match(editor, /categoryNameFields\(name.value, nameAr.value, existingSlug.value\)/)
  assert.match(editor, /existingSlug.value = category.slug/)
  for (const mutation of ['update', 'insert']) assert.match(editor, new RegExp('\\.' + mutation + '\\(\\{[\\s\\S]*?\\.\\.\\.names'))
  assert.match(editor, /v-model="nameAr"/)
})

test('Arabic category metadata, canonical, hreflang, sitemap and AI links retain English slug identity', async () => {
  const policy = searchSeoPolicy({ category: 'mouse' }, [category], [], 1)
  const fields = catalogSeoFields(category, {}, 'ar')
  assert.equal(fields.title, 'الفأرات')
  const seo = buildSeo({ settings: { seo_site_url: 'https://store.example' }, path: '/ar/search', locale: 'ar', query: policy.query, ...fields })
  assert.equal(seo.canonical, 'https://store.example/ar/search?category=mouse')
  assert.ok(seo.alternates.some(item => item.href === 'https://store.example/search?category=mouse'))
  const routes = discoverPublicPages({ categories: [category], products: [{ id: 'p', title: 'Mouse', slug: 'test-mouse', category_id: 'c', is_published: true }] })
  const xml = sitemapXml(routes, 'https://store.example')
  assert.match(xml, /\/ar\/search\?category=mouse/)
  assert.doesNotMatch(xml, /الفأرات/)
  const client = { from: table => {
    const q = { select: () => q, eq: () => q, order: () => q, limit: () => Promise.resolve({ data: [{ title: 'Mouse', slug: 'test-mouse', price: 10 }], count: 1 }), maybeSingle: () => Promise.resolve({ data: category }) }
    return q
  } }
  const md = await publicAiMarkdown(client, { kind: 'category', slug: 'mouse', path: '/search', query: policy.query, locale: 'ar' }, { base: 'https://store.example' }, {})
  assert.match(md, /# الفأرات/)
  assert.match(md, /https:\/\/store.example\/ar\/search\?category=mouse/)
})

test('populated additive migration preserves category data, product relationships and RLS policies', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create table categories(id uuid primary key, name text not null, slug text unique not null);
      alter table categories enable row level security;
      create policy categories_read on categories for select using (true);
      create table products(id int primary key, category_id uuid references categories);
      insert into categories values('00000000-0000-4000-8000-000000000001','Mice','mouse');
      insert into products values(1,'00000000-0000-4000-8000-000000000001');`)
    const migration = read('supabase/migrations/20261003140000_category_arabic_name.sql')
    await db.exec(migration)
    await db.exec(migration)
    const row = (await db.query('select * from categories')).rows[0]
    assert.deepEqual(row, { id: '00000000-0000-4000-8000-000000000001', name: 'Mice', slug: 'mouse', name_ar: null })
    await db.query('update categories set name_ar=$1', ['الفأرات'])
    assert.equal((await db.query('select slug from categories')).rows[0].slug, 'mouse')
    assert.equal((await db.query('select category_id from products')).rows[0].category_id, row.id)
    assert.equal((await db.query("select relrowsecurity from pg_class where relname='categories'")).rows[0].relrowsecurity, true)
    assert.equal((await db.query("select count(*)::int as n from pg_policies where tablename='categories'")).rows[0].n, 1)
  } finally { await db.close() }
})

test('NPS presentation retains the original 0–10 selection and submission code exactly', () => {
  const before = execFileSync('git', ['show', 'HEAD:app/components/nps/Survey.vue'], { encoding: 'utf8' })
  const after = read('app/components/nps/Survey.vue')
  const script = source => source.split('<script setup>')[1].split('</script>')[0]
  assert.equal(script(after), script(before))
  assert.match(after, /repeat\(6, minmax\(0, 1fr\)\)/)
  assert.match(after, /@container \(min-width: 544px\)/)
  assert.match(after, /min-height: 44px/)
  assert.match(after, /v-model="score"/)
})

test('existing NPS database stores each 0–10 score and preserves cooldown and score bounds', async () => {
  const { createResetDatabase } = await import('./helpers/resetDatabase.mjs')
  const { randomUUID } = await import('node:crypto')
  const db = await createResetDatabase()
  try {
    await db.query("select set_config('request.jwt.claim.role','service_role',false)")
    const visitor = randomUUID()
    for (let score = 0; score <= 10; score++) {
      const row = (await db.query('insert into nps_responses(response_id,visitor_id,score) values($1,$2,$3) returning score', [randomUUID(), score === 0 ? visitor : randomUUID(), score])).rows[0]
      assert.equal(row.score, score)
    }
    await assert.rejects(() => db.query('insert into nps_responses(response_id,visitor_id,score) values($1,$2,10)', [randomUUID(), visitor]), /cooldown/)
    for (const invalid of [-1, 11]) await assert.rejects(() => db.query('insert into nps_responses(response_id,visitor_id,score) values($1,$2,$3)', [randomUUID(), randomUUID(), invalid]), /score_check/)
  } finally { await db.close() }
})
