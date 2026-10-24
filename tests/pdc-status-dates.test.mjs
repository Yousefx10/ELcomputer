import test from 'node:test'
import assert from 'node:assert/strict'
import { getPdcStatusFilters, requestPdcLookup } from '../server/utils/pdcLookups.js'
import { encryptShippingSecret } from '../server/utils/shippingSecrets.js'

const fixture = (created_at, error = null) => {
  const reads = []
  const db = { from(table) { reads.push(['from', table]); return {
    select(fields) { reads.push(['select', fields]); return this },
    eq(key, value) { reads.push(['eq', key, value]); return this },
    maybeSingle() { return this },
    abortSignal() { return Promise.resolve({ data: created_at ? { created_at } : null, error }) }
  } } }
  return { db, reads }
}
const now = new Date('2026-10-24T10:00:00Z')

test('dated lookups include the saved shipment lifetime and preserve exact identifiers', async () => {
  for (const identifiers of [{ orderId: 'fixture-order' }, { jobId: 'fixture-claim-job' }]) {
    const f = fixture('2025-01-01T00:30:00+02:00')
    const body = await getPdcStatusFilters(f.db, { ...identifiers, awb: 'FIXTURE-AWB', ref: 'FIXTURE-REF' }, now)
    assert.deepEqual(body, { awBs: 'FIXTURE-AWB', reFs: 'FIXTURE-REF', fromDate: '2024-12-30T00:00:00.000Z', toDate: '2026-10-25T00:00:00.000Z' })
    assert.deepEqual(f.reads[0], ['from', identifiers.jobId ? 'shipping_claim_jobs' : 'shipping_order_jobs'])
    assert.deepEqual(f.reads[1], ['select', 'created_at'])
    assert.deepEqual(f.reads.at(-1), ['eq', 'to_ref', 'FIXTURE-REF'])
  }
})

test('missing, invalid, future or unreadable shipment dates fail before provider transport', async () => {
  for (const [date, error] of [[null, null], ['invalid', null], ['2027-01-01T00:00:00Z', null], ['2026-01-01T00:00:00Z', { message: 'PRIVATE_CANARY' }]]) {
    await assert.rejects(() => getPdcStatusFilters(fixture(date, error).db, { orderId: 'fixture', ref: 'REF' }, now), error => error.statusCode === 502 && !error.message.includes('CANARY'))
  }
})

test('status transport refuses omitted, impossible, timezone-free or reversed dates without network', async () => {
  let calls = 0
  const fetcher = async () => { calls++; throw Error('Unexpected provider call') }
  const valid = { awBs: '', reFs: 'REF', fromDate: '2026-10-23T00:00:00+03:00', toDate: '2026-10-25T00:00:00+03:00' }
  for (const body of [undefined, {}, { ...valid, fromDate: undefined }, { ...valid, toDate: undefined }, { ...valid, fromDate: '2026-02-30T00:00:00Z' }, { ...valid, fromDate: '2026-10-23T00:00:00' }, { ...valid, toDate: valid.fromDate }, { ...valid, fromDate: valid.toDate, toDate: valid.fromDate }]) {
    await assert.rejects(() => requestPdcLookup({}, 'GetShipmentsStatus', body, fetcher), { statusCode: 502 })
  }
  assert.equal(calls, 0)
})

test('valid explicit dates reach PDC unchanged with the corrected client', async () => {
  globalThis.useRuntimeConfig = () => ({ shippingCredentialsEncryptionKey: 'offline-date-test-key-over-32-characters' })
  const settings = { api_mode: 'production', base_url: 'https://clientsapi.pdc-eg.com/api/ClientUsers/V6/', company_id: '789', access_token_encrypted: encryptShippingSecret('offline-token') }
  const body = { awBs: 'FIXTURE-AWB', reFs: 'FIXTURE-REF', fromDate: '2026-10-23T00:00:00+03:00', toDate: '2026-10-25T00:00:00+03:00' }
  let calls = 0
  await requestPdcLookup(settings, 'GetShipmentsStatus', body, async (_url, options) => {
    calls++; assert.deepEqual(JSON.parse(options.body), body)
    assert.equal(options.headers['User-Agent'], 'Storefront-PDC/1.0')
    return Response.json([])
  })
  assert.equal(calls, 1)
})
