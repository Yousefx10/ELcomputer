import test from 'node:test'
import assert from 'node:assert/strict'
import { measuredParcelWeight } from '../app/utils/parcelWeight.js'

test('measured parcel weight accepts explicit positive kilograms at storage precision', () => {
  for (const [value, expected] of [['0.001', 0.001], ['0.875', 0.875], [2.345, 2.345], ['99999.999', 99999.999], ['10.000', 10]]) assert.equal(measuredParcelWeight(value), expected)
})
test('missing, coerced, rounded and non-finite weights cannot become a default parcel', () => {
  for (const value of [null, undefined, true, false, [], {}, '', ' ', ' 1', '1 ', '01', '1e2', '1,5', '-1', '+1', '0', 0, -1, Infinity, NaN, '0.0001', '1.2345', 100000]) assert.equal(measuredParcelWeight(value), null)
})
