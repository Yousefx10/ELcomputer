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
import { registry, repairedRegistry, registryPath } from '../shipping-tariff-release/repair.mjs'

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
const scope = { milestone: 'customer_session_isolation', schema: '91 unchanged', database_writes: false, runtime_change: false, caddy_change: false, provider_calls: false, public_checkout: false, signup: false }
const applicationPaths = ['app', 'server', 'public', 'i18n', 'package.json', 'package-lock.json', 'nuxt.config.ts', 'tsconfig.json']
const sshArgs = target => ['-T', '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'HostKeyAlgorithms=ssh-ed25519', '-o', 'UserKnownHostsFile=' + target.known_hosts, '-o', 'ConnectionAttempts=1', '-o', 'ConnectTimeout=12', '-o', 'ServerAliveInterval=10', '-o', 'ServerAliveCountMax=2', '-o', 'ControlMaster=no', '-i', target.identity]
async function remote(plan, mode, { approved = null, database = null, bytes = false } = {}) {
  if (!['inspect', 'assets', 'recovery'].includes(mode)) assert.equal(approved, plan.seal)
  const command = 'python3 -I -S -B -c ' + shell('import sys,json;q=json.load(sys.stdin);sys.argv=["customer-session-remote.py",q["mode"],json.dumps(q)];exec(compile(q["source"],"customer-session-remote.py","exec"))')
  const task = run('ssh', [...sshArgs(plan.target), 'root@' + plan.target.host, command], { env: cleanEnv(), timeout: 180000, maxBuffer: 64 * 1024 * 1024, encoding: bytes ? 'buffer' : 'utf8' })
  task.child.stdin.on('error', () => {})
  task.child.stdin.end(JSON.stringify({ source: await readFile(here + '/remote.py', 'utf8'), plan, mode, approved, database }))
  const result = (await task).stdout
  return bytes ? result : JSON.parse(result)
}
export async function applicationInputs() {
  const names = (await run('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', ...applicationPaths], { cwd: repo, maxBuffer: 8e6 })).stdout.trim().split('\n').sort()
  const entries = []
  for (const name of names) { assert.ok((await lstat(repo + '/' + name)).isFile()); entries.push([name, hash(await readFile(repo + '/' + name))]) }
  return Object.fromEntries(entries)
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
async function logged(work, name, command, args, cwd) {
  const handle = await import('node:fs').then(fs => fs.openSync(work + '/' + name, 'wx', 0o600))
  try {
    await new Promise((done, fail) => {
      const child = spawn(command, args, { cwd, env: cleanEnv(), stdio: ['ignore', handle, handle] })
      child.once('error', fail); child.once('exit', code => code === 0 ? done() : fail(Error(name + ' failed with exit ' + code)))
    })
  } finally { (await import('node:fs')).closeSync(handle) }
}
async function start(work) {
  assert.equal(process.version, 'v22.23.1')
  const target = await load(work + '/target.json'), backupConfig = await load(work + '/backup-config.json')
  const base = { target, release_id: 'preflight', archive_bytes: 0 }
  const before = await remote(base, 'inspect'), database = await databaseState(target), auth = await authState(target)
  const inputs = await applicationInputs(), tools = await toolInputs()
  await save(work + '/runtime-before.json', before); await save(work + '/database-before.json', database); await save(work + '/auth-before.json', auth)
  await save(work + '/source-inputs.json', inputs); await save(work + '/tools.json', tools)
  await mkdir(work + '/backups', { mode: 0o700 })
  const backups = await backup({ ...base, before, backup: backupConfig }, work + '/backups')
  await save(work + '/backup-proof.json', backups)
  await writeFile(work + '/retained-assets.tar.gz', await remote({ ...base, before }, 'assets', { bytes: true }), { flag: 'wx', mode: 0o600 })
  await mkdir(work + '/retained', { mode: 0o700 })
  await run('tar', ['-xzf', work + '/retained-assets.tar.gz', '-C', work + '/retained'])
  const source = work + '/source'; await mkdir(source, { mode: 0o700 })
  for (const name of Object.keys(inputs)) { const dest = source + '/' + name; await mkdir(dirname(dest), { recursive: true }); await copyFile(repo + '/' + name, dest) }
  await retainClientAssets(work + '/retained/_nuxt', source + '/public/_nuxt', before.assets)
  await writeFile(work + '/empty.env', '', { flag: 'wx', mode: 0o600 })
  await save(work + '/prepared.json', { result: 'READ_ONLY_PREPARATION_PASS', before_release: before.current, application_inputs_sha256: digest(inputs), tools_sha256: digest(tools), backups: true, schema: 91 })
  console.log(JSON.stringify({ result: 'READ_ONLY_PREPARATION_PASS', application_inputs: Object.keys(inputs).length, retained_assets: Object.keys(before.assets).length }))
}
async function build(work) {
  const source = work + '/source', npm = dirname(process.execPath) + '/../lib/node_modules/npm/bin/npm-cli.js'
  assert.equal((await run(process.execPath, [npm, '--version'], { env: cleanEnv() })).stdout.trim(), '10.9.8')
  await logged(work, 'npm-ci.log', process.execPath, [npm, 'ci', '--no-audit', '--no-fund'], source)
  assert.equal(hash(await readFile(source + '/package-lock.json')), (await load(work + '/source-inputs.json'))['package-lock.json'])
  await logged(work, 'typecheck.log', process.execPath, [source + '/node_modules/nuxt/bin/nuxt.mjs', 'typecheck', '--dotenv', work + '/empty.env'], source)
  await logged(work, 'build.log', process.execPath, [source + '/node_modules/nuxt/bin/nuxt.mjs', 'build', '--dotenv', work + '/empty.env'], source)
  console.log(JSON.stringify({ result: 'BUILD_AND_TYPECHECK_PASS' }))
}
async function bind(work) {
  // Before any build/seal, preserve unrelated working changes outside this release.
  try { await access(work + '/artifact.json'); throw Error('Artifact already packed; do not rebind') } catch (error) { if (error.code !== 'ENOENT') throw error }
  const inputs = await load(work + '/source-inputs.json'), workspace = await applicationInputs()
  assert.deepEqual(workspace, inputs)
  const before = await load(work + '/runtime-before.json'), exclusions = await load(work + '/excluded-workspace-files.json')
  await save(work + '/workspace-inputs.json', workspace)
  const bindings = {}
  for (const name of exclusions) {
    assert.ok(Object.hasOwn(inputs, name) && name.startsWith('server/'))
    const bytes = (await run('git', ['show', before.verified.commit + ':' + name], { cwd: repo, encoding: 'buffer', maxBuffer: 8e6 })).stdout
    bindings[name] = { workspace_sha256: workspace[name], deployed_source_commit: before.verified.commit, artifact_sha256: hash(bytes), reason: 'Existing paused-provider change excluded; workspace preserved' }
    inputs[name] = hash(bytes); await writeFile(work + '/source/' + name, bytes)
  }
  await writeFile(work + '/source-inputs.json', JSON.stringify(inputs, null, 2) + '\n', { mode: 0o600 })
  await writeFile(work + '/tools.json', JSON.stringify(await toolInputs(), null, 2) + '\n', { mode: 0o600 })
  await save(work + '/excluded-workspace-bindings.json', bindings)
  console.log(JSON.stringify({ result: 'SOURCE_SCOPE_BOUND', excluded_workspace_files: Object.keys(bindings) }))
}
async function pack(work) {
  const before = await load(work + '/runtime-before.json'), output = work + '/source/.output'
  await retainClientAssets(work + '/retained/_nuxt', output + '/public/_nuxt', before.assets)
  async function modes(path) { const s = await lstat(path); if (s.isSymbolicLink()) return; await chmod(path, s.isDirectory() ? 0o755 : 0o644); if (s.isDirectory()) for (const name of await readdir(path)) await modes(path + '/' + name) }
  await modes(output)
  const target = await load(work + '/target.json'), c = await load(target.credentials_file)
  let entries = await inventory(output, { secrets: [c.database_password, c.service_role_key] })
  const retained = await load(work + '/retained-source.json'), oldPlan = await load(retained.plan), { seal: oldSeal, ...oldBody } = oldPlan
  assert.equal(digest(oldBody), oldSeal); assert.equal(oldSeal, before.verified.plan_sha256)
  assert.equal(hash(await readFile(retained.archive)), before.verified.archive_sha256)
  assert.equal(oldPlan.archive_sha256, before.verified.archive_sha256)
  const oldEntries = await load(retained.inventory); assert.equal(digest(oldEntries), oldPlan.inventory_sha256)
  const oldSource = await readFile(retained.readback + '/' + registryPath, 'utf8')
  assert.equal(hash(oldSource), oldEntries.find(entry => entry.path === registryPath).sha256)
  const currentSource = await readFile(output + '/' + registryPath, 'utf8'), currentRegistry = registry(currentSource).value, oldRegistry = registry(oldSource).value, additions = {}
  for (const [name, proof] of Object.entries(before.assets)) {
    const key = '/_nuxt/' + name
    if (!Object.hasOwn(currentRegistry, key)) { assert.ok(Object.hasOwn(oldRegistry, key)); additions[key] = { metadata: oldRegistry[key], sha256: proof.sha256 } }
  }
  await writeFile(output + '/' + registryPath, repairedRegistry(currentSource, { entries: additions }, entries))
  entries = await inventory(output, { secrets: [c.database_password, c.service_role_key] })
  await save(work + '/retention-proof.json', { result: 'PASS', retained_assets: Object.keys(before.assets).length, serving_entries_added: Object.keys(additions).length,
    original_archive_sha256: oldPlan.archive_sha256, original_plan_seal: oldSeal, original_registry_sha256: hash(oldSource), current_registry_entries_preserved: true, differing_collisions: 0 })
  await save(work + '/inventory.json', entries)
  await createReleaseArchive(work + '/source', work + '/application.tar.gz'); await chmod(work + '/application.tar.gz', 0o600)
  const extractor = 'import importlib.util,json,sys,pathlib;s=importlib.util.spec_from_file_location("extractor",sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);m.extract_release(sys.argv[2],pathlib.Path(sys.argv[3]),json.loads(pathlib.Path(sys.argv[4]).read_text()));print("PASS")'
  await run('python3', ['-B', '-c', extractor, repo + '/scripts/clean-reinstall/deploy.py', work + '/application.tar.gz', work + '/readback', work + '/inventory.json'])
  assert.equal(digest(await inventory(work + '/readback')), digest(entries))
  await save(work + '/artifact.json', { archive_sha256: hash(await readFile(work + '/application.tar.gz')), inventory_sha256: digest(entries), entries: entries.length, extracted_readback: 'PASS', retained_assets: Object.keys(before.assets).length })
  console.log(JSON.stringify({ result: 'PACK_AND_READBACK_PASS', entries: entries.length }))
}
async function checked(work, plan) {
  const { seal, ...body } = plan; assert.equal(digest(body), seal)
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
async function seal(work) {
  const artifact = await load(work + '/artifact.json'), q = await load(work + '/qualification.json')
  assert.equal(q.result, 'PASS'); assert.equal(q.archive_sha256, artifact.archive_sha256)
  assert.equal(q.typecheck, 'PASS'); assert.equal(q.build, 'PASS'); assert.ok(q.browser_checks > 0); assert.ok(q.security_tests > 0)
  const target = await load(work + '/target.json'), backupConfig = await load(work + '/backup-config.json')
  const before = await load(work + '/runtime-before.json'), database = await load(work + '/database-before.json')
  const protectedFiles = [target.credentials_file, target.database.ca_file, target.identity, target.known_hosts, backupConfig.key]
  const names = ['source-inputs.json', 'workspace-inputs.json', 'excluded-workspace-bindings.json', 'tools.json', 'inventory.json', 'artifact.json', 'qualification.json', 'retention-proof.json', 'backup-proof.json', 'backups/database-before.dump.enc', 'backups/runtime-recovery.tar.gz.enc']
  const evidence = Object.fromEntries(await Promise.all(names.map(async name => [work + '/' + name, hash(await readFile(work + '/' + name))])))
  const plan = { format: 10, created_utc: new Date().toISOString(), scope, application_commit: (await run('git', ['rev-parse', 'HEAD'], { cwd: repo })).stdout.trim(),
    application_inputs: await load(work + '/source-inputs.json'), workspace_inputs: await load(work + '/workspace-inputs.json'),
    excluded_workspace_bindings: await load(work + '/excluded-workspace-bindings.json'), source_binding: 'Exact application manifest plus preserved workspace manifest. Includes accepted profile correction; excludes paused-provider changes. No Git operation required.',
    release_id: artifact.archive_sha256.slice(0, 16), archive_sha256: artifact.archive_sha256, archive_bytes: (await lstat(work + '/application.tar.gz')).size,
    inventory_sha256: artifact.inventory_sha256, schema_version: 91, migrations: [], database_writes: 0, target, before, database,
    database_state_sha256: digest(approvalState(database)), auth: await load(work + '/auth-before.json'), tools: await load(work + '/tools.json'), backup: backupConfig,
    evidence_sha256: { ...evidence, ...q.evidence_sha256 }, protected_inputs: Object.fromEntries(await Promise.all(protectedFiles.map(async file => [file, hash(await readFile(file))]))),
    approval_phrase: 'APPROVE CUSTOMER SESSION ISOLATION DEPLOY', execution_backups_required: true, nuxt_restarts_max: 1, caddy_restart: false, runtime_grant_must_remain_empty: true,
    automatic_retry: false, automatic_rollback: false, provider_requests: 0, git_push: false,
    rollback: { previous_release: before.current, application_only: true, preserve_schema: 91, requires_separate_review: true, automatic: false } }
  plan.seal = digest(plan)
  await checked(work, plan); await save(work + '/plan.json', plan)
  console.log(JSON.stringify({ result: 'SEALED_READY_FOR_OWNER_REVIEW', seal: plan.seal, release_id: plan.release_id, approval: plan.approval_phrase + ' ' + plan.seal }))
}
async function check(work) {
  const plan = await load(work + '/plan.json'); await checked(work, plan)
  console.log(JSON.stringify({ result: 'READ_ONLY_CHECK_PASS', seal: plan.seal, production_writes: 0 }))
}
async function apply(work, approved) {
  const plan = await load(work + '/plan.json')
  assert.equal(approved, plan.seal, 'Exact owner deployment approval required')
  await checked(work, plan)
  try { await access(work + '/execution-intent.json'); throw Error('Consumed approval; inspect only') } catch (error) { if (error.code !== 'ENOENT') throw error }
  const execution = work + '/execution'; await mkdir(execution, { mode: 0o700 })
  await backup(plan, execution)
  await checked(work, plan)
  await save(work + '/execution-intent.json', { seal: plan.seal, utc: new Date().toISOString(), automatic_retry: false })
  await save(execution + '/prepare.json', await remote(plan, 'prepare', { approved }))
  const destination = '/var/lib/customer-session-releases/' + plan.release_id
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
    assert.ok(['start', 'bind', 'build', 'pack', 'seal', 'check', 'apply'].includes(mode))
    await ({ start, bind, build, pack, seal, check, apply }[mode])(work, approved)
  } catch (error) { console.error(JSON.stringify({ result: 'STOP', error_type: error.name, message: error.message, automatic_retry: false, automatic_rollback: false })); process.exitCode = 1 }
}
