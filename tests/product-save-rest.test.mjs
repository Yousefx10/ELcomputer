import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { createCatalogRestFixture } from './helpers/catalogRestFixture.mjs'
import { emailNativeAvailable, nativeWaitFor } from './helpers/emailNativeDatabase.mjs'
import { createProductSaveFixture } from './helpers/productSaveFixture.mjs'
import { prepareProductSave } from '../server/utils/productSave.js'

test('actual PostgREST exposes product-save RPCs only to service role and preserves confidential catalog grants', {
  skip: !emailNativeAvailable || !process.env.CATALOG_REVIEW_POSTGREST_BIN, timeout: 60000
}, async () => {
  const rest = await createCatalogRestFixture()
  try {
    const migrations = new URL('../supabase/migrations/', import.meta.url)
    for (const file of (await readdir(migrations)).sort().filter(file => file.endsWith('.sql') && file > '20261011120000_catalog_confidentiality.sql')) {
      // The existing fixture ends at migration 68. Apply its remaining tail.
      await rest.db.exec(await readFile(new URL(file, migrations), 'utf8'))
    }
    const f = await createProductSaveFixture({ database: rest.db })
    const statusBody = { p_admin_id: f.actors.owner, p_request_id: randomUUID() }
    await nativeWaitFor(async () => (await rest.request('/rpc/catalog_product_save_status', { actor: 'service', method: 'POST', body: statusBody })).status === 200)
    const command = { p_admin_id: f.actors.owner, p_product_id: null, ...prepareProductSave(f.body(), 'create') }
    for (const actor of [null, 'customer', 'owner', 'editor']) {
      const denied = await rest.request('/rpc/catalog_save_product', { actor, method: 'POST', body: command })
      assert.ok([401, 403, 404].includes(denied.status), JSON.stringify(denied))
    }
    const created = await rest.request('/rpc/catalog_save_product', { actor: 'service', method: 'POST', body: command })
    assert.equal(created.status, 200, JSON.stringify(created))
    const replay = await rest.request('/rpc/catalog_save_product', { actor: 'service', method: 'POST', body: command })
    assert.equal(replay.body.id, created.body.id)
    assert.equal(replay.body.replayed, true)
    assert.equal((await f.counts()).receipts, 1)
    const forbidden = await rest.request('/rpc/catalog_save_product', { actor: 'service', method: 'POST', body: { ...command, p_request_id: randomUUID(), p_admin_id: f.actors.viewer } })
    assert.equal(forbidden.status, 403)
    for (const actor of [null, 'customer', 'owner', 'editor']) {
      const snapshot = await rest.request('/rpc/catalog_product_edit_snapshot', { actor, method: 'POST', body: { p_admin_id: f.actors.owner, p_product_id: created.body.id } })
      assert.ok([401, 403, 404].includes(snapshot.status))
      assert.notEqual((await rest.request('/products?select=cost_price,default_supplier_id,primary_warehouse_id', { actor })).status, 200)
      assert.notEqual((await rest.request('/product_save_receipts', { actor })).status, 200)
    }
    const staffRead = await rest.request('/rpc/catalog_staff_products', { actor: 'owner', method: 'POST', body: {} })
    assert.equal(staffRead.status, 200)
    const anonymous = await rest.request('/storefront_products?select=id,title,price')
    assert.equal(anonymous.status, 200)
    assert.ok(!JSON.stringify(anonymous.body).includes('cost_price'))
  } finally { await rest.close() }
})
