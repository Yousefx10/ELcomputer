// Offline investigation only. Requires owner-held, hash-pinned diagnostic bundles.
// Every network entry point is refused before a diagnostic bundle is imported.
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash, generateKeyPairSync, privateDecrypt, createDecipheriv, constants } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { runInNewContext } from 'node:vm'
import { syncBuiltinESMExports } from 'node:module'
import http from 'node:http'
import https from 'node:https'
import http2 from 'node:http2'
import net from 'node:net'
import tls from 'node:tls'
import dns from 'node:dns'
import { createError } from 'h3'
import { requestPdcLookup, normalizePdcLookup, pdcResponseRows, requirePdcReadAccess } from '../server/utils/pdcLookups.js'
import { encryptShippingSecret, decryptShippingSecret } from '../server/utils/shippingSecrets.js'
import { PDC_PRODUCTION_BASE_URL } from '../server/utils/pdcShipping.js'

let networkAttempts = 0
const refuse = () => { networkAttempts++; throw Error('Offline investigation refuses network') }
globalThis.fetch = refuse
http.request = http.get = https.request = https.get = http2.connect = refuse
net.connect = net.createConnection = tls.connect = dns.lookup = dns.resolve = refuse
net.Socket.prototype.connect = refuse
syncBuiltinESMExports()

const args = process.argv.slice(2)
const options = Object.fromEntries(Array.from({ length: args.length / 2 }, (_, i) => [args[i * 2], args[i * 2 + 1]]))
assert.equal(args.length % 2, 0)
assert.deepEqual(Object.keys(options).sort(), ['--capture-bundle', '--capture-sha256', '--lookup-bundle', '--lookup-sha256', '--output'].sort())
const loadPinned = async (path, expected) => {
  assert.match(expected, /^[a-f0-9]{64}$/)
  assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'), expected)
  return import(pathToFileURL(path).href)
}
const { runCapture } = await loadPinned(options['--capture-bundle'], options['--capture-sha256'])
const { runDiagnostic } = await loadPinned(options['--lookup-bundle'], options['--lookup-sha256'])
const fixtureKey = 'offline-investigation-synthetic-encryption-key-over-32-characters'
const runtime = () => ({ shippingCredentialsEncryptionKey: fixtureKey, shippingLiveRequestsEnabled: true })
globalThis.useRuntimeConfig = runtime
const settings = () => ({ api_mode: 'production', base_url: PDC_PRODUCTION_BASE_URL,
  company_id: '123456', product_id: 1, origin_city_id: 1, is_enabled: false,
  auto_create_labels: false, reverse_enabled: false, cod_enabled: false,
  access_token_encrypted: encryptShippingSecret('SYNTHETIC-TOKEN-ONLY') })
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 3072,
  publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } })
const unsealSynthetic = envelope => {
  const key = privateDecrypt({ key: privateKey, oaepHash: 'sha256', padding: constants.RSA_PKCS1_OAEP_PADDING }, Buffer.from(envelope.wrapped_key, 'base64'))
  const cipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'))
  cipher.setAuthTag(Buffer.from(envelope.tag, 'base64'))
  return JSON.parse(Buffer.concat([cipher.update(Buffer.from(envelope.ciphertext, 'base64')), cipher.final()]))
}
const capture = async (body, extra = {}, config = settings()) => {
  let requests = 0
  const bytes = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))
  const result = await runCapture({ settings: config, encryption_key: fixtureKey, recipient_public_key: publicKey,
    approval: 'OWNER_APPROVED_ONE_GETPRODUCTS_CAPTURE' }, async (url, request) => {
    requests++
    assert.equal(url, PDC_PRODUCTION_BASE_URL + 'GetProducts')
    assert.equal(request.method, 'GET'); assert.equal(request.body, undefined); assert.equal(request.redirect, 'error')
    return { status: 200, bytes, headers: { 'content-type': 'application/json' }, truncated: false, ...extra }
  })
  assert.equal(requests, 1)
  assert.equal(result.provider_request_count, 1)
  assert.equal(result.GetCities, 'NOT_ATTEMPTED'); assert.equal(result.automatic_retries, 0)
  return { result, report: result.evidence ? unsealSynthetic(result.evidence) : null }
}
const outcomes = []
const check = async (name, test) => {
  try { await test() } catch (error) { error.message = name + ': ' + error.message; throw error }
  outcomes.push({ case: name, result: 'PASS' })
}
const rejected = response => { assert.throws(() => normalizePdcLookup(response)) }
const accepted = response => { assert.equal(normalizePdcLookup(response).length, 1) }
const row = (id = 1, name = 'Synthetic name') => ({ id, name })
const lookupUrl = new URL('../server/utils/pdcLookups.js', import.meta.url)
const originalLookupSource = readFileSync(lookupUrl, 'utf8')
const oldIdLine = '    const id = Number(row?.id ?? row?.ID)'
const guardedIdLines = "    const rawId = row?.id ?? row?.ID\n    if (!['number', 'string'].includes(typeof rawId)) throw unavailable()\n    const id = Number(rawId)"
assert.equal(originalLookupSource.split(oldIdLine).length, 2)
const candidateSource = originalLookupSource.replace(oldIdLine, guardedIdLines)
  .replace(/from '([^']+)'/g, (_, path) => 'from ' + JSON.stringify(path.startsWith('.') ? new URL(path, lookupUrl).href : import.meta.resolve(path)))
const { normalizePdcLookup: strictCandidate } = await import('data:text/javascript;base64,' + Buffer.from(candidateSource).toString('base64'))

for (const [name, body, ok] of [
  ['lowercase', [row()], true], ['uppercase', [{ ID: 1, Name: 'Synthetic' }], true],
  ['mixed-case', [{ id: 1, Name: 'Synthetic' }], true], ['null-lowercase-fallback', [{ id: null, ID: 1, name: null, Name: 'Synthetic' }], true],
  ['invalid-lowercase-id-blocks-fallback', [{ id: 0, ID: 1, name: 'Synthetic' }], false],
  ['empty-lowercase-name-blocks-fallback', [{ id: 1, name: '', Name: 'Synthetic' }], false],
  ['unproven-product-alias', [{ ProductID: 1, ProductName: 'Synthetic' }], false],
  ['unproven-title-alias', [{ id: 1, title: 'Synthetic' }], false], ['wrong-id-casing', [{ Id: 1, name: 'Synthetic' }], false],
  ['wrong-name-casing', [{ id: 1, NAME: 'Synthetic' }], false], ['null-row', [null], false],
  ['string-row', ['Synthetic'], false], ['numeric-row', [1], false], ['array-row', [[1, 'Synthetic']], false],
  ['account-error-object', { error: 'Unauthorized synthetic account' }, false],
  ['account-error-rows', [{ error: 'Synthetic account disabled' }, { error: 'Synthetic error' }], false],
  ['named-error-row-still-normalizes', [row(1, 'Unauthorized synthetic')], true],
  ['empty-object-row', [{}], false], ['missing-id', [{ name: 'Synthetic' }], false], ['missing-name', [{ id: 1 }], false],
  ['data-wrapper', { data: [row()] }, true], ['items-wrapper', { items: [row()] }, true],
  ['shipments-wrapper', { shipments: [row()] }, true], ['unsupported-products-wrapper', { products: [row()] }, false],
  ['unsupported-capital-data-wrapper', { Data: [row()] }, false], ['nested-wrapper', { data: { items: [row()] } }, false],
  ['invalid-data-blocks-items-fallback', { data: {}, items: [row()] }, false], ['null-data-falls-through', { data: null, items: [row()] }, true],
  ['has-more', { data: [row()], hasMore: true }, false], ['next-page', { data: [row()], nextPage: 2 }, false],
  ['larger-total', { data: [row()], totalCount: 2 }, false], ['complete-total', { data: [row()], totalCount: 1 }, true],
  ['false-has-more', { data: [row()], hasMore: false }, true], ['string-has-more-is-currently-unrecognized', { data: [row()], hasMore: 'true' }, true],
  ['nested-pagination-is-currently-unrecognized', { data: [row()], pagination: { hasMore: true } }, true],
  ['bad-total-is-currently-unrecognized', { data: [row()], totalCount: 'bad' }, true],
  ['extra-non-sensitive-field', [{ ...row(), additional: { nested: true } }], true]
]) await check('shape/' + name, () => { (ok ? accepted : rejected)(body); if (ok) assert.deepEqual(strictCandidate(body), normalizePdcLookup(body)) })

for (const [name, value, ok, strictOk = ok] of [
  ['positive', 1, true], ['int32-maximum', 2147483647, true], ['int32-overflow', 2147483648, false],
  ['zero', 0, false], ['negative', -1, false], ['fraction', 1.5, false], ['null', null, false],
  ['numeric-string', '1', true], ['padded-string', '01', true], ['whitespace-numeric-string', ' 1 ', true],
  ['exponential-string', '1e0', true], ['hex-string', '0x1', true], ['fraction-string', '1.5', false],
  ['empty-string', '', false], ['blank-string', ' ', false], ['not-a-number-string', 'NaN', false],
  ['infinity-string', 'Infinity', false], ['false', false, false], ['true-coerces', true, true, false],
  ['single-number-array-coerces', [1], true, false], ['single-string-array-coerces', ['1'], true, false],
  ['nested-array-coerces', [[1]], true, false], ['multiple-number-array', [1, 2], false],
  ['empty-array', [], false], ['plain-object', {}, false], ['null-stringifier-object', { toString: null }, false],
  ['string-stringifier-object', { toString: 'Synthetic' }, false]
]) await check('id/' + name, () => {
  (ok ? accepted : rejected)([row(value)])
  if (strictOk) assert.deepEqual(strictCandidate([row(value)]), normalizePdcLookup([row(value)]))
  else assert.throws(() => strictCandidate([row(value)]))
})
for (const [name, value, ok] of [
  ['text', 'Synthetic', true], ['trimmed', ' Synthetic ', true], ['length-200', 'x'.repeat(200), true],
  ['length-201', 'x'.repeat(201), false], ['empty', '', false], ['spaces', ' ', false], ['null', null, false],
  ['number', 5, true], ['numeric-zero', 0, true], ['boolean', true, false], ['object', {}, false], ['array', ['Synthetic'], false],
  ['embedded-newline', 'Syn\nthetic', false], ['edge-newlines-trimmed', '\nSynthetic\n', true],
  ['nul', 'Syn\0thetic', false], ['delete-control', 'Syn\x7fthetic', false], ['arabic', 'اصطناعي', true],
  ['unicode-space-trimmed', '\u00a0Synthetic\u00a0', true]
]) await check('name/' + name, () => { (ok ? accepted : rejected)([row(1, value)]) })
await check('duplicates/exact', () => rejected([row(), row()]))
await check('duplicates/numeric-string-equivalence', () => rejected([row(1), row('01')]))
await check('rows/empty-array-normalizes', () => assert.deepEqual(normalizePdcLookup([]), []))
await check('rows/5000-accepted', () => assert.equal(normalizePdcLookup(Array.from({ length: 5000 }, (_, i) => row(i + 1))).length, 5000))
await check('rows/5001-rejected', () => rejected(Array.from({ length: 5001 }, (_, i) => row(i + 1))))

for (const [name, body, classification] of [
  ['documented-pair', [row(), row(2)], 'GETPRODUCTS_ACCEPTED'],
  ['unproven-alias-pair', [{ ProductID: 1, ProductName: 'Synthetic' }, { ProductID: 2, ProductName: 'Synthetic' }], 'RESPONSE_SCHEMA_REJECTED'],
  ['invalid-id-pair', [row(0), row(2)], 'RESPONSE_SCHEMA_REJECTED'],
  ['duplicate-pair', [row(), row()], 'RESPONSE_SCHEMA_REJECTED'],
  ['invalid-name-pair', [row(1, ''), row(2)], 'RESPONSE_SCHEMA_REJECTED'],
  ['invalid-name-type-pair', [row(1, {}), row(2)], 'RESPONSE_SCHEMA_REJECTED'],
  ['malformed-echo-pair', [{ ...row(), CompanyID: { toString: null } }, row(2)], 'RESPONSE_SCHEMA_REJECTED'],
  ['empty-array', [], 'RESPONSE_SELECTION_MISMATCH'], ['missing-saved-product', [row(2), row(3)], 'RESPONSE_SELECTION_MISMATCH'],
  ['wrong-scalar-company', [{ ...row(), CompanyID: '654321' }, row(2)], 'RESPONSE_SELECTION_MISMATCH'],
  ['matching-company', [{ ...row(), CompanyID: '123456' }, row(2)], 'GETPRODUCTS_ACCEPTED'],
  ['null-company', [{ ...row(), CompanyID: null }, row(2)], 'GETPRODUCTS_ACCEPTED'],
  ['plain-object-company', [{ ...row(), CompanyID: {} }, row(2)], 'RESPONSE_SELECTION_MISMATCH'],
  ['array-company-coerces', [{ ...row(), CompanyID: ['123456'] }, row(2)], 'GETPRODUCTS_ACCEPTED'],
  ['numeric-company', [{ ...row(), CompanyID: 123456 }, row(2)], 'GETPRODUCTS_ACCEPTED'],
  ['root-company-match', { data: [row()], CompanyID: '123456' }, 'GETPRODUCTS_ACCEPTED'],
  ['root-company-mismatch', { data: [row()], CompanyID: '654321' }, 'RESPONSE_SELECTION_MISMATCH'],
  ['root-company-malformed', { data: [row()], CompanyID: { toString: null } }, 'RESPONSE_SCHEMA_REJECTED'],
  ['mixed-company-echoes', [{ ...row(), CompanyID: '123456' }, { ...row(2), company_id: '654321' }], 'RESPONSE_SELECTION_MISMATCH'],
  ['error-pair', [{ message: 'Synthetic account error' }, { message: 'Synthetic account error' }], 'RESPONSE_SCHEMA_REJECTED'],
  ['data-envelope', { data: [row()] }, 'GETPRODUCTS_ACCEPTED'], ['unreviewed-envelope', { products: [row()] }, 'RESPONSE_SCHEMA_REJECTED'],
  ['partial-envelope', { data: [row()], totalCount: 2 }, 'RESPONSE_SCHEMA_REJECTED'],
  ['id-conversion-throws', [row({ toString: null }), row(2)], 'RESPONSE_SCHEMA_REJECTED'],
  ['invalid-json', '{', 'RESPONSE_PARSE_FAILURE'], ['utf8-bom', '\ufeff' + JSON.stringify([row(), row(2)]), 'RESPONSE_PARSE_FAILURE']
]) await check('capture/' + name, async () => {
  const { result, report } = await capture(body)
  assert.equal(result.classification, classification)
  if (classification === 'RESPONSE_SCHEMA_REJECTED') assert.equal(Object.hasOwn(report, 'company_scope_echoed'), false)
  if (['unproven-alias-pair', 'invalid-id-pair', 'duplicate-pair', 'invalid-name-pair', 'invalid-name-type-pair', 'malformed-echo-pair'].includes(name)) {
    assert.deepEqual(JSON.parse(report.body.redacted_body), [{ redacted_fields: '[redacted]' }, { redacted_fields: '[redacted]' }])
  }
})
for (const key of ['CompanyID', 'companyID', 'companyId', 'company_id']) {
  for (const [label, echo, expected] of [['match', '123456', 'GETPRODUCTS_ACCEPTED'], ['mismatch', '654321', 'RESPONSE_SELECTION_MISMATCH'], ['type-error', { toString: null }, 'RESPONSE_SCHEMA_REJECTED']]) {
    await check('echo/' + key + '/' + label, async () => {
      const { result } = await capture([{ ...row(), [key]: echo }, row(2)])
      assert.equal(result.classification, expected)
    })
  }
}
for (const [name, status, classification] of [
  ['upstream-500', 500, 'UPSTREAM_SERVER_ERROR'], ['upstream-502', 502, 'UPSTREAM_SERVER_ERROR'],
  ['unauthorized', 401, 'AUTHORIZATION_REJECTED'], ['forbidden', 403, 'AUTHORIZATION_REJECTED'],
  ['redirect', 302, 'REDIRECT_REFUSED'], ['bad-request', 400, 'UPSTREAM_CLIENT_ERROR'],
  ['not-found', 404, 'UPSTREAM_CLIENT_ERROR'], ['rate-limited', 429, 'UPSTREAM_CLIENT_ERROR']
]) await check('http/' + name, async () => assert.equal((await capture({ message: 'Synthetic failure' }, { status })).result.classification, classification))
for (const [name, extra, expected] of [
  ['truncated', { truncated: true }, 'BODY_LIMIT_EXCEEDED'], ['incomplete', { body_error: 'RESPONSE_STREAM' }, 'RESPONSE_INCOMPLETE'],
  ['encoded', { headers: { 'content-type': 'application/json', 'content-encoding': 'gzip' } }, 'BODY_ENCODING_REFUSED']
]) await check('transport/' + name, async () => assert.equal((await capture([row()], extra)).result.classification, expected))
await check('http/upstream-500-with-auth-text-remains-unproven', async () => {
  const { result } = await capture({ message: 'Invalid token (synthetic)' }, { status: 500 })
  assert.equal(result.classification, 'UPSTREAM_5XX_WITH_AUTH_HINT')
})
await check('capture/account-text-in-valid-row-is-only-a-hint', async () => {
  const { result, report } = await capture([row(1, 'Unauthorized synthetic')])
  assert.equal(result.classification, 'GETPRODUCTS_ACCEPTED')
  assert.equal(report.body.hints.authentication_hint, true)
})

const routeSource = readFileSync(new URL('../server/api/admin-shipping/lookups.post.js', import.meta.url), 'utf8')
  .replace(/^import .*\n/gm, '').replace('export default defineEventHandler', 'defineEventHandler')
const route = async (body, config = settings(), action = 'test', runtimeEnabled = true) => {
  let handler, calls = 0, claims = 0, audits = 0, writes = 0
  globalThis.useRuntimeConfig = runtime
  const db = { rpc(name) { assert.equal(name, 'shipping_claim_pdc_lookup'); claims++; return { abortSignal: async () => ({ data: true }) } },
    from() { writes++; throw Error('Unexpected cache write') } }
  const fetcher = async () => { calls++; return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } }) }
  runInNewContext(routeSource, { createError, defineEventHandler: fn => { handler = fn },
    requireAdminRequest: async (_, requirement) => { assert.equal(requirement.permission, 'settings.edit'); return { supabaseAdmin: db, adminUser: { id: 'synthetic-admin' } } },
    getPdcSettings: async () => config, requirePdcReadAccess, useRuntimeConfig: () => ({ ...runtime(), shippingLiveRequestsEnabled: runtimeEnabled }),
    readPaymentCallbackBody: async () => JSON.stringify({ action }), requestPdcLookup: (s, op, data) => requestPdcLookup(s, op, data, fetcher),
    normalizePdcLookup, recordAdminActivity: async () => { audits++ }, AbortSignal })
  let result, error
  try { result = await handler({}) } catch (caught) { error = caught }
  return { result, error, calls, claims, audits, writes }
}
for (const [name, body] of [
  ['malformed-company-echo', [{ ...row(), CompanyID: { toString: null } }, row(2)]],
  ['mismatched-company-echo', [{ ...row(), CompanyID: '654321' }, row(2)]],
  ['missing-saved-product', [row(2), row(3)]], ['empty-products', []]
]) await check('dashboard-difference/' + name, async () => {
  const result = await route(body)
  assert.equal(result.result.connected, true)
  assert.equal(result.calls, 1); assert.equal(result.claims, 1); assert.equal(result.audits, 1); assert.equal(result.writes, 0)
})
await check('dashboard/gate-disabled-no-fetch-no-throttle', async () => {
  const result = await route([row()], settings(), 'test', false)
  assert.equal(result.error.statusCode, 503); assert.equal(result.calls, 0); assert.equal(result.claims, 0)
})
await check('dashboard/product-selection-unset-still-connects', async () => {
  const result = await route([row()], { ...settings(), product_id: null })
  assert.equal(result.result.connected, true)
})
await check('dashboard/normalization-failure-has-no-success-audit', async () => {
  const result = await route([row(0)])
  assert.equal(result.error.statusCode, 502); assert.equal(result.calls, 1); assert.equal(result.claims, 1); assert.equal(result.audits, 0)
})
await check('dashboard/required-name-error-is-local-400-not-upstream-500', async () => {
  const result = await route([row(1, '')])
  assert.equal(result.error.statusCode, 400); assert.equal(result.calls, 1); assert.equal(result.audits, 0)
})
await check('dashboard/sync-stops-before-city-on-product-failure', async () => {
  const result = await route([row(0)], settings(), 'sync')
  assert.equal(result.calls, 1); assert.equal(result.writes, 0)
})

for (const [name, secret, calls] of [['invalid-envelope', 'invalid', 0], ['tampered-envelope', settings().access_token_encrypted + 'x', 0]]) {
  await check('credentials/' + name, async () => {
    let invoked = 0
    await assert.rejects(() => requestPdcLookup({ ...settings(), access_token_encrypted: secret }, 'GetProducts', undefined, async () => { invoked++; throw Error('Synthetic') }), error => error.statusCode === 502)
    assert.equal(invoked, calls)
  })
}
await check('credentials/round-trip-fixture-only', () => assert.equal(decryptShippingSecret(settings().access_token_encrypted), 'SYNTHETIC-TOKEN-ONLY'))
await check('transport/upstream-500-never-reads-body', async () => {
  let reads = 0
  await assert.rejects(() => requestPdcLookup(settings(), 'GetProducts', undefined, async () => ({ ok: false, status: 500,
    get body() { reads++; throw Error('Body must remain unread') }, headers: new Headers() })), error => error.statusCode === 502)
  assert.equal(reads, 0)
})
await check('transport/oversize-declared', async () => {
  await assert.rejects(() => requestPdcLookup(settings(), 'GetProducts', undefined, async () => new Response('[]', { headers: { 'content-length': '1048577' } })), error => error.statusCode === 502)
})
await check('transport/oversize-stream', async () => {
  await assert.rejects(() => requestPdcLookup(settings(), 'GetProducts', undefined, async () => new Response('x'.repeat(1048577))), error => error.statusCode === 502)
})
await check('transport/network-rejection-is-masked', async () => {
  await assert.rejects(() => requestPdcLookup(settings(), 'GetProducts', undefined, async () => { throw Error('SYNTHETIC-PRIVATE-ERROR') }), error => error.statusCode === 502 && !error.message.includes('PRIVATE'))
})
await check('old-diagnostic/upstream-500-is-recorded-before-normalization', async () => {
  let requests = 0
  const result = await runDiagnostic({ settings: settings(), encryption_key: fixtureKey, approval: 'OWNER_APPROVED_SINGLE_GETPRODUCTS_GETCITIES_20261021' }, async () => {
    requests++; return new Response('Synthetic upstream error', { status: 500 })
  })
  assert.equal(requests, 1); assert.equal(result.requests[0].status, 500); assert.equal(result.reason, 'UNEXPECTED_RESPONSE')
})
await check('old-diagnostic/company-check-precedes-normalizer', async () => {
  const result = await runDiagnostic({ settings: settings(), encryption_key: fixtureKey, approval: 'OWNER_APPROVED_SINGLE_GETPRODUCTS_GETCITIES_20261021' }, async () => Response.json([{ ...row(0), CompanyID: '654321' }]))
  assert.equal(result.reason, 'COMPANY_SCOPE_MISMATCH')
})
assert.equal(networkAttempts, 0)
const report = { result: 'PASS', node_version: process.version, cases: outcomes.length,
  synthetic_only: true, provider_requests: 0, real_network_attempts: networkAttempts,
  production_connections: 0, original_helpers_modified: false, outcomes }
writeFileSync(options['--output'], JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
console.log(JSON.stringify({ result: report.result, cases: report.cases, provider_requests: 0, real_network_attempts: 0 }))
