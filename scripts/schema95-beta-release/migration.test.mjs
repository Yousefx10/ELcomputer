import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { databaseTools, digest } from './database.mjs'
// Explicit disposable native cluster; no configured production URL is accepted.
test('new95 migration operator commits once and rolls back failures without changing old rows', async t => {
  const repo = process.env.SCHEMA95_FROZEN_SOURCE, work = process.env.SCHEMA95_QUALIFICATION_DIR
  assert.ok(repo && work && process.env.EMAIL_REVIEW_PG_BIN && process.env.EMAIL_REVIEW_PG_DRIVER)
  const { createEmailNativeDatabase } = await import(pathToFileURL(repo + '/tests/helpers/emailNativeDatabase.mjs'))
  const f = await createEmailNativeDatabase({ stopBefore: '20261026170000_unrecorded_normal_sales.sql' }); t.after(f.close)
  const db = await f.connect(), tools = await databaseTools(repo), sql = await readFile(repo + '/supabase/migrations/20261026170000_unrecorded_normal_sales.sql', 'utf8')
  // The disposable platform stub has no hosted migration ledger/owners.
  await db.query('create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[])')
  const names = (await readdir(repo + '/supabase/migrations')).filter(n => n.endsWith('.sql')).sort().slice(0, 94)
  for (const name of names) await db.query('insert into supabase_migrations.schema_migrations values($1,$2,$3)', [name.slice(0,14), name.slice(15,-4), [await readFile(repo + '/supabase/migrations/' + name, 'utf8')]])
  for (const name of ['sources','customers','orders','items','batches']) await db.query('alter table customer_history_private.' + name + ' owner to postgres')
  await db.query("insert into public.site_settings(key) values('default') on conflict do nothing")
  const baseline = await tools.state(db), delta = JSON.parse(await readFile(work + '/schema-delta.json'))
  const p = { database: baseline, schema_delta: delta, expected_after_schema_sha256: digest(tools.expectedSchema(baseline.schema, delta)), seal: 'fixture-only' }
  await t.test('tampered migration is rejected before BEGIN', async () => { await assert.rejects(tools.migrate(db, p, sql + '\n-- changed')); assert.deepEqual(await tools.state(db), baseline) })
  await t.test('unexpected schema footprint rolls back the ledger and DDL', async () => { await assert.rejects(tools.migrate(db, { ...p, expected_after_schema_sha256: '0'.repeat(64) }, sql)); assert.deepEqual(await tools.state(db), baseline) })
  await t.test('receipt-write failure rolls back before commit', async () => { await assert.rejects(tools.migrate(db, p, sql, async () => { throw Error('injected receipt failure') })); assert.deepEqual(await tools.state(db), baseline) })
  await t.test('qualified exact migration preserves all old rows and commits once', async () => { const receipt = await tools.migrate(db, p, sql); assert.equal(receipt.migration_committed, true); assert.equal(receipt.business_data_writes, 0); const after = await tools.state(db, baseline.tables); assert.equal(after.history.length, 95); assert.deepEqual(after.protected_tables, baseline.protected_tables) })
  await t.test('a second application is rejected without further changes', async () => { const after = await tools.state(db); await assert.rejects(tools.migrate(db, p, sql)); assert.deepEqual(await tools.state(db), after) })
})
