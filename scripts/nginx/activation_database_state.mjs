// Local-only gate runner. Nothing executes on import; production access needs
// separately approved binding+nonce and explicit CLI invocation, never root.
import assert from 'node:assert/strict'
import { readFile, open, lstat, realpath } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

export const hash = raw => createHash('sha256').update(raw).digest('hex')
const bytes = value => Buffer.from(JSON.stringify(value))
const plain = value => JSON.parse(JSON.stringify(value))

export function assertProof(proof, expected) {
  assert.equal(proof.result, 'PASS')
  assert.equal(proof.production_writes, 0)
  assert.equal(proof.zero_stock_orders_storage, true)
  assert.equal(proof.purchasing_payments_COD_signups_disabled, true)
  assert.equal(proof.certificate.read_only, true)
  assert.equal(proof.certificate.schema_rls_grants_exact, true)
  assert.equal(proof.verified_publication_receipts, expected.publication_receipts)
  assert.equal(proof.published, expected.published)
  assert.equal(proof.draft, expected.draft)
  assert.equal(proof.held_source_id, expected.held_source_id)
}

export async function snapshot(db, certificate, vetted) {
  // The fixed table set includes authorization, customer and all commerce state.
  // Each query is SELECT within one enforced repeatable-read/read-only snapshot.
  const tables = [
    'admin_users', 'customer_profiles', 'commerce_warehouses',
    'commerce_serialized_units', 'commerce_serialized_inventory_batches',
    'commerce_inventory_movements', 'commerce_warehouse_inventory', 'customer_orders', 'customer_order_items',
  ]
  const fingerprints = {}
  for (const table of tables) {
    const rows = (await db.query('select to_jsonb(t) row from public.' + table + ' t order by to_jsonb(t)::text')).rows
    fingerprints[table] = { rows: rows.length, sha256: hash(bytes(plain(rows))) }
  }
  const queries = {
    products_and_revisions_sha256: 'select p.*,r.revision from public.products p join catalog_private.product_revisions r on r.product_id=p.id order by p.id',
    variants_sha256: 'select * from public.product_variants order by product_id,id',
    settings_sha256: "select s.* from public.site_settings s where key='default'",
  }
  for (const [key, sql] of Object.entries(queries)) {
    const observed = hash(bytes(plain((await db.query(sql)).rows)))
    assert.equal(observed, vetted[key], 'VETTED_SNAPSHOT_DRIFT:' + key)
    fingerprints[key] = observed
  }
  assert.equal(certificate.schema_rls_grants_exact, true)
  assert.equal(certificate.read_only, true)
  assert.equal(certificate.certified_application_schema_sha256, vetted.certificate.certified_application_schema_sha256)
  return { fingerprints, business_fingerprint_sha256: hash(bytes(fingerprints)) }
}

export async function pinned(path, sha, expectedMetadata) {
  assert.equal(await realpath(path), path, 'LOCAL_SOURCE_SYMLINK')
  const info = await lstat(path)
  assert.equal(info.isFile(), true)
  assert.equal(info.nlink, expectedMetadata?.nlink ?? 1)
  if (expectedMetadata) {
    for (const key of ['dev', 'ino', 'size', 'uid', 'gid', 'mode', 'nlink']) assert.equal(info[key], expectedMetadata[key], 'LOCAL_INPUT_METADATA_DRIFT')
  }
  assert.ok([0, process.getuid()].includes(info.uid), 'LOCAL_INPUT_OWNER')
  assert.equal(info.mode & 0o022, 0, 'LOCAL_INPUT_WRITABLE')
  const raw = await readFile(path)
  assert.equal(hash(raw), sha, 'LOCAL_SOURCE_DRIFT')
  const after = await lstat(path)
  for (const key of ['dev', 'ino', 'size', 'uid', 'gid', 'mode', 'mtimeMs', 'ctimeMs', 'nlink']) assert.equal(after[key], info[key], 'LOCAL_READ_DRIFT')
  return raw
}

export async function main(argv = process.argv.slice(2)) {
  assert.notEqual(process.getuid?.(), 0, 'Use the approved local unprivileged database transport')
  const [bindingPath, bindingSha, output, nonce, priorReceipt, priorReceiptSha] = argv
  assert.match(nonce, /^[a-f0-9]{64}$/)
  assert.equal(resolve(output), output)
  const info = await lstat(output)
  assert.equal(info.isDirectory(), true)
  assert.equal(info.mode & 0o777, 0o700)
  assert.equal(info.uid, process.getuid())
  assert.equal(await realpath(output), output)
  const binding = JSON.parse(await pinned(bindingPath, bindingSha))
  assert.equal(await realpath(process.argv[1]), binding.runner_path, 'RUNNER_IDENTITY')
  await pinned(binding.runner_path, binding.runner_sha256)
  assert.equal(await realpath(process.execPath), binding.node_path, 'NODE_IDENTITY')
  await pinned(binding.node_path, binding.node_sha256)
  for (const [path, sha] of Object.entries(binding.locked_inputs)) await pinned(path, sha, binding.locked_input_metadata[path])
  await pinned(binding.verifier_path, binding.verifier_sha256)
  await pinned(binding.production_module, binding.production_module_sha256)
  // The existing vetted verifier stays unchanged, including strict TLS and its
  // readonly connection. Its complete output and diagnostics stay private.
  const started = new Date().toISOString()
  const marker = await open(output + '/DATABASE-STARTED.private.json', 'wx', 0o600)
  try { await marker.writeFile(JSON.stringify({ nonce, started })); await marker.sync() } finally { await marker.close() }
  let result, failed
  try {
    result = await promisify(execFile)(process.execPath, ['--unhandled-rejections=strict', binding.verifier_path, output],
      { cwd: binding.working_directory, timeout: 120000, maxBuffer: 2000000, env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '' } })
  } catch (error) { result = error; failed = error }
  for (const [name, raw] of [['vetted.stdout.private', result.stdout || ''], ['vetted.stderr.private', result.stderr || ''],
    ['vetted.exit.private.json', JSON.stringify({ exit_code: failed ? failed.code : 0, killed: Boolean(failed?.killed) })]]) {
    const file = await open(output + '/' + name, 'wx', 0o600)
    try { await file.writeFile(raw); await file.sync() } finally { await file.close() }
  }
  if (failed) throw failed
  const vettedRaw = await readFile(output + '/PRODUCTION-STATE-READONLY.private.json')
  const vetted = JSON.parse(vettedRaw)
  assertProof(vetted, binding.expected)
  assert.equal(vetted.plan_sha256, binding.launch_plan_sha256)
  const { productionConnection, destinationEvidence } = await import(pathToFileURL(binding.production_module))
  const connection = await productionConnection()
  let scope, certificate
  try {
    await connection.db.query('begin isolation level repeatable read read only')
    assert.equal((await connection.db.query('show transaction_read_only')).rows[0].transaction_read_only, 'on')
    certificate = await destinationEvidence(connection.db, connection.target,
      { catalogCounts: binding.expected.catalog_counts })
    assert.equal(connection.target.project_ref, binding.project_ref)
    assert.equal(certificate.certified_application_schema_sha256, binding.schema_sha256)
    scope = await snapshot(connection.db, certificate, vetted)
    await connection.db.query('commit')
  } finally { await connection.db.end() }
  if (priorReceipt) {
    assert.match(priorReceiptSha, /^[a-f0-9]{64}$/)
    const prior = JSON.parse(await pinned(priorReceipt, priorReceiptSha))
    assert.equal(scope.business_fingerprint_sha256, prior.business_fingerprint_sha256, 'SCOPED_POST_ACTIVATION_DRIFT')
    assert.equal(certificate.certified_application_schema_sha256, prior.schema_sha256)
  }
  // Recheck all inputs after collection. No changed helper or baseline is accepted.
  for (const [path, sha] of Object.entries(binding.locked_inputs)) await pinned(path, sha, binding.locked_input_metadata[path])
  await pinned(bindingPath, bindingSha)
  const receipt = {
    result: 'PASS', mode: 'ACTIVATION_DATABASE_READONLY', nonce, observed_at_utc: started,
    completed_at_utc: new Date().toISOString(), project_ref: connection.target.project_ref,
    vetted_verifier_sha256: binding.verifier_sha256, vetted_receipt_sha256: hash(vettedRaw),
    settings_preimage_sha256: binding.settings_preimage_sha256, read_only: true,
    schema_migrations_rls_grants_exact: true, schema_sha256: certificate.certified_application_schema_sha256,
    catalog_settings_publication_exact: true, zero_stock_orders_storage: true, commerce_signup_disabled: true,
    ...scope, production_writes: 0, post_comparison_verified: Boolean(priorReceipt),
  }
  const raw = Buffer.from(JSON.stringify(receipt, null, 2) + '\n')
  const file = await open(output + '/DATABASE-STATE.private.json', 'wx', 0o600)
  try { await file.writeFile(raw); await file.sync() } finally { await file.close() }
  console.log(JSON.stringify({ result: 'PASS', database_receipt_sha256: hash(raw), business_fingerprint_sha256: receipt.business_fingerprint_sha256, production_writes: 0 }))
  return receipt
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(async error => {
    try {
      const output = process.argv[4], info = await lstat(output)
      assert.notEqual(process.getuid(), 0)
      assert.equal(await realpath(output), output)
      assert.equal(info.isDirectory(), true)
      assert.equal(info.uid, process.getuid())
      assert.equal(info.mode & 0o777, 0o700)
      const file = await open(output + '/DATABASE-STOP.private.json', 'wx', 0o600)
      try { await file.writeFile(JSON.stringify({ stack: error.stack })); await file.sync() } finally { await file.close() }
    } catch {}
    // No credentials, SQL diagnostics or business rows go to the console.
    console.error(JSON.stringify({ result: 'BLOCKED', exception_type: error.name, automatic_retry: false, cleanup: false }))
    process.exitCode = 1
  })
}
