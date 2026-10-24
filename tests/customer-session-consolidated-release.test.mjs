import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { parse } from 'acorn'
import { digest } from '../scripts/customer-session-consolidated-release/operator.mjs'

const operator = resolve('scripts/customer-session-consolidated-release/operator.mjs')
const call = args => promisify(execFile)(process.execPath, [operator, ...args]).then(() => null, error => error)

test('wrong consolidated approval cannot inspect, back up or stage a target', async t => {
  const work = await mkdtemp(join(tmpdir(), 'consolidated-denial-')); t.after(() => rm(work, { recursive: true, force: true }))
  await writeFile(work + '/plan.json', JSON.stringify({ seal: 'a'.repeat(64) }))
  const error = await call(['apply', work, 'b'.repeat(64)])
  assert.equal(error.code, 1); assert.match(error.stderr, /Exact owner deployment approval required/)
  assert.deepEqual(await readdir(work), ['plan.json'])
})

test('a consumed consolidated invocation stops before target inspection', async t => {
  const work = await mkdtemp(join(tmpdir(), 'consolidated-consumed-')); t.after(() => rm(work, { recursive: true, force: true }))
  await writeFile(work + '/plan.json', JSON.stringify({ seal: 'a'.repeat(64) }))
  await writeFile(work + '/execution-intent.json', '{}')
  const error = await call(['apply', work, 'a'.repeat(64)])
  assert.equal(error.code, 1); assert.match(error.stderr, /Consumed approval/)
  assert.deepEqual((await readdir(work)).sort(), ['execution-intent.json', 'plan.json'])
})

test('valid historical session and PDC scopes cannot be used as consolidated plans', async t => {
  const work = await mkdtemp(join(tmpdir(), 'consolidated-scope-')); t.after(() => rm(work, { recursive: true, force: true }))
  for (const milestone of ['customer_session_isolation', 'pdc_http_client']) {
    const body = { format: 10, schema_version: 91, scope: { milestone } }
    await writeFile(work + '/plan.json', JSON.stringify({ ...body, seal: digest(body) }))
    const error = await call(['check', work])
    assert.equal(error.code, 1); assert.deepEqual(await readdir(work), ['plan.json'])
  }
})

test('consolidated target still requires private qualification and held gates', async () => {
  const source = await readFile('scripts/customer-session-consolidated-release/remote.py', 'utf8')
  assert.match(source, /schema_version'\]==91/)
  assert.match(source, /customer_session_consolidated/)
  assert.match(source, /payload.get\('approved'\)==seal/)
  assert.match(source, /candidate_proof\['private_purchase_closed'\]/)
  assert.match(source, /NUXT_PAYMOB_LIVE_REQUESTS_ENABLED/)
  assert.match(source, /NUXT_SHIPPING_LIVE_REQUESTS_ENABLED/)
  assert.match(source, /activation-intent.json/); assert.match(source, /restart-intent.json/)
  assert.doesNotMatch(source, /systemctl','(?:restart|reload)','caddy/)
})

test('compiled PDC definitions remain byte-identical to the deployed correction', { skip: !process.env.CONSOLIDATED_RELEASE_ARTIFACT || !process.env.DEPLOYED_PDC_ARTIFACT }, async () => {
  const names = ['PDC_HTTP_USER_AGENT', 'getPdcHeaders', 'getPdcStatusFilters', 'requirePdcStatusDates', 'requestPdcLookup',
    'requestPdcJson', 'requestPdcLabel', 'operatePdcOrder', 'operatePdcReverse', 'reconcilePdcShipment']
  const declarations = async root => {
    const code = await readFile(root + '/server/chunks/nitro/nitro.mjs', 'utf8'), ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module' }), result = new Map()
    for (const node of ast.body) if (node.type === 'VariableDeclaration') for (const value of node.declarations) if (names.includes(value.id.name)) result.set(value.id.name, code.slice(value.start, value.end))
    return result
  }
  const [current, combined] = await Promise.all([declarations(process.env.DEPLOYED_PDC_ARTIFACT), declarations(process.env.CONSOLIDATED_RELEASE_ARTIFACT)])
  for (const name of names) { assert.ok(current.has(name), name); assert.equal(combined.get(name), current.get(name), name) }
})
