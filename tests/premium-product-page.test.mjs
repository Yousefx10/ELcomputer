import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { parse } from '@vue/compiler-sfc'
import { productPageStyle, productPageEditorConfig, normalizeProductPageConfig, productPageConfigError, formatProductPagePrice, premiumSpecificationContent } from '../app/utils/productPage.js'
import { presentationCommand } from '../server/utils/productPresentation.js'

test('exactly two styles, with Classic as the safe default', () => {
  for (const value of [undefined, null, '', 'modern', 'Premium', {}, true]) assert.equal(productPageStyle(value), 'classic')
  assert.equal(productPageStyle('premium'), 'premium')
  assert.equal(productPageStyle('classic'), 'classic')
})
test('sections hide only on explicit false; empty and unsafe policy links never render', () => {
  const source = { sections: { overview: false, reviews: 'false' }, policy_links: [{ label: 'Returns', url: '/returns' }, { label_ar: 'Policy', url: 'https://merchant.example/policy' }, { label: 'Unsafe', url: 'javascript:alert(1)' }] }
  const normalized = normalizeProductPageConfig(source)
  assert.equal(normalized.sections.overview, false); assert.equal(normalized.sections.reviews, true)
  assert.deepEqual(normalized.policy_links.map(row => row.url), ['/returns', 'https://merchant.example/policy'])
  assert.equal(productPageConfigError(source), 'invalidLink')
  assert.equal(productPageEditorConfig(source).policy_links[2].url, 'javascript:alert(1)', 'invalid drafts remain editable')
  assert.equal(productPageConfigError({ policy_links: [{ label: '', label_ar: '', url: '/returns' }] }), 'linkLabel')
  assert.equal(productPageConfigError({ policy_links: Array(5).fill({ label: 'Link', url: '/help' }) }), 'linksLimit')
})
test('locale presentation formats the same authoritative product price', () => {
  for (const locale of ['en-US', 'ar-EG']) {
    assert.equal(formatProductPagePrice(1799.5, locale), new Intl.NumberFormat(locale, { style: 'currency', currency: 'EGP', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(1799.5))
  }
})
test('presentation commands accept bounded metadata without price or inventory fields', () => {
  const id = '11111111-1111-4111-8111-111111111111', body = { request_id: id, expected_revision: 0, content: { videos: [], related: [], compatible: [] } }
  assert.equal(presentationCommand(body).p_expected_revision, 0)
  for (const invalid of [{ ...body, price: 1 }, { ...body, expected_revision: -1 }, { ...body, request_id: 'bad' }, { ...body, content: { ...body.content, is_published: true } }, { ...body, content: { ...body.content, related: [id, id] } }]) assert.throws(() => presentationCommand(invalid))
})
test('Classic retains its frozen markup and both styles use the one existing route authority', async () => {
  const source = await readFile('app/components/product/Classic.vue', 'utf8'), { descriptor } = parse(source)
  const expected = '021990c39cbab51f07ab84cce798d66c5f2c78eef886309eee62da917642b1fe'
  assert.equal(createHash('sha256').update(descriptor.template.content).digest('hex'), expected)
  const route = await readFile('app/pages/products/[slug].vue', 'utf8')
  const sharedScript = parse(route).descriptor.scriptSetup.content.split('const { data: productAppearance }')[0].trim()
  assert.equal(createHash('sha256').update(sharedScript).digest('hex'), '318c3eeb1fd7b42e5025d4d0aca6306ed49db3356c70c950b400032012d398c7', 'Shared route baseline includes the approved scoped purchasing guard')
  assert.equal((route.match(/const handleAddToCart\s*=/g) || []).length, 1)
  assert.match(route, /provideProductDetailContext/)
  assert.match(route, /productPageStyle === 'premium'/)
  const premium = await readFile('app/components/product/Premium.vue', 'utf8')
  assert.match(premium, /useProductDetailContext\(\)/)
  assert.doesNotMatch(premium, /\.from\(['"](?:products|product_variants)|\.rpc\(['"]commerce_|addItem\(/)
  for (const text of [route, premium]) assert.doesNotMatch(text, /variant\.price|selectedVariant\.value\?\.price/)
})

test('Premium consolidates repeated authored groups and separates only explicit box contents', () => {
  const rows = [{id: '1',label:'DPI',value:'8000',definition:{group_name:'Performance'}},{id:'2',label:'Weight',value:'60 g',definition:{group_name:'Physical'}},{id:'3',label:'Polling',value:'1000 Hz',definition:{group_name:'Performance'}},{id:'4',label:'Box contents',value:'Mouse\nCable'},{id:'5',label:'Model',value:'M1'}]
  const data = premiumSpecificationContent(rows)
  assert.deepEqual(data.groups[0].items.map(row => row.id), ['1','3'])
  assert.equal(data.included[0].value, 'Mouse\nCable'); assert.equal(data.model, 'M1')
  assert.equal(premiumSpecificationContent([{label:'Compatibility',value:'Windows'}]).included.length,0)
})
