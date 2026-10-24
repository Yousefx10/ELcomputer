import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, mkdtemp, writeFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { runInNewContext } from 'node:vm'
import { parse } from 'acorn'
import { createError } from 'h3'
import { encryptShippingSecret, decryptShippingSecret } from '../server/utils/shippingSecrets.js'
import { parsePdcStatusDate } from '../server/utils/pdcTracking.js'

test('wrong deployment approval stops before target access or any intent', async t => {
  const work = await mkdtemp(join(tmpdir(), 'pdc-release-denied-'))
  t.after(() => rm(work, { recursive: true, force: true }))
  await writeFile(work + '/plan.json', JSON.stringify({ seal: 'a'.repeat(64) }))
  const error = await promisify(execFile)(process.execPath, [resolve('scripts/pdc-http-client-release/operator.mjs'), 'apply', work, 'b'.repeat(64)]).then(() => null, error => error)
  assert.equal(error.code, 1); assert.match(error.stderr, /Exact owner deployment approval required/)
  assert.deepEqual(await readdir(work), ['plan.json'])
})

test('deployment retains schema, closed gates, private qualification and one-use guards', async () => {
  const remote = await readFile('scripts/pdc-http-client-release/remote.py', 'utf8')
  assert.match(remote, /schema_version'\]==91/)
  assert.match(remote, /payload.get\('approved'\)==seal/)
  assert.match(remote, /candidate_proof\['private_purchase_closed'\]/)
  assert.match(remote, /activation-intent.json/); assert.match(remote, /restart-intent.json/)
  assert.match(remote, /NUXT_SHIPPING_LIVE_REQUESTS_ENABLED/)
  assert.doesNotMatch(remote, /systemctl','(?:restart|reload)','caddy/)
})

test('consumed deployment stops before another target inspection or backup', async t => {
  const work = await mkdtemp(join(tmpdir(), 'pdc-release-consumed-'))
  t.after(() => rm(work, { recursive: true, force: true }))
  await writeFile(work + '/plan.json', JSON.stringify({ seal: 'a'.repeat(64) }))
  await writeFile(work + '/execution-intent.json', '{}')
  const error = await promisify(execFile)(process.execPath, [resolve('scripts/pdc-http-client-release/operator.mjs'), 'apply', work, 'a'.repeat(64)]).then(() => null, error => error)
  assert.equal(error.code, 1); assert.match(error.stderr, /Consumed approval/)
  assert.deepEqual((await readdir(work)).sort(), ['execution-intent.json', 'plan.json'])
})

test('changed deployment content stops before SSH', async t => {
  const work = await mkdtemp(join(tmpdir(), 'pdc-release-tampered-'))
  t.after(() => rm(work, { recursive: true, force: true }))
  await writeFile(work + '/plan.json', JSON.stringify({ schema_version: 92, seal: 'a'.repeat(64) }))
  const error = await promisify(execFile)(process.execPath, [resolve('scripts/pdc-http-client-release/operator.mjs'), 'check', work]).then(() => null, error => error)
  assert.equal(error.code, 1); assert.deepEqual(await readdir(work), ['plan.json'])
})

test('exact candidate uses the corrected headers and required dates for every provider operation', { skip: !process.env.PDC_RELEASE_ARTIFACT }, async () => {
  globalThis.useRuntimeConfig = () => ({ shippingCredentialsEncryptionKey: 'offline-compiled-pdc-key-over-32-characters' })
  const code = await readFile(process.env.PDC_RELEASE_ARTIFACT + '/server/chunks/nitro/nitro.mjs', 'utf8')
  const names = ['PDC_PRODUCTION_BASE_URL', 'PDC_HTTP_USER_AGENT', 'PDC_ENDPOINTS', 'cleanText', 'getPdcHeaders', 'PDC_TEST_BASE_URL', 'validatePdcBaseUrl', 'getPdcEndpointUrl', 'readPdcJsonResponse', 'requestPdcJson', 'readPdcBytes', 'requestPdcLabel', 'unavailable$2', 'getPdcStatusFilters', 'requirePdcStatusDates', 'requestPdcLookup']
  const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module' }), declarations = new Map()
  for (const node of ast.body) if (node.type === 'VariableDeclaration') for (const value of node.declarations) if (value.id.type === 'Identifier') declarations.set(value.id.name, 'const ' + code.slice(value.start, value.end) + ';')
  for (const name of names) assert.ok(declarations.has(name), name)
  const compiled = runInNewContext(names.map(name => declarations.get(name)).join('\n') + '\n;({requestPdcJson,requestPdcLabel,requestPdcLookup,getPdcStatusFilters});', {
    URL, AbortSignal, Buffer, Date, Response, decryptShippingSecret, parsePdcStatusDate, createError$1: createError, fetch: () => { throw Error('Network forbidden') }
  })
  const settings = { api_mode: 'production', base_url: 'https://clientsapi.pdc-eg.com/api/ClientUsers/V6/', company_id: '987', label_template_id: 1, access_token_encrypted: encryptShippingSecret('offline-token') }
  const db = { from(table) { assert.equal(table, 'shipping_order_jobs'); return { select() { return this }, eq() { return this }, maybeSingle() { return this }, abortSignal() { return Promise.resolve({ data: { created_at: '2025-01-01T12:00:00Z' } }) } } } }
  const dates = await compiled.getPdcStatusFilters(db, { orderId: 'fixture-order', ref: 'fixture-ref', awb: 'fixture-awb' }, new Date('2026-10-24T10:00:00Z'))
  assert.deepEqual(JSON.parse(JSON.stringify(dates)), { awBs: 'fixture-awb', reFs: 'fixture-ref', fromDate: '2024-12-31T00:00:00.000Z', toDate: '2026-10-25T00:00:00.000Z' })
  const calls = []
  const fetcher = async (url, options) => {
    calls.push(url)
    assert.equal(options.headers['User-Agent'], 'Storefront-PDC/1.0'); assert.equal(options.headers.AccessToken, 'offline-token')
    assert.equal(options.headers.CompanyID, '987'); assert.equal(options.headers.Accept, 'application/json')
    assert.equal(Object.keys(options.headers).some(key => /cookie/i.test(key)), false)
    assert.equal(options.redirect, 'error')
    if (url.endsWith('GetShipmentsStatus')) assert.deepEqual(JSON.parse(options.body), JSON.parse(JSON.stringify(dates)))
    return url.endsWith('ExportPDF') ? new Response('%PDF-1.7\nOffline fixture', { headers: { 'content-type': 'application/pdf' } }) : Response.json([])
  }
  for (const endpoint of ['GetCities', 'GetProducts']) await compiled.requestPdcLookup(settings, endpoint, undefined, fetcher)
  await compiled.requestPdcLookup(settings, 'GetShipmentsStatus', dates, fetcher)
  await compiled.requestPdcJson({ settings, endpoint: 'SaveShipmentEx', body: { shipments: [{ toRef: 'fixture-ref', toAddress: 'عنوان اختبار', weight: 1 }] }, fetcher })
  await compiled.requestPdcLabel({ settings, awb: 'fixture-awb', fetcher })
  assert.equal(calls.length, 5)
  await assert.rejects(() => compiled.requestPdcLookup(settings, 'GetShipmentsStatus', { awBs: 'fixture-awb', reFs: 'fixture-ref' }, fetcher))
  assert.equal(calls.length, 5)
  let failures = 0
  await assert.rejects(() => compiled.requestPdcJson({ settings, endpoint: 'SaveShipmentEx', body: {}, fetcher: async () => { failures++; return Response.json({}, { status: 500 }) } }))
  assert.equal(failures, 1)
  for (const caller of ['{ orderId, awb: claim.awb, ref: claim.ref }', '{ orderId, ref: job2.to_ref }', '{ jobId: job.id, awb: job.awb || "", ref: job.ref }']) assert.ok(code.includes(caller))
})
