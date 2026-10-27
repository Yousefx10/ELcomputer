// Read-only preparation; apply requires a new exact, single-use owner approval.
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, access, readdir } from 'node:fs/promises'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { pipeline } from 'node:stream/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { databaseTools, digest, hash, migrationHash, version } from './database.mjs'
const here = dirname(fileURLToPath(import.meta.url)), run = promisify(execFile)
const load = async f => JSON.parse(await readFile(f, 'utf8'))
const save = (f, v) => writeFile(f, JSON.stringify(v, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
const shell = v => "'" + v.replaceAll("'", "'\\''") + "'"
const env = () => ({ PATH: dirname(process.execPath) + ':/usr/bin:/bin:/usr/sbin:/sbin', HOME: process.env.HOME, LANG: 'C', NODE_ENV: 'production' })
const exited = c => new Promise((ok, fail) => { c.once('error', fail); c.once('close', ok) })
export const scope = { milestone: 'schema95_inactive_beta', schema: '94->95', database_writes: 'one_additive_migration_only', runtime_change: false, caddy_change: false, provider_calls: false, public_checkout: false, signup: 'preserve_open' }
const stable = v => Object.fromEntries(Object.entries(v).filter(([k]) => !['observed_utc', 'free_bytes', 'production_writes'].includes(k)))
const sshArgs = t => ['-T', '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'HostKeyAlgorithms=ssh-ed25519', '-o', 'UserKnownHostsFile=' + t.known_hosts, '-o', 'ConnectionAttempts=1', '-o', 'ConnectTimeout=12', '-o', 'ServerAliveInterval=10', '-o', 'ServerAliveCountMax=2', '-o', 'ControlMaster=no', '-i', t.identity]
export function assertPlan(p, now = Date.now()) {
  const { seal, ...body } = p; assert.equal(digest(body), seal); assert.deepEqual(p.scope, scope)
  assert.equal(p.format, 95); assert.equal(p.schema_version, 95); assert.deepEqual(p.migrations, [version]); assert.equal(p.database_writes, 'one_additive_migration_only')
  assert.equal(p.migration_sha256, migrationHash); assert.equal(p.nuxt_restarts_max, 1)
  assert.equal(p.archive_sha256, '81becf54218a8e144137f2bdce7df1eed6bcc07745924c0167fcd7435aae37ff')
  assert.equal(p.application_commit, 'b37be43ac6a24a663a12a5a56aaaa7e801827963')
  assert.equal(p.release_id, p.archive_sha256.slice(0, 16)); assert.equal(p.provider_requests, 0)
  for (const k of ['automatic_retry', 'automatic_rollback', 'git_push', 'public_signup_activation', 'public_purchase_activation', 'production_payment', 'business_configuration_changes']) assert.equal(p[k], false, k)
  const time = Date.parse(p.backup_verified_utc); assert.ok(Number.isFinite(time) && time <= now && now - time <= 6 * 3600000, 'Recovery evidence expired')
  assert.equal(p.backup_proof.database.pg_restore_full_readback, 'PASS'); assert.equal(p.backup_proof.runtime.full_byte_readback, true)
}
async function remoteProcess(p, mode, approved = null, database = null) {
  assert.ok(['inspect', 'recovery', 'prepare', 'stage', 'candidate', 'activate'].includes(mode))
  if (!['inspect', 'recovery'].includes(mode)) { assertPlan(p); assert.equal(approved, p.seal) }
  const code = 'import sys,json;q=json.load(sys.stdin);sys.argv=["schema95-beta.py",q["mode"],json.dumps(q)];exec(compile(q["source"],"schema95-beta.py","exec"))'
  const child = spawn('ssh', [...sshArgs(p.target), 'root@' + p.target.host, 'python3 -I -S -B -c ' + shell(code)], { env: env(), stdio: ['pipe', 'pipe', 'pipe'], timeout: 180000 })
  child.stdin.on('error', () => {}); child.stdin.end(JSON.stringify({ source: await readFile(here + '/remote.py', 'utf8'), plan: p, mode, approved, database })); return child
}
async function remote(p, mode, approved, database) {
  const c = await remoteProcess(p, mode, approved, database), out = [], err = []; let bytes = 0
  c.stdout.on('data', b => { bytes += b.length; if (bytes > 64e6) c.kill('SIGTERM'); else out.push(b) }); c.stderr.on('data', b => err.push(b))
  assert.equal(await exited(c), 0, 'Pinned remote ' + mode + ' stopped; no retry'); assert.ok(bytes <= 64e6)
  return JSON.parse(Buffer.concat(out))
}
async function authState(t) {
  const c = await load(t.credentials_file), r = await fetch('https://' + t.project_ref + '.supabase.co/auth/v1/settings', { headers: { apikey: c.anon_key }, redirect: 'manual', signal: AbortSignal.timeout(15000) })
  assert.equal(r.status, 200); const s = await r.json(); assert.equal(s.disable_signup, false); assert.equal(s.mailer_autoconfirm, false); assert.equal(s.external?.email, true)
  return { disable_signup: false, mailer_autoconfirm: false, external: s.external }
}
async function health(t) {
  const proof = []
  for (const [path, status] of [['/login', 200], ['/ar/login', 200], ['/cart', 403], ['/checkout', 403], ['/api/account/history', 401]]) {
    const r = await fetch(t.origin + path, { redirect: 'manual', signal: AbortSignal.timeout(15000) }); await r.arrayBuffer(); assert.equal(r.status, status); proof.push({ path, status })
  }
  return proof
}
async function fileHashes(files) { return Object.fromEntries(await Promise.all(files.map(async f => [f, hash(await readFile(f))]))) }
async function toolHashes(p) {
  const names = (await run('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', 'scripts', 'docs/operations/backup-envelope.mjs', 'tests/helpers'], { cwd: p.source_repo, maxBuffer: 8e6 })).stdout.trim().split('\n')
  return fileHashes([...names.map(n => p.source_repo + '/' + n), ...['operator.mjs', 'database.mjs', 'remote.py', 'assets.py', 'qualify.mjs', 'guards.test.mjs', 'migration.test.mjs', 'remote_test.py'].map(n => here + '/' + n)])
}
async function sourceInputs(p) {
  assert.equal((await run('git', ['rev-parse', 'HEAD'], { cwd: p.source_repo })).stdout.trim(), p.application_commit)
  const names = (await run('git', ['ls-tree', '-r', '--name-only', p.application_commit, '--', 'app', 'server', 'public', 'i18n', 'nuxt.config.ts', 'package.json', 'package-lock.json', 'tsconfig.json', 'supabase/migrations'], { cwd: p.source_repo, maxBuffer: 8e6 })).stdout.trim().split('\n')
  assert.equal(names.filter(n => n.startsWith('supabase/migrations/') && n.endsWith('.sql')).length, 95)
  assert.equal((await run('git', ['diff', 'HEAD', '--name-only', '--', ...['app', 'server', 'public', 'i18n', 'nuxt.config.ts', 'package.json', 'package-lock.json', 'tsconfig.json', 'supabase/migrations']], { cwd: p.source_repo })).stdout, '')
  const untracked = (await run('git', ['ls-files', '--others', '--exclude-standard', '--', 'app', 'server', 'public', 'i18n', 'supabase/migrations'], { cwd: p.source_repo })).stdout; assert.equal(untracked, '')
  return fileHashes(names.map(n => p.source_repo + '/' + n))
}
async function frozenWorktrees(p) {
  const old = await load(p.preservation_file); let count = 0
  for (const t of old) {
    if (t.path === p.documentation_repo) continue
    assert.equal((await run('git', ['rev-parse', 'HEAD'], { cwd: t.path })).stdout.trim(), t.head)
    assert.equal((await run('git', ['status', '--porcelain=v1', '-z'], { cwd: t.path, encoding: 'buffer', maxBuffer: 8e6 })).stdout.toString('hex'), t.status_hex)
    for (const [f, m] of Object.entries(t.files)) { assert.equal(hash(await readFile(t.path + '/' + f)), m.sha256); count++ }
  }
  assert.equal(count, 135)
  assert.equal((await run('git', ['rev-parse', 'HEAD'], { cwd: p.location_repo })).stdout.trim(), p.location_head)
  assert.equal((await run('git', ['status', '--porcelain'], { cwd: p.location_repo })).stdout, '')
  return { frozen_worktrees: old.length - 1, frozen_dirty_paths: count, separate96_unchanged: true }
}
async function encrypted(p, work, name, source) {
  const sink = spawn(process.execPath, [p.backup.envelope, 'encrypt', p.backup.key, work + '/' + name + '.enc'], { env: env(), stdio: ['pipe', 'pipe', 'pipe'], timeout: 180000 }), out = [], errors = []
  for (const c of [source, sink]) c.stderr.on('data', b => errors.push(b)); sink.stdout.on('data', b => out.push(b))
  const outcomes = await Promise.allSettled([exited(source), exited(sink), pipeline(source.stdout, sink.stdin)])
  await writeFile(work + '/' + name + '.diagnostics', Buffer.concat(errors), { flag: 'wx', mode: 0o600 })
  assert.ok(outcomes.every(r => r.status === 'fulfilled') && outcomes[0].value === 0 && outcomes[1].value === 0, 'Encrypted backup stopped')
  const receipt = JSON.parse(Buffer.concat(out)), verified = JSON.parse((await run(process.execPath, [p.backup.envelope, 'verify', p.backup.key, work + '/' + name + '.enc'], { env: env(), timeout: 180000 })).stdout)
  assert.equal(verified.authenticatedDecryption, true); assert.equal(verified.plaintextSha256, receipt.plaintextSha256); assert.equal(verified.encryptedSha256, receipt.encryptedSha256)
  return receipt
}
async function backup(p, work) {
  await mkdir(work, { mode: 0o700 })
  const t = p.target, b = p.backup, c = await load(t.credentials_file)
  const pgEnv = { ...env(), DYLD_LIBRARY_PATH: b.library_path, PGHOST: t.database.host, PGPORT: '5432', PGDATABASE: 'postgres', PGUSER: 'postgres', PGPASSWORD: c.database_password, PGSSLMODE: 'verify-full', PGSSLROOTCERT: t.database.ca_file, PGCONNECT_TIMEOUT: '12', PGOPTIONS: '-c default_transaction_read_only=on -c statement_timeout=120000 -c lock_timeout=5000' }
  const database = await encrypted(p, work, 'database-before.dump', spawn(b.pg_dump, ['-w', '-Fc', '-Z0', '--lock-wait-timeout=5000'], { env: pgEnv, stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 }))
  const { decryptTo } = await import(pathToFileURL(p.source_repo + '/scripts/live-sales-release/operator.mjs'))
  const localEnv = { ...env(), DYLD_LIBRARY_PATH: b.library_path }
  const toc = await decryptTo(p, work, 'database-before.dump', dirname(b.pg_dump) + '/pg_restore', ['--list'], localEnv)
  for (const name of ['customer_orders', 'users', 'identities', 'schema_migrations', 'products', 'objects', 'customer_history_private']) assert.ok(toc.toString().includes(name))
  await writeFile(work + '/database-toc.txt', toc, { flag: 'wx', mode: 0o600 })
  await decryptTo(p, work, 'database-before.dump', dirname(b.pg_dump) + '/pg_restore', ['--file=/dev/null'], localEnv, 'full-readback')
  const runtime = await encrypted(p, work, 'runtime-recovery.tar.gz', await remoteProcess(p, 'recovery'))
  const expected = Object.fromEntries(Object.entries(p.before.recovery_files).map(([path, value]) => [path.slice(1), value]))
  const verifier = 'import sys,tarfile,json,hashlib; expected=json.loads(sys.argv[1]);seen=set();t=tarfile.open(fileobj=sys.stdin.buffer,mode="r|gz");\nfor m in t:\n assert m.isfile() and m.name in expected and m.name not in seen;seen.add(m.name);assert hashlib.sha256(t.extractfile(m).read()).hexdigest()==expected[m.name]["sha256"]\nassert seen==set(expected)\nprint(json.dumps({"files":len(seen),"full_byte_readback":True}))'
  const checked = JSON.parse(await decryptTo(p, work, 'runtime-recovery.tar.gz', 'python3', ['-c', verifier, JSON.stringify(expected)]))
  const proof = { database: { ...database, pg_restore_list: 'PASS', pg_restore_full_readback: 'PASS' }, runtime: { ...runtime, ...checked }, production_writes: 0 }
  await save(work + '/backup-verification.json', proof); return proof
}
async function localCheck(work, p) {
  assertPlan(p); assert.equal(process.version, 'v22.23.1')
  assert.deepEqual(await sourceInputs(p), p.application_inputs); assert.deepEqual(await toolHashes(p), p.tools)
  await frozenWorktrees(p)
  for (const [f, sha] of Object.entries(p.protected_inputs)) assert.equal(hash(await readFile(f)), sha, 'Changed sealed input: ' + f)
  const { inventory } = await import(pathToFileURL(p.source_repo + '/scripts/publish/inventory.mjs'))
  assert.equal(digest(await inventory(work + '/readback')), p.inventory_sha256)
  for (const [name, proof] of [['database-before.dump', p.backup_proof.database], ['runtime-recovery.tar.gz', p.backup_proof.runtime]]) {
    assert.equal(hash(await readFile(work + '/backups/' + name + '.enc')), proof.encryptedSha256)
    const verified = JSON.parse((await run(process.execPath, [p.backup.envelope, 'verify', p.backup.key, work + '/backups/' + name + '.enc'], { env: env(), timeout: 180000 })).stdout)
    assert.equal(verified.authenticatedDecryption, true); assert.equal(verified.plaintextSha256, proof.plaintextSha256)
  }
}
async function liveCheck(p) {
  assert.deepEqual(stable(await remote(p, 'inspect')), stable(p.before), 'Runtime/media/assets drift')
  const db = await databaseTools(p.source_repo); assert.deepEqual(db.comparable(await db.observe(p.target)), db.comparable(p.database), 'Data/schema/ownership drift')
  assert.deepEqual(await authState(p.target), p.auth); await health(p.target)
}
async function prepare(work) {
  assert.equal(process.version, 'v22.23.1'); const spec = await load(work + '/spec.private.json')
  const manifest = await load(spec.artifact_dir + '/manifest.json')
  assert.equal(manifest.source_commit, 'b37be43ac6a24a663a12a5a56aaaa7e801827963'); assert.equal(manifest.schema_candidate, 95)
  const p = { ...spec, format: 95, scope, application_commit: manifest.source_commit, schema_version: 95, migrations: [version], database_writes: scope.database_writes, migration_sha256: migrationHash, archive_sha256: manifest.artifact_sha256['application.tar.gz'], release_id: manifest.artifact_sha256['application.tar.gz'].slice(0, 16), archive_bytes: (await readFile(spec.artifact_dir + '/application.tar.gz')).length }
  for (const [name, sha] of Object.entries(manifest.artifact_sha256)) assert.equal(hash(await readFile(spec.artifact_dir + '/' + name)), sha)
  assert.equal(p.archive_sha256, '81becf54218a8e144137f2bdce7df1eed6bcc07745924c0167fcd7435aae37ff')
  p.application_inputs = await sourceInputs(p); p.tools = await toolHashes(p); p.preservation = await frozenWorktrees(p)
  const qualification = await load(work + '/migration-qualification.json'); assert.equal(qualification.result, 'PASS'); assert.equal(qualification.exact_sql_sha256, migrationHash)
  const guards = await readFile(work + '/operator-tests.log', 'utf8'); assert.match(guards, /# fail 0/); assert.doesNotMatch(guards, /# skipped [1-9]/)
  assert.match(await readFile(work + '/remote-tests.log', 'utf8'), /\nOK\s*$/)
  assert.match(await readFile(work + '/migration-operator-tests.log', 'utf8'), /# pass 6/)
  assert.match(await readFile(work + '/migration-operator-tests.log', 'utf8'), /# fail 0/)
  assert.doesNotMatch(await readFile(work + '/migration-operator-tests.log', 'utf8'), /# skipped [1-9]/)
  assert.match(await readFile(p.validation_dir + '/native-untracked-and-preservation-3.log', 'utf8'), /# pass 15/)
  assert.match(await readFile(p.validation_dir + '/native-untracked-and-preservation-3.log', 'utf8'), /# fail 0/)
  assert.match(await readFile(p.validation_dir + '/build-final.log', 'utf8'), /Build complete!/)
  p.before = await remote(p, 'inspect'); assert.deepEqual(p.before.verified, p.expected_deployed_verified)
  assert.equal(hash(await readFile(p.previous_archive)), p.before.verified.archive_sha256)
  const db = await databaseTools(p.source_repo); p.database = await db.observe(p.target); assert.equal(p.database.history.length, 94)
  // Exact migration lineage, including the original certificate and post-certificate SQL.
  const names = (await readdir(p.source_repo + '/supabase/migrations')).filter(n => n.endsWith('.sql')).sort()
  assert.deepEqual(p.database.history.map(r => r.version), names.slice(0, 94).map(n => n.slice(0, 14)))
  const certificate = await load(p.source_repo + '/supabase/bootstrap/release-82-v1/manifest.json')
  const { json: certificateJson } = await import(pathToFileURL(p.source_repo + '/scripts/lib/cleanBaseline.mjs'))
  for (let i = 0; i < 82; i++) assert.equal(hash(certificateJson(p.database.history[i].statements)), certificate.history[i].statements_sha256)
  for (let i = 82; i < 94; i++) assert.deepEqual(p.database.history[i].statements, [await readFile(p.source_repo + '/supabase/migrations/' + names[i], 'utf8')])
  p.schema_delta = await load(work + '/schema-delta.json'); p.expected_after_schema_sha256 = digest(db.expectedSchema(p.database.schema, p.schema_delta))
  p.base_inventory_sha256 = digest(await load(p.base_inventory_file)); p.compatibility_inventory_sha256 = digest(await load(p.compatibility_inventory_file)); p.compatibility_archive_sha256 = hash(await readFile(p.compatibility_archive))
  const assetProof = await load(work + '/asset-preservation.json'); assert.equal(assetProof.result, 'PASS'); assert.equal(assetProof.companion_archive_sha256, p.compatibility_archive_sha256); assert.equal(assetProof.overwritten_files, 0)
  p.auth = await authState(p.target); p.http_before = await health(p.target)
  const { inventory } = await import(pathToFileURL(p.source_repo + '/scripts/publish/inventory.mjs'))
  const credentials = await load(p.target.credentials_file), entries = await inventory(work + '/readback', { secrets: [credentials.database_password, credentials.service_role_key] })
  p.inventory_sha256 = digest(entries); await save(work + '/inventory.json', entries)
  for (const [name, value] of Object.entries(p.before.assets)) assert.equal(hash(await readFile(work + '/readback/public/_nuxt/' + name)), value.sha256, 'Previous asset missing')
  p.backup_proof = await backup(p, work + '/backups'); p.backup_verified_utc = new Date().toISOString()
  const files = [work + '/spec.private.json', work + '/schema-delta.json', work + '/migration-qualification.json', work + '/migration-qualification.log', work + '/migration-operator-tests.log', work + '/operator-tests.log', work + '/remote-tests.log', work + '/inventory.json', work + '/backups/backup-verification.json', p.previous_archive, p.target.credentials_file, p.target.database.ca_file, p.target.identity, p.target.known_hosts, p.backup.key, p.backup.envelope, p.backup.pg_dump, dirname(p.backup.pg_dump) + '/pg_restore', process.execPath, p.preservation_file, p.validation_dir + '/native-untracked-and-preservation-3.log', p.validation_dir + '/typecheck-untracked.log', p.validation_dir + '/build-final.log', ...['manifest.json', ...Object.keys(manifest.artifact_sha256)].map(n => p.artifact_dir + '/' + n)]
  files.push(p.base_inventory_file, p.compatibility_inventory_file, p.compatibility_archive, p.baseline_runtime_file, work + '/asset-preservation.json')
  p.protected_inputs = await fileHashes(files)
  Object.assign(p, { created_utc: new Date().toISOString(), provider_requests: 0, nuxt_restarts_max: 1, automatic_retry: false, automatic_rollback: false, git_push: false, public_signup_activation: false, public_purchase_activation: false, production_payment: false, business_configuration_changes: false, approval_phrase: 'APPROVE SCHEMA95 BETA DEPLOY', rollback: { previous_release: p.before.current, automatic: false, separate_review_required: true, sql_down_migration: false, retain_schema95: true, require_tracking_default_true_and_no_untracked_orders: true } })
  p.seal = digest(p); await localCheck(work, p); await liveCheck(p); await save(work + '/plan.json', p)
  console.log(JSON.stringify({ result: 'SCHEMA95_RELEASE_READY', seal: p.seal, approval: p.approval_phrase + ' ' + p.seal, production_writes: 0 }))
}
async function check(work) { const p = await load(work + '/plan.json'); await localCheck(work, p); await liveCheck(p); console.log(JSON.stringify({ result: 'READ_ONLY_CHECK_PASS', seal: p.seal, production_writes: 0 })) }
async function apply(work, approved) {
  const p = await load(work + '/plan.json'); assertPlan(p); assert.equal(approved, p.seal, 'Exact owner deployment approval required')
  try { await access(work + '/execution-intent.json'); throw Error('Consumed approval; inspect only') } catch (e) { if (e.code !== 'ENOENT') throw e }
  await localCheck(work, p); await liveCheck(p)
  await save(work + '/execution-intent.json', { seal: p.seal, utc: new Date().toISOString(), automatic_retry: false })
  const execution = work + '/execution'; await mkdir(execution, { mode: 0o700 })
  try {
    await backup(p, execution + '/backups'); await liveCheck(p)
    await save(execution + '/prepare.json', await remote(p, 'prepare', approved))
    const stage = '/var/lib/schema95-beta-releases/' + p.release_id, args = sshArgs(p.target).filter(v => v !== '-T')
    for (const [source, dest] of [[p.artifact_dir + '/application.tar.gz', 'release.tar.gz'], [work + '/inventory.json', 'inventory.json'], [p.base_inventory_file, 'base-inventory.json'], [p.compatibility_inventory_file, 'compatibility-inventory.json'], [p.compatibility_archive, 'compatibility.tar.gz']]) await run('scp', [...args, source, 'root@' + p.target.host + ':' + stage + '/' + dest], { env: env(), timeout: 180000 })
    await save(execution + '/stage.json', await remote(p, 'stage', approved)); await liveCheck(p)
    const db = await databaseTools(p.source_repo), connection = await db.connect(p.target, { readOnly: false }); let receipt
    try { receipt = await db.migrate(connection, p, await readFile(p.artifact_dir + '/20261026170000_unrecorded_normal_sales.sql', 'utf8'), r => save(execution + '/migration-precommit.json', { ...r, migration_committed: false })) }
    finally { await connection.end() }
    await save(execution + '/migration-committed.json', receipt)
    await save(execution + '/candidate.json', await remote(p, 'candidate', approved))
    assert.deepEqual(await authState(p.target), p.auth)
    await save(execution + '/activate.json', await remote(p, 'activate', approved, receipt))
    const after = await db.observe(p.target, p.database.tables)
    assert.deepEqual(after.protected_tables.filter(t => !['store_analytics_events', 'store_analytics_sessions', 'users'].includes(t.name)), p.database.protected_tables.filter(t => !['store_analytics_events', 'store_analytics_sessions', 'users'].includes(t.name)))
    assert.equal(digest(after.schema), p.expected_after_schema_sha256); assert.equal(after.history.length, 95)
    assert.deepEqual(after.history.slice(0, 94), p.database.history); assert.deepEqual(after.auth_security, p.database.auth_security)
    assert.deepEqual(after.history_schema, p.database.history_schema); assert.deepEqual(after.history_counts, p.database.history_counts); assert.deepEqual(await authState(p.target), p.auth)
    await health(p.target); await frozenWorktrees(p)
    await save(execution + '/completed.json', { result: 'DEPLOY_PASS', seal: p.seal, release: p.release_id, schema: 95, signup_open: true, confirmation_required: true, turnstile_preserved: true, purchasing_closed: true, provider_calls: 0, real_payments: 0, business_configuration_changes: 0 })
    console.log(JSON.stringify({ result: 'DEPLOY_PASS', seal: p.seal, release: p.release_id }))
  } catch (e) { await save(execution + '/STOP.json', { result: 'STOP', type: e.name, automatic_retry: false, automatic_rollback: false }); throw Error('STOP; preserve evidence. No retry, automatic rollback or second restart.') }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const [mode, directory, approval] = process.argv.slice(2); assert.ok(['prepare', 'check', 'apply'].includes(mode)); await ({ prepare, check, apply }[mode])(resolve(directory), approval) }
  catch (e) { console.error(JSON.stringify({ result: 'STOP', type: e.name, message: e.message, automatic_retry: false })); process.exitCode = 1 }
}
