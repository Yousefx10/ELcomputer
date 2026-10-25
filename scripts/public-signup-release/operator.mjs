// Application-only release. Preparation/check are read-only on the target.
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, access, lstat } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { inventory } from '../publish/inventory.mjs'
import { backup } from '../footer-release/operator.mjs'
import { connect } from '../commerce-release/database.mjs'
import { baseline, historyTables } from '../customer-migration/final-db.mjs'
import { approvalState } from '../live-sales-release/operator.mjs'

const here = dirname(fileURLToPath(import.meta.url)), repo = resolve(here, '../..'), run = promisify(execFile)
const hash = value => createHash('sha256').update(value).digest('hex')
const sorted = value => value instanceof Date ? value.toISOString() : Array.isArray(value) ? value.map(sorted) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])])) : value
export const digest = value => hash(JSON.stringify(sorted(value)))
// Reuse the deployed approval rules for only live analytics rows and two Auth
// activity timestamps. Identity/security, internal ledgers and history stay bound.
export const comparableDatabase = approvalState
const load = async path => JSON.parse(await readFile(path, 'utf8'))
const save = (path, value) => writeFile(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
const shell = value => "'" + value.replaceAll("'", "'\\''") + "'"
const env = () => ({ PATH: dirname(process.execPath) + ':/usr/bin:/bin:/usr/sbin:/sbin', HOME: process.env.HOME, LANG: 'C', NODE_ENV: 'production' })
const stable = value => Object.fromEntries(Object.entries(value).filter(([key]) => !['observed_utc', 'free_bytes', 'production_writes'].includes(key)))
export const scope = { milestone: 'public_signup_notice', schema: '94 unchanged', database_writes: false, runtime_change: false, caddy_change: false, provider_calls: false, public_checkout: false, signup: false }
const sshArgs = t => ['-T', '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'HostKeyAlgorithms=ssh-ed25519', '-o', 'UserKnownHostsFile=' + t.known_hosts, '-o', 'ConnectionAttempts=1', '-o', 'ConnectTimeout=12', '-o', 'ServerAliveInterval=10', '-o', 'ServerAliveCountMax=2', '-o', 'ControlMaster=no', '-i', t.identity]
export function assertScope(p) {
  assert.equal(p.format, 12); assert.deepEqual(p.scope, scope); assert.equal(p.schema_version, 94)
  assert.deepEqual(p.migrations, []); assert.equal(p.database_writes, 0); assert.equal(p.provider_requests, 0)
  assert.equal(p.nuxt_restarts_max, 1)
  for (const key of ['automatic_retry', 'automatic_rollback', 'git_push', 'public_signup_activation']) assert.equal(p[key], false, key)
}
export function assertFresh(p, now = Date.now()) {
  const time = Date.parse(p.backup_verified_utc)
  assert.ok(Number.isFinite(time) && time <= now && now - time <= 6 * 3600000, 'Recovery evidence expired; prepare a new review packet')
  assert.equal(p.backup_proof.database.pg_restore_full_readback, 'PASS'); assert.equal(p.backup_proof.runtime.full_byte_readback, true)
}
async function hashes(paths) {
  const names = (await run('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', ...paths], { cwd: repo, maxBuffer: 8e6 })).stdout.trim().split('\n').sort()
  return Object.fromEntries(await Promise.all(names.map(async name => [name, hash(await readFile(repo + '/' + name))])))
}
const inputs = () => hashes(['app', 'server', 'public', 'i18n', 'nuxt.config.ts', 'package.json', 'package-lock.json', 'tsconfig.json', 'supabase/migrations'])
const tools = () => hashes(['scripts', 'docs/operations/backup-envelope.mjs'])
async function remote(p, mode, approved = null, database = null) {
  assert.ok(['inspect', 'prepare', 'stage', 'candidate', 'activate'].includes(mode))
  if (mode !== 'inspect') { assertScope(p); assert.equal(approved, p.seal) }
  const command = 'python3 -I -S -B -c ' + shell('import sys,json;q=json.load(sys.stdin);sys.argv=["public-signup-notice.py",q["mode"],json.dumps(q)];exec(compile(q["source"],"public-signup-notice.py","exec"))')
  const task = run('ssh', [...sshArgs(p.target), 'root@' + p.target.host, command], { env: env(), timeout: 180000, maxBuffer: 64e6 })
  task.child.stdin.on('error', () => {}); task.child.stdin.end(JSON.stringify({ source: await readFile(here + '/remote.py', 'utf8'), plan: p, mode, approved, database }))
  return JSON.parse((await task).stdout)
}
async function databaseState(target) {
  const db = await connect(target)
  try {
    await db.query('begin isolation level repeatable read read only')
    const state = await baseline(db), records = []
    assert.equal(state.history.length, 94)
    for (const table of historyTables) records.push({ table, ...(await db.query(`select count(*)::int count,encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text collate "C")::text,'[]'),'UTF8')),'hex') sha256 from customer_history_private.${table} t`)).rows[0] })
    assert.equal((await db.query('show transaction_read_only')).rows[0].transaction_read_only, 'on')
    await db.query('rollback'); return { ...state, history_records: records }
  } finally { await db.end() }
}
async function authState(target) {
  const c = await load(target.credentials_file), r = await fetch('https://' + target.project_ref + '.supabase.co/auth/v1/settings', { headers: { apikey: c.anon_key }, signal: AbortSignal.timeout(15000) })
  assert.equal(r.status, 200); const s = await r.json()
  assert.equal(s.disable_signup, true); assert.equal(s.mailer_autoconfirm, false)
  return { disable_signup: true, mailer_autoconfirm: false, external: s.external }
}
export async function localCheck(work, p) {
  const { seal, ...body } = p; assert.equal(digest(body), seal); assertScope(p); assertFresh(p)
  assert.equal(process.version, 'v22.23.1'); assert.deepEqual(await inputs(), p.application_inputs); assert.deepEqual(await tools(), p.tools)
  assert.equal((await run('git', ['rev-parse', 'HEAD'], { cwd: repo })).stdout.trim(), p.application_commit)
  assert.equal(hash(await readFile(work + '/application.tar.gz')), p.archive_sha256)
  assert.equal(digest(await inventory(work + '/readback')), p.inventory_sha256)
  for (const [file, sha] of Object.entries(p.evidence_sha256)) assert.equal(hash(await readFile(file)), sha, 'Evidence changed: ' + file)
  for (const [file, sha] of Object.entries(p.protected_inputs)) assert.equal(hash(await readFile(file)), sha, 'Protected input changed')
  for (const name of ['database-before.dump', 'runtime-recovery.tar.gz']) {
    const verified = JSON.parse((await run(process.execPath, [p.backup.envelope, 'verify', p.backup.key, work + '/backups/' + name + '.enc'], { env: env(), timeout: 180000 })).stdout)
    assert.equal(verified.authenticatedDecryption, true)
  }
}
async function checked(work, p) {
  await localCheck(work, p)
  assert.deepEqual(stable(await remote(p, 'inspect')), stable(p.before), 'Runtime drift')
  assert.deepEqual(comparableDatabase(await databaseState(p.target)), comparableDatabase(p.database), 'Data/schema/ownership drift')
  assert.deepEqual(await authState(p.target), p.auth, 'Auth policy drift')
}
async function prepare(work) {
  assert.equal(process.version, 'v22.23.1')
  const spec = await load(work + '/release-spec.private.json'), a = await load(work + '/artifact.json'), q = await load(work + '/browser-qualification.json')
  assert.equal(q.result, 'EXACT_ARCHIVE_LOCAL_PASS'); assert.equal(q.archive_sha256, a.archive_sha256)
  assert.equal(q.page_errors.length, 0); assert.equal(q.forbidden_backend_mutations.length, 0)
  assert.equal(q.hosted_supabase_connections, 0); assert.equal(q.payment_shipping_provider_calls, 0)
  assert.ok(q.external_Cloudflare_public_test_widget_requests > 0)
  assert.ok(q.checks.includes('Dashboard_password_login_receives_test_Captcha_token'))
  const application = await inputs(), toolInputs = await tools(), commit = (await run('git', ['rev-parse', 'HEAD'], { cwd: repo })).stdout.trim()
  const built = await load(work + '/application-inputs.json')
  assert.equal(hash(JSON.stringify(built)), a.application_inputs_sha256)
  assert.deepEqual(Object.fromEntries(Object.entries(application).filter(([name]) => !name.startsWith('supabase/migrations/'))), built, 'Built source changed')
  for (const name of ['focused-tests.log', 'security-focused.log', 'native-history-corrected.log', 'release-operator-tests.log']) assert.match(await readFile(work + '/' + name, 'utf8'), /^# fail 0$/m, name)
  assert.match(await readFile(work + '/build.log', 'utf8'), /Build complete!/)
  assert.equal((await run('git', ['diff', 'HEAD', '--name-only', '--', 'app', 'server', 'public', 'i18n', 'nuxt.config.ts', 'package.json', 'package-lock.json', 'supabase/migrations'], { cwd: repo })).stdout, '', 'Commit the reviewed source before sealing')
  const before = await remote({ target: spec.target, release_id: 'preflight' }, 'inspect')
  assert.equal(before.verified.archive_sha256, spec.expected_archive_sha256)
  assert.equal(hash(await readFile(spec.previous_archive)), spec.expected_archive_sha256, 'Prior recovery archive changed')
  const database = await databaseState(spec.target), auth = await authState(spec.target)
  await mkdir(work + '/backups', { mode: 0o700 })
  const backupProof = await backup({ target: spec.target, release_id: 'preflight', archive_bytes: a.archive_bytes, before, backup: spec.backup }, work + '/backups')
  const backupVerified = new Date().toISOString()
  const evidenceNames = ['artifact.json', 'inventory.json', 'application-inputs.json', 'browser-qualification.json', 'focused-tests.log', 'security-focused.log', 'native-history-corrected.log', 'release-operator-tests.log', 'typecheck.log', 'build.log', 'archive-readback.log', 'release-spec.private.json', 'owner-abuse-settings.json', 'reused-validation.json', 'backups/backup-verification.json', 'backups/database-before.dump.enc', 'backups/runtime-recovery.tar.gz.enc']
  const evidence = Object.fromEntries(await Promise.all(evidenceNames.map(async n => [work + '/' + n, hash(await readFile(work + '/' + n))])))
  evidence[spec.previous_archive] = hash(await readFile(spec.previous_archive))
  const protectedFiles = [spec.target.credentials_file, spec.target.database.ca_file, spec.target.identity, spec.target.known_hosts, spec.backup.key, spec.backup.pg_dump, dirname(spec.backup.pg_dump) + '/pg_restore', spec.backup.envelope, process.execPath]
  const p = { format: 12, created_utc: new Date().toISOString(), scope, application_commit: commit, application_inputs: application, tools: toolInputs,
    target: spec.target, before, database, auth, schema_version: 94, migrations: [], database_writes: 0, public_signup_activation: false,
    archive_sha256: a.archive_sha256, archive_bytes: a.archive_bytes, release_id: a.archive_sha256.slice(0, 16), inventory_sha256: digest(await inventory(work + '/readback')),
    evidence_sha256: evidence, protected_inputs: Object.fromEntries(await Promise.all(protectedFiles.map(async f => [f, hash(await readFile(f))]))),
    backup: spec.backup, backup_verified_utc: backupVerified, backup_proof: backupProof, database_state_sha256: digest(comparableDatabase(database)),
    automatic_retry: false, automatic_rollback: false, provider_requests: 0, nuxt_restarts_max: 1, git_push: false,
    approval_phrase: 'APPROVE SIGNUP NOTICE DEPLOY', rollback: { previous_release: before.current, schema: 94, automatic: false, separate_review: true } }
  p.seal = digest(p); await checked(work, p); await save(work + '/plan.json', p)
  console.log(JSON.stringify({ result: 'APPLICATION_RELEASE_READY', release: p.release_id, seal: p.seal, approval: p.approval_phrase + ' ' + p.seal, public_signup_activation: false }))
}
async function check(work) { const p = await load(work + '/plan.json'); await checked(work, p); console.log(JSON.stringify({ result: 'READ_ONLY_CHECK_PASS', seal: p.seal, production_writes: 0 })) }
async function apply(work, approved) {
  const p = await load(work + '/plan.json'); assert.equal(approved, p.seal, 'Exact owner deployment approval required')
  try { await access(work + '/execution-intent.json'); throw Error('Consumed approval; inspect only') } catch (e) { if (e.code !== 'ENOENT') throw e }
  await checked(work, p)
  await save(work + '/execution-intent.json', { seal: p.seal, utc: new Date().toISOString(), automatic_retry: false })
  const execution = work + '/execution'; await mkdir(execution, { mode: 0o700 })
  try {
    await backup(p, execution); await checked(work, p)
    await save(execution + '/prepare.json', await remote(p, 'prepare', approved))
    const destination = '/var/lib/public-signup-notice-releases/' + p.release_id
    for (const [name, dest] of [['application.tar.gz', 'release.tar.gz'], ['inventory.json', 'inventory.json']]) await run('scp', [...sshArgs(p.target).filter(v => v !== '-T'), work + '/' + name, 'root@' + p.target.host + ':' + destination + '/' + dest], { env: env(), timeout: 180000 })
    for (const mode of ['stage', 'candidate']) await save(execution + '/' + mode + '.json', await remote(p, mode, approved))
    await checked(work, p)
    await save(execution + '/activate.json', await remote(p, 'activate', approved, { plan_sha256: p.seal, schema: 94, read_only: true, migrations_applied: 0, business_data_writes: 0, preservation: 'PASS', state_sha256: p.database_state_sha256 }))
    assert.deepEqual(comparableDatabase(await databaseState(p.target)), comparableDatabase(p.database)); assert.deepEqual(await authState(p.target), p.auth)
    for (const [path, status] of [['/login', 200], ['/ar/login', 200], ['/cart', 403], ['/checkout', 403], ['/api/account/history', 401]]) {
      const r = await fetch(p.target.origin + path, { redirect: 'manual', signal: AbortSignal.timeout(15000) }); await r.arrayBuffer(); assert.equal(r.status, status)
    }
    await save(execution + '/completed.json', { result: 'DEPLOY_PASS', seal: p.seal, release: p.release_id, schema: 94, signup_disabled: true, purchasing_closed: true })
    console.log(JSON.stringify({ result: 'DEPLOY_PASS', release: p.release_id, seal: p.seal }))
  } catch (e) { await save(execution + '/STOP.json', { result: 'STOP', type: e.name, automatic_retry: false, automatic_rollback: false }); throw Error('STOP; preserve evidence. No retry or automatic rollback.') }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const [mode, directory, approved] = process.argv.slice(2); assert.ok(['prepare', 'check', 'apply'].includes(mode)); await ({ prepare, check, apply }[mode])(resolve(directory), approved) }
  catch (e) { console.error(JSON.stringify({ result: 'STOP', type: e.name, message: e.message, automatic_retry: false })); process.exitCode = 1 }
}
