import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { scope, assertScope, assertFresh, publicWidget, recoveryPlan } from '../scripts/turnstile-runtime/operator.mjs'
const call = args => promisify(execFile)(process.execPath, [resolve('scripts/turnstile-runtime/operator.mjs'), ...args]).then(() => null, e => e)
test('wrong or consumed configuration approval stops before target access and intent', async t => {
  const work = await mkdtemp(join(tmpdir(), 'turnstile-config-')); t.after(() => rm(work, { recursive: true, force: true }))
  await writeFile(work + '/plan.json', JSON.stringify({ seal: 'a'.repeat(64) }))
  let e = await call(['apply', work, 'b'.repeat(64)]); assert.equal(e.code, 1); assert.match(e.stderr, /Exact frontend configuration approval required/); assert.deepEqual(await readdir(work), ['plan.json'])
  await writeFile(work + '/execution-intent.json', '{}'); e = await call(['apply', work, 'a'.repeat(64)]); assert.equal(e.code, 1); assert.match(e.stderr, /Consumed approval/)
  assert.deepEqual((await readdir(work)).sort(), ['execution-intent.json', 'plan.json'])
})
test('frontend-only scope rejects enforcement, purchasing, app deployment, Supabase writes and extra runtime keys', () => {
  const p = { format: 13, scope, changed_keys: ['NUXT_PUBLIC_AUTH_CAPTCHA_PROVIDER', 'NUXT_PUBLIC_TURNSTILE_SITE_KEY'], git_push: false }; assert.doesNotThrow(() => assertScope(p))
  for (const key of ['application_deployment', 'database_writes', 'supabase_changes', 'captcha_enforcement', 'signup', 'purchasing', 'pdc', 'caddy', 'automatic_retry', 'automatic_rollback']) assert.throws(() => assertScope({ ...p, scope: { ...scope, [key]: true } }), key)
  assert.throws(() => assertScope({ ...p, scope: { ...scope, app_restarts_max: 2 } }))
  assert.throws(() => assertScope({ ...p, changed_keys: [...p.changed_keys, 'NUXT_PUBLIC_TURNSTILE_SECRET_KEY'] }))
})
test('missing, future, stale or incompletely read-back recovery evidence rejects configuration', () => {
  const now = Date.now(), p = { backup_verified_utc: new Date(now).toISOString(), backup_proof: { database: { pg_restore_full_readback: 'PASS' }, runtime: { full_byte_readback: true } } }
  assert.doesNotThrow(() => assertFresh(p, now))
  for (const time of ['', new Date(now + 1).toISOString(), new Date(now - 21600001).toISOString()]) assert.throws(() => assertFresh({ ...p, backup_verified_utc: time }, now))
  assert.throws(() => assertFresh({ ...p, backup_proof: { database: { pg_restore_full_readback: 'FAIL' } } }, now))
})
test('public input cannot accept a secret, another provider or hidden enforcement permission', () => {
  const value = { site_key: '0x4' + 'A'.repeat(20), allowed_hostnames: ['shop.example.invalid'], mode: 'managed', enforcement_authorized: false }
  assert.deepEqual(publicWidget(value), { site_key: value.site_key, allowed_hostnames: value.allowed_hostnames, mode: 'managed' })
  for (const patch of [{ secret_key: 'never-accepted' }, { enforcement_authorized: true }, { mode: 'invisible' }, { allowed_hostnames: ['https://shop.example.invalid/path'] }]) assert.throws(() => publicWidget({ ...value, ...patch }))
})
test('approved recovery adapts the sealed plan for the actual shared remote capacity guard', async () => {
  const p = { format: 13, scope, changed_keys: ['NUXT_PUBLIC_AUTH_CAPTCHA_PROVIDER', 'NUXT_PUBLIC_TURNSTILE_SITE_KEY'], git_push: false, seal: 'a'.repeat(64), before: { free_bytes: 2 ** 31 } }
  const original = JSON.stringify(p), adapted = recoveryPlan(p)
  assert.equal(JSON.stringify(p), original); assert.equal(adapted.seal, p.seal)
  const script = 'import importlib.util,json,sys; s=importlib.util.spec_from_file_location("shared_recovery",sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);p=json.loads(sys.argv[2]);m.inspect=lambda _:p["before"];m.baseline(p);print("PASS")'
  const remote = resolve('scripts/footer-release/remote.py'), run = promisify(execFile)
  await assert.rejects(run('python3', ['-B', '-c', script, remote, JSON.stringify(p)]), e => /KeyError: .archive_bytes./.test(e.stderr))
  assert.equal((await run('python3', ['-B', '-c', script, remote, JSON.stringify(adapted)])).stdout.trim(), 'PASS')
  assert.throws(() => recoveryPlan({ ...p, scope: { ...scope, application_deployment: true } }))
})
