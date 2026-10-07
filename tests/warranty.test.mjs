import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createI18n } from 'vue-i18n'
import { defaultWarrantyConfig, normalizeProductWarranty, warrantyEntitlement, warrantyDurationKey, warrantyInputErrors } from '../app/utils/warranty.js'
import { normalizeAdminProductPayload, pickMutableProductFields } from '../server/utils/adminProducts.js'

const included = (value = 12, unit = 'months') => ({ warranty_status: 'included', warranty_duration_value: value, warranty_duration_unit: unit })
const snapshot = terms => ({ ...terms, warranty_snapshot_at: '2026-10-07T09:00:00Z', warranty_start_basis: terms.warranty_status === 'included' ? 'unresolved' : null })

test('product warranty distinguishes unconfigured, explicit none, months and years', () => {
  assert.deepEqual(normalizeProductWarranty({}), defaultWarrantyConfig())
  assert.deepEqual(normalizeProductWarranty({ warranty_status: 'none' }), { warranty_status: 'none', warranty_duration_value: null, warranty_duration_unit: null })
  assert.deepEqual(normalizeProductWarranty(included('12')), included(12))
  assert.deepEqual(normalizeProductWarranty(included(3, 'years')), included(3, 'years'))
  assert.deepEqual(normalizeProductWarranty(included(120)), included(120))
  assert.deepEqual(normalizeProductWarranty(included(10, 'years')), included(10, 'years'))
})

test('server normalization rejects malformed, fractional, zero, negative and unbounded durations', () => {
  for (const value of [undefined, null, '', ' ', true, false, [], [12], {}, 0, -1, 0.5, 12.5, 121, Infinity, NaN, '1e2', '12x', '12.0', '-1', '99999999999999999999999999']) {
    assert.throws(() => normalizeProductWarranty({ ...included(), warranty_duration_value: value }), error => error.warrantyErrorKey === 'invalidDuration', String(value))
  }
  assert.throws(() => normalizeProductWarranty(included(11, 'years')), /whole/)
  for (const unit of ['days', 'year', 'Months', '', null, true, ['months'], {}]) assert.throws(() => normalizeProductWarranty(included(12, unit)), /months or years/)
  for (const status of [null, false, 1, 'active', 'NONE', '', ['none']]) assert.throws(() => normalizeProductWarranty({ warranty_status: status }), /valid warranty option/)
  for (const status of ['none', 'unknown']) assert.throws(() => normalizeProductWarranty({ ...included(), warranty_status: status }), /Only included/)
})

test('admin validation includes warranty, preserves omitted terms and rolls them back with existing product fields', () => {
  const product = { title: 'Fixture', price: 100, stock_quantity: 0, ...included() }
  assert.deepEqual(normalizeProductWarranty({}, { previous: product }), included())
  assert.equal(normalizeAdminProductPayload({ title: 'Fixture', price: 100, stock_quantity: 0 }, { previousProduct: product }).warranty_duration_value, 12)
  assert.equal(normalizeAdminProductPayload({ ...product, ...included(3, 'years') }).warranty_duration_unit, 'years')
  assert.equal(pickMutableProductFields(product).warranty_duration_value, 12)
  assert.throws(() => normalizeAdminProductPayload({ ...product, warranty_duration_value: -1 }), error => error.statusCode === 400 && error.data.warrantyErrorKey === 'invalidDuration')
})

test('historical and unconfigured entitlement remain unknown and never read current catalog/specification', () => {
  for (const item of [{}, { warranty_status: 'none' }, { ...included(), product: included(24), specifications: [{ label: 'Warranty', value: '3 years' }] }, snapshot(defaultWarrantyConfig())]) {
    const entitlement = warrantyEntitlement(item)
    assert.equal(entitlement.status, 'unknown')
    assert.equal(entitlement.hasWarranty, null)
    assert.equal(entitlement.duration, null)
    assert.equal(entitlement.expiryDate, null)
  }
  assert.equal(warrantyEntitlement(snapshot({ warranty_status: 'none' })).status, 'not_applicable')
  assert.equal(warrantyEntitlement(snapshot({ warranty_status: 'none' })).hasWarranty, false)
})

test('known purchased duration does not invent a start, expiry, active or expired status', () => {
  for (const terms of [included(), included(3, 'years')]) {
    const result = warrantyEntitlement({ ...snapshot(terms), created_at: '2020-01-31T23:00:00Z', paid_at: '2020-02-29T00:00:00Z', delivered_at: '2020-03-31T12:00:00Z', warranty_expiry_date: '2099-01-01' })
    assert.deepEqual(result.duration, { value: terms.warranty_duration_value, unit: terms.warranty_duration_unit })
    assert.equal(result.hasWarranty, true)
    assert.equal(result.startBasis, 'unresolved')
    assert.equal(result.startDate, null)
    assert.equal(result.expiryDate, null)
    assert.equal(result.status, 'unknown')
  }
  for (const bad of [{ warranty_start_basis: 'order_date' }, { warranty_duration_value: 0 }, { warranty_snapshot_at: 'bad' }]) assert.equal(warrantyEntitlement({ ...snapshot(included()), ...bad }).hasWarranty, null)
})

test('English and Arabic render purchased duration, none and historical unknown distinctly', () => {
  for (const locale of ['en', 'ar']) {
    const messages = JSON.parse(readFileSync(new URL(`../i18n/locales/${locale}.json`, import.meta.url), 'utf8'))
    const i18n = createI18n({ legacy: false, locale, messages: { [locale]: messages } }).global
    assert.equal(i18n.t('warranty.title'), locale === 'ar' ? 'الضمان' : 'Warranty')
    for (const terms of [included(), included(2, 'years'), included(1), included(1, 'years')]) {
      const duration = warrantyEntitlement(snapshot(terms)).duration
      const rendered = i18n.t(warrantyDurationKey(duration), { value: duration.value })
      assert.notEqual(rendered, warrantyDurationKey(duration))
      assert.ok(duration.value === 1 && locale === 'ar' ? /واحد/.test(rendered) : rendered.includes(String(duration.value)))
    }
    assert.notEqual(i18n.t('warranty.none'), i18n.t('warranty.unavailable'))
    for (const key of Object.keys(warrantyInputErrors)) assert.notEqual(i18n.t('warranty.' + key), 'warranty.' + key)
  }
})
