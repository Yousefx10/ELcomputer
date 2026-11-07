import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parse } from '@vue/compiler-sfc'
import { familyChoiceStyle, labelColor, familyChoiceColor, lightColor, familySwatch } from '../app/utils/productFamily.js'
import { productPageStyles } from '../app/utils/productPage.js'

test('linked choices show photos for colors, models and editions; stems for switches', () => {
  for (const key of ['color', 'model', 'version']) assert.equal(familyChoiceStyle(key), 'photo')
  assert.equal(familyChoiceStyle('switch'), 'switch')
  for (const key of ['capacity', 'size', 'other']) assert.equal(familyChoiceStyle(key), 'text')
})

test('switch and color marks come from common words, never guesses', () => {
  assert.equal(labelColor('Red switch'), '#dc2626')
  assert.equal(labelColor('Lubed BLUE switch'), '#2563eb')
  assert.equal(labelColor('Blue/Black'), '#2563eb')
  assert.equal(labelColor('مفتاح أحمر'), '#dc2626')
  for (const label of ['Ginger cat', 'Snoman', 'E9310M 100%', '', null]) assert.equal(labelColor(label), '')
  assert.equal(familyChoiceColor({ values: { switch: 'Ginger cat' }, color_hex: '#D2691E' }, 'switch'), '#D2691E')
  assert.equal(familyChoiceColor({ values: { switch: 'Brown' }, values_ar: {} }, 'switch'), '#8b5a2b')
  assert.equal(familyChoiceColor({ values: { switch: 'Custom' }, values_ar: { switch: 'أصفر' } }, 'switch'), '#facc15')
  assert.equal(lightColor('#f8fafc'), true)
  assert.equal(lightColor('#18181b'), false)
  assert.equal(familySwatch({ values: { color: 'Black' } }), 'black', 'existing swatch contract is unchanged')
})

test('Modern is a third opt-in style sharing the route purchasing state', async () => {
  assert.deepEqual(productPageStyles, ['classic', 'premium', 'modern'])
  const route = await readFile('app/pages/products/[slug].vue', 'utf8')
  assert.match(route, /<ProductModern v-if="productPageStyle === 'modern'" \/>/)
  const modern = await readFile('app/components/product/Modern.vue', 'utf8'), { descriptor } = parse(modern)
  assert.ok(descriptor.scriptSetup && descriptor.template)
  assert.match(modern, /useProductDetailContext\(\)/)
  assert.match(modern, /<ProductFamilyOptions /)
  assert.doesNotMatch(modern, /\.from\(['"](?:products|product_variants)|\.rpc\(['"]commerce_|addItem\(/)
  assert.doesNotMatch(modern, /variant\.price|selectedVariant\.value\?\.price/)
  const settings = await readFile('app/components/dashboard/ProductPageSettings.vue', 'utf8')
  assert.match(settings, /v-for="option in productPageStyles"/)
  const sql = await readFile('supabase/migrations/20261107180000_modern_product_page.sql', 'utf8')
  assert.match(sql, /CHECK \(product_page_style IN \('classic', 'premium', 'modern'\)\)/)
  assert.doesNotMatch(sql, /UPDATE|INSERT|DELETE/i)
})

test('linked members get only their published main photo', async () => {
  const api = await readFile('server/api/storefront/products/[id]/presentation.get.js', 'utf8')
  assert.match(api, /from\('storefront_products'\)\.select\('id,image_url'\)/)
  assert.match(api, /\.eq\('is_published', true\)/)
  assert.match(api, /if \(error \|\| !Array\.isArray\(rows\)\) return data/)
})

test('every new label exists in English and Arabic', async () => {
  const en = JSON.parse(await readFile('i18n/locales/en.json', 'utf8')), ar = JSON.parse(await readFile('i18n/locales/ar.json', 'utf8'))
  for (const key of ['percentOff', 'bestSeller', 'added', 'viewCart', 'showAll', 'showLess']) { assert.ok(en.productModern[key]); assert.ok(ar.productModern[key]) }
  for (const key of ['modern', 'modernDescription']) { assert.ok(en.productPage[key]); assert.ok(ar.productPage[key]) }
})

test('native schema accepts Modern, keeps the current choice and rejects unknown styles', { timeout: 180000 }, async t => {
  const { createEmailNativeDatabase, emailNativeAvailable } = await import('./helpers/emailNativeDatabase.mjs')
  if (!emailNativeAvailable) return t.skip('native PostgreSQL is not configured')
  const { createProductSaveFixture } = await import('./helpers/productSaveFixture.mjs')
  const db = await createEmailNativeDatabase()
  try {
    await createProductSaveFixture({ database: db })
    const style = async () => (await db.query("select product_page_style from public.site_settings where key='default'")).rows[0].product_page_style
    assert.equal(await style(), 'classic')
    await db.exec("update public.site_settings set product_page_style='modern'")
    assert.equal(await style(), 'modern')
    await assert.rejects(() => db.exec("update public.site_settings set product_page_style='other'"), error => error.code === '23514')
    await db.exec("update public.site_settings set product_page_style='premium'")
    assert.equal(await style(), 'premium')
  } finally { await db.close() }
})
