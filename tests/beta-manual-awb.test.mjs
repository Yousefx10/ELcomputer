import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createPrivatePackingFixture } from './helpers/privatePackingFixture.mjs'
import { emailNativeAvailable } from './helpers/emailNativeDatabase.mjs'

test('manual PDC AWBs require real packing, paid stock and RBAC; original barriers survive', { skip: !emailNativeAvailable, timeout: 90000 }, async () => {
  const f = await createPrivatePackingFixture({ extraRoutes: [['post', '/api/admin-shipping/orders/:id/manual-awb', '../../admin-shipping/orders/[id]/manual-awb.post.js']] })
  const rpc = async (name, args) => { const r = await f.client.rpc(name, args); assert.equal(r.error, null, JSON.stringify(r.error)); return r.data }
  try {
    await f.db.query("update public.site_settings set payment_card_enabled=true where key='default'")
    await f.db.query("update public.shipping_provider_settings set is_enabled=true,auto_create_labels=false,company_id='123',product_id=40,origin_city_id=999991,origin_address='Fixture origin',origin_phone='01000000000',origin_contact_name='Fixture',cities_cache='[{\"id\":999991},{\"id\":999992}]',products_cache='[{\"id\":40}]',access_token_encrypted='v1.fixture',webhook_secret_encrypted='v1.fixture' where id='pdc'")
    await f.db.query("delete from public.shipping_city_mappings;insert into public.shipping_city_mappings(provider_city_id,governorate,city) values(999992,'Cairo','Fixture city');update public.commerce_shipping_companies set provider='pdc'")
    const pack = await f.newPack(1, 'editor', { paymentMethod: 'card', beforePack: async orderId => {
      const claimed = await rpc('commerce_claim_payment_attempt', { p_order_id: orderId, p_user_id: f.actors.customer, p_mode: 'live', p_integration_id: 12345 })
      await rpc('commerce_store_payment_intention', { p_attempt_id: claimed.attempt.id, p_intention_id: 'pi_live_' + randomUUID(), p_provider_order_id: '960001', p_client_secret: 'egy_csk_live_fixture_manual' })
      await rpc('commerce_reconcile_payment_transaction', { p_transaction: { provider_order_id: '960001', transaction_id: '960002', mode: 'live', integration_id: 12345, amount_minor: Number(claimed.attempt.amount_minor), currency: 'EGP', status: 'succeeded' } })
    } })
    const route = `/api/admin-shipping/orders/${pack.order}/manual-awb`, body = { awb: 'FIXTURE-ACTUAL-AWB', confirmed: true }
    assert.equal((await f.call(route, { actor: 'owner', method: 'POST', body })).response.status, 409)
    await f.scan(pack)
    const file = join(f.directory, 'manual-fixture.webm')
    await promisify(execFile)('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:size=64x64:rate=10', '-t', '6', '-an', '-c:v', 'libvpx', file], { timeout: 15000 })
    const video = await readFile(file), start = Date.now() - 1000
    const prepared = await f.call(pack.path + '/video-upload', { method: 'POST', body: { mimeType: 'video/webm', sizeBytes: video.length, recordingStartedAt: new Date(start).toISOString(), recordingEndedAt: new Date(start + 6000).toISOString() } })
    assert.equal(prepared.response.status, 200, JSON.stringify(prepared.body))
    const upload = await f.call(prepared.body.upload.url, { method: 'PUT', body: video, raw: true, headers: { 'content-type': 'video/webm' } })
    assert.equal(upload.response.status, 200, JSON.stringify(upload.body))
    const complete = await f.call(pack.path + '/complete', { method: 'POST', body: {} })
    assert.equal(complete.response.status, 200, JSON.stringify(complete.body))
    for (const actor of [null, 'customer', 'viewer', 'disabled']) assert.equal((await f.call(route, { actor, method: 'POST', body })).response.status, actor ? 403 : 401)
    assert.equal((await f.call(route, { actor: 'owner', method: 'POST', body: { ...body, confirmed: false } })).response.status, 400)
    const recorded = await f.call(route, { actor: 'owner', method: 'POST', body })
    assert.equal(recorded.response.status, 200, JSON.stringify(recorded.body)); assert.equal(recorded.body.state, 'label_pending')
    assert.equal((await f.call(route, { actor: 'owner', method: 'POST', body })).response.status, 200)
    assert.equal((await f.db.query('select count(*)::int n from private.pdc_dispatches where order_id=$1', [pack.order])).rows[0].n, 1)
    assert.equal((await f.call(route, { actor: 'owner', method: 'POST', body: { ...body, awb: 'DIFFERENT-FIXTURE' } })).response.status, 409)
    await f.db.query("update public.shipping_order_jobs set awb=null,state='uncertain' where order_id=$1", [pack.order])
    assert.equal((await f.call(route, { actor: 'owner', method: 'POST', body })).response.status, 409)
    assert.equal(f.controls.storageCalls, 0)
  } finally { await f.close() }
})
