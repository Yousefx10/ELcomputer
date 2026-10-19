import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:net'
import { request } from 'node:http'
import { createProductSaveHttpFixture } from './helpers/productSaveHttpFixture.mjs'
import { createEmailNativeDatabase, emailNativeAvailable, nativeWaitFor } from './helpers/emailNativeDatabase.mjs'
import { productBulkResult } from '../app/utils/productBulk.js'

const run = promisify(execFile)
const freePort = async () => {
  const server = createServer()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  return port
}
// Host and Auth are synthetic. Real Nginx -> actual handlers -> native SQL.
const call = (port, path, { method = 'GET', actor = 'owner', body } = {}) => new Promise((resolve, reject) => {
  const raw = body ? JSON.stringify(body) : ''
  const req = request({ host: '127.0.0.1', port, path, method, headers: {
    host: 'orchard.example.test', ...(actor ? { authorization: 'Bearer ' + actor } : {}),
    'content-type': 'application/json', 'content-length': Buffer.byteLength(raw)
  } }, response => {
    let text = ''
    response.setEncoding('utf8').on('data', chunk => { text += chunk }).on('end', () => {
      let data
      try { data = JSON.parse(text) } catch { data = null }
      resolve({ status: response.statusCode, headers: response.headers, body: data })
    })
  })
  req.setTimeout(10000, () => req.destroy(Error('Owned fixture request timeout')))
  req.on('error', reject)
  req.end(raw)
})

test('Products through actual Nginx: deny before repair, authorized atomic writes and GET-only recovery after repair', {
  skip: !emailNativeAvailable || !process.env.DASHBOARD_REVIEW_NGINX, timeout: 90000
}, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'product-writes-owned-'))
  let f
  const processes = []
  try {
    f = await createProductSaveHttpFixture({ database: await createEmailNativeDatabase() })
    const oldPort = await freePort(), newPort = await freePort()
    const python = `
import json,sys
sys.path.insert(0,'tests')
import product_writes_test as fixture
from dashboard_access import digest
from product_writes import render_product_writes
ports=json.loads(sys.stdin.read())
result=[]
for edge,new in [(ports[0],False),(ports[1],True)]:
 source,binding=fixture.harness.fixture(edge=edge,upstream=ports[2])
 old=fixture.accepted(source,binding)
 result.append(render_product_writes(old,{**binding,'source_sha256':digest(old)})[0] if new else old)
print(json.dumps(result))
`
    const child = spawn('python3', ['-c', python], { cwd: resolve('.'), stdio: ['pipe', 'pipe', 'pipe'] })
    let rendered = '', errors = ''
    child.stdout.on('data', data => { rendered += data })
    child.stderr.on('data', data => { errors += data })
    const exited = new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve) })
    child.stdin.end(JSON.stringify([oldPort, newPort, Number(new URL(f.url).port)]))
    assert.equal(await exited, 0, errors)
    const configurations = JSON.parse(rendered)
    for (const [index, contents] of configurations.entries()) {
      const config = join(directory, index + '.conf')
      await writeFile(config, `daemon off;\nworker_processes 1;\nerror_log ${directory}/${index}.log;\npid ${directory}/${index}.pid;\nevents { worker_connections 128; }\nhttp { access_log off; client_body_temp_path ${directory}/body; proxy_temp_path ${directory}/proxy;\n${contents}\n}\n`)
      const args = ['-p', directory + '/', '-c', config]
      await run(process.env.DASHBOARD_REVIEW_NGINX, [...args, '-t'])
      processes.push(spawn(process.env.DASHBOARD_REVIEW_NGINX, args, { stdio: 'ignore' }))
      await nativeWaitFor(async () => {
        try { return (await call(index ? newPort : oldPort, '/api/admin-products?request_id=' + randomUUID(), { actor: null })).status === 401 }
        catch { return false }
      })
    }
    const stats = async () => ({ ...await f.counts(), bulkReceipts: (await f.db.query('select count(*)::int n from catalog_private.product_bulk_receipts')).rows[0].n })
    let product
    const batch = async (id, operation) => ({ request_id: randomUUID(), operation, reference_id: null,
      items: [{ id, expected_revision: (await f.snapshot(id)).revision }] })
    await t.test('accepted production policy blocks all three commands before handlers', async () => {
      const counts = await stats(), writes = f.controls.writes
      for (const [path, method] of [['/api/admin-products', 'POST'], ['/api/admin-products/' + randomUUID(), 'PATCH'], ['/api/admin-products/bulk', 'POST']]) {
        assert.equal((await call(oldPort, path, { method, body: f.body() })).status, 405)
      }
      assert.equal(f.controls.writes, writes)
      assert.deepEqual(await stats(), counts)
    })
    await t.test('new policy retains real application denials without any product/audit/receipt writes', async () => {
      const counts = await stats()
      for (const actor of [null, 'invalid', 'viewer', 'disabled', 'customer']) {
        for (const [path, method] of [['/api/admin-products', 'POST'], ['/api/admin-products/' + randomUUID(), 'PATCH'], ['/api/admin-products/bulk', 'POST']]) {
          const response = await call(newPort, path, { method, actor, body: f.body() })
          assert.equal(response.status, actor === null || actor === 'invalid' ? 401 : 403)
          assert.equal(response.headers['cache-control'], 'private, no-store')
        }
      }
      assert.deepEqual(await stats(), counts)
    })
    await t.test('create Draft, edit, publish and Move to Draft commit with exact acknowledgements', async () => {
      const input = f.body(), before = await stats()
      const created = await call(newPort, '/api/admin-products', { method: 'POST', body: input })
      assert.equal(created.status, 200, JSON.stringify(created))
      product = created.body
      assert.equal((await f.snapshot(product.id)).product.is_published, false)
      const repeated = await Promise.all([1, 2].map(() => call(newPort, '/api/admin-products', { method: 'POST', body: input })))
      for (const r of repeated) { assert.equal(r.body.id, product.id); assert.equal(r.body.replayed, true) }
      assert.equal((await stats()).audits, before.audits + 1)
      const snapshot = await f.snapshot(product.id)
      const edit = { ...input, request_id: randomUUID(), expected_revision: snapshot.revision,
        variants: snapshot.variants, title: 'Administrator authored edit', is_published: true }
      const changed = await call(newPort, '/api/admin-products/' + product.id, { method: 'PATCH', actor: 'editor', body: edit })
      assert.equal(changed.status, 200, JSON.stringify(changed))
      const afterEdit = await f.snapshot(product.id), counts = await stats()
      assert.equal(afterEdit.product.title, edit.title)
      assert.equal(afterEdit.product.is_published, true)
      const replay = await call(newPort, '/api/admin-products/' + product.id, { method: 'PATCH', actor: 'editor', body: edit })
      assert.equal(replay.body.replayed, true)
      assert.deepEqual(await stats(), counts)
      const stale = await call(newPort, '/api/admin-products/' + product.id, { method: 'PATCH', body: { ...edit, request_id: randomUUID() } })
      assert.equal(stale.status, 409)
      assert.deepEqual(await f.snapshot(product.id), afterEdit)
      const command = await batch(product.id, 'draft')
      const drafted = await call(newPort, '/api/admin-products/bulk', { method: 'POST', actor: 'editor', body: command })
      assert.equal(drafted.status, 200, JSON.stringify(drafted))
      productBulkResult(drafted.body, command)
      assert.equal(drafted.body.succeeded, 1)
      const afterDraft = await f.snapshot(product.id)
      assert.equal(afterDraft.product.is_published, false)
      for (const field of ['price', 'stock_quantity', 'cost_price', 'primary_warehouse_id', 'default_supplier_id']) {
        assert.deepEqual(afterDraft.product[field], afterEdit.product[field])
      }
      assert.deepEqual(afterDraft.variants, afterEdit.variants)
    })
    await t.test('named add/edit permissions remain separate and both require Products view', async () => {
      const grant = permissions => f.db.query('update public.admin_users set permissions=$1 where id=$2',
        [JSON.stringify(permissions), f.actors.editor])
      try {
        await grant({ 'products.view': true, 'products.add': true })
        const added = await call(newPort, '/api/admin-products', { method: 'POST', actor: 'editor', body: f.body() })
        assert.equal(added.status, 200)
        let before = await stats()
        for (const [path, method] of [['/api/admin-products/' + product.id, 'PATCH'], ['/api/admin-products/bulk', 'POST']]) {
          assert.equal((await call(newPort, path, { method, actor: 'editor', body: {} })).status, 403)
        }
        assert.deepEqual(await stats(), before)
        await grant({ 'products.view': true, 'products.edit': true })
        assert.equal((await call(newPort, '/api/admin-products', { method: 'POST', actor: 'editor', body: f.body() })).status, 403)
        await grant({ 'products.add': true, 'products.edit': true })
        before = await stats()
        for (const [path, method] of [['/api/admin-products', 'POST'], ['/api/admin-products/' + product.id, 'PATCH'], ['/api/admin-products/bulk', 'POST']]) {
          assert.equal((await call(newPort, path, { method, actor: 'editor', body: f.body() })).status, 403)
        }
        assert.deepEqual(await stats(), before)
      } finally { await grant({ 'products.view': true, 'products.add': true, 'products.edit': true }) }
    })
    await t.test('lost create acknowledgement recovers actor-owned receipt only through GET', async () => {
      const input = f.body(), before = await stats()
      f.controls.loseResponse = true
      const lost = await call(newPort, '/api/admin-products', { method: 'POST', body: input })
      assert.equal(lost.status, 502)
      const writes = f.controls.writes, committed = await stats()
      assert.equal(committed.products, before.products + 1)
      assert.equal(committed.audits, before.audits + 1)
      const path = '/api/admin-products?request_id=' + input.request_id
      const recovered = await call(newPort, path)
      assert.ok(recovered.body.result.id)
      assert.equal((await call(newPort, path, { actor: 'editor' })).body.result, null)
      assert.equal((await call(newPort, path, { actor: 'viewer' })).status, 403)
      assert.equal((await call(newPort, '/api/admin-products?request_id=' + randomUUID())).body.result, null)
      assert.equal((await call(newPort, '/api/admin-products?request_id=bad')).status, 400)
      assert.equal(f.controls.writes, writes)
      assert.deepEqual(await stats(), committed)
    })
    await t.test('lost bulk acknowledgement, duplicate clicks, actor isolation and immutable receipt', async () => {
      const command = await batch(product.id, 'publish'), before = await stats()
      f.controls.loseResponse = true
      assert.equal((await call(newPort, '/api/admin-products/bulk', { method: 'POST', body: command })).status, 502)
      const writes = f.controls.writes, committed = await stats()
      assert.equal(committed.audits, before.audits + 1)
      assert.equal(committed.bulkReceipts, before.bulkReceipts + 1)
      const path = '/api/admin-products/bulk?request_id=' + command.request_id
      const recovered = await call(newPort, path)
      productBulkResult(recovered.body.result, command)
      assert.equal((await call(newPort, path, { actor: 'editor' })).body.result, null)
      assert.equal((await call(newPort, '/api/admin-products/bulk?request_id=' + randomUUID())).body.result, null)
      assert.equal((await call(newPort, '/api/admin-products/bulk?request_id=bad')).status, 400)
      assert.equal(f.controls.writes, writes)
      assert.deepEqual(await stats(), committed)
      for (const r of await Promise.all([1, 2].map(() => call(newPort, '/api/admin-products/bulk', { method: 'POST', body: command })))) {
        assert.equal(r.body.replayed, true)
        productBulkResult(r.body, command)
      }
      assert.equal((await call(newPort, '/api/admin-products/bulk', { method: 'POST', body: command, actor: 'editor' })).status, 400)
      assert.equal((await call(newPort, '/api/admin-products/bulk', { method: 'POST', body: { ...command, operation: 'draft' } })).status, 400)
      assert.deepEqual(await stats(), committed)
    })
    await t.test('unreviewed writes, uploads, imports and commerce still stop before handlers', async () => {
      const counts = await stats(), writes = f.controls.writes
      for (const path of ['/api/admin-products/transfer/import/apply', '/api/admin-products/transfer/export',
        '/api/admin-uploads', '/api/admin-inventory/items', '/api/checkout', '/api/auth/signup',
        '/api/admin-products?x=1', '/api/admin-products/bulk/']) {
        assert.equal((await call(newPort, path, { method: 'POST', body: {} })).status, 405, path)
      }
      assert.equal(f.controls.writes, writes)
      assert.deepEqual(await stats(), counts)
    })
  } finally {
    for (const process of processes) {
      if (process.exitCode !== null) continue
      const ended = new Promise(resolve => process.once('exit', resolve))
      process.kill('SIGTERM')
      await ended
    }
    await f?.close()
    await rm(directory, { recursive: true, force: true })
  }
})
