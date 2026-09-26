import assert from 'node:assert/strict'
import test from 'node:test'
import { buildProductGallery, selectProductGalleryImages, visibleProductSpecifications, productSavings, pickRelatedProducts } from '../app/utils/productDetail.js'

test('gallery keeps the main image, variant images, and unique usable URLs', () => {
  const product = { image_url: '/main.jpg', title: 'Keyboard' }
  assert.deepEqual(buildProductGallery(product, []), [{ url: '/main.jpg', alt: 'Keyboard' }])
  assert.deepEqual(buildProductGallery(product, [
    { image_url: '/main.jpg' }, { image_url: '/side.jpg', alt_text: 'Side' },
    { image_url: '/side.jpg' }, { image_url: 'javascript:bad' }
  ]), [{ url: '/main.jpg', alt: 'Keyboard' }, { url: '/side.jpg', alt: 'Side' }])
  assert.deepEqual(buildProductGallery(product, [{ image_url: '/side.jpg' }], ['/main.jpg']), [{ url: '/side.jpg', alt: 'Keyboard' }])
  assert.deepEqual(buildProductGallery({}, []), [])
})

test('variant galleries only show images for the selected option', () => {
  const images = [{ variant_id: 'blue', image_url: '/blue.jpg' }, { variant_id: 'red', image_url: '/red.jpg' }]
  assert.deepEqual(selectProductGalleryImages(images, false, ''), images)
  assert.deepEqual(selectProductGalleryImages(images, true, ''), [])
  assert.deepEqual(selectProductGalleryImages(images, true, 'red'), [images[1]])
})

test('specifications preserve order and omit incomplete rows', () => {
  const rows = [{ label: 'Model', value: 'A'.repeat(200) }, { label: ' ', value: 'x' }, { label: 'DPI', value: '8000' }, { label: 'Weight', value: '' }]
  assert.deepEqual(visibleProductSpecifications(rows), [rows[0], rows[2]])
  assert.deepEqual(visibleProductSpecifications([]), [])
})

test('savings only reflect real discounts', () => {
  assert.deepEqual(productSavings(750, 1000), { amount: 250, percent: 25 })
  assert.deepEqual(productSavings(1000, 1000), { amount: 0, percent: 0 })
  assert.deepEqual(productSavings(1100, 1000), { amount: 0, percent: 0 })
})

test('related products favor category and brand and reject bad records', () => {
  const product = { id: 'current', category_id: 'c', brand_id: 'b' }
  const items = [
    { id: 'other-brand', title: 'B', slug: 'b', price: 1, category_id: 'x', brand_id: 'b' },
    { id: 'same-category', title: 'C', slug: 'c', price: 2, category_id: 'c', brand_id: 'x' },
    { id: 'current', title: 'Self', slug: 'self', price: 1, category_id: 'c', brand_id: 'b' },
    { id: 'hidden', title: 'Hidden', slug: 'hidden', price: 1, is_published: false },
    { id: 'invalid', title: 'Invalid', slug: '', price: 1 }
  ]
  assert.deepEqual(pickRelatedProducts(product, items).map((item) => item.id), ['same-category', 'other-brand'])
})
