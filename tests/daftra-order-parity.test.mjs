import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migration = 'supabase/migrations/20261107200000_daftra_mode_order_parity.sql'

test('order emails and staff PDC booking no longer require built-in ERP orders', async () => {
  const sql = await readFile(migration, 'utf8')
  for (const name of ['private.capture_order_email()', 'private.order_email_reason(public.order_email_events)', 'private.pdc_order_eligibility(uuid)']) assert.ok(sql.includes(name))
  assert.match(sql, /raise exception 'ERP owner rule remains in %'/)
  assert.doesNotMatch(await readFile('server/utils/pdcOrderShipping.js', 'utf8'), /erp_owner/)
  assert.doesNotMatch(await readFile('server/api/admin-orders/[id].get.js', 'utf8'), /erp_owner === 'built_in'/)
})

test('native schema keeps every rule except the built-in ERP owner condition', { timeout: 240000 }, async t => {
  const { createEmailNativeDatabase, emailNativeAvailable } = await import('./helpers/emailNativeDatabase.mjs')
  if (!emailNativeAvailable) return t.skip('native PostgreSQL is not configured')
  const db = await createEmailNativeDatabase()
  try {
    for (const sig of ['private.capture_order_email()', 'private.order_email_reason(public.order_email_events)', 'private.pdc_order_eligibility(uuid)']) {
      const body = (await db.query('select pg_get_functiondef($1::regprocedure) d', [sig])).rows[0].d
      assert.doesNotMatch(body, /erp_owner/, sig)
      assert.match(body, /is_preorder/, sig)
    }
  } finally { await db.close() }
})
