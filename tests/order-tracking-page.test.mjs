import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { trackOrdersTarget, trackOrdersLinkError, DEFAULT_TRACK_ORDERS_LINK } from '../app/utils/trackOrdersLink.js'
import { normalizeAwb, publicShipment } from '../server/utils/publicTracking.js'

// Owner request 7 Nov 2026 (phase 3A): public AWB tracking page; Dashboard sets the homepage link.
test('the Track your orders link accepts a store path or an https link, otherwise opens the tracking page', () => {
  for (const ok of ['/track', '/account/orders', '/p/delivery?x=1#top', 'https://example.com/track?awb=1']) assert.equal(trackOrdersLinkError(ok), null, ok)
  for (const bad of ['//evil.example', 'javascript:alert(1)', 'http://example.com', 'track', '/a b', 'https://user@example.com/', '/<x>']) {
    assert.equal(trackOrdersLinkError(bad), 'invalid', bad)
    assert.deepEqual(trackOrdersTarget(bad), { to: DEFAULT_TRACK_ORDERS_LINK, external: false })
  }
  assert.deepEqual(trackOrdersTarget(''), { to: '/track', external: false })
  assert.deepEqual(trackOrdersTarget(' https://example.com/t '), { to: 'https://example.com/t', external: true })
})

test('AWB input is normalized and bounded', () => {
  assert.equal(normalizeAwb(' edc17244218eg '), 'EDC17244218EG')
  for (const bad of ['', 'ab', "EDC1'; drop", 'A'.repeat(41), '-ABC1', null, { awb: 'X' }]) assert.equal(normalizeAwb(bad), null, String(bad))
})

test('the public view keeps courier states and times only', () => {
  const view = publicShipment({ provider: 'pdc', awb: 'EDC1', order_id: 'o', to_ref: 'ORD-1', source: 'reconciliation', current_state: 'picked_up', has_update: true,
    status_at: null, observed_at: '2026-11-07T10:00:00Z', reason_key: null, booked_at: '2026-11-07T09:00:00Z', latest_update_at: '2026-11-07T10:00:00Z', stale: false,
    booking_verified: true, last_success_at: 'x', events: [{ id: 'secret-id', state: 'picked_up', status_at: null, observed_at: '2026-11-07T10:00:00Z', source: 'reconciliation', reason_key: null }] })
  assert.deepEqual(Object.keys(view).sort(), ['awb', 'booked_at', 'current_state', 'events', 'has_update', 'latest_update_at', 'observed_at', 'reason_key', 'stale', 'status_at'])
  assert.deepEqual(Object.keys(view.events[0]).sort(), ['observed_at', 'reason_key', 'state', 'status_at'])
})

test('the page, homepage and endpoints keep the agreed boundaries', async () => {
  const [route, account, home, migration, page] = await Promise.all(['server/api/storefront/track.get.js', 'server/api/account/tracking.get.js', 'app/pages/index.vue',
    'supabase/migrations/20261108010000_order_tracking_page.sql', 'app/pages/track.vue'].map(f => readFile(f, 'utf8')))
  assert.match(route, /assertStoreAnalyticsRateLimit\(event, \{ scope: 'public-tracking', limit: 20/); assert.match(route, /X-Robots-Tag', 'noindex'/)
  assert.doesNotMatch(route, /fetch\(|pdcLookups|requestPdcLookup/, 'visitors never trigger a courier request')
  assert.match(account, /requireCustomerRequest/)
  assert.match(home, /trackOrdersTarget\(siteContent\.value\?\.settings\?\.track_orders_link\)/)
  assert.match(migration, /add column track_orders_link text not null default '\/track'/)
  assert.doesNotMatch(page, /order_number[^\n]*shipment\.awb|first_name|phone/, 'the public result shows no customer details')
})

test('native: an AWB shows its courier timeline; signed-in customers see open orders only', { timeout: 240000 }, async t => {
  const { emailNativeAvailable } = await import('./helpers/emailNativeDatabase.mjs')
  if (!emailNativeAvailable) return t.skip('native PostgreSQL is not configured')
  const { createPrivatePackingFixture } = await import('./helpers/privatePackingFixture.mjs')
  const { encryptShippingSecret } = await import('../server/utils/shippingSecrets.js')
  const { processPdcTracking, defaultTrackingPolicy } = await import('../server/utils/pdcTrackingPolling.js')
  const { readPublicShipment, readOpenOrderShipments } = await import('../server/utils/publicTracking.js')
  const f = await createPrivatePackingFixture({ extraRoutes: [['post', '/api/admin-shipping/orders/:id/manual-awb', resolve('server/api/admin-shipping/orders/[id]/manual-awb.post.js')]] })
  const previous = globalThis.useRuntimeConfig; globalThis.useRuntimeConfig = () => f.config
  Object.assign(f.config, { shippingCredentialsEncryptionKey: 'owned-local-only-shipping-encryption-key-32-characters', pdcTrackingRequestsEnabled: true, pdcTrackingWorkerEnabled: true })
  const originalRpc = f.client.rpc; f.client.rpc = (...args) => { const promise = originalRpc(...args); promise.abortSignal = () => promise; return promise }
  const q = (sql, args) => f.db.query(sql, args)
  const newOrder = async (method = 'cash', status = 'processing') => {
    const id = randomUUID()
    await q("insert into public.customer_orders(id,user_id,order_number,status,payment_method,first_name,phone,street_address,city,governorate,created_at) values($1,$2,$3,$4,$5,'Owned fixture','01000000000','Owned street','Cairo','Cairo',now()-interval '3 days')", [id, f.actors.customer, 'ORD-' + id.slice(0, 8), status, method])
    return id
  }
  const attach = async (order, awb) => {
    const r = await f.call(`/api/admin-shipping/orders/${order}/manual-awb`, { actor: 'owner', method: 'POST', body: { awb, confirmed: true } })
    assert.equal(r.response.status, 200, JSON.stringify(r.body))
    await q("update public.shipping_order_jobs set awb_verified_at=now()-interval '10 minutes' where order_id=$1", [order])
  }
  const track = async (order, awb, Status, StatusID) => {
    await q("update public.shipping_order_jobs set tracking_next_at=null,tracking_checked_at=now()-interval '10 minutes' where order_id=$1", [order])
    await q("update public.shipping_provider_settings set tracking_request_times='{}' where id='pdc'")
    return processPdcTracking({ db: f.client, orderId: order, fetcher: async () => Response.json([{ AWB: awb, Ref: 'PORTAL-REF', Status, StatusID }]) })
  }
  try {
    await q("update public.shipping_provider_settings set is_enabled=true,api_mode='production',company_id='123456',access_token_encrypted=$1,auto_create_labels=false,tracking_policy=$2,tracking_request_times='{}' where id='pdc'",
      [encryptShippingSecret('OWNED-LOCAL-TOKEN'), JSON.stringify({ ...defaultTrackingPolicy, enabled: true })])
    await q("update public.site_settings set payment_card_enabled=true where key='default'")
    const shipped = await newOrder(), waiting = await newOrder(), unpaidCard = await newOrder('card', 'pending_payment'), done = await newOrder()
    await attach(shipped, 'PORTALTRACK1'); await attach(done, 'PORTALTRACK2')
    assert.equal((await track(shipped, 'PORTALTRACK1', 'Collected', 12)).checked, 1)
    assert.equal((await track(done, 'PORTALTRACK2', 'Delivered', 5)).checked, 1)

    await t.test('anyone with the AWB sees courier states only', async () => {
      const view = await readPublicShipment(f.client, 'PORTALTRACK1')
      assert.equal(view.awb, 'PORTALTRACK1'); assert.equal(view.current_state, 'picked_up'); assert.equal(view.events.length, 1)
      assert.equal(JSON.stringify(view).includes(shipped), false, 'no order id'); assert.equal(JSON.stringify(view).includes('Owned'), false, 'no customer details')
      assert.equal(await readPublicShipment(f.client, 'NOSUCHAWB1'), null)
    })

    await t.test('the signed-in list holds undelivered orders and skips unpaid card attempts', async () => {
      const orders = await readOpenOrderShipments(f.client, f.actors.customer)
      const ids = orders.map(order => order.id)
      assert.ok(ids.includes(shipped)); assert.ok(ids.includes(waiting))
      assert.equal(ids.includes(unpaidCard), false); assert.equal(ids.includes(done), false, 'a delivered parcel is no longer open')
      assert.equal(orders.find(order => order.id === shipped).shipment.awb, 'PORTALTRACK1')
      assert.equal(orders.find(order => order.id === waiting).shipment, null)
      assert.deepEqual(await readOpenOrderShipments(f.client, randomUUID()), [])
    })

    await t.test('the database accepts only a store path or an https link', async () => {
      for (const ok of ['/track', '/account/orders', 'https://example.com/track']) await q("update public.site_settings set track_orders_link=$1 where key='default'", [ok])
      for (const bad of ['//evil.example', 'javascript:alert(1)', 'http://example.com', 'track']) await assert.rejects(() => q("update public.site_settings set track_orders_link=$1 where key='default'", [bad]), /site_settings_track_orders_link_check/, bad)
    })
  } finally { globalThis.useRuntimeConfig = previous; await f.close() }
})
