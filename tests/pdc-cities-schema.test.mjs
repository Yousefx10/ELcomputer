import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizePdcLookup } from '../server/utils/pdcLookups.js'

const city = (id = 81, name = 'Synthetic area') => ({ cityID: id, cityName: name, zoneID: 12, companyID: 123456 })
const normalize = value => normalizePdcLookup(value, 'GetCities')

test('GetCities accepts its observed endpoint fields and discards unrelated metadata', () => {
  assert.deepEqual(normalize([city()]), [{ id: 81, name: 'Synthetic area' }])
  for (const key of ['data', 'items', 'shipments']) assert.deepEqual(normalize({ [key]: [city()] }), [{ id: 81, name: 'Synthetic area' }])
})

test('city fields remain scoped to GetCities and product fields to GetProducts', () => {
  for (const operation of ['GetProducts', 'GetShipmentsStatus', undefined]) assert.throws(() => normalizePdcLookup([city()], operation))
  assert.throws(() => normalize([{ productID: 81, productName: 'Synthetic service' }]))
  assert.deepEqual(normalizePdcLookup([{ productID: 81, productName: 'Synthetic service' }], 'GetProducts'), [{ id: 81, name: 'Synthetic service' }])
})

test('legacy field precedence is preserved and invalid values cannot fall through', () => {
  assert.deepEqual(normalize([{ ...city(), id: 82, name: 'Canonical' }]), [{ id: 82, name: 'Canonical' }])
  assert.deepEqual(normalize([{ ...city(), id: null, ID: 82, name: null, Name: 'Legacy' }]), [{ id: 82, name: 'Legacy' }])
  for (const row of [{ ...city(), id: 0 }, { ...city(), name: '' }, { ...city(), id: true }]) assert.throws(() => normalize([row]))
})

test('city IDs retain integer, type, bounds and uniqueness checks', () => {
  for (const id of [true, false, [], [81], {}, null, '', ' ', '0x51', '8.1e1', '81.0', 0, -1, 1.5, 2147483648, Infinity]) assert.throws(() => normalize([city(id)]))
  for (const id of [81, '81', '081', ' 81 ', 2147483647]) assert.equal(normalize([city(id)])[0].id, Number(id))
  for (const duplicate of [city('081'), { id: 81, name: 'Canonical duplicate' }, { ID: 81, Name: 'Legacy duplicate' }]) assert.throws(() => normalize([city(), duplicate]))
})

test('city names retain required bounded text validation', () => {
  for (const name of [null, '', ' ', true, [], {}, 'x'.repeat(201), 'x\0y']) assert.throws(() => normalize([city(81, name)]))
})

test('partial envelopes, unsupported aliases and excessive rows remain rejected', () => {
  for (const body of [{ data: [city()], hasMore: true }, { data: [city()], nextPage: 2 }, { data: [city()], totalCount: 2 }, { cities: [city()] }, [{ CityID: 81, CityName: 'Unconfirmed casing' }]]) assert.throws(() => normalize(body))
  assert.equal(normalize(Array.from({ length: 5000 }, (_, i) => city(i + 1))).length, 5000)
  assert.throws(() => normalize(Array.from({ length: 5001 }, (_, i) => city(i + 1))))
})
