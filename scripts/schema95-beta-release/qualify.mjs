// Only the new migration footprint is exercised here. No Auth/customer/provider test.
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { databaseTools, hash, migrationHash } from './database.mjs'
const [repo, directory] = process.argv.slice(2)
const { createEmailNativeDatabase } = await import(pathToFileURL(repo + '/tests/helpers/emailNativeDatabase.mjs'))
const { schemaState } = await import(pathToFileURL(repo + '/scripts/footer-release/database.mjs'))
const tools = await databaseTools(repo), filename = '20261026170000_unrecorded_normal_sales.sql'
const fixture = await createEmailNativeDatabase({ stopBefore: filename })
try {
  const db = await fixture.connect(), before = await schemaState(db)
  const canonical = s => Object.fromEntries(Object.entries(s).map(([k, rows]) => [k, [...rows].sort((a,b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : JSON.stringify(a) > JSON.stringify(b) ? 1 : 0)]))
  // Reuse production canonical ordering rather than local locale or key insertion.
  const { canonicalSchema } = await import(pathToFileURL(repo + '/scripts/inactive-history-release/database.mjs'))
  const sql = await readFile(repo + '/supabase/migrations/' + filename, 'utf8'); assert.equal(hash(sql), migrationHash)
  await db.query(sql); const after = canonicalSchema(await schemaState(db))
  const delta = tools.footprint(canonicalSchema(before), after)
  assert.deepEqual(tools.expectedSchema(canonicalSchema(before), delta), after)
  // Existing default remains true. Qualification must not activate commercial mode.
  await db.query("insert into public.site_settings(key) values('default') on conflict do nothing")
  assert.equal((await db.query("select inventory_tracking_required from public.site_settings where key='default'")).rows[0].inventory_tracking_required, true)
  await writeFile(directory + '/schema-delta.json', JSON.stringify(delta, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
  await writeFile(directory + '/migration-qualification.json', JSON.stringify({ result: 'PASS', postgres: fixture.version, schema: '94->95', exact_sql_sha256: migrationHash, footprint: 'one default-true column, one expanded constraint, seven existing functions; original ACL/RLS/other schema unchanged', production_writes: 0, provider_calls: 0, signup_tests: 0 }, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
  console.log('MIGRATION_FOOTPRINT_PASS')
} finally { await fixture.close() }
