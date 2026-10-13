import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createProductSaveHttpFixture } from './helpers/productSaveHttpFixture.mjs'

test('product HTTP saves enforce current authorization, atomicity and recovery contracts', async t => {
  const f = await createProductSaveHttpFixture()
  try {
    const input = f.body()
    let created, loaded
    await t.test('signed-out, invalid, viewer, disabled and customer requests cannot write', async () => {
      const before = await f.counts()
      for (const [actor, expected] of [[null, 401], ['invalid', 401], ['viewer', 403], ['disabled', 403], ['customer', 403]]) {
        const result = await f.call('/api/admin-products', { actor, method: 'POST', body: input })
        assert.equal(result.response.status, expected)
        assert.equal(result.response.headers.get('cache-control'), 'private, no-store')
      }
      assert.deepEqual(await f.counts(), before)
    })
    await t.test('owner creates and reads a coherent private editor snapshot', async () => {
      const result = await f.call('/api/admin-products', { method: 'POST', body: input })
      assert.equal(result.response.status, 200, JSON.stringify(result.body))
      created = result.body
      loaded = (await f.call('/api/admin-products/' + created.id)).body
      assert.equal(loaded.revision, created.revision)
      assert.equal(loaded.product.price, 125.5)
      assert.equal(loaded.variants.length, 1)
      for (const actor of ['viewer', 'disabled', 'customer']) {
        assert.equal((await f.call('/api/admin-products/' + created.id, { actor })).response.status, 403)
      }
    })
    await t.test('lost HTTP acknowledgement recovers one committed create by receipt and retry', async () => {
      const retry = f.body(), before = await f.counts()
      f.controls.loseResponse = true
      await assert.rejects(() => f.call('/api/admin-products', { method: 'POST', body: retry }))
      const status = await f.call('/api/admin-products?request_id=' + retry.request_id)
      assert.equal(status.response.status, 200)
      assert.ok(status.body.result.id)
      const replay = await f.call('/api/admin-products', { method: 'POST', body: retry })
      assert.equal(replay.body.id, status.body.result.id)
      assert.equal(replay.body.replayed, true)
      const after = await f.counts()
      assert.equal(after.products, before.products + 1)
      assert.equal(after.audits, before.audits + 1)
      assert.equal((await f.call('/api/admin-products?request_id=' + retry.request_id, { actor: 'editor' })).body.result, null)
      assert.equal((await f.call('/api/admin-products?request_id=' + retry.request_id, { actor: 'viewer' })).response.status, 403)
    })
    await t.test('editor saves once and stale version returns a safe conflict without changes', async () => {
      const edit = { ...input, request_id: randomUUID(), expected_revision: loaded.revision, title: 'Editor authored title', variants: loaded.variants }
      assert.equal((await f.call('/api/admin-products/' + created.id, { actor: 'editor', method: 'PATCH', body: edit })).response.status, 200)
      const before = await f.snapshot(created.id), counts = await f.counts()
      const stale = await f.call('/api/admin-products/' + created.id, { method: 'PATCH', body: { ...edit, request_id: randomUUID(), title: 'Stale title' } })
      assert.equal(stale.response.status, 409)
      assert.equal(stale.body.data.productSaveError, 'conflict')
      assert.ok(!JSON.stringify(stale.body).includes('catalog_private'))
      assert.deepEqual(await f.snapshot(created.id), before)
      assert.deepEqual(await f.counts(), counts)
    })
    await t.test('missing price, invalid identifiers, SKU and quantity fail before writes', async () => {
      const before = await f.counts()
      for (const change of [{ price: null }, { price: '' }, { price: true }, { price: '12.345' }, { category_id: 'bad' },
        { sku: ['bad'] }, { sku: 'bad\nSKU' }, { slug: 'bad/URL' }, { stock_quantity: '1.7' }, { cost_price: 10 }]) {
        const result = await f.call('/api/admin-products', { method: 'POST', body: f.body(change) })
        assert.equal(result.response.status, 400, JSON.stringify(change))
        assert.equal(result.body.data.productSaveError, 'validation')
      }
      const { price, ...missing } = f.body()
      assert.equal((await f.call('/api/admin-products', { method: 'POST', body: missing })).response.status, 400)
      assert.deepEqual(await f.counts(), before)
    })
    await t.test('late definition failure never leaves a partial product through HTTP', async () => {
      const before = await f.counts()
      const result = await f.call('/api/admin-products', { method: 'POST', body: f.body({ variants: [{ id: randomUUID(), name: 'Foreign', code: 'FOREIGN' }] }) })
      assert.equal(result.response.status, 400)
      assert.deepEqual(await f.counts(), before)
    })
  } finally { await f.close() }
})
