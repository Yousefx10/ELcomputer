// Two public runtime values only. No application deployment or Supabase writes.
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { backup } from '../footer-release/operator.mjs'
import { connect } from '../commerce-release/database.mjs'
import { baseline, historyTables } from '../customer-migration/final-db.mjs'
import { approvalState } from '../live-sales-release/operator.mjs'

const here = dirname(fileURLToPath(import.meta.url)), repo = resolve(here, '../..'), run = promisify(execFile)
const hash = value => createHash('sha256').update(value).digest('hex')
const sorted = v => v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sorted(v[k])])) : v
export const digest = v => hash(JSON.stringify(sorted(v)))
export const scope = { kind: 'turnstile_frontend_runtime_only', schema: 94, application_deployment: false, database_writes: false, supabase_changes: false, captcha_enforcement: false, signup: false, purchasing: false, pdc: false, caddy: false, automatic_retry: false, automatic_rollback: false, app_restarts_max: 1 }
export function publicWidget(owner) {
  assert.ok(Object.keys(owner).every(k => ['site_key', 'allowed_hostnames', 'mode', 'source', 'enforcement_authorized'].includes(k)), 'Only public widget inputs are accepted; keep secrets in Supabase')
  assert.equal(owner.enforcement_authorized, false); assert.equal(owner.mode, 'managed'); assert.match(owner.site_key, /^0x4[A-Za-z0-9_-]{10,100}$/)
  assert.ok(Array.isArray(owner.allowed_hostnames) && owner.allowed_hostnames.length)
  for (const host of owner.allowed_hostnames) assert.ok(typeof host === 'string' && /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(host) && !host.includes('..'))
  return { site_key: owner.site_key, allowed_hostnames: owner.allowed_hostnames, mode: owner.mode }
}
export function assertScope(p) { assert.equal(p.format, 13); assert.deepEqual(p.scope, scope); assert.deepEqual(p.changed_keys, ['NUXT_PUBLIC_AUTH_CAPTCHA_PROVIDER', 'NUXT_PUBLIC_TURNSTILE_SITE_KEY']); assert.equal(p.git_push, false) }
// Read-only shared recovery requires a capacity hint even without an app archive.
// Adapt its input without modifying the sealed plan used for runtime activation.
export function recoveryPlan(p) { assertScope(p); return { ...p, archive_bytes: 0 } }
export function assertFresh(p, now = Date.now()) { const t = Date.parse(p.backup_verified_utc); assert.ok(Number.isFinite(t) && t <= now && now - t <= 6 * 3600000, 'Recovery evidence expired'); assert.equal(p.backup_proof.database.pg_restore_full_readback, 'PASS'); assert.equal(p.backup_proof.runtime.full_byte_readback, true) }
const load = async path => JSON.parse(await readFile(path, 'utf8'))
const save = (path, value) => writeFile(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
const environment = () => ({ PATH: dirname(process.execPath) + ':/usr/bin:/bin:/usr/sbin:/sbin', HOME: process.env.HOME, LANG: 'C', NODE_ENV: 'production' })
const shell = value => "'" + value.replaceAll("'", "'\\''") + "'"
const stable = v => Object.fromEntries(Object.entries(v).filter(([k]) => !['observed_utc', 'free_bytes', 'production_writes'].includes(k)))
const sshArgs = t => ['-T', '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'HostKeyAlgorithms=ssh-ed25519', '-o', 'UserKnownHostsFile=' + t.known_hosts, '-o', 'ConnectionAttempts=1', '-o', 'ConnectTimeout=12', '-o', 'ServerAliveInterval=10', '-o', 'ServerAliveCountMax=2', '-o', 'ControlMaster=no', '-i', t.identity]
async function hashes(paths) {
  const names = (await run('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', ...paths], { cwd: repo, maxBuffer: 8e6 })).stdout.trim().split('\n').sort()
  return Object.fromEntries(await Promise.all(names.map(async name => [name, hash(await readFile(repo + '/' + name))])))
}
const applicationInputs = () => hashes(['app', 'server', 'public', 'i18n', 'nuxt.config.ts', 'package.json', 'package-lock.json', 'tsconfig.json', 'supabase/migrations'])
const toolInputs = () => hashes(['scripts', 'docs/operations/backup-envelope.mjs'])
async function remote(p, mode, approved = null, database = null) {
  assert.ok(['preview', 'prepare', 'candidate', 'activate'].includes(mode)); if (mode !== 'preview') { assertScope(p); assert.equal(approved, p.seal) }
  const command = 'python3 -I -S -B -c ' + shell('import sys,json;q=json.load(sys.stdin);sys.argv=["turnstile-runtime.py",q["mode"],json.dumps(q)];exec(compile(q["source"],"turnstile-runtime.py","exec"))')
  const task = run('ssh', [...sshArgs(p.target), 'root@' + p.target.host, command], { env: environment(), timeout: 180000, maxBuffer: 64e6 })
  task.child.stdin.on('error', () => {}); task.child.stdin.end(JSON.stringify({ source: await readFile(here + '/remote.py', 'utf8'), plan: p, mode, approved, database }))
  const value = JSON.parse((await task).stdout); assert.notEqual(value.result, 'STOP'); return value
}
async function authState(t) {
  const c = await load(t.credentials_file), r = await fetch('https://' + t.project_ref + '.supabase.co/auth/v1/settings', { headers: { apikey: c.anon_key }, signal: AbortSignal.timeout(15000) })
  assert.equal(r.status, 200); const v = await r.json(); assert.equal(v.disable_signup, true); assert.equal(v.mailer_autoconfirm, false)
  return { disable_signup: true, mailer_autoconfirm: false, external: v.external }
}
async function databaseState(t) {
  const db = await connect(t)
  try {
    await db.query('begin isolation level repeatable read read only'); const state = await baseline(db), records = []; assert.equal(state.history.length, 94)
    for (const table of historyTables) records.push({ table, ...(await db.query(`select count(*)::int count,encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text collate "C")::text,'[]'),'UTF8')),'hex') sha256 from customer_history_private.${table} t`)).rows[0] })
    assert.equal((await db.query('show transaction_read_only')).rows[0].transaction_read_only, 'on'); await db.query('rollback'); return { ...state, history_records: records }
  } finally { await db.end() }
}
async function localCheck(work, p) {
  const { seal, ...body } = p; assert.equal(digest(body), seal); assertScope(p); assertFresh(p); assert.equal(process.version, 'v22.23.1')
  assert.equal((await run('git', ['rev-parse', 'HEAD'], { cwd: repo })).stdout.trim(), p.operator_commit)
  assert.deepEqual(await applicationInputs(), p.application_inputs); assert.deepEqual(await toolInputs(), p.tools)
  for (const [file, sha] of Object.entries(p.evidence_sha256)) assert.equal(hash(await readFile(file)), sha, 'Evidence drift')
  for (const [file, sha] of Object.entries(p.protected_inputs)) assert.equal(hash(await readFile(file)), sha, 'Protected input drift')
  for (const name of ['database-before.dump', 'runtime-recovery.tar.gz']) {
    const v = JSON.parse((await run(process.execPath, [p.backup.envelope, 'verify', p.backup.key, work + '/backups/' + name + '.enc'], { env: environment(), timeout: 180000 })).stdout); assert.equal(v.authenticatedDecryption, true)
  }
}
async function checked(work, p) {
  await localCheck(work, p); const now = await remote(p, 'preview')
  assert.deepEqual(stable(now.before), stable(p.before), 'Runtime drift'); assert.deepEqual({ ...now, before: null }, { ...p.runtime, before: null }, 'Proposed runtime drift')
  assert.deepEqual(approvalState(await databaseState(p.target)), approvalState(p.database), 'Protected data/schema/ownership drift')
  assert.deepEqual(await authState(p.target), p.auth, 'Auth policy drift')
}
async function prepare(work) {
  assert.equal(process.version, 'v22.23.1')
  assert.equal((await run('git', ['status', '--porcelain', '--', 'scripts', 'tests'], { cwd: repo })).stdout, '', 'Commit reviewed operational tools/tests before sealing')
  const spec = await load(work + '/spec.private.json'), owner = await load(spec.widget_file), installed = await load(spec.deployed_packet + '/plan.json'), receipt = await load(spec.deployed_packet + '/DEPLOYMENT-RECEIPT.json')
  const { seal: deployedSeal, ...deployedBody } = installed; assert.equal(digest(deployedBody), deployedSeal); assert.equal(deployedSeal, spec.deployed_seal); assert.equal(receipt.result, 'DEPLOY_PASS_APPROVAL_CONSUMED')
  const application = await applicationInputs(); assert.deepEqual(application, installed.application_inputs, 'Application/session-isolation inputs changed; no application deployment is permitted')
  const widget = publicWidget(owner)
  const base = { target: spec.target, release_id: spec.deployed_release, widget, deployed_verified: { archive_sha256: spec.deployed_archive_sha256, commit: spec.deployed_source_commit, plan_sha256: spec.deployed_seal } }
  const runtime = await remote(base, 'preview'), database = await databaseState(spec.target), auth = await authState(spec.target)
  await save(work + '/runtime-preview.private.json', runtime); await save(work + '/database-before.private.json', database); await save(work + '/auth-before.json', auth)
  await mkdir(work + '/backups', { mode: 0o700 }); const backupProof = await backup({ ...base, before: runtime.before, archive_bytes: 0, backup: spec.backup }, work + '/backups')
  const now = new Date().toISOString(), validation = await load(work + '/validation.json'); assert.equal(validation.result, 'PASS')
  assert.equal(validation.widget_input_sha256, hash(await readFile(spec.widget_file)), 'Tested public widget input changed')
  const live = await load(work + '/live-tab-preview.json'); assert.equal(live.result, 'LIVE_TAB_WIDGET_PASS'); assert.equal(live.live_origin, spec.target.origin)
  assert.equal(live.auth_submissions, 0); assert.equal(live.secret_key_seen, false); assert.equal(live.runtime_file_changed, false); assert.equal(live.token_observed_as_boolean_only, true)
  for (const [file, sha] of Object.entries(validation.evidence_sha256)) assert.equal(hash(await readFile(file)), sha)
  const names = ['spec.private.json', 'validation.json', 'runtime-preview.private.json', 'database-before.private.json', 'auth-before.json', 'backups/backup-verification.json', 'backups/database-before.dump.enc', 'backups/runtime-recovery.tar.gz.enc']
  const evidence = { ...validation.evidence_sha256, [spec.widget_file]: hash(await readFile(spec.widget_file)), [spec.deployed_packet + '/DEPLOYMENT-RECEIPT.json']: hash(await readFile(spec.deployed_packet + '/DEPLOYMENT-RECEIPT.json')) }
  for (const name of names) evidence[work + '/' + name] = hash(await readFile(work + '/' + name))
  const protectedFiles = [spec.target.credentials_file, spec.target.database.ca_file, spec.target.identity, spec.target.known_hosts, spec.backup.key, spec.backup.pg_dump, dirname(spec.backup.pg_dump) + '/pg_restore', spec.backup.envelope, process.execPath]
  const p = { format: 13, created_utc: now, scope, ...base, changed_keys: ['NUXT_PUBLIC_AUTH_CAPTCHA_PROVIDER', 'NUXT_PUBLIC_TURNSTILE_SITE_KEY'], operator_commit: (await run('git', ['rev-parse', 'HEAD'], { cwd: repo })).stdout.trim(), application_inputs: application, tools: await toolInputs(), before: runtime.before, runtime, database, database_state_sha256: digest(approvalState(database)), auth, backup: spec.backup, backup_verified_utc: now, backup_proof: backupProof, evidence_sha256: evidence, protected_inputs: Object.fromEntries(await Promise.all(protectedFiles.map(async f => [f, hash(await readFile(f))]))), approval_phrase: 'APPROVE TURNSTILE FRONTEND CONFIG', git_push: false, rollback: { automatic: false, separate_review: true, retained_runtime_backup: 'execution/runtime-recovery.tar.gz.enc' } }
  p.seal = digest(p); await checked(work, p); await save(work + '/plan.json', p)
  console.log(JSON.stringify({ result: 'FRONTEND_CONFIG_READY', seal: p.seal, approval: p.approval_phrase + ' ' + p.seal, captcha_enforcement: false, signup: false, purchasing: false }))
}
async function check(work) { const p = await load(work + '/plan.json'); await checked(work, p); console.log(JSON.stringify({ result: 'READ_ONLY_CHECK_PASS', seal: p.seal, target_writes: 0 })) }
async function apply(work, approved) {
  const p = await load(work + '/plan.json'); assert.equal(approved, p.seal, 'Exact frontend configuration approval required')
  try { await access(work + '/execution-intent.json'); throw Error('Consumed approval; inspect only') } catch (e) { if (e.code !== 'ENOENT') throw e }
  await checked(work, p); await save(work + '/execution-intent.json', { seal: p.seal, utc: new Date().toISOString(), automatic_retry: false }); const execution = work + '/execution'; await mkdir(execution, { mode: 0o700 })
  try {
    await backup(recoveryPlan(p), execution); await checked(work, p)
    for (const mode of ['prepare', 'candidate']) await save(execution + '/' + mode + '.json', await remote(p, mode, approved))
    await checked(work, p); await save(execution + '/activate.json', await remote(p, 'activate', approved, { seal: p.seal, state_sha256: p.database_state_sha256, schema: 94, read_only: true }))
    assert.deepEqual(approvalState(await databaseState(p.target)), approvalState(p.database)); assert.deepEqual(await authState(p.target), p.auth)
    for (const path of ['/login', '/ar/login', '/dashboard/login']) { const r = await fetch(p.target.origin + path, { signal: AbortSignal.timeout(15000), redirect: 'manual' }); assert.equal(r.status, 200); assert.ok((await r.text()).includes(p.widget.site_key)) }
    for (const [path, status] of [['/cart', 403], ['/checkout', 403], ['/api/account/history', 401]]) { const r = await fetch(p.target.origin + path, { signal: AbortSignal.timeout(15000), redirect: 'manual' }); await r.arrayBuffer(); assert.equal(r.status, status) }
    await save(execution + '/completed.json', { result: 'FRONTEND_CONFIG_PASS', seal: p.seal, application_release_unchanged: p.release_id, schema: 94, app_restarts: 1, supabase_changes: 0, captcha_enforcement: false, signup_disabled: true, purchasing_closed: true, provider_requests: 0, git_push: false }); console.log(JSON.stringify({ result: 'FRONTEND_CONFIG_PASS', seal: p.seal }))
  } catch (e) { await save(execution + '/STOP.json', { result: 'STOP', type: e.name, automatic_retry: false, automatic_rollback: false }); throw Error('STOP; preserve evidence. No retry or automatic rollback.') }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const [mode, directory, approved] = process.argv.slice(2); assert.ok(['prepare', 'check', 'apply'].includes(mode)); await ({ prepare, check, apply }[mode])(resolve(directory), approved) }
  catch (e) { console.error(JSON.stringify({ result: 'STOP', type: e.name, message: e.message, automatic_retry: false })); process.exitCode = 1 }
}
