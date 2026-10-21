import test from 'node:test'
import assert from 'node:assert/strict'
import { inspectPdcLookupBytes } from '../scripts/lib/pdcLookupSchema.mjs'

const inspect = (value, options = {}) => inspectPdcLookupBytes(Buffer.from(JSON.stringify(value)), {
  companyId: '123456', productId: 1, privateValues: ['SYNTHETIC_SECRET_CANARY', '123456'], ...options
})
const row = (id = 1, name = 'SYNTHETIC_PRODUCT_NAME_CANARY') => ({ id, name })

test('schema-only analysis emits field names and types without scalar values', () => {
  const result = inspect([{ ...row(), CompanyID: '123456', extra: 'SYNTHETIC_SECRET_CANARY' }, row(2)])
  assert.equal(result.normalization, 'PASS'); assert.equal(result.company_echo, 'MATCH_ONLY')
  assert.equal(result.saved_product, 'MATCH'); assert.equal(result.account_ownership, 'UNPROVEN')
  assert.equal(result.provider_authentication, 'UNPROVEN')
  assert.equal(result.shape.elements[0].fields.find(item => item.field === 'name').schema.type, 'string')
  const serialized = JSON.stringify(result)
  for (const secret of ['SYNTHETIC_PRODUCT_NAME_CANARY', 'SYNTHETIC_SECRET_CANARY', '123456']) assert.equal(serialized.includes(secret), false)
})

test('normalization and company-echo failure remain separate', () => {
  const result = inspect([{ ...row(), CompanyID: { toString: null } }, row(2)])
  assert.equal(result.normalization, 'PASS'); assert.equal(result.company_echo, 'UNSUPPORTED_TYPE')
  assert.equal(result.saved_product, 'MATCH')
})

test('a saved selection is not declared missing after normalization failure', () => {
  for (const input of [[row(0)], [row(1, '')], [row(), row()], [{ ProductID: 1, ProductName: 'SYNTHETIC_PRODUCT_NAME_CANARY' }]]) {
    const result = inspect(input)
    assert.equal(result.normalization, 'REJECTED'); assert.equal(result.saved_product, 'NOT_EVALUATED')
  }
})

test('metadata distinguishes invalid names, IDs, conversions and duplicates', () => {
  assert.equal(inspect([row(0)]).validation.invalid_integer_ids, 1)
  assert.equal(inspect([row(1, null)]).validation.invalid_names, 1)
  assert.equal(inspect([row(), row('01')]).validation.duplicate_ids, 1)
  assert.equal(inspect([row({ toString: null })]).validation.id_conversion_exceptions, 1)
  assert.equal(inspect([row(true)]).validation.nonprimitive_id_types, 1)
  assert.equal(inspect([row(true)]).normalization, 'PASS')
})

test('missing echoes, scalar mismatches and unsupported echo types are explicit', () => {
  assert.equal(inspect([row()]).company_echo, 'ABSENT')
  assert.equal(inspect([{ ...row(), CompanyID: '654321' }]).company_echo, 'MISMATCH')
  assert.equal(inspect([{ ...row(), CompanyID: ['123456'] }]).company_echo, 'UNSUPPORTED_TYPE')
  assert.equal(inspect([row(2)]).saved_product, 'MISMATCH')
  assert.equal(inspect([row()], { productId: null }).saved_product, 'NOT_EVALUATED')
})

test('partial and unsupported wrappers preserve the actual row-extraction result', () => {
  for (const input of [{ data: [row()], hasMore: true }, { data: [row()], totalCount: 2 }, { products: [row()] }, [null]]) {
    const result = inspect(input)
    assert.ok(result.row_extraction === 'REJECTED' || result.normalization === 'REJECTED')
    assert.equal(result.saved_product, 'NOT_EVALUATED')
  }
})

test('unsafe field names are withheld and make schema evidence incomplete', () => {
  for (const field of ['SYNTHETIC_SECRET_CANARY', 'customer@example.invalid', '123456', 'x'.repeat(65)]) {
    const result = inspect([{ ...row(), [field]: 'SYNTHETIC_VALUE' }])
    assert.equal(result.schema_complete, false)
    assert.equal(JSON.stringify(result).includes(field), false)
    assert.equal(JSON.stringify(result).includes('SYNTHETIC_VALUE'), false)
  }
})

test('all rows are validated even when the schema projection reaches its limit', () => {
  const rows = Array.from({ length: 1000 }, (_, index) => row(index + 1, 'x'))
  rows[999].id = 1
  const result = inspect(rows)
  assert.equal(result.schema_complete, false)
  assert.equal(result.validation.duplicate_ids, 1)
  assert.equal(result.validation.first_invalid_row, 999)
  assert.equal(result.normalization, 'REJECTED')
  assert.ok(Buffer.byteLength(JSON.stringify(result)) <= 8192)
})

test('invalid JSON and oversized input produce fixed outcomes', () => {
  assert.equal(inspectPdcLookupBytes(Buffer.from('{')).json, 'REJECTED')
  assert.equal(inspectPdcLookupBytes(Buffer.alloc(65537)).capture, 'BODY_REFUSED')
  assert.equal(inspectPdcLookupBytes('not-a-buffer').capture, 'BODY_REFUSED')
})

test('normalization metadata covers both name and ID failures independently', () => {
  const result = inspect([{ id: 0, name: null }, row(2)])
  assert.equal(result.validation.invalid_integer_ids, 1)
  assert.equal(result.validation.invalid_names, 1)
  assert.equal(result.validation.first_invalid_row, 0)
})

test('body structure never forwards nested scalar strings or numbers', () => {
  const result = inspect([{ ...row(), unexpected: { code: 987654, label: 'SYNTHETIC_NESTED_CANARY', values: ['SYNTHETIC_ARRAY_CANARY'] } }])
  for (const value of ['987654', 'SYNTHETIC_NESTED_CANARY', 'SYNTHETIC_ARRAY_CANARY']) assert.equal(JSON.stringify(result).includes(value), false)
})

test('a private scalar reused as a field name is withheld', () => {
  const result = inspect([{ ...row(), SYNTHETIC_PRODUCT_NAME_CANARY: false }])
  assert.equal(result.schema_complete, false)
  assert.equal(JSON.stringify(result).includes('SYNTHETIC_PRODUCT_NAME_CANARY'), false)
})

test('field, depth and output limits never present partial schema as complete', () => {
  const tooManyFields = Object.fromEntries(Array.from({ length: 65 }, (_, index) => ['field_' + index, 'SYNTHETIC_VALUE']))
  assert.equal(inspect([tooManyFields]).schema_complete, false)
  const deep = { nested: { nested: { nested: { nested: { nested: 'SYNTHETIC_DEEP' } } } } }
  assert.equal(inspect([deep]).schema_complete, false)
  const wide = Object.fromEntries(Array.from({ length: 64 }, (_, index) => ['field_' + index + '_'.repeat(45), { nested: 'SYNTHETIC_VALUE' }]))
  const result = inspect([wide, wide])
  assert.equal(result.schema_complete, false)
  assert.ok(Buffer.byteLength(JSON.stringify(result)) <= 8192)
  assert.equal(JSON.stringify(result).includes('SYNTHETIC_VALUE'), false)
})

test('very deep valid JSON is refused without exposing an exception', () => {
  const result = inspectPdcLookupBytes(Buffer.from('['.repeat(10000) + '0' + ']'.repeat(10000)))
  assert.equal(result.capture, 'STRUCTURE_REFUSED')
  assert.equal(result.schema_complete, false)
})
