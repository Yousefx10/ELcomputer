import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { createPrivatePackingFixture } from './helpers/privatePackingFixture.mjs'
import { emailNativeAvailable } from './helpers/emailNativeDatabase.mjs'
import { encryptShippingSecret } from '../server/utils/shippingSecrets.js'
import { processPdcTracking, defaultTrackingPolicy } from '../server/utils/pdcTrackingPolling.js'

// Owner request 7 Nov 2026: real orders booked in the PDC portal must be trackable.
test('a PDC portal AWB attached to an open COD order is tracked by AWB', { skip: !emailNativeAvailable, timeout: 240000 }, async t => {
  const f = await createPrivatePackingFixture({ extraRoutes: [
    ['post', '/api/admin-shipping/orders/:id/manual-awb', resolve('server/api/admin-shipping/orders/[id]/manual-awb.post.js')],
    ['get', '/api/account/orders/:id', resolve('server/api/account/orders/[id].get.js')]] })
  const previous = globalThis.useRuntimeConfig; globalThis.useRuntimeConfig = () => f.config
  Object.assign(f.config, { shippingCredentialsEncryptionKey: 'owned-local-only-shipping-encryption-key-32-characters', pdcTrackingRequestsEnabled: true, pdcTrackingWorkerEnabled: true })
  const originalRpc = f.client.rpc; f.client.rpc = (...args) => { const promise = originalRpc(...args); promise.abortSignal = () => promise; return promise }
  const q = (sql, args) => f.db.query(sql, args)
  const newOrder = async (status = 'processing') => {
    const id = randomUUID()
    await q("insert into public.customer_orders(id,user_id,order_number,status,payment_method,first_name,phone,street_address,city,governorate,created_at) values($1,$2,$3,$4,'cash','Owned fixture','01000000000','Owned street','Cairo','Cairo',now()-interval '3 days')", [id, f.actors.customer, 'ORD-' + id.slice(0, 8), status])
    return id
  }
  const attach = (order, awb, actor = 'owner') => f.call(`/api/admin-shipping/orders/${order}/manual-awb`, { actor, method: 'POST', body: { awb, confirmed: true } })
  try {
    await q("update public.shipping_provider_settings set is_enabled=true,api_mode='production',company_id='123456',access_token_encrypted=$1,auto_create_labels=false,tracking_policy=$2,tracking_request_times='{}' where id='pdc'",
      [encryptShippingSecret('OWNED-LOCAL-TOKEN'), JSON.stringify({ ...defaultTrackingPolicy, enabled: true })])
    const order = await newOrder(), awb = 'PORTAL' + Date.now()

    await t.test('staff attach the portal AWB to an unpaid COD order', async () => {
      const r = await attach(order, awb)
      assert.equal(r.response.status, 200, JSON.stringify(r.body))
      assert.deepEqual([r.body.awb, r.body.state], [awb, 'label_pending'])
      assert.equal((await attach(order, awb)).response.status, 200, 'same AWB again is idempotent')
      assert.equal((await attach(order, awb + 'X')).response.status, 409, 'a second AWB is refused')
      assert.equal((await attach(await newOrder(), awb)).response.status, 409, 'an AWB belongs to one order')
      assert.equal((await attach(await newOrder('cancelled'), 'PORTAL-CANCELLED')).response.status, 409)
    })

    await t.test('the tracker matches PDC rows by AWB even when PDC holds another reference', async () => {
      await q("update public.shipping_order_jobs set awb_verified_at=now()-interval '10 minutes' where order_id=$1", [order])
      const calls = []
      const fetcher = async (url, options) => { calls.push(JSON.parse(options.body)); return Response.json([{ AWB: awb, Ref: 'PORTAL-REF-1', Status: 'Out For Delivery', StatusID: 4 }]) }
      const r = await processPdcTracking({ db: f.client, orderId: order, fetcher })
      assert.equal(r.checked, 1, JSON.stringify(r))
      assert.equal(calls.length, 1)
      assert.equal(calls[0].awBs, awb); assert.equal(calls[0].reFs, '')
      assert.equal((await q('select normalized_state from public.shipping_order_jobs where order_id=$1', [order])).rows[0].normalized_state, 'out_for_delivery')
    })

    await t.test('the customer sees the verified AWB on their order', async () => {
      const r = await f.call('/api/account/orders/' + order, { actor: 'customer' })
      assert.equal(r.response.status, 200, JSON.stringify(r.body))
      assert.equal(r.body.shipping.awb, awb); assert.equal(r.body.shipping.booking_verified, true)
    })
  } finally { globalThis.useRuntimeConfig = previous; await f.close() }
})
