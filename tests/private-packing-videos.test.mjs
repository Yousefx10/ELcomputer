import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import childProcess, { execFile } from 'node:child_process'
import { syncBuiltinESMExports } from 'node:module'
import { request } from 'node:http'
import { promisify } from 'node:util'
import { readFile, writeFile, stat, readdir, access, rename, symlink, link, unlink, chmod } from 'node:fs/promises'
import { join } from 'node:path'
import { probePackingVideo } from '../server/utils/privatePackingVideos.js'
import { finishResetCleanup } from '../server/utils/systemReset.js'
import { createPrivatePackingFixture } from './helpers/privatePackingFixture.mjs'
import { emailNativeAvailable, nativeWaitFor } from './helpers/emailNativeDatabase.mjs'

const migration = '20261020160000_private_vps_packing_videos.sql'
const generatedVideo = async (directory, extension = 'webm', extra = []) => {
  const path = join(directory, randomUUID() + '.' + extension)
  await promisify(execFile)('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:size=64x64:rate=10', '-t', '6', '-an',
    '-c:v', extension === 'webm' ? 'libvpx' : extension === 'mp4' ? 'libx264' : 'mpeg4', ...extra, path], { timeout: 15000 })
  return readFile(path)
}
const details = (bytes, mimeType = 'video/webm', offset = -1000, seconds = 6) => {
  const start = Date.now() + offset
  return { mimeType, sizeBytes: bytes.length, durationSeconds: 123456 /* untrusted; ignored */,
    recordingStartedAt: new Date(start).toISOString(), recordingEndedAt: new Date(start + seconds * 1000).toISOString() }
}
const prepare = async (f, pack, body) => {
  const result = await f.call(pack.path + '/video-upload', { actor: pack.actor, method: 'POST', body })
  assert.equal(result.response.status, 200, JSON.stringify(result.body))
  assert.ok(result.body.upload.url.startsWith(pack.path + '/video-content?upload='))
  assert.equal(result.body.upload.token, undefined); assert.equal(result.body.video.storage_path, undefined)
  return result.body
}
const upload = (f, prepared, bytes, actor = 'editor', headers = {}) => f.call(prepared.upload.url, {
  actor, method: 'PUT', body: bytes, raw: true, headers: { 'Content-Type': prepared.video.mime_type, ...headers }
})
const stored = async (f, pack) => (await f.db.query('select * from public.order_packing_videos where packing_session_id=$1', [pack.session.id])).rows[0]
const files = async root => (await readdir(root, { recursive: true }).catch(() => [])).filter(path => /\.(webm|mp4|mov|pending)$/.test(path))
const closeWork = async f => {
  for (const actor of ['editor', 'owner']) {
    const result = await f.call('/api/admin-orders/packing/work-session', { actor, method: 'POST', body: { action: 'close' } })
    assert.equal(result.response.status, 200, JSON.stringify(result.body))
  }
}
const financial = async (f, pack) => (await f.db.query(`select
 jsonb_build_array(o.subtotal_amount,o.discount_amount,o.shipping_fee_amount,o.payment_fee_amount,o.total_amount,o.payment_status) totals,
 (select jsonb_agg(jsonb_build_array(id,quantity,unit_price,line_total) order by id) from public.customer_order_items where order_id=o.id) items,
 (select jsonb_agg(jsonb_build_array(id,status,customer_order_item_id) order by id) from public.commerce_serialized_units where customer_order_id=o.id) units,
 (select sum(quantity)::int from public.commerce_warehouse_inventory) stock,
 (select count(*)::int from public.treasury_transactions) ledger
 from public.customer_orders o where id=$1`, [pack.order])).rows[0]

test('private VPS packing: real upload, authorized retrieval, evidence and failure boundaries', { skip: !emailNativeAvailable, timeout: 180000 }, async t => {
  const f = await createPrivatePackingFixture()
  try {
    const webm = await generatedVideo(f.directory), live = await generatedVideo(f.directory, 'webm', ['-live', '1'])
    const vp9 = await generatedVideo(f.directory, 'webm', ['-c:v', 'libvpx-vp9', '-deadline', 'realtime'])
    const run = (name, action) => t.test(name, async () => { try { await action() } finally { await closeWork(f) } })
    await run('received COD order scans, persists video and completes exactly once without changing money or stock', async () => {
      const pack = await f.newPack(2), before = await financial(f, pack)
      assert.equal((await f.call(pack.path + '/complete', { method: 'POST', body: {} })).response.status, 409)
      await f.scan(pack)
      const prepared = await prepare(f, pack, details(webm))
      const put = await upload(f, prepared, webm)
      assert.equal(put.response.status, 200, JSON.stringify(put.body)); assert.equal(put.body.video.status, 'ready')
      const video = await stored(f, pack), path = join(f.config.packingVideosDir, video.storage_path)
      assert.equal(video.storage_backend, 'vps'); assert.equal(Number(video.size_bytes), webm.length)
      assert.equal(video.sha256, createHash('sha256').update(webm).digest('hex'))
      assert.equal(Number(video.duration_seconds), 6); assert.ok(video.validated_at)
      assert.deepEqual(await readFile(path), webm); assert.equal((await stat(path)).mode & 0o777, 0o600)
      assert.equal((await stat(f.config.packingVideosDir)).mode & 0o777, 0o700)
      const downloaded = await f.call(pack.path + '/video', { actor: 'owner' })
      assert.equal(downloaded.response.status, 200); assert.deepEqual(downloaded.body, webm)
      assert.equal(downloaded.response.headers.get('cache-control'), 'private, no-store')
      assert.equal(downloaded.response.headers.get('location'), null)
      assert.equal(downloaded.response.headers.get('x-content-type-options'), 'nosniff')
      const confirmed = await f.call(pack.path + '/video-complete', { method: 'POST' })
      assert.equal(confirmed.response.status, 200, JSON.stringify(confirmed.body))
      const result = await f.call(pack.path + '/complete', { method: 'POST', body: {} })
      assert.equal(result.response.status, 200, JSON.stringify(result.body)); assert.equal(result.body.result.already_completed, false)
      assert.equal(result.body.result.order_status, 'ready_to_deliver')
      assert.equal((await f.call(pack.path + '/complete', { method: 'POST', body: {} })).body.result.already_completed, true)
      assert.deepEqual(await financial(f, pack), before)
      assert.equal((await f.call(pack.path + '/video', { actor: 'editor' })).response.status, 200)
      assert.equal((await f.db.query("select count(*)::int n from public.admin_activity_logs where action_key='orders.packing.video.saved' and metadata->>'packing_session_id'=$1", [pack.session.id])).rows[0].n, 1)
    })
    await run('fresh bearer authorization denies anonymous, customer, disabled staff and missing Orders access on every file route', async () => {
      const pack = await f.newPack(1), body = details(webm), prepared = await prepare(f, pack, body)
      for (const [actor, expected] of [[null, 401], ['invalid', 401], ['customer', 403], ['disabled', 403], ['viewer', 403]]) {
        for (const [path, method, payload, raw] of [[pack.path + '/video-upload', 'POST', body, false], [prepared.upload.url, 'PUT', webm, true], [pack.path + '/video-complete', 'POST'], [pack.path + '/video', 'GET']]) {
          assert.equal((await f.call(path, { actor, method, body: payload, raw, headers: raw ? { 'Content-Type': 'video/webm' } : {} })).response.status, expected, actor + ' ' + method)
        }
      }
      assert.equal((await stored(f, pack)).status, 'uploading')
      assert.equal((await files(f.config.packingVideosDir)).some(path => path.includes(pack.session.id)), false)
    })
    await run('staff cannot upload another operator session or use a different upload identity', async () => {
      const pack = await f.newPack(1), prepared = await prepare(f, pack, details(webm))
      assert.equal((await upload(f, prepared, webm, 'owner')).response.status, 409)
      assert.equal((await f.call(pack.path + '/video-upload', { actor: 'owner', method: 'POST', body: details(webm) })).response.status, 409)
      assert.equal((await f.call(prepared.upload.url.replace(/upload=.*/, 'upload=' + randomUUID()), { method: 'PUT', raw: true, body: webm, headers: { 'Content-Type': 'video/webm' } })).response.status, 409)
      assert.equal((await f.call(pack.path + '/video-complete', { actor: 'owner', method: 'POST' })).response.status, 409)
      assert.equal((await f.call(pack.path + '/video', { actor: 'owner' })).response.status, 404)
    })
    await run('preparation rejects forged paths, invalid metadata, MIME and oversized declarations', async () => {
      const pack = await f.newPack(1), base = details(webm)
      for (const [changes, status] of [[{ storage_path: '../../public/x.webm' }, 400], [{ order_id: randomUUID() }, 400], [{ recorded_by: f.actors.owner }, 400], [{ mimeType: 'text/html' }, 415], [{ sizeBytes: 524288001 }, 413], [{ sizeBytes: -1 }, 413], [{ recordingEndedAt: 'invalid' }, 400], [{ recordingEndedAt: base.recordingStartedAt }, 400]]) {
        assert.equal((await f.call(pack.path + '/video-upload', { method: 'POST', body: { ...base, ...changes } })).response.status, status)
      }
      assert.equal((await f.call(pack.path + '/video-upload', { method: 'POST', body: { ...base, durationSeconds: 'x'.repeat(9000) } })).response.status, 413)
      assert.equal(await stored(f, pack), undefined)
    })
    await run('unknown storage configuration fails closed and never falls back to public files', async () => {
      const pack = await f.newPack(1), original = f.config.packingVideosDir
      for (const root of ['', 'relative/private', f.config.uploadsDir, join(f.config.uploadsDir, 'private'), process.cwd()]) {
        f.config.packingVideosDir = root
        assert.equal((await f.call(pack.path + '/video-upload', { method: 'POST', body: details(webm) })).response.status, 503)
      }
      f.config.packingVideosDir = original
      assert.equal(await stored(f, pack), undefined)
    })
    await run('wrong content and truncated media never become saved evidence', async () => {
      for (const bytes of [Buffer.from('<html>not a packing recording</html>'), webm.subarray(0, 180)]) {
        const pack = await f.newPack(1), prepared = await prepare(f, pack, details(bytes))
        const result = await upload(f, prepared, bytes)
        assert.ok([415, 422].includes(result.response.status), JSON.stringify(result.body))
        assert.equal((await stored(f, pack)).status, 'uploading')
        assert.equal((await files(f.config.packingVideosDir)).some(path => path.includes(pack.session.id)), false)
        await closeWork(f)
      }
    })
    await run('byte limits apply to chunked bodies and failed writes leave no staging file', async () => {
      const pack = await f.newPack(1), prepared = await prepare(f, pack, details(webm))
      const body = new ReadableStream({ start(controller) { controller.enqueue(webm); controller.enqueue(Buffer.from('EXCESS')); controller.close() } })
      const result = await f.call(prepared.upload.url, { method: 'PUT', raw: true, body, duplex: 'half', headers: { 'Content-Type': 'video/webm' } })
      assert.equal(result.response.status, 413, JSON.stringify(result.body))
      assert.equal((await stored(f, pack)).status, 'uploading')
      assert.equal((await files(f.config.packingVideosDir)).some(path => path.includes(pack.session.id)), false)
      assert.equal((await upload(f, prepared, webm, 'editor', { 'Content-Type': 'video/mp4' })).response.status, 415)
    })
    await run('an interrupted client stream cleans its partial file and can retry the same recording', async () => {
      const pack = await f.newPack(1), prepared = await prepare(f, pack, details(webm))
      const req = request(f.url + prepared.upload.url, { method: 'PUT', headers: { authorization: 'Bearer editor', 'content-type': 'video/webm', 'content-length': webm.length } })
      req.on('error', () => {}); req.write(webm.subarray(0, 64))
      await nativeWaitFor(async () => (await files(f.config.packingVideosDir)).some(path => path.includes(pack.session.id) && path.endsWith('.pending')))
      req.destroy()
      await nativeWaitFor(async () => !(await files(f.config.packingVideosDir)).some(path => path.includes(pack.session.id)))
      assert.equal((await stored(f, pack)).status, 'uploading')
      assert.equal((await upload(f, prepared, webm)).response.status, 200)
    })
    await run('MediaRecorder-style WebM without duration metadata is verified from decoded frames', async () => {
      for (const bytes of [live, vp9]) {
        const pack = await f.newPack(1), prepared = await prepare(f, pack, details(bytes))
        const result = await upload(f, prepared, bytes)
        assert.equal(result.response.status, 200, JSON.stringify(result.body))
        assert.equal(Number((await stored(f, pack)).duration_seconds), 6)
        await closeWork(f)
      }
    })
    await run('MP4 and QuickTime files use their actual container types', async () => {
      for (const [extension, mime] of [['mp4', 'video/mp4'], ['mov', 'video/quicktime']]) {
        const bytes = await generatedVideo(f.directory, extension), pack = await f.newPack(1)
        const prepared = await prepare(f, pack, details(bytes, mime))
        assert.equal((await upload(f, prepared, bytes)).response.status, 200)
        assert.equal((await f.call(pack.path + '/video')).response.headers.get('content-type'), mime)
        await closeWork(f)
      }
    })
    await run('audio-only files and recordings with false duration are rejected', async () => {
      const audio = join(f.directory, 'audio.webm')
      await promisify(execFile)('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'anullsrc', '-t', '1', '-c:a', 'libopus', audio], { timeout: 15000 })
      let pack = await f.newPack(1), bytes = await readFile(audio), prepared = await prepare(f, pack, details(bytes))
      assert.equal((await upload(f, prepared, bytes)).response.status, 415)
      await closeWork(f)
      pack = await f.newPack(1); prepared = await prepare(f, pack, details(webm, 'video/webm', -1000, 30))
      assert.equal((await upload(f, prepared, webm)).response.status, 422)
      assert.equal((await stored(f, pack)).status, 'uploading')
    })
    await run('a real saved file cannot bypass missing scans or every-scan recording coverage', async () => {
      const pack = await f.newPack(1), before = await financial(f, pack)
      const prepared = await prepare(f, pack, details(webm, 'video/webm', 86400000))
      assert.equal((await upload(f, prepared, webm)).response.status, 200)
      assert.equal((await f.call(pack.path + '/complete', { method: 'POST', body: {} })).response.status, 409)
      await f.scan(pack)
      const completion = await f.call(pack.path + '/complete', { method: 'POST', body: {} })
      assert.ok([400, 409].includes(completion.response.status)); assert.match(completion.body.statusMessage, /cover every item scan/)
      assert.deepEqual(await financial(f, pack), before)
    })
    await run('SQL failure after disk persistence and lost HTTP acknowledgement both recover without replacing evidence', async () => {
      let pack = await f.newPack(1), body = details(webm), prepared = await prepare(f, pack, body)
      f.controls.failFinishOnce = true
      assert.equal((await upload(f, prepared, webm)).response.status, 500)
      assert.equal((await stored(f, pack)).status, 'uploading')
      const snapshot = await stat(join(f.config.packingVideosDir, (await stored(f, pack)).storage_path))
      assert.equal((await f.call(pack.path + '/video-complete', { method: 'POST' })).response.status, 200)
      assert.equal((await stat(join(f.config.packingVideosDir, (await stored(f, pack)).storage_path))).ino, snapshot.ino)
      await closeWork(f)
      pack = await f.newPack(1); body = details(webm); prepared = await prepare(f, pack, body)
      f.controls.dropResponseFor = '/api/admin-orders/packing/:sessionId/video-content'
      await assert.rejects(() => upload(f, prepared, webm))
      const original = await stored(f, pack)
      assert.equal(original.status, 'ready')
      const replay = await prepare(f, pack, body)
      assert.equal(replay.video.id, original.id)
      assert.equal((await f.call(pack.path + '/video-complete', { method: 'POST' })).response.status, 200)
      assert.equal((await stored(f, pack)).sha256, original.sha256)
    })
    await run('simultaneous identical uploads publish one immutable file and one save event', async () => {
      const pack = await f.newPack(1), body = details(webm)
      const prepared = await Promise.all([prepare(f, pack, body), prepare(f, pack, body)])
      assert.equal(prepared[0].upload.url, prepared[1].upload.url)
      const results = await Promise.all(prepared.map(item => upload(f, item, webm)))
      assert.ok(results.every(result => result.response.status === 200), JSON.stringify(results.map(result => result.body)))
      assert.equal((await files(f.config.packingVideosDir)).filter(path => path.includes(pack.session.id)).length, 1)
      assert.equal((await f.db.query("select count(*)::int n from public.admin_activity_logs where action_key='orders.packing.video.saved' and metadata->>'packing_session_id'=$1", [pack.session.id])).rows[0].n, 1)
      assert.equal((await f.call(pack.path + '/video-upload', { method: 'POST', body: { ...body, sizeBytes: body.sizeBytes + 1 } })).response.status, 409)
    })
    await run('revoked permissions during upload prevent ready evidence and completion', async () => {
      const pack = await f.newPack(1), prepared = await prepare(f, pack, details(webm))
      f.controls.beforeFinish = () => f.db.query('update public.admin_users set permissions=permissions-\'dashboard.orders\' where id=$1', [f.actors.editor])
      try {
        assert.equal((await upload(f, prepared, webm)).response.status, 403)
        assert.equal((await stored(f, pack)).status, 'uploading')
        assert.equal((await f.call(pack.path + '/video-complete', { method: 'POST' })).response.status, 403)
      } finally { await f.db.query("update public.admin_users set permissions=permissions||'{\"dashboard.orders\":true}'::jsonb where id=$1", [f.actors.editor]) }
      assert.equal((await f.call(pack.path + '/video-complete', { method: 'POST' })).response.status, 200)
    })
    await run('missing verifier fails closed and bounded verifier execution leaves no child process', async () => {
      const pack = await f.newPack(1), prepared = await prepare(f, pack, details(webm)), original = f.config.packingVideoProbePath
      try {
        f.config.packingVideoProbePath = join(f.directory, 'missing-ffprobe')
        assert.equal((await upload(f, prepared, webm)).response.status, 503)
        assert.equal((await stored(f, pack)).status, 'uploading')
      } finally { f.config.packingVideoProbePath = original }
      const slow = join(f.directory, 'slow-probe'), source = join(f.directory, 'probe.webm')
      await writeFile(source, webm)
      await writeFile(slow, '#!/bin/sh\nexec /bin/sleep 60\n', { mode: 0o700 })
      const previous = globalThis.useRuntimeConfig
      globalThis.useRuntimeConfig = () => f.config
      const originalSpawn = childProcess.spawn, children = []
      childProcess.spawn = (...args) => { const child = originalSpawn(...args); children.push(child); return child }
      syncBuiltinESMExports()
      try {
        f.config.packingVideoProbePath = slow
        await assert.rejects(() => probePackingVideo(source, 'video/webm', { timeoutMs: 500 }), error => error.statusCode === 422 && /timed out/.test(error.statusMessage))
        assert.equal(children.length, 1)
        assert.throws(() => process.kill(children[0].pid, 0), error => error.code === 'ESRCH')
      } finally {
        childProcess.spawn = originalSpawn; syncBuiltinESMExports()
        f.config.packingVideoProbePath = original
        if (previous) globalThis.useRuntimeConfig = previous
        else delete globalThis.useRuntimeConfig
      }
    })
    await run('changed order state or mismatched session binding cannot create ready evidence', async () => {
      const pack = await f.newPack(1), prepared = await prepare(f, pack, details(webm))
      f.controls.beforeFinish = () => f.db.query("update public.customer_orders set status='cancelled' where id=$1", [pack.order])
      assert.equal((await upload(f, prepared, webm)).response.status, 409)
      assert.equal((await stored(f, pack)).status, 'uploading')
      await f.db.query("update public.customer_orders set status='processing' where id=$1", [pack.order])
      assert.equal((await f.call(pack.path + '/video-complete', { method: 'POST' })).response.status, 200)
      const other = (await f.call('/api/admin-orders/packing/work-session', { actor: 'owner', method: 'POST', body: {} })).body.workSession.id
      await f.db.query('update public.order_packing_videos set work_session_id=$1 where packing_session_id=$2', [other, pack.session.id])
      assert.equal((await f.call(pack.path + '/video')).response.status, 409)
      await f.db.query('update public.order_packing_videos set work_session_id=$1 where packing_session_id=$2', [pack.session.work_session_id, pack.session.id])
      await chmod(f.config.packingVideosDir, 0o755)
      assert.equal((await f.call(pack.path + '/video')).response.status, 503)
      await chmod(f.config.packingVideosDir, 0o700)
    })
    await run('release or work-session closure retires interrupted uploads without bypassing scan guards', async () => {
      let pack = await f.newPack(1), prepared = await prepare(f, pack, details(webm))
      assert.equal((await f.call(pack.path + '/release', { method: 'POST' })).response.status, 200)
      assert.equal((await stored(f, pack)).status, 'failed')
      assert.equal((await upload(f, prepared, webm)).response.status, 409)
      pack = await f.newPack(1); prepared = await prepare(f, pack, details(webm))
      await closeWork(f)
      assert.equal((await stored(f, pack)).status, 'failed')
      assert.equal((await f.call(pack.path + '/video-complete', { method: 'POST' })).response.status, 409)
    })
    await run('missing, tampered and linked files block retrieval and completion', async () => {
      const pack = await f.newPack(1); await f.scan(pack)
      const prepared = await prepare(f, pack, details(webm)); assert.equal((await upload(f, prepared, webm)).response.status, 200)
      const video = await stored(f, pack), path = join(f.config.packingVideosDir, video.storage_path), backup = path + '.held'
      await rename(path, backup)
      assert.equal((await f.call(pack.path + '/video')).response.status, 409)
      assert.equal((await f.call(pack.path + '/complete', { method: 'POST', body: {} })).response.status, 409)
      await symlink(backup, path)
      assert.ok([409, 503].includes((await f.call(pack.path + '/video')).response.status))
      await unlink(path); await link(backup, path)
      assert.equal((await f.call(pack.path + '/video')).response.status, 503)
      await unlink(path); await rename(backup, path)
      const modified = Buffer.from(webm); modified[modified.length - 1] ^= 1
      await writeFile(path, modified, { mode: 0o600 })
      assert.equal((await f.call(pack.path + '/video')).response.status, 409)
      assert.equal((await f.call(pack.path + '/complete', { method: 'POST', body: {} })).response.status, 409)
      await writeFile(path, webm, { mode: 0o600 })
      assert.equal((await f.call(pack.path + '/video')).response.status, 200)
    })
    await run('authorized ranges work; public routes never expose video bytes', async () => {
      const pack = await f.newPack(1), prepared = await prepare(f, pack, details(webm))
      assert.equal((await upload(f, prepared, webm)).response.status, 200)
      const partial = await f.call(pack.path + '/video', { headers: { Range: 'bytes=0-31' } })
      assert.equal(partial.response.status, 206); assert.deepEqual(partial.body, webm.subarray(0, 32))
      assert.equal((await f.call(pack.path + '/video', { headers: { Range: 'bytes=99999999-' } })).response.status, 416)
      assert.equal((await f.call(pack.path + '/video', { headers: { Range: 'bytes=0-1,4-6' } })).response.status, 416)
      const video = await stored(f, pack)
      for (const path of ['/uploads/' + video.storage_path, '/' + video.storage_path, '/packing-videos/' + video.upload_id + '.webm']) assert.equal((await f.call(path, { actor: null })).response.status, 404)
      assert.deepEqual(await files(f.config.uploadsDir), [])
    })
    await run('storage roots are configurable and symlink/public-root aliases fail closed', async () => {
      const original = f.config.packingVideosDir, other = join(f.directory, 'private-b')
      f.config.packingVideosDir = other
      const pack = await f.newPack(1), prepared = await prepare(f, pack, details(webm))
      assert.equal((await upload(f, prepared, webm)).response.status, 200)
      const saved = await stored(f, pack); await access(join(other, saved.storage_path))
      f.config.packingVideosDir = original
      assert.equal((await f.call(pack.path + '/video')).response.status, 409)
      const alias = join(f.directory, 'private-alias'); await symlink(other, alias)
      f.config.packingVideosDir = alias
      assert.equal((await f.call(pack.path + '/video')).response.status, 503)
      f.config.packingVideosDir = original
    })
    await run('browser roles and direct service writes cannot forge video evidence', async () => {
      for (const role of ['anon', 'authenticated', 'service_role']) {
        const privileges = (await f.db.query("select has_function_privilege($1,'public.packing_video_prepare(uuid,uuid,text,bigint,timestamptz,timestamptz)','EXECUTE') prepare,has_function_privilege($1,'private.packing_video_authorize(uuid,uuid)','EXECUTE') helper,has_table_privilege($1,'public.order_packing_videos','INSERT') insert,has_table_privilege($1,'public.order_packing_videos','UPDATE') update", [role])).rows[0]
        assert.deepEqual(privileges, { prepare: role === 'service_role', helper: false, insert: false, update: false })
      }
      assert.equal(f.controls.storageCalls, 0)
      assert.equal((await f.db.query('select count(*)::int n from storage.objects')).rows[0].n, 0)
      assert.equal((await f.db.query('select count(*)::int n from public.shipping_order_jobs')).rows[0].n, 0)
    })
    await t.test('reset keeps dependency guards and captures/checkpoints private VPS keys', async () => {
      // Exercise real reset SQL without invoking production password/Auth services.
      // Each preview runs in a rollback on the owned fixture connection.
      const all = (await f.db.query("select storage_path from public.order_packing_videos where storage_backend='vps' order by storage_path")).rows.map(row => row.storage_path)
      assert.ok(all.length > 0)
      for (const scope of ['orders', 'commerce', 'full']) {
        const plan = (await f.db.query('select public.system_reset_plan($1,$2) value', [f.actors.owner, scope])).rows[0].value
        assert.equal(plan.blockers.some(blocker => blocker.table === 'order_packing_videos'), false)
        if (plan.blockers.length) await assert.rejects(() => f.db.query('select public.system_reset_begin($1,$2,$3)', [f.actors.owner, scope, randomUUID()]), /Linked records prevent/)
        await f.db.exec('begin')
        try {
          // Capture-only trigger proof for a scope whose legitimate inventory
          // dependencies prevent erasure. The transaction is always rolled back.
          const run = plan.blockers.length ? (await f.db.query("insert into public.system_reset_runs(id,owner_id,scope,status,actor,summary,manifest) values($1,$2,$3,'cleanup_pending','{}','{}','{\"format\":2}') returning to_jsonb(system_reset_runs) value", [randomUUID(), f.actors.owner, scope])).rows[0].value
            : (await f.db.query('select public.system_reset_begin($1,$2,$3) value', [f.actors.owner, scope, randomUUID()])).rows[0].value
          assert.deepEqual([...run.manifest.packing].sort(), all)
        } finally { await f.db.exec('rollback') }
      }
      const before = await files(f.config.packingVideosDir)
      assert.ok(before.length > 0)
      const run = await f.client.rpc('system_reset_begin', { p_owner: f.actors.owner, p_scope: 'full', p_id: randomUUID() })
      assert.equal(run.error, null, JSON.stringify(run.error))
      const previous = globalThis.useRuntimeConfig
      globalThis.useRuntimeConfig = () => f.config
      try {
        const result = await finishResetCleanup({ supabaseAdmin: f.client, run: run.data, ownerId: f.actors.owner, uploadsRoot: f.config.uploadsDir })
        assert.equal(result.status, 'completed')
        assert.deepEqual(await files(f.config.packingVideosDir), [])
        assert.equal(f.controls.storageCalls, 0)
      } finally {
        if (previous) globalThis.useRuntimeConfig = previous
        else delete globalThis.useRuntimeConfig
      }
    })
  } finally { await f.close() }
})

test('migration84 preserves historical evidence but requires VPS evidence for new completion', { skip: !emailNativeAvailable, timeout: 60000 }, async () => {
  const f = await createPrivatePackingFixture({ stopBefore: migration })
  try {
    const bytes = await generatedVideo(f.directory), pack = await f.newPack(1)
    await f.scan(pack)
    const before = await financial(f, pack)
    assert.equal((await f.call(pack.path + '/video-upload', { method: 'POST', body: details(bytes) })).response.status, 503)
    await f.db.query("insert into public.order_packing_videos(packing_session_id,work_session_id,order_id,recorded_by,storage_path,file_name,mime_type,size_bytes,status,recording_started_at,recording_ended_at,uploaded_at) values($1,$2,$3,$4,'old-private-key.webm','old.webm','video/webm',17,'ready',now()-interval '1 minute',now()+interval '1 minute',now())", [pack.session.id, pack.session.work_session_id, pack.order, f.actors.editor])
    await f.db.exec(await readFile(new URL('../supabase/migrations/' + migration, import.meta.url), 'utf8'))
    const legacy = await stored(f, pack)
    assert.equal(legacy.storage_backend, 'supabase'); assert.equal(legacy.sha256, null); assert.equal(legacy.storage_path, 'old-private-key.webm')
    assert.equal((await f.call(pack.path + '/video')).response.status, 409)
    const denied = await f.client.rpc('complete_order_packing_session', { p_session_id: pack.session.id, p_admin_user_id: f.actors.editor })
    assert.match(denied.error.message, /private VPS video/)
    assert.equal((await f.call(pack.path + '/video-upload', { method: 'POST', body: details(bytes) })).response.status, 409)
    assert.deepEqual(await stored(f, pack), legacy)
    await f.call(pack.path + '/release', { method: 'POST' })
    const replacement = await f.claimOrder(pack.order)
    await f.scan(replacement)
    const prepared = await prepare(f, replacement, details(bytes))
    assert.equal((await upload(f, prepared, bytes)).response.status, 200)
    assert.equal((await f.call(replacement.path + '/complete', { method: 'POST', body: {} })).response.status, 200)
    assert.deepEqual(await stored(f, pack), legacy)
    assert.deepEqual(await financial(f, pack), before)
    assert.equal(f.controls.storageCalls, 0)
  } finally { await f.close() }
})
