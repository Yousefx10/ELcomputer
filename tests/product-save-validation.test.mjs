import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { prepareProductSave, productId, throwProductSaveError } from '../server/utils/productSave.js'
import { normalizeAdminProductPayload } from '../server/utils/adminProducts.js'

const valid = () => ({ request_id: randomUUID(), title: 'Real product', slug: 'real-product', price: '0.29',
  primary_warehouse_id: randomUUID(), is_serialized: true, is_published: false,
  variants: [{ name: 'Default', code: 'DEFAULT', sku: '001234' }] })
const rejected = (value, field) => assert.throws(() => prepareProductSave({ ...valid(), [field]: value }, 'create'), e => e.statusCode === 400)

test('product prices require explicit decimal input and retain exact valid cents', () => {
  for (const value of [undefined, null, '', ' ', true, false, [], [1], {}, NaN, Infinity, -1, 1.001, '1e2', '1.001', '10000000000', '12x']) rejected(value, 'price')
  for (const value of [0, '0', '0.00', 0.29, '0.29', '125.50', '9999999999.99']) {
    assert.equal(prepareProductSave({ ...valid(), price: value }, 'create').p_payload.price, Number(value))
  }
  for (const value of [true, [], ' ', -1, 1.001]) rejected(value, 'old_price')
  assert.equal(prepareProductSave({ ...valid(), old_price: '' }, 'create').p_payload.old_price, null)
})

test('product references, required fields, SKUs and option codes reject coercion', () => {
  for (const value of [null, '', true, [], {}, 'x'.repeat(501)]) rejected(value, 'title')
  for (const value of ['bad/id', 'two words', '../product', 'عربي', true, 'x'.repeat(201)]) rejected(value, 'slug')
  for (const field of ['request_id', 'primary_warehouse_id', 'category_id', 'brand_id', 'default_supplier_id']) {
    for (const value of [true, [], {}, 'not-a-uuid']) rejected(value, field)
  }
  for (const value of [true, [], {}, 'x'.repeat(121), 'bad\nSKU', 'bad\tSKU', '\nBAD', 'BAD\t']) rejected(value, 'sku')
  assert.equal(prepareProductSave(valid(), 'create').p_variants[0].sku, '001234')
  for (const value of ['bad/code', 'two words', true, false, 0, 'x'.repeat(81)]) {
    assert.throws(() => prepareProductSave({ ...valid(), variants: [{ name: 'Option', code: value }] }, 'create'), e => e.statusCode === 400)
  }
  for (const value of [1, 'true', null]) rejected(value, 'is_published')
  assert.throws(() => prepareProductSave({ ...valid(), cost_price: 12 }, 'create'), e => e.statusCode === 400)
  assert.throws(() => productId('../secret'), e => e.statusCode === 400)
})

test('stock is never truncated or coerced and tracked catalog commands contain no stock projection', () => {
  for (const value of ['', null, true, [], '2.5', 2.5, '2x', '-1', '1e2', '2147483648']) rejected(value, 'stock_quantity')
  rejected(1, 'stock_quantity')
  assert.ok(!Object.hasOwn(prepareProductSave({ ...valid(), stock_quantity: 0 }, 'create').p_payload, 'stock_quantity'))
  for (const value of ['2.5', 2.5, '2x']) assert.throws(() => normalizeAdminProductPayload({ title: 'Legacy', price: 1, stock_quantity: value }), e => e.statusCode === 400)
  assert.throws(() => prepareProductSave({ ...valid(), variants: [{ name: 'Default', code: 'DEFAULT', quantity: 1 }] }, 'create'), e => e.statusCode === 400)
})

test('updates require their loaded revision and preserve omitted warranty configuration', () => {
  for (const value of [undefined, null, true, '1', -1, 0.5, 9007199254740992]) {
    assert.throws(() => prepareProductSave({ ...valid(), expected_revision: value }, 'update'), e => e.statusCode === 400)
  }
  const command = prepareProductSave({ ...valid(), expected_revision: 0 }, 'update')
  assert.equal(command.p_expected_revision, 0)
  assert.ok(!Object.hasOwn(command.p_payload, 'warranty_status'))
})

test('product errors return safe actionable messages without raw database diagnostics', () => {
  for (const [failure, status, reason] of [
    [{ code: '40001', message: 'catalog:conflict' }, 409, 'conflict'],
    [{ code: '23505', message: 'PRIVATE-SKU-detail' }, 409, 'duplicate'],
    [{ code: '42501', message: 'PRIVATE-permission' }, 403, 'permission'],
    [{ code: 'P0001', message: 'PRIVATE-audit-outage' }, 503, 'unconfirmed']
  ]) assert.throws(() => throwProductSaveError(failure), e => e.statusCode === status && e.data.productSaveError === reason && !e.message.includes('PRIVATE'))
})
