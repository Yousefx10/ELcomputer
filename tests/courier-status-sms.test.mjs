import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { normalizeAwb, normalizeOrderNumber } from '../server/utils/publicTracking.js'
import { renderOrderSms } from '../server/utils/sms/orderEvents.js'
import { pdcEventKey } from '../server/utils/pdcTracking.js'
import { emailNativeAvailable } from './helpers/emailNativeDatabase.mjs'

// Owner request 8 Nov 2026: track by order number; courier name from the Dashboard; order status follows the courier.
test('order numbers are read with or without the ORD prefix and never as an AWB', () => {
  assert.equal(normalizeOrderNumber('ORD-20261107-E7663BB340'), 'ORD-20261107-E7663BB340')
  assert.equal(normalizeOrderNumber(' 20261107-e7663bb340 '), 'ORD-20261107-E7663BB340')
  for (const bad of ['E7663BB3D0', '2026-E7663BB340', 'ORD-20261107-', 'ORD-20261107-E7663BB340; drop', null, {}]) assert.equal(normalizeOrderNumber(bad), null, String(bad))
  assert.equal(normalizeAwb('E7663BB3D0'), 'E7663BB3D0')
})
test('the track page and SMS use the Dashboard courier name', async () => {
  const page = await readFile('app/pages/track.vue', 'utf8')
  assert.doesNotMatch(page, />PDC ·/); assert.match(page, /courierName/); assert.match(page, /query: \{ q: number \}/)
  const account = await readFile('app/pages/account/orders/[id].vue', 'utf8')
  assert.doesNotMatch(account, />PDC</)
  const text = renderOrderSms({ event_type: 'pdc_delivered', locale: 'en', template_text: '{{courier_name}} delivered order {{order_number}}.', payload: { order_number: 'ORD-1', awb: 'A1', courier_name: 'Fast Shipping' } })
  assert.equal(text, 'Fast Shipping delivered order ORD-1.')
})
test('the bill logo is an upload field limited to PDF-safe types', async () => {
  const settings = await readFile('app/pages/dashboard/settings.vue', 'utf8')
  assert.doesNotMatch(settings, /v-model="siteSettings\.bill_design\.logo_url" type="text"/)
  assert.match(settings, /DashboardMediaUploadField v-model="siteSettings\.bill_design\.logo_url"[^>]*:extensions="\['png', 'jpg', 'jpeg'\]"/)
})

test('native: courier updates move orders forward only, and courier SMS use the Dashboard name', { skip: !emailNativeAvailable, timeout: 240000 }, async t => {
  const { createResetDatabase } = await import('./helpers/resetDatabase.mjs')
  const db = await createResetDatabase()
  const sql = (text, args = []) => db.query(text, args)
  const user = randomUUID()
  const make = async (status = 'processing') => {
    const order = randomUUID(), job = randomUUID(), ref = 'ORD-20261108-' + randomUUID().slice(0, 10).toUpperCase(), awb = 'AWB' + randomUUID().slice(0, 8).toUpperCase()
    await db.exec('alter table public.customer_orders disable trigger user')
    await sql("insert into public.customer_orders(id,user_id,order_number,status,payment_method,payment_status,first_name,phone,street_address,city,governorate) values($1,$2,$3,$4,'cash','pending','Fixture','01000000000','Street','City','Cairo')", [order, user, ref, status])
    await db.exec('alter table public.customer_orders enable trigger user')
    await sql("insert into public.shipping_order_jobs(id,order_id,to_ref,awb,state,awb_verified_at,provider_identity) values($1,$2,$3,$4,'ready',now()-interval '1 hour',jsonb_build_object('api_mode','production'))", [job, order, ref, awb])
    await sql("insert into private.pdc_dispatches(job_id,order_id,to_ref,token,state,awb) values($1,$2,$3,$4,'created',$5)", [job, order, ref, randomUUID(), awb])
    return { order, job, ref, awb }
  }
  const status = async s => (await sql('select status from public.customer_orders where id=$1', [s.order])).rows[0].status
  let tick = 0
  const send = async (s, status_id, status_name, offsetMs = 0) => {
    const data = { awb: s.awb, ref: s.ref, status_id, status_name, reason: '', status_date: new Date(Date.now() + offsetMs + (++tick) * 1000).toISOString(), source: 'webhook' }
    return (await sql('select public.shipping_record_pdc_event($1::jsonb) result', [JSON.stringify({ ...data, event_key: pdcEventKey(data) })])).rows[0].result
  }
  const IN_TRANSIT = [2, 'In Transit'], OFD = [4, 'Out For Delivery'], DELIVERED = [5, 'Delivered']
  try {
    await sql("insert into auth.users(id,email) values($1,'courier-status@example.invalid')", [user])
    await db.exec("set request.jwt.claim.role='service_role'")
    await sql("update public.shipping_provider_settings set display_name='Fast Shipping' where id='pdc'")
    // In production capture started weeks ago; this keeps the age checks meaningful in a fresh database.
    await sql("update public.sms_order_event_settings set capture_started_at=now()-interval '2 days'")
    await t.test('off by default: tracking updates leave the status alone', async () => {
      assert.equal((await sql("select status_follows_courier v from public.commerce_order_flow_settings where id='default'")).rows[0].v, false)
      const s = await make(); await send(s, ...IN_TRANSIT); assert.equal(await status(s), 'processing')
    })
    await sql("update public.commerce_order_flow_settings set status_follows_courier=true where id='default'")
    await t.test('on: being shipped, out for delivery, completed', async () => {
      const s = await make('ready_to_deliver')
      await send(s, ...IN_TRANSIT); assert.equal(await status(s), 'being_shipped')
      await send(s, ...OFD); assert.equal(await status(s), 'out_for_delivery')
      await send(s, ...DELIVERED); assert.equal(await status(s), 'completed')
    })
    await t.test('never moves backward or overrides on hold, cancelled or refunded', async () => {
      const done = await make('completed'); await send(done, ...IN_TRANSIT); assert.equal(await status(done), 'completed')
      for (const held of ['on_hold', 'cancelled', 'refunded', 'pending_payment']) { const s = await make(held); await send(s, ...DELIVERED); assert.equal(await status(s), held) }
      const s = await make('out_for_delivery'); await send(s, ...IN_TRANSIT); assert.equal(await status(s), 'out_for_delivery')
    })
    await t.test('courier SMS intent carries the Dashboard name and a window that survives polling', async () => {
      const s = await make(); await send(s, ...OFD, -20 * 60000)
      const row = (await sql("select payload->>'courier_name' courier,extract(epoch from expires_at-now())::int left_s from public.sms_order_events where order_id=$1 and event_type='pdc_out_for_delivery'", [s.order])).rows[0]
      assert.equal(row.courier, 'Fast Shipping'); assert.ok(row.left_s > 10000 && row.left_s <= 10800, String(row.left_s))
    })
    await t.test('news older than six hours is not sent', async () => {
      const s = await make(); await send(s, ...OFD, -7 * 3600000)
      assert.equal((await sql('select count(*)::int n from public.sms_order_events where order_id=$1', [s.order])).rows[0].n, 0)
    })
    await t.test('polled updates have no event time: they send using the time first seen', async () => {
      const s = await make()
      const data = { awb: s.awb, ref: s.ref, status_id: OFD[0], status_name: OFD[1], reason: '', status_date: null, source: 'reconciliation', observed_at: new Date().toISOString() }
      await sql('select public.shipping_record_pdc_event($1::jsonb) r', [JSON.stringify({ ...data, event_key: pdcEventKey(data) })])
      const row = (await sql("select provider_event_at,reason from public.sms_order_events where order_id=$1 and event_type='pdc_out_for_delivery'", [s.order])).rows[0]
      assert.ok(row.provider_event_at); assert.notEqual(row.reason, 'event_time_unknown')
    })
    await t.test('a polled update after six hours without tracking is not sent', async () => {
      const s = await make()
      await sql("update public.shipping_order_jobs set tracking_success_at=now()-interval '7 hours',awb_verified_at=now()-interval '2 days' where id=$1", [s.job])
      const data = { awb: s.awb, ref: s.ref, status_id: OFD[0], status_name: OFD[1], reason: '', status_date: null, source: 'reconciliation', observed_at: new Date().toISOString() }
      await sql('select public.shipping_record_pdc_event($1::jsonb) r', [JSON.stringify({ ...data, event_key: pdcEventKey(data) })])
      assert.equal((await sql('select count(*)::int n from public.sms_order_events where order_id=$1', [s.order])).rows[0].n, 0)
    })
    await t.test('an order-level check ignores the schedule but keeps the 5-minute limit', async () => {
      const s = await make()
      await sql("update public.shipping_order_jobs set tracking_next_at=now()+interval '1 hour',tracking_checked_at=now()-interval '10 minutes' where id=$1", [s.job])
      const claim = async id => (await sql('select public.shipping_claim_pdc_tracking($1) j', [id])).rows[0].j
      await sql("update public.shipping_provider_settings set is_enabled=true,api_mode='production',tracking_policy=tracking_policy||'{\"enabled\":true}'::jsonb,tracking_request_times='{}' where id='pdc'")
      await sql("update public.shipping_order_jobs j set provider_identity=jsonb_build_object('base_url',s.base_url,'api_mode',s.api_mode,'company_id',s.company_id) from public.shipping_provider_settings s where s.id='pdc' and j.id=$1", [s.job])
      assert.ok((await claim(s.order)).job_id)
      await sql('update public.shipping_order_jobs set tracking_token=null,tracking_lease_until=null where id=$1', [s.job])
      assert.equal((await claim(s.order)).error, 'not_due_or_ineligible')
    })
    await t.test('default templates name the courier through the variable', async () => {
      const rows = (await sql("select code,text_en,text_ar from public.sms_templates where code like 'pdc_%'")).rows
      assert.equal(rows.length, 3)
      for (const row of rows) { assert.match(row.text_en, /\{\{courier_name\}\}/); assert.match(row.text_ar, /\{\{courier_name\}\}/); assert.doesNotMatch(row.text_en + row.text_ar, /PDC/) }
    })
    await t.test('the old four-argument save still works during the release', async () => {
      const admin = randomUUID()
      await sql("insert into auth.users(id,email) values($1,'owner-flow@example.invalid')", [admin])
      await db.exec('alter table public.admin_users disable trigger user')
      await sql("insert into public.admin_users(id,email,full_name,role,is_active) values($1,'owner-flow@example.invalid','Owner','owner',true)", [admin])
      await db.exec('alter table public.admin_users enable trigger user')
      const r = (await sql("select public.order_flow_save(p_admin=>$1,p_paid=>'review',p_cod=>'review',p_weight=>1) j", [admin])).rows[0].j
      assert.equal(r.status_follows_courier, true)
      const off = (await sql("select public.order_flow_save(p_admin=>$1,p_paid=>'review',p_cod=>'review',p_weight=>1,p_status_follows=>false) j", [admin])).rows[0].j
      assert.equal(off.status_follows_courier, false)
    })
  } finally { await db.close?.(); await db.end?.() }
})

test('opening an order refreshes through the route the proxy already allows', async () => {
  const api = await readFile('server/api/account/orders/[id].get.js', 'utf8'), page = await readFile('app/pages/account/orders/[id].vue', 'utf8')
  assert.match(api, /getQuery\(event\)\.refresh === '1'/); assert.match(api, /processPdcTracking\(\{ db: supabaseAdmin, orderId: order\.id \}\)/)
  assert.ok(api.indexOf('Order not found.\' })\n\n  // Opening') > 0, 'ownership is established before the courier is asked')
  assert.match(page, /\?refresh=1/); assert.match(page, /load\(true, true\)/)
})

test('imported SKUs with literal quotes still match Daftra codes', async () => {
  const { codeKey } = await import('../server/utils/daftraLinks.js')
  assert.equal(codeKey('"7727500558378"'), codeKey('7727500558378'))
})
