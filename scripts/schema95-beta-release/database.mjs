// Schema95 tooling only. Application bytes come from the separate frozen source.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
export const sorted = v => v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sorted(v[k])])) : v
export const hash = v => createHash('sha256').update(v).digest('hex')
export const digest = v => hash(JSON.stringify(sorted(v)))
export const version = '20261026170000'
export const migrationHash = 'fd9c028435f74caae6b3731ce7791573077838d00f9c3893ac3e10f484e2a508'
export const changedFunctions = [
  'private.checkout_review_before_cod(jsonb)', 'private.checkout_review_before_pdc(jsonb)',
  'commerce_create_normal_customer_order(uuid,jsonb,jsonb,boolean,uuid)', 'commerce_release_backorder(uuid,uuid)',
  'validate_order_packing_scan()', 'complete_order_packing_session(uuid,uuid,text,text,text,text)',
  'private.guard_backorder_fulfillment()'
]
export async function databaseTools(repo) {
  const imp = name => import(pathToFileURL(repo + '/' + name).href)
  const [core, history, schema, auth, approval] = await Promise.all([
    imp('scripts/commerce-release/database.mjs'), imp('scripts/customer-migration/final-db.mjs'),
    imp('scripts/footer-release/database.mjs'), imp('scripts/live-sales-release/auth.mjs'),
    imp('scripts/live-sales-release/operator.mjs')
  ])
  const canonical = s => Object.fromEntries(Object.entries(s).map(([k, a]) => [k, [...a].sort((a, b) => JSON.stringify(sorted(a)) < JSON.stringify(sorted(b)) ? -1 : JSON.stringify(sorted(a)) > JSON.stringify(sorted(b)) ? 1 : 0)]))
  async function state(db, tables = null) {
    const defs = tables || await history.definitions(db)
    const all = [...defs, ...history.historyTables.map(name => ({ schema: 'customer_history_private', name, columns: null }))]
    for (const t of all.filter(t => !t.columns)) t.columns = (await db.query('select attname from pg_attribute where attrelid=$1::regclass and attnum>0 and not attisdropped order by attnum', [t.schema + '.' + t.name])).rows.map(r => r.attname)
    return {
      history: (await db.query('select version,name,statements from supabase_migrations.schema_migrations order by version')).rows,
      schema: canonical(await schema.schemaState(db)), history_schema: await history.privateCatalog(db),
      tables: defs, protected_tables: await history.protectedRows(db, all), auth_security: await auth.authSecurityFingerprint(db),
      history_access: await history.access(db), history_counts: await history.historyCounts(db)
    }
  }
  async function observe(target, tables = null) {
    const db = await core.connect(target)
    try { await db.query('begin isolation level repeatable read read only'); const result = await state(db, tables); assert.equal((await db.query('show transaction_read_only')).rows[0].transaction_read_only, 'on'); await db.query('rollback'); return result }
    finally { await db.end() }
  }
  function footprint(before, after) {
    const added = after.columns.filter(c => c.schema === 'public' && c.table_name === 'site_settings' && c.name === 'inventory_tracking_required')
    assert.equal(added.length, 1); assert.equal(added[0].type, 'boolean'); assert.equal(added[0].not_null, true); assert.equal(added[0].default_value, 'true')
    const constraint = s => s.constraints.find(c => c.schema === 'public' && c.table_name === 'customer_orders' && c.name === 'customer_orders_stock_fulfillment_state_check')
    assert.ok(constraint(after)?.definition.includes('untracked'))
    const functions = after.functions.filter(f => changedFunctions.includes(f.signature))
    assert.equal(functions.length, 7)
    for (const f of functions) {
      const old = before.functions.find(o => o.signature === f.signature); assert.ok(old)
      assert.deepEqual({ ...f, definition: old.definition }, old, 'Changed function ownership/ACL')
      assert.notEqual(f.definition, old.definition)
    }
    const normalized = canonical({ ...after, columns: after.columns.filter(c => c !== added[0]), constraints: after.constraints.map(c => c === constraint(after) ? constraint(before) : c), functions: after.functions.map(f => changedFunctions.includes(f.signature) ? before.functions.find(o => o.signature === f.signature) : f) })
    assert.deepEqual(normalized, before, 'Unexpected schema/RLS/ACL/trigger/index change')
    return { column: added[0], constraint: constraint(after), functions }
  }
  function expectedSchema(before, delta) {
    return canonical({ ...before, columns: [...before.columns, delta.column], constraints: before.constraints.map(c => c.schema === 'public' && c.table_name === 'customer_orders' && c.name === delta.constraint.name ? delta.constraint : c), functions: before.functions.map(f => ({ ...f, definition: delta.functions.find(n => n.signature === f.signature)?.definition || f.definition })) })
  }
  async function migrate(db, p, sql, beforeCommit = async () => {}) {
    assert.equal(hash(sql), migrationHash); assert.equal((sql.match(/^begin;\s*$/gmi) || []).length, 1); assert.equal((sql.match(/^commit;\s*$/gmi) || []).length, 1)
    let begun = false
    try {
      await db.query('begin isolation level repeatable read'); begun = true
      await db.query("set local lock_timeout='5s';set local statement_timeout='60s'")
      assert.equal((await db.query("select pg_try_advisory_xact_lock(hashtextextended('elcomputer-system-reset',0)) locked")).rows[0].locked, true)
      const before = await state(db); assert.deepEqual(approval.approvalState(before), approval.approvalState(p.database), 'Pre-migration drift')
      assert.equal(before.history.length, 94); assert.equal(before.history.at(-1).version, '20261025120000')
      // Serialize application/history writes. Auth stays enabled and read-only to this transaction.
      for (const t of before.protected_tables.filter(t => ['public', 'private', 'catalog_private', 'customer_history_private'].includes(t.schema))) await db.query('lock table ' + history.quote(t.schema) + '.' + history.quote(t.name) + ' in share mode')
      const locked = await history.protectedRows(db, before.protected_tables)
      assert.deepEqual(locked, before.protected_tables)
      await db.query(sql.replace(/^begin;\s*$/im, '').replace(/^commit;\s*$/im, ''))
      await db.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)', [version, 'unrecorded_normal_sales', [sql]])
      const after = await state(db, before.tables)
      assert.deepEqual(after.protected_tables, before.protected_tables, 'Original rows changed')
      assert.deepEqual(after.auth_security, before.auth_security); assert.deepEqual(after.history_schema, before.history_schema)
      assert.deepEqual(after.history_access, before.history_access); assert.deepEqual(after.history_counts, before.history_counts)
      assert.deepEqual(after.history.slice(0, 94), before.history); assert.equal(after.history.length, 95)
      footprint(before.schema, after.schema)
      assert.deepEqual(after.schema, expectedSchema(before.schema, p.schema_delta)); assert.equal(digest(after.schema), p.expected_after_schema_sha256)
      assert.equal((await db.query("select count(*)::int n from public.site_settings where not inventory_tracking_required")).rows[0].n, 0)
      const receipt = { plan_sha256: p.seal, schema: 95, migrations_applied: 1, business_data_writes: 0, preservation: 'PASS', protected_tables: before.protected_tables.length, after_schema_sha256: digest(after.schema), migration_committed: true }
      await beforeCommit(receipt); await db.query('commit'); begun = false; return receipt
    } catch (error) { if (begun) await db.query('rollback').catch(() => {}); throw error }
  }
  return { connect: core.connect, state, observe, footprint, expectedSchema, migrate, comparable: approval.approvalState }
}
