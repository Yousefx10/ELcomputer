import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { createServer } from 'node:http'
import { build } from 'esbuild'
import { createApp, createRouter, readBody, toNodeListener } from 'h3'
import { createOrderSmsFixture } from './helpers/orderSmsFixture.mjs'

// Real routes, auth/permission guards, validation and SQL; only Auth token
// verification and the Supabase transport are replaced with isolated fixtures.
test('warranty HTTP routes enforce staff permissions and customer ownership using actual guards', async t => {
  const f = await createOrderSmsFixture()
  const { db, client } = f
  const actors = { owner: f.owner, alice: f.customer, bob: randomUUID(), viewer: randomUUID(), editor: randomUUID(), disabled: randomUUID() }
  for (const name of ['bob', 'viewer', 'editor', 'disabled']) {
    await db.query('insert into auth.users(id,email) values($1,$2)', [actors[name], `warranty-${name}@example.invalid`])
  }
  for (const [name, permissions] of [['viewer', { 'products.view': true }], ['editor', { 'products.view': true, 'products.edit': true }], ['disabled', { 'products.view': true, 'products.edit': true, 'products.add': true }]]) {
    await db.query('insert into public.admin_users(id,email,role,permissions,is_active) values($1,$2,\'admin\',$3,$4)', [actors[name], `warranty-${name}@example.invalid`, JSON.stringify(permissions), name !== 'disabled'])
  }
  client.auth = { getUser: async token => ({ data: { user: actors[token] ? { id: actors[token], is_anonymous: false } : null }, error: null }) }
  globalThis.warrantyApiDatabase = client
  globalThis.defineEventHandler = handler => handler
  globalThis.readBody = readBody
  const router = createRouter()
  for (const [method, route, file] of [
    ['get', '/api/account/orders/:id', 'server/api/account/orders/[id].get.js'],
    ['post', '/api/admin-products', 'server/api/admin-products/index.post.js'],
    ['patch', '/api/admin-products/:id', 'server/api/admin-products/[id].patch.js']
  ]) {
    const compiled = await build({ entryPoints: [resolve(file)], bundle: true, write: false, format: 'esm', platform: 'node', alias: { '~': resolve('app') }, plugins: [{ name: 'isolated-auth-transport', setup(builder) {
      builder.onResolve({ filter: /\/supabaseAdmin$/ }, () => ({ path: 'supabaseAdmin', namespace: 'warranty-test' }))
      builder.onLoad({ filter: /.*/, namespace: 'warranty-test' }, () => ({ contents: 'export const getSupabaseAdminClient=()=>globalThis.warrantyApiDatabase', loader: 'js' }))
      builder.onResolve({ filter: /^h3$/ }, () => ({ path: import.meta.resolve('h3'), external: true }))
    } }] })
    const handler = (await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'))).default
    router[method](route, handler)
  }
  const app = createApp().use(router)
  const server = createServer(toNodeListener(app))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const call = async (path, { actor = 'owner', method = 'GET', body } = {}) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers: { authorization: actor ? 'Bearer ' + actor : '', 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
    return { response, body: await response.json() }
  }
  const warehouse = randomUUID()
  await db.query("insert into public.commerce_warehouses(id,name) values($1,'Warranty warehouse fixture')", [warehouse])
  const payload = { title: 'Warranty catalog fixture', slug: 'warranty-catalog-' + randomUUID(), price: 100, stock_quantity: 0, is_serialized: true, primary_warehouse_id: warehouse, variants: [{ name: 'Default', code: 'DEFAULT', sku: 'WR-' + randomUUID() }], warranty_status: 'included', warranty_duration_value: 12, warranty_duration_unit: 'months' }
  try {
    await t.test('POST enforces products.add before any catalog write', async () => {
      for (const [actor, status] of [[null, 401], ['viewer', 403], ['editor', 403], ['disabled', 403]]) {
        assert.equal((await call('/api/admin-products', { actor, method: 'POST', body: payload })).response.status, status)
      }
    })
    let product
    await t.test('authorized create and edit persist normalized structured terms and preserve omitted configuration', async () => {
      const result = await call('/api/admin-products', { method: 'POST', body: payload })
      assert.equal(result.response.status, 200, JSON.stringify(result.body))
      product = result.body.id
      assert.equal((await db.query('select warranty_duration_value from public.products where id=$1', [product])).rows[0].warranty_duration_value, 12)
      const edited = await call('/api/admin-products/' + product, { actor: 'editor', method: 'PATCH', body: { ...payload, warranty_duration_value: '3', warranty_duration_unit: 'years' } })
      assert.equal(edited.response.status, 200, JSON.stringify(edited.body))
      const { warranty_status, warranty_duration_value, warranty_duration_unit, ...oldCaller } = payload
      assert.equal((await call('/api/admin-products/' + product, { method: 'PATCH', body: oldCaller })).response.status, 200)
      const record = (await db.query('select * from public.products where id=$1', [product])).rows[0]
      assert.equal(record.warranty_duration_value, 3)
      assert.equal(record.warranty_duration_unit, 'years')
    })
    await t.test('PATCH rejects missing permission and malformed product terms server-side without changing saved warranty', async () => {
      for (const actor of ['viewer', 'disabled', 'alice']) assert.equal((await call('/api/admin-products/' + product, { actor, method: 'PATCH', body: payload })).response.status, 403)
      for (const change of [{ warranty_duration_value: -1 }, { warranty_duration_value: 0 }, { warranty_duration_value: true }, { warranty_duration_value: [12] }, { warranty_duration_value: 121 }, { warranty_duration_unit: 'days' }, { warranty_status: 'none' }]) {
        const result = await call('/api/admin-products/' + product, { method: 'PATCH', body: { ...payload, ...change } })
        assert.equal(result.response.status, 400)
        assert.ok(result.body.data.warrantyErrorKey)
      }
      assert.equal((await db.query('select warranty_duration_value from public.products where id=$1', [product])).rows[0].warranty_duration_value, 3)
    })
    await t.test('existing product rollback restores warranty if downstream variant definition fails', async () => {
      const result = await call('/api/admin-products/' + product, { method: 'PATCH', body: { ...payload, warranty_duration_value: 24, variants: [{ ...payload.variants[0], id: randomUUID() }] } })
      assert.equal(result.response.status, 400)
      const record = (await db.query('select warranty_duration_value,warranty_duration_unit from public.products where id=$1', [product])).rows[0]
      assert.equal(record.warranty_duration_value, 3)
      assert.equal(record.warranty_duration_unit, 'years')
    })
    await db.query("update public.products set warranty_status='included',warranty_duration_value=12,warranty_duration_unit='months' where id=$1", [f.product])
    const order = await f.checkout()
    await t.test('customer owner receives only owned purchase snapshots with private/no-store and unchanged shipment projection', async () => {
      const result = await call('/api/account/orders/' + order.id, { actor: 'alice' })
      assert.equal(result.response.status, 200)
      assert.equal(result.response.headers.get('cache-control'), 'private, no-store')
      assert.equal(result.body.items[0].warranty_duration_value, 12)
      assert.equal(result.body.items[0].warranty_start_basis, 'unresolved')
      assert.equal(result.body.shipping, null)
      assert.equal(result.body.order.payment_status, 'pending')
      assert.equal(Object.hasOwn(result.body.order, 'user_id'), false)
      await db.query('update public.products set warranty_duration_value=24 where id=$1', [f.product])
      assert.equal((await call('/api/account/orders/' + order.id, { actor: 'alice' })).body.items[0].warranty_duration_value, 12)
    })
    await t.test('foreign, signed-out, invalid and inactive customers cannot access purchased warranties', async () => {
      assert.equal((await call('/api/account/orders/' + order.id, { actor: 'bob' })).response.status, 404)
      for (const actor of [null, 'unknown']) assert.equal((await call('/api/account/orders/' + order.id, { actor })).response.status, 401)
      assert.equal((await call('/api/account/orders/not-a-uuid', { actor: 'alice' })).response.status, 404)
      await db.query('update public.customer_profiles set is_active=false where id=$1', [f.customer])
      assert.equal((await call('/api/account/orders/' + order.id, { actor: 'alice' })).response.status, 403)
    })
  } finally {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
    await db.close()
    delete globalThis.warrantyApiDatabase
  }
})
