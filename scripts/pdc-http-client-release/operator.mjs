// One application archive, schema91 unchanged. Preparation and check are read-only.
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, readdir, lstat, chmod, copyFile, access } from 'node:fs/promises'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { connect, snapshot } from '../commerce-release/database.mjs'
import { schemaState } from '../footer-release/database.mjs'
import { authSecurityFingerprint } from '../live-sales-release/auth.mjs'
import { approvalState } from '../live-sales-release/operator.mjs'
import { backup } from '../footer-release/operator.mjs'
import { inventory } from '../publish/inventory.mjs'
import { createReleaseArchive } from '../controlled-purchase-release/operator.mjs'
import { retainClientAssets } from '../premium-product-finishing-release/assets.mjs'
import { patchNitro, sourceFiles } from './patch.mjs'

const here = dirname(fileURLToPath(import.meta.url)), repo = resolve(here, '../..'), run = promisify(execFile)
const hash = value => createHash('sha256').update(value).digest('hex')
const sorted = value => Array.isArray(value) ? value.map(sorted) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])])) : value
export const digest = value => hash(JSON.stringify(sorted(value)))
const load = async file => JSON.parse(await readFile(file, 'utf8'))
const save = (file, value) => writeFile(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
const shell = value => "'" + value.replaceAll("'", "'\\''") + "'"
const cleanEnv = () => ({ PATH: dirname(process.execPath) + ':/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin', HOME: process.env.HOME, LANG: 'en_US.UTF-8', NODE_ENV: 'production' })
const stable = value => Object.fromEntries(Object.entries(value).filter(([key]) => !['observed_utc', 'free_bytes', 'production_writes'].includes(key)))
const scope = { milestone: 'pdc_http_client', schema: '91 unchanged', database_writes: false, runtime_change: false, caddy_change: false, provider_calls: false, public_checkout: false, signup: false }
const applicationPaths = ['app', 'server', 'public', 'i18n', 'package.json', 'package-lock.json', 'nuxt.config.ts', 'tsconfig.json']
const sshArgs = target => ['-T', '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'HostKeyAlgorithms=ssh-ed25519', '-o', 'UserKnownHostsFile=' + target.known_hosts, '-o', 'ConnectionAttempts=1', '-o', 'ConnectTimeout=12', '-o', 'ServerAliveInterval=10', '-o', 'ServerAliveCountMax=2', '-o', 'ControlMaster=no', '-i', target.identity]
async function remote(plan, mode, { approved = null, database = null, bytes = false } = {}) {
  if (!['inspect', 'assets', 'recovery'].includes(mode)) assert.equal(approved, plan.seal)
  const command = 'python3 -I -S -B -c ' + shell('import sys,json;q=json.load(sys.stdin);sys.argv=["pdc-http-client-remote.py",q["mode"],json.dumps(q)];exec(compile(q["source"],"pdc-http-client-remote.py","exec"))')
  const task = run('ssh', [...sshArgs(plan.target), 'root@' + plan.target.host, command], { env: cleanEnv(), timeout: 180000, maxBuffer: 64 * 1024 * 1024, encoding: bytes ? 'buffer' : 'utf8' })
  task.child.stdin.on('error', () => {})
  task.child.stdin.end(JSON.stringify({ source: await readFile(here + '/remote.py', 'utf8'), plan, mode, approved, database }))
  const result = (await task).stdout
  return bytes ? result : JSON.parse(result)
}
export async function applicationInputs() {
  return Object.fromEntries(await Promise.all(sourceFiles.map(async name => [name, hash(await readFile(repo + '/' + name))])) )
}
async function toolInputs() {
  // Bind the existing operators' transitive local imports as well as this one.
  const names = (await run('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', 'scripts', 'docs/operations/backup-envelope.mjs'], { cwd: repo, maxBuffer: 8e6 })).stdout.trim().split('\n').sort()
  return Object.fromEntries(await Promise.all(names.map(async name => [name, hash(await readFile(repo + '/' + name))])))
}
async function databaseState(target) {
  const db = await connect(target)
  try {
    await db.query('begin isolation level repeatable read read only')
    const history = (await db.query('select version,name,statements from supabase_migrations.schema_migrations order by version')).rows
    const files = (await readdir(repo + '/supabase/migrations')).filter(name => name.endsWith('.sql')).sort()
    assert.equal(history.length, 91); assert.equal(files.length, 91)
    assert.deepEqual(history.map(row => row.version), files.map(name => name.slice(0, 14)))
    const state = { history, schema: await schemaState(db), protected_tables: await snapshot(db), auth_security: await authSecurityFingerprint(db), read_only: (await db.query('show transaction_read_only')).rows[0].transaction_read_only }
    assert.equal(state.read_only, 'on')
    await db.query('rollback'); return state
  } finally { await db.end() }
}
async function authState(target) {
  const credentials = await load(target.credentials_file)
  const response = await fetch('https://' + target.project_ref + '.supabase.co/auth/v1/settings', { headers: { apikey: credentials.anon_key }, signal: AbortSignal.timeout(15000) })
  assert.equal(response.status, 200); const value = await response.json()
  assert.equal(value.disable_signup, true); assert.equal(value.mailer_autoconfirm, false)
  return { disable_signup: true, mailer_autoconfirm: false, external: value.external }
}
async function logged(work, name, command, args, cwd, extraEnv = {}) {
  const handle = await import('node:fs').then(fs => fs.openSync(work + '/' + name, 'wx', 0o600))
  try {
    await new Promise((done, fail) => {
      const child = spawn(command, args, { cwd, env: { ...cleanEnv(), ...extraEnv }, stdio: ['ignore', handle, handle] })
      child.once('error', fail); child.once('exit', code => code === 0 ? done() : fail(Error(name + ' failed with exit ' + code)))
    })
  } finally { (await import('node:fs')).closeSync(handle) }
}

async function prepare(work) {
  assert.equal(process.version, 'v22.23.1')
  const target = await load(work + '/target.json'), base = { target, release_id: 'preflight', archive_bytes: 0 }
  const before = await remote(base, 'inspect')
  assert.equal(before.current, target.root + '/releases/' + (await load(work + '/expected-baseline.json')).release_id)
  const original = work + '/baseline/application', candidate = work + '/readback'
  const baselineEntries = await load(original + '/OUTPUT-INVENTORY.json')
  await logged(work, 'copy-artifact.log', '/usr/bin/ditto', [original, candidate], repo)
  const { unlink } = await import('node:fs/promises')
  await unlink(candidate + '/VERIFIED.json'); await unlink(candidate + '/OUTPUT-INVENTORY.json')
  assert.equal(digest(await inventory(candidate)), digest(baselineEntries), 'Captured deployed artifact differs from its inventory')
  const sources = Object.fromEntries(await Promise.all(sourceFiles.map(async name => [name, await readFile(repo + '/' + name, 'utf8')])))
  for (const [name, source] of Object.entries(sources)) {
    await mkdir(dirname(work + '/source/' + name), { recursive: true, mode: 0o700 })
    await writeFile(work + '/source/' + name, source, { flag: 'wx', mode: 0o600 })
  }
  const nitro = '/server/chunks/nitro/nitro.mjs'
  const patched = await patchNitro(await readFile(original + nitro, 'utf8'), sources)
  await writeFile(candidate + nitro, patched.code)
  await save(work + '/patch-proof.json', patched.proof)
  const entries = await inventory(candidate)
  const changed = entries.filter(entry => digest(entry) !== digest(baselineEntries.find(old => old.path === entry.path))).map(entry => entry.path)
  assert.deepEqual(changed, ['server/chunks/nitro/nitro.mjs'])
  assert.equal(entries.length, baselineEntries.length)
  await save(work + '/inventory.json', entries)
  await logged(work, 'syntax.log', process.execPath, ['--check', candidate + nitro], repo)
  await logged(work, 'exact-artifact-tests.log', process.execPath, ['--test', 'tests/pdc-http-client-release.test.mjs'], repo, { PDC_RELEASE_ARTIFACT: candidate })
  const build = work + '/package'; await mkdir(build, { mode: 0o700 })
  await logged(work, 'package-copy.log', '/usr/bin/ditto', [candidate, build + '/.output'], repo)
  await createReleaseArchive(build, work + '/application.tar.gz'); await chmod(work + '/application.tar.gz', 0o600)
  const archive = await readFile(work + '/application.tar.gz')
  await save(work + '/artifact.json', { archive_sha256: hash(archive), inventory_sha256: digest(entries), changed, entries: entries.length })
  await save(work + '/source-inputs.json', await applicationInputs())
  await save(work + '/workspace-inputs.json', await applicationInputs())
  await save(work + '/runtime-before.json', before)
  await save(work + '/database-before.json', await databaseState(target))
  await save(work + '/auth-before.json', await authState(target))
  await save(work + '/prepared.json', { result: 'SCOPED_ARTIFACT_PREPARED', production_writes: 0, provider_calls: 0, full_build_repeated: false })
  console.log(JSON.stringify({ result: 'SCOPED_ARTIFACT_PREPARED', changed, archive_sha256: hash(archive), production_writes: 0, provider_calls: 0 }))
}

async function seal(work) {
  const artifact = await load(work + '/artifact.json'), q = await load(work + '/qualification.json')
  assert.equal(q.result, 'PASS'); assert.equal(q.archive_sha256, artifact.archive_sha256)
  assert.equal(q.focused_tests, 'PASS'); assert.equal(q.native_tests, 'PASS'); assert.equal(q.artifact_tests, 'PASS')
  const extract = 'import importlib.util,json,sys,pathlib;s=importlib.util.spec_from_file_location("extractor",sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);m.extract_release(sys.argv[2],pathlib.Path(sys.argv[3]),json.loads(pathlib.Path(sys.argv[4]).read_text()));print("PASS")'
  await logged(work, 'archive-readback.log', 'python3', ['-I', '-S', '-B', '-c', extract, repo + '/scripts/clean-reinstall/deploy.py', work + '/application.tar.gz', work + '/archive-readback', work + '/inventory.json'], repo)
  assert.equal(digest(await inventory(work + '/archive-readback')), artifact.inventory_sha256)
  const target = await load(work + '/target.json'), backupConfig = await load(work + '/backup-config.json')
  const before = await load(work + '/runtime-before.json'), database = await load(work + '/database-before.json')
  const protectedFiles = [target.credentials_file, target.database.ca_file, target.identity, target.known_hosts, backupConfig.key]
  const evidenceNames = ['source-inputs.json', 'workspace-inputs.json', 'inventory.json', 'artifact.json', 'qualification.json', 'patch-proof.json', 'acceptance.json', 'focused-tests.log', 'native-tests.log', 'exact-artifact-tests-final.log', 'archive-readback.log', 'http-qualification.json']
  const evidence = Object.fromEntries(await Promise.all(evidenceNames.map(async name => [work + '/' + name, hash(await readFile(work + '/' + name))])))
  const plan = { format: 10, created_utc: new Date().toISOString(), scope, application_commit: before.verified.commit,
    application_inputs: await load(work + '/source-inputs.json'), workspace_inputs: await load(work + '/workspace-inputs.json'),
    source_binding: 'Exact deployed artifact with one scoped compiled server patch, compiled helpers from four reviewed source files; every other deployed byte retained.',
    release_id: artifact.archive_sha256.slice(0, 16), archive_sha256: artifact.archive_sha256, archive_bytes: (await lstat(work + '/application.tar.gz')).size,
    inventory_sha256: artifact.inventory_sha256, schema_version: 91, migrations: [], database_writes: 0, target, before, database,
    database_state_sha256: digest(approvalState(database)), auth: await load(work + '/auth-before.json'), tools: await toolInputs(), backup: backupConfig,
    evidence_sha256: evidence, protected_inputs: Object.fromEntries(await Promise.all(protectedFiles.map(async file => [file, hash(await readFile(file))]))),
    approval_phrase: 'APPROVE PDC CLIENT FIX DEPLOY', execution_backups_required: true, nuxt_restarts_max: 1, caddy_restart: false, runtime_grant_must_remain_empty: true,
    automatic_retry: false, automatic_rollback: false, provider_requests: 0, git_push: false,
    rollback: { previous_release: before.current, application_only: true, preserve_schema: 91, requires_separate_review: true, automatic: false } }
  plan.seal = digest(plan)
  await checked(work, plan); await save(work + '/plan.json', plan)
  console.log(JSON.stringify({ result: 'SEALED_READY_FOR_OWNER_REVIEW', seal: plan.seal, release_id: plan.release_id, approval: plan.approval_phrase + ' ' + plan.seal }))
}
async function checked(work, plan) {
  const { seal, ...body } = plan; assert.equal(digest(body), seal)
  assert.equal(plan.format, 10); assert.deepEqual(plan.scope, scope)
  assert.equal(plan.schema_version, 91); assert.deepEqual(plan.migrations, [])
  assert.equal(plan.database_writes, 0); assert.equal(plan.provider_requests, 0)
  assert.equal(plan.nuxt_restarts_max, 1); assert.equal(plan.automatic_retry, false); assert.equal(plan.automatic_rollback, false)
  assert.deepEqual(await applicationInputs(), plan.workspace_inputs)
  assert.deepEqual(await toolInputs(), plan.tools)
  for (const [name, sha] of Object.entries(plan.application_inputs)) assert.equal(hash(await readFile(work + '/source/' + name)), sha, 'Packaged source changed: ' + name)
  assert.equal(hash(await readFile(work + '/application.tar.gz')), plan.archive_sha256)
  assert.equal(digest(await inventory(work + '/readback')), plan.inventory_sha256)
  for (const [file, sha] of Object.entries(plan.evidence_sha256)) assert.equal(hash(await readFile(file)), sha)
  for (const [file, sha] of Object.entries(plan.protected_inputs)) assert.equal(hash(await readFile(file)), sha)
  assert.deepEqual(stable(await remote(plan, 'inspect')), stable(plan.before))
  const database = await databaseState(plan.target)
  assert.deepEqual(approvalState(database), approvalState(plan.database))
  assert.deepEqual(await authState(plan.target), plan.auth)
  return database
}
async function check(work) {
  const plan = await load(work + '/plan.json'); await checked(work, plan)
  console.log(JSON.stringify({ result: 'READ_ONLY_CHECK_PASS', seal: plan.seal, production_writes: 0 }))
}
async function apply(work, approved) {
  const plan = await load(work + '/plan.json')
  assert.equal(approved, plan.seal, 'Exact owner deployment approval required')
  try { await access(work + '/execution-intent.json'); throw Error('Consumed approval; inspect only') } catch (error) { if (error.code !== 'ENOENT') throw error }
  await checked(work, plan)
  const execution = work + '/execution'; await mkdir(execution, { mode: 0o700 })
  await save(work + '/execution-intent.json', { seal: plan.seal, utc: new Date().toISOString(), automatic_retry: false })
  await backup(plan, execution)
  await checked(work, plan)
  await save(execution + '/prepare.json', await remote(plan, 'prepare', { approved }))
  const destination = '/var/lib/pdc-http-client-releases/' + plan.release_id
  const scpArgs = sshArgs(plan.target).filter(value => value !== '-T')
  await run('scp', [...scpArgs, work + '/application.tar.gz', 'root@' + plan.target.host + ':' + destination + '/release.tar.gz'], { env: cleanEnv(), timeout: 180000 })
  await run('scp', [...scpArgs, work + '/inventory.json', 'root@' + plan.target.host + ':' + destination + '/inventory.json'], { env: cleanEnv(), timeout: 180000 })
  await save(execution + '/stage.json', await remote(plan, 'stage', { approved }))
  await save(execution + '/candidate.json', await remote(plan, 'candidate', { approved }))
  await checked(work, plan)
  await save(execution + '/activate.json', await remote(plan, 'activate', { approved, database: { plan_sha256: plan.seal, schema: 91, read_only: true, migrations_applied: 0, business_data_writes: 0, preservation: 'PASS', state_sha256: plan.database_state_sha256 } }))
  const after = await remote(plan, 'inspect')
  assert.equal(after.current, plan.target.root + '/releases/' + plan.release_id)
  assert.deepEqual(after.caddy, plan.before.caddy)
  assert.equal(after.recovery_files['/etc/caddy/Caddyfile'].sha256, plan.before.recovery_files['/etc/caddy/Caddyfile'].sha256)
  assert.deepEqual(after.media, plan.before.media); assert.deepEqual(after.private_files, plan.before.private_files)
  assert.deepEqual(approvalState(await databaseState(plan.target)), approvalState(plan.database))
  await save(execution + '/completed.json', { result: 'PASS', seal: plan.seal, release: plan.release_id, schema: 91, migrations_applied: 0, provider_calls: 0, caddy_changed: false })
  console.log(JSON.stringify({ result: 'DEPLOY_PASS', seal: plan.seal, release: plan.release_id }))
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [mode, directory, approved] = process.argv.slice(2), work = resolve(directory)
    assert.ok(['prepare', 'seal', 'check', 'apply'].includes(mode))
    await ({ prepare, seal, check, apply }[mode])(work, approved)
  } catch (error) { console.error(JSON.stringify({ result: 'STOP', error_type: error.name, message: error.message, automatic_retry: false, automatic_rollback: false })); process.exitCode = 1 }
}
