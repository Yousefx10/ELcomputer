import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, access } from 'node:fs/promises'
import { join } from 'node:path'
import { createPrivatePackingFixture } from './helpers/privatePackingFixture.mjs'
import { emailNativeAvailable } from './helpers/emailNativeDatabase.mjs'
import { isPackingWorkSessionStale, PACKING_STALE_MS } from '../server/utils/packingPresence.js'

const hasFfmpeg = await promisify(execFile)('ffmpeg', ['-version']).then(() => true, () => false)
const WORK = '/api/admin-orders/packing/work-session'
const generatedVideo = async directory => {
  const path = join(directory, randomUUID() + '.webm')
  await promisify(execFile)('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:size=64x64:rate=10', '-t', '6', '-an', '-c:v', 'libvpx', path], { timeout: 15000 })
  return readFile(path)
}
const closeWork = async f => { for (const actor of ['editor', 'owner']) await f.call(WORK, { actor, method: 'POST', body: { action: 'close' } }) }
// A tracked checkout is the fixture's only order path, so the order is switched without firing its stock guards.
const untrackedPack = (f, quantity) => f.newPack(quantity, 'editor', { beforePack: async id => {
  await f.db.exec('set session_replication_role=replica')
  try { await f.db.query("update public.customer_orders set stock_fulfillment_state='untracked' where id=$1", [id]) }
  finally { await f.db.exec('set session_replication_role=origin') }
} })
const finishWithVideo = async (f, pack, bytes) => {
  const start = Date.now() - 1000
  const prepared = await f.call(pack.path + '/video-upload', { actor: pack.actor, method: 'POST', body: { mimeType: 'video/webm', sizeBytes: bytes.length, durationSeconds: 6, recordingStartedAt: new Date(start).toISOString(), recordingEndedAt: new Date(start + 6000).toISOString() } })
  assert.equal(prepared.response.status, 200, JSON.stringify(prepared.body))
  const put = await f.call(prepared.body.upload.url, { actor: pack.actor, method: 'PUT', body: bytes, raw: true, headers: { 'Content-Type': 'video/webm' } })
  assert.equal(put.response.status, 200, JSON.stringify(put.body))
  const done = await f.call(pack.path + '/complete', { actor: pack.actor, method: 'POST', body: {} })
  assert.equal(done.response.status, 200, JSON.stringify(done.body))
}

test('a session is stale only after several missed reports', () => {
  const now = Date.now()
  assert.equal(isPackingWorkSessionStale({ status: 'active', last_seen_at: new Date(now - 30000).toISOString() }, now), false)
  assert.equal(isPackingWorkSessionStale({ status: 'active', last_seen_at: new Date(now - PACKING_STALE_MS - 1000).toISOString() }, now), true)
  assert.equal(isPackingWorkSessionStale({ status: 'closed', last_seen_at: new Date(now).toISOString() }, now), true)
  assert.equal(isPackingWorkSessionStale(null, now), true)
})

test('the order page shows information only and bills use allowed routes', async () => {
  const dialog = await readFile('app/components/dashboard/OrderDetailsDialog.vue', 'utf8')
  for (const removed of ["$t('common.updateStatus')", 'runCourierAction', 'recordManualAwb', "$t('pdcParcel.weight')", 'ShippingLabelPreview']) assert.ok(!dialog.includes(removed), removed)
  assert.match(dialog, /openOrderPdf/)
  assert.match(await readFile('app/pages/account/orders/[id].vue', 'utf8'), /\?bill=1/)
  await assert.rejects(access('server/api/account/orders/[id]/bill.get.js'))
  assert.match(await readFile('server/api/account/orders/[id].get.js', 'utf8'), /getQuery\(event\)\.bill === '1'/)
  const page = await readFile('app/pages/dashboard/orders/confirm.vue', 'utf8')
  assert.doesNotMatch(page, /writePrintDocuments\(printWindow\)|completionStatus/, 'Finishing no longer prints the old sheet or asks for a status')
  assert.match(page, /heartbeat/); assert.match(page, /recoverInterruptedOrder/); assert.match(page, /parcelWeight/)
})

test('Confirm Orders workspace: hand checks, sessions, takeover, cancel and Documents', { skip: !emailNativeAvailable || !hasFfmpeg, timeout: 240000 }, async t => {
  const f = await createPrivatePackingFixture({ extraRoutes: [
    ['post', '/api/admin-orders/packing/:sessionId/cancel-order', '[sessionId]/cancel-order.post.js'],
    ['get', '/api/admin-orders/packing', 'index.get.js'],
    ['get', '/api/admin-documents/files/:id/download', '../../admin-documents/files/[id]/download.get.js'],
    ['delete', '/api/admin-documents/files/:id', '../../admin-documents/files/[id].delete.js']
  ] })
  const run = (name, action) => t.test(name, async () => { try { await action() } finally { await closeWork(f) } })
  try {
    const video = await generatedVideo(f.directory)
    const itemOf = async pack => (await f.db.query('select id from public.customer_order_items where order_id=$1', [pack.order])).rows[0].id
    await run('a hand check fills the line once, only on orders with no stock units', async () => {
      const pack = await untrackedPack(f, 2), itemId = await itemOf(pack)
      const checked = await f.call(pack.path + '/scan', { method: 'POST', body: { itemId } })
      assert.equal(checked.response.status, 200, JSON.stringify(checked.body)); assert.equal(checked.body.detail.progress.is_complete, true)
      assert.deepEqual((await f.db.query('select scan_type,count(*)::int n from public.order_packing_scans where session_id=$1 group by 1', [pack.session.id])).rows, [{ scan_type: 'checked', n: 2 }])
      assert.equal((await f.call(pack.path + '/scan', { method: 'POST', body: { itemId } })).response.status, 409)
      await f.call(pack.path + '/release', { method: 'POST' })
      const tracked = await f.newPack(1)
      assert.equal((await f.call(tracked.path + '/scan', { method: 'POST', body: { itemId: await itemOf(tracked) } })).response.status, 409)
      assert.equal(await f.db.query('select count(*)::int n from public.order_packing_scans where session_id=$1', [tracked.session.id]).then(r => r.rows[0].n), 0)
      await f.call(tracked.path + '/release', { method: 'POST' })
    })
    await run('one screen at a time: another screen must choose to take the session', async () => {
      const a = randomUUID(), b = randomUUID()
      const first = await f.call(WORK, { method: 'POST', body: { action: 'start', clientId: a } })
      assert.equal(first.response.status, 200, JSON.stringify(first.body))
      const second = await f.call(WORK, { method: 'POST', body: { action: 'start', clientId: b } })
      assert.equal(second.response.status, 409); assert.equal(second.body.data.code, 'open_elsewhere')
      assert.equal((await f.call(WORK, { method: 'POST', body: { action: 'start', clientId: a } })).response.status, 200, 'A reload keeps the same screen')
      assert.equal((await f.call(WORK, { method: 'POST', body: { action: 'start', clientId: b, force: true } })).response.status, 200)
      const old = await f.call(WORK, { method: 'POST', body: { action: 'heartbeat', clientId: a } })
      assert.equal(old.response.status, 409); assert.equal(old.body.data.code, 'moved')
      assert.equal((await f.call(WORK, { method: 'POST', body: { action: 'heartbeat', clientId: b } })).response.status, 200)
    })
    await run('another packer can take over only after the first screen stops reporting', async () => {
      const pack = await untrackedPack(f, 1)
      const work = await f.call(WORK, { actor: 'owner', method: 'POST', body: { action: 'start', clientId: randomUUID() } })
      const claim = takeover => f.call('/api/admin-orders/packing', { actor: 'owner', method: 'POST', body: { orderId: pack.order, workSessionId: work.body.workSession.id, cameraReady: true, cameraLabel: 'Owned', takeover } })
      assert.equal((await claim(false)).response.status, 409)
      assert.equal((await claim(true)).response.status, 409, 'A live screen cannot be displaced')
      assert.equal((await f.call('/api/admin-orders/packing?pageSize=50', { actor: 'owner' })).body.orders.find(o => o.id === pack.order).active_session.can_take_over, false)
      await f.db.query("update public.order_packing_work_sessions set last_seen_at=now()-interval '10 minutes' where id=$1", [pack.session.work_session_id])
      assert.equal((await f.call('/api/admin-orders/packing?pageSize=50', { actor: 'owner' })).body.orders.find(o => o.id === pack.order).active_session.can_take_over, true)
      const taken = await claim(true)
      assert.equal(taken.response.status, 200, JSON.stringify(taken.body))
      assert.equal((await f.db.query('select status from public.order_packing_sessions where id=$1', [pack.session.id])).rows[0].status, 'cancelled')
      await f.call('/api/admin-orders/packing/' + taken.body.session.id + '/release', { actor: 'owner', method: 'POST' })
    })
    await run('Cancel order closes the session and cancels only a waiting order', async () => {
      const pack = await f.newPack(1)
      const cancelled = await f.call(pack.path + '/cancel-order', { method: 'POST', body: { reason: 'Customer asked' } })
      assert.equal(cancelled.response.status, 200, JSON.stringify(cancelled.body)); assert.equal(cancelled.body.order.status, 'cancelled')
      assert.equal((await f.db.query('select status from public.order_packing_sessions where id=$1', [pack.session.id])).rows[0].status, 'cancelled')
      assert.equal((await f.call(pack.path + '/cancel-order', { method: 'POST', body: {} })).response.status, 409)
    })
    await run('a finished video appears once in Documents under date and packer, and stays read-only', async () => {
      const pack = await untrackedPack(f, 1)
      await f.call(pack.path + '/scan', { method: 'POST', body: { itemId: await itemOf(pack) } })
      await finishWithVideo(f, pack, video)
      const row = (await f.db.query(`select d.id,d.name,d.mime_type,person.name person,person.is_system,day.name day_name,root.name root_name from public.documents d join public.order_packing_videos v on v.id=d.packing_video_id
       join public.document_folders person on person.id=d.folder_id join public.document_folders day on day.id=person.parent_id join public.document_folders root on root.id=day.parent_id where v.packing_session_id=$1`, [pack.session.id])).rows
      assert.equal(row.length, 1); assert.equal(row[0].root_name, 'Packing videos'); assert.match(row[0].day_name, /^\d{4}-\d{2}-\d{2}$/); assert.equal(row[0].is_system, true)
      assert.match(row[0].name, new RegExp('^' + row[0].person + ' - .+\\.webm$')); assert.equal(row[0].mime_type, 'video/webm')
      await f.db.query('select private.publish_packing_video($1)', [pack.session.id])
      assert.equal((await f.db.query('select count(*)::int n from public.documents where packing_video_id is not null and name=$1', [row[0].name])).rows[0].n, 1, 'Publishing is idempotent')
      const download = await f.call('/api/admin-documents/files/' + row[0].id + '/download', { actor: 'owner' })
      assert.equal(download.response.status, 200); assert.deepEqual(download.body, video)
      assert.equal((await f.call('/api/admin-documents/files/' + row[0].id, { actor: 'owner', method: 'DELETE' })).response.status, 403)
      const confirmed = await f.call('/api/admin-orders/packing?view=confirmed&pageSize=20', { actor: 'owner' })
      assert.ok(confirmed.body.orders.some(o => o.session_id === pack.session.id && o.order_id === pack.order))
    })
  } finally { await f.close() }
})
