import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readdir, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { digest } from '../scripts/customer-session-release/operator.mjs'

test('application deployment refuses a wrong approval before SSH, backups or staging', async t => {
  const work = await mkdtemp(join(tmpdir(), 'session-release-deny-')); t.after(() => rm(work, { recursive: true, force: true }))
  await writeFile(work + '/plan.json', JSON.stringify({ seal: 'a'.repeat(64) }))
  const failure = await promisify(execFile)(process.execPath, [resolve('scripts/customer-session-release/operator.mjs'), 'apply', work, 'b'.repeat(64)]).then(() => null, error => error)
  assert.equal(failure.code, 1)
  assert.match(failure.stderr, /Exact owner deployment approval required/)
  assert.deepEqual(await readdir(work), ['plan.json'])
})

test('read-only check rejects modified plan content before target access', async t => {
  const work = await mkdtemp(join(tmpdir(), 'session-release-tamper-')); t.after(() => rm(work, { recursive: true, force: true }))
  const body = { application_inputs: {}, workspace_inputs: {}, schema_version: 91, migrations: [] }
  await writeFile(work + '/plan.json', JSON.stringify({ ...body, schema_version: 92, seal: digest(body) }))
  const failure = await promisify(execFile)(process.execPath, [resolve('scripts/customer-session-release/operator.mjs'), 'check', work]).then(() => null, error => error)
  assert.equal(failure.code, 1)
  assert.deepEqual(await readdir(work), ['plan.json'])
})

test('remote activation retains independent schema, candidate, gate and one-use guards', async () => {
  const source = await readFile('scripts/customer-session-release/remote.py', 'utf8')
  assert.match(source, /schema_version'\]==91/)
  assert.match(source, /'NUXT_PAYMOB_ENABLED','NUXT_PAYMOB_LIVE_REQUESTS_ENABLED','NUXT_SHIPPING_LIVE_REQUESTS_ENABLED','PDC_LIVE_REQUESTS_ENABLED'/)
  assert.match(source, /candidate_proof\['private_purchase_closed'\]/)
  assert.match(source, /payload.get\('approved'\)==seal/)
  assert.match(source, /activation-intent.json/)
  assert.match(source, /restart-intent.json/)
  assert.doesNotMatch(source, /systemctl','(?:restart|reload)','caddy/)
})
