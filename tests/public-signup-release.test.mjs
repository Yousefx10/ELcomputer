import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readdir, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { assertFresh, assertScope, scope, digest } from '../scripts/public-signup-release/operator.mjs'
const call = args => promisify(execFile)(process.execPath, [resolve('scripts/public-signup-release/operator.mjs'), ...args]).then(() => null, error => error)
test('wrong approval and consumed approval stop before target access or local writes', async t => {
  const work = await mkdtemp(join(tmpdir(), 'signup-release-denial-')); t.after(() => rm(work, { recursive: true, force: true }))
  await writeFile(work + '/plan.json', JSON.stringify({ seal: 'a'.repeat(64) }))
  let error = await call(['apply', work, 'b'.repeat(64)])
  assert.equal(error.code, 1); assert.match(error.stderr, /Exact owner deployment approval required/); assert.deepEqual(await readdir(work), ['plan.json'])
  await writeFile(work + '/execution-intent.json', '{}'); error = await call(['apply', work, 'a'.repeat(64)])
  assert.equal(error.code, 1); assert.match(error.stderr, /Consumed approval/)
  assert.deepEqual((await readdir(work)).sort(), ['execution-intent.json', 'plan.json'])
})
test('signup release rejects activation, schema/provider writes and retry scope', () => {
  const p = { format: 12, scope, schema_version: 94, migrations: [], database_writes: 0, provider_requests: 0, nuxt_restarts_max: 1, automatic_retry: false, automatic_rollback: false, git_push: false, public_signup_activation: false }
  assert.doesNotThrow(() => assertScope(p))
  for (const [key, value] of Object.entries({ schema_version: 91, migrations: ['sql'], database_writes: 1, provider_requests: 1, nuxt_restarts_max: 2, automatic_retry: true, automatic_rollback: true, git_push: true, public_signup_activation: true, scope: { ...scope, signup: true } })) assert.throws(() => assertScope({ ...p, [key]: value }), key)
})
test('recovery freshness rejects missing, future or expired evidence', () => {
  const now = Date.now(), p = { backup_verified_utc: new Date(now).toISOString(), backup_proof: { database: { pg_restore_full_readback: 'PASS' }, runtime: { full_byte_readback: true } } }
  assert.doesNotThrow(() => assertFresh(p, now))
  for (const time of ['invalid', new Date(now + 1).toISOString(), new Date(now - 6 * 3600000 - 1).toISOString()]) assert.throws(() => assertFresh({ ...p, backup_verified_utc: time }, now))
})
test('target rejects a differently scoped signed packet before staging', async () => {
  const body = { format: 12, schema_version: 94, migrations: [], database_writes: 0, scope: { ...scope, signup: true } }, seal = digest(body)
  await assert.rejects(promisify(execFile)('python3', ['-I', '-S', '-B', resolve('scripts/public-signup-release/remote.py'), 'prepare', JSON.stringify({ plan: { ...body, seal }, approved: seal })]), e => e.code === 1 && e.stdout.includes('STOP'))
})
test('remote schema94 application qualification preserves all held gates and scoped routes', async () => {
  const text = await readFile('scripts/public-signup-release/remote.py', 'utf8')
  assert.match(text, /schema_version'\]==94/); assert.match(text, /public_signup_notice/)
  for (const flag of ['NUXT_PUBLIC_BETA_PURCHASING_ENABLED', 'NUXT_PUBLIC_RETURNING_CUSTOMER_NOTICE_ENABLED', 'NUXT_PAYMOB_LIVE_REQUESTS_ENABLED', 'NUXT_SHIPPING_LIVE_REQUESTS_ENABLED']) assert.ok(text.includes(flag))
  assert.match(text, /\('\/api\/account\/history',401\)/)
  assert.doesNotMatch(text, /systemctl','(?:restart|reload)','caddy/)
})
