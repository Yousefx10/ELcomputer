import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, readdir, realpath, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createEmailNativeDatabase, emailNativeAvailable } from './helpers/emailNativeDatabase.mjs'
import { createProductSaveHttpFixture } from './helpers/productSaveHttpFixture.mjs'

const routes = [
  ['get', '/api/admin-products/:id/presentation', 'server/api/admin-products/[id]/presentation.get.js'],
  ['put', '/api/admin-products/:id/presentation', 'server/api/admin-products/[id]/presentation.put.js'],
  ['put', '/api/admin-products/:id/videos/:assetId', 'server/api/admin-products/[id]/videos/[assetId].put.js'],
  ['get', '/api/storefront/products/:id/presentation', 'server/api/storefront/products/[id]/presentation.get.js'],
  ['get', '/uploads/**', 'server/routes/uploads/[...path].get.js']
]
test('owned native HTTP: current RBAC, receipt recovery and validated public VPS video streaming', { skip: !emailNativeAvailable, timeout: 180000 }, async t => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'product-presentation-'))), db = await createEmailNativeDatabase()
  let f
  try {
    f = await createProductSaveHttpFixture({ database: db, extraRoutes: routes, mapParams: (event, path) => {
      // H3's wildcard uses "_"; Nitro's [...path] route supplies "path".
      if (path === '/uploads/**') event.context.params.path = event.context.params._
    } })
    f.client.__ownedUploadsDir = join(directory, 'uploads')
    f.client.__ownedRuntimeConfig = { public: { supabaseUrl: 'http://owned.example.invalid', supabase: { key: 'synthetic' } }, packingVideoProbePath: 'ffprobe' }
    const source = await f.save(f.body({ is_published: true })), productId = source.id, path = `/api/admin-products/${productId}/presentation`
    const empty = { videos: [], related: [], compatible: [] }
    await t.test('customers, inactive staff and viewers cannot read or change editor metadata', async () => {
      for (const [actor, status] of [[null, 401], ['invalid', 401], ['customer', 403], ['disabled', 403], ['viewer', 403]]) {
        for (const method of ['GET', 'PUT']) assert.equal((await f.call(path, { actor, method, body: method === 'PUT' ? { request_id: randomUUID(), expected_revision: 0, content: empty } : null })).response.status, status)
      }
      assert.equal((await f.call(path)).body.revision, 0)
    })
    await t.test('lost response recovers the same command without a second audit', async () => {
      const body = { request_id: randomUUID(), expected_revision: 0, content: empty }
      f.controls.loseResponse = true
      await assert.rejects(() => f.call(path, { method: 'PUT', body }))
      const status = await f.call(path + '?request_id=' + body.request_id); assert.equal(status.body.committed, true)
      const repeat = await f.call(path, { method: 'PUT', body }); assert.equal(repeat.body.replayed, true)
      assert.equal((await db.query("select count(*)::int n from public.admin_activity_logs where action_key='products.presentation.update'")).rows[0].n, 1)
      assert.equal((await f.call(path, { method: 'PUT', body: { ...body, request_id: randomUUID() } })).response.status, 409)
    })
    const videoFile = join(directory, 'generated.webm')
    await promisify(execFile)('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:size=64x64:rate=10', '-t', '2', '-an', '-c:v', 'libvpx', videoFile], { timeout: 15000 })
    const video = await readFile(videoFile), assetId = randomUUID(), uploadPath = `/api/admin-products/${productId}/videos/${assetId}`
    const upload = async (bytes = video, mime = 'video/webm', actor = 'owner', id = assetId) => fetch(f.url + `/api/admin-products/${productId}/videos/${id}`, { method: 'PUT', headers: { ...(actor ? { authorization: 'Bearer ' + actor } : {}), 'content-type': mime }, body: bytes })
    let asset
    await t.test('real ffprobe validates video bytes; partial/foreign formats and private paths cannot publish', async () => {
      assert.equal((await upload(video, 'video/webm', 'viewer')).status, 403)
      assert.equal((await upload(Buffer.from('not video'), 'video/webm', 'owner', randomUUID())).status, 422)
      assert.equal((await upload(video, 'image/png', 'owner', randomUUID())).status, 415)
      const response = await upload(); assert.equal(response.status, 200); asset = await response.json()
      assert.equal(asset.id, assetId); assert.ok(asset.duration_seconds > 1)
      assert.equal((await upload()).status, 200, 'identical upload retries retain the one immutable file')
      assert.equal((await db.query('select count(*)::int n from catalog_private.product_video_assets')).rows[0].n, 1)
      assert.equal((await fetch(f.url + asset.url)).status, 404, 'unassigned uploaded assets stay unpublished')
      assert.equal((await readdir(join(directory, 'uploads/product_videos'))).length, 1)
    })
    await t.test('published assignment enables exact bytes, single ranges and safe failure states', async () => {
      const content = { ...empty, videos: [{ asset_id: assetId, variant_id: null, label: 'Isolated playback fixture', label_ar: '', sort_order: 0 }] }
      assert.equal((await f.call(path, { method: 'PUT', body: { request_id: randomUUID(), expected_revision: 1, content } })).response.status, 200)
      const full = await fetch(f.url + asset.url); assert.equal(full.status, 200); assert.equal(full.headers.get('content-type'), 'video/webm'); assert.equal(full.headers.get('x-content-type-options'), 'nosniff'); assert.deepEqual(Buffer.from(await full.arrayBuffer()), video)
      const partial = await fetch(f.url + asset.url, { headers: { Range: 'bytes=10-39' } }); assert.equal(partial.status, 206); assert.deepEqual(Buffer.from(await partial.arrayBuffer()), video.subarray(10, 40))
      const suffix = await fetch(f.url + asset.url, { headers: { Range: 'bytes=-20' } }); assert.equal(suffix.status, 206); assert.deepEqual(Buffer.from(await suffix.arrayBuffer()), video.subarray(-20))
      assert.equal((await fetch(f.url + asset.url, { headers: { Range: 'bytes=999999999-' } })).status, 416)
      const before = await readFile(join(directory, 'uploads/product_videos', assetId + '.webm'))
      await writeFile(join(directory, 'uploads/product_videos', assetId + '.webm'), Buffer.alloc(before.length, 0))
      assert.equal((await fetch(f.url + asset.url)).status, 404)
      await writeFile(join(directory, 'uploads/product_videos', assetId + '.webm'), before)
      await db.query('update public.products set is_published=false where id=$1', [productId])
      assert.equal((await fetch(f.url + asset.url)).status, 404)
      assert.equal((await fetch(f.url + `/api/storefront/products/${productId}/presentation`)).status, 404)
    })
  } finally { if (f) await f.close(); else await db.close(); await rm(directory, { recursive: true, force: true }) }
})
