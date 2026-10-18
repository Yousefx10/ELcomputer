import test from 'node:test'
import assert from 'node:assert/strict'
import { assertProof, snapshot, hash } from '../scripts/nginx/activation_database_state.mjs'

const expected = { published: 12, draft: 2, publication_receipts: 4, held_source_id: 'owned-held' }
const certificate = { read_only: true, schema_rls_grants_exact: true, certified_application_schema_sha256: 'owned-schema' }
const proof = () => ({ result: 'PASS', production_writes: 0, zero_stock_orders_storage: true,
  purchasing_payments_COD_signups_disabled: true, certificate, verified_publication_receipts: 4,
  published: 12, draft: 2, held_source_id: 'owned-held' })

test('vetted database proof preserves reusable deployment bindings', () => {
  assertProof(proof(), expected)
  for (const [key, value] of [['production_writes', 1], ['zero_stock_orders_storage', false],
    ['purchasing_payments_COD_signups_disabled', false], ['published', 11], ['held_source_id', 'wrong']]) {
    assert.throws(() => assertProof({ ...proof(), [key]: value }, expected))
  }
  assert.throws(() => assertProof({ ...proof(), certificate: { ...certificate, schema_rls_grants_exact: false } }, expected))
})

const emptyHash = hash(Buffer.from('[]'))
const vetted = { certificate, products_and_revisions_sha256: emptyHash, variants_sha256: emptyHash, settings_sha256: emptyHash }

test('scoped state captures permissions, customer profiles, warehouses and orders through SELECT only', async () => {
  const queries = []
  const db = { query: async sql => { queries.push(sql); return { rows: [] } } }
  const state = await snapshot(db, certificate, vetted)
  assert.match(state.business_fingerprint_sha256, /^[a-f0-9]{64}$/)
  assert.equal(state.fingerprints.admin_users.rows, 0)
  assert.equal(state.fingerprints.customer_profiles.rows, 0)
  assert.equal(state.fingerprints.customer_orders.rows, 0)
  assert.ok(queries.every(sql => sql.startsWith('select ')))
  assert.ok(queries.some(sql => sql.includes('public.customer_order_items')))
  assert.ok(!queries.some(sql => sql.includes('admin_permissions') || sql.includes('public.profiles ')))
})

test('coherent supplement rejects changed product revisions, variants or settings', async () => {
  for (const changed of ['products', 'product_variants', 'site_settings']) {
    const db = { query: async sql => ({ rows: sql.includes('from public.' + changed + ' ') ? [{ changed: true }] : [] }) }
    await assert.rejects(snapshot(db, certificate, vetted), /VETTED_SNAPSHOT_DRIFT/)
  }
})

test('business fingerprints change when permissions, profiles or warehouses drift', async () => {
  const baseline = await snapshot({ query: async () => ({ rows: [] }) }, certificate, vetted)
  for (const changed of ['admin_users', 'customer_profiles', 'commerce_warehouses', 'customer_orders']) {
    const db = { query: async sql => ({ rows: sql.includes('from public.' + changed + ' ') ? [{ row: { changed: true } }] : [] }) }
    const state = await snapshot(db, certificate, vetted)
    assert.notEqual(state.business_fingerprint_sha256, baseline.business_fingerprint_sha256)
  }
})
