import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pdcRejectionReason } from '../server/utils/pdcOrderShipping.js'
import { processAutoCourier } from '../server/utils/orderFlow.js'

// Owner request 7 Nov 2026: paid orders get their PDC AWB without a review step.
test('the order worker stays idle while courier booking is off on the server', async () => {
  const db = { rpc: async () => { throw new Error('no database call expected') } }
  assert.deepEqual(await processAutoCourier({ db, runtime: { shippingLiveRequestsEnabled: false, pdcManualCodEnabled: false } }),
    { active: false, booked: 0, waiting: 0, rejected: 0, uncertain: 0 })
})

test('a PDC rejection keeps a short reason without customer numbers', () => {
  const reason = pdcRejectionReason({ badResponses: [{ ref: 'ORD-1', errors: [{ message: 'Invalid receiver phone 01012345678' }, { errorMessage: 'City is required' }] }] })
  assert.equal(reason, 'Invalid receiver phone #; City is required')
  assert.equal(pdcRejectionReason({}), 'No reason given.')
})

test('migration only relaxes status and packing evidence for automatic orders', async () => {
  const sql = await readFile('supabase/migrations/20261107233000_order_flow_auto_courier.sql', 'utf8')
  assert.match(sql, /raise exception 'Courier eligibility anchors changed\.'/)
  assert.match(sql, /\(o\.status<>''ready_to_deliver'' and not private\.order_flow_auto\(o\)\)/)
  assert.match(sql, /if not private\.order_flow_auto\(o\) and not exists\(select 1 from public\.order_packing_sessions/)
  assert.match(sql, /paid_orders text not null default 'review'/); assert.match(sql, /cod_orders text not null default 'review'/)
})

test('automatic paid orders book PDC at the default weight; rejections free the order', { timeout: 300000 }, async t => {
  const { emailNativeAvailable } = await import('./helpers/emailNativeDatabase.mjs')
  if (!emailNativeAvailable) return t.skip('native PostgreSQL is not configured')
  const { createPrivatePackingFixture } = await import('./helpers/privatePackingFixture.mjs')
  const { encryptShippingSecret } = await import('../server/utils/shippingSecrets.js')
  const { shippingLabelFixture } = await import('./helpers/shippingLabelFixture.mjs')
  const f = await createPrivatePackingFixture()
  const previous = globalThis.useRuntimeConfig; globalThis.useRuntimeConfig = () => f.config
  Object.assign(f.config, { shippingLiveRequestsEnabled: false, pdcManualCodEnabled: true, shippingDocumentsDir: join(f.directory, 'private-documents'), shippingCredentialsEncryptionKey: 'owned-isolated-shipping-key-over-32-characters' })
  const q = (sql, args) => f.db.query(sql, args)
  let mode = 'created'; const posts = []
  const fetcher = async (url, options) => {
    const body = JSON.parse(options.body)
    if (String(url).endsWith('/SaveShipmentEx')) {
      posts.push(body.shipments[0])
      if (mode === 'rejected') return Response.json({ generalResponse: { success: false, summary: { totalShipments: 1, invalidShipments: 1 } }, successResponses: [], badResponses: [{ ref: body.shipments[0].toRef, errors: [{ message: 'Receiver phone 01099999999 is invalid' }] }] })
      return Response.json({ generalResponse: { success: true }, successResponses: [{ success: true, ref: body.shipments[0].toRef, awb: 'AUTO-' + posts.length }] })
    }
    if (String(url).endsWith('/ExportPDF')) {
      const saved = (await q('select to_ref from public.shipping_order_jobs where awb=$1', [body.awBs[0]])).rows[0]
      return new Response(shippingLabelFixture({ awb: body.awBs[0], reference: saved.to_ref, compressed: true }), { headers: { 'content-type': 'application/pdf' } })
    }
    throw new Error('Unexpected provider request')
  }
  const run = () => processAutoCourier({ db: f.client, runtime: f.config, fetcher, limit: 2 })
  const flow = (paid, cod, actor = f.actors.owner) => q('select public.order_flow_save($1,$2,$3,1) r', [actor, paid, cod]).then(r => r.rows[0].r)
  try {
    await q("insert into private.delivery_location_cities(code,governorate_code,name_en,name_ar,is_active) values('owned-fixture-city','eg-cairo','Fixture city','مدينة اختبار',true) on conflict do nothing")
    await q("update public.site_settings set inventory_tracking_required=false,allow_out_of_stock_purchases=true,payment_card_enabled=true,payment_cash_enabled=true where key='default'")
    await q("update public.commerce_shipping_companies set cod_collection_provider='pdc',cod_collection_enabled=true")
    await q("update public.shipping_provider_settings set is_enabled=true,cod_enabled=true,auto_create_labels=false,company_id='123',product_id=64,origin_city_id=1,origin_address='Owned pickup street',origin_phone='01000000000',origin_contact_name='Owned pickup',cities_cache='[{\"id\":1},{\"id\":2}]',products_cache='[{\"id\":64}]',access_token_encrypted=$1,webhook_secret_encrypted=$2 where id='pdc'",
      [encryptShippingSecret('OWNED-TOKEN'), encryptShippingSecret('owned-independent-webhook-secret-over-32-characters')])
    await q('delete from public.shipping_city_mappings')
    await q("insert into public.shipping_city_mappings(provider,governorate,city,provider_city_id) values('pdc','Cairo','Fixture city',2)")
    const company = (await q('select id from public.commerce_shipping_companies limit 1')).rows[0].id
    const { product_id: product, id: variant } = (await q('select id,product_id from public.product_variants limit 1')).rows[0]
    const order = async (method = 'card') => {
      const id = randomUUID(), paid = method !== 'cash'
      await q(`insert into public.customer_orders(id,user_id,order_number,status,payment_method,payment_status,amount_paid,subtotal_amount,total_amount,first_name,phone,street_address,city,governorate,shipping_company_id,shipping_method,stock_fulfillment_state,paid_at)
        values($1,$2,$3,'processing',$4,$5,$6,100,150,'Owned buyer','01012345678','Owned street','Fixture city','Cairo',$7,'shipping','untracked',case when $8 then now() end)`,
        [id, f.actors.customer, 'ORD-' + id.slice(0, 8), method, 'pending', 0, company, false])
      await q("insert into public.customer_order_items(order_id,product_id,variant_id,product_title,unit_price,quantity,line_total) values($1,$2,$3,'Owned item',100,1,100)", [id, product, variant])
      if (paid) {
        await q("insert into public.payment_attempts(order_id,mode,integration_id,amount_minor,currency,status,paid_at) select id,'live',1,(total_amount*100)::bigint,'EGP','succeeded',now() from public.customer_orders where id=$1", [id])
        await q("update public.customer_orders set payment_status='paid',amount_paid=total_amount,paid_at=now() where id=$1", [id])
      }
      return id
    }
    const due = async () => (await q('select public.orders_due_for_auto_courier(5) d')).rows[0].d

    const before = await order()
    await t.test('review first keeps today\'s flow: nothing is booked without packing', async () => {
      assert.deepEqual(await due(), [])
      await assert.rejects(() => q('select public.shipping_order_prepare($1,$2)', [f.actors.owner, before]), /not ready for courier booking/)
      assert.equal((await run()).booked, 0); assert.equal(posts.length, 0)
    })

    await t.test('only orders paid after the switch are booked, at 1 kg, with a saved label', async () => {
      const saved = await flow('auto', 'review')
      assert.equal(saved.paid_orders, 'auto'); assert.ok(saved.paid_auto_since)
      const paid = await order(), cash = await order('cash')
      assert.deepEqual(await due(), [paid], 'older paid orders and COD under review are left alone')
      const result = await run()
      assert.equal(result.booked, 1, JSON.stringify(result)); assert.equal(posts.length, 1); assert.equal(posts[0].weight ?? posts[0].Weight ?? 1, 1)
      const job = (await q('select state,awb,actual_weight_kg,requested_by from public.shipping_order_jobs where order_id=$1', [paid])).rows[0]
      assert.equal(job.state, 'ready'); assert.equal(job.awb, 'AUTO-1'); assert.equal(Number(job.actual_weight_kg), 1); assert.equal(job.requested_by, f.actors.owner)
      assert.deepEqual(await due(), []); assert.equal((await run()).booked, 0, 'never books twice')
      assert.equal((await q('select count(*)::int n from public.shipping_order_jobs where order_id=$1', [cash])).rows[0].n, 0)
    })

    await t.test('a PDC rejection keeps the reason and leaves the order free to rebook or attach', async () => {
      mode = 'rejected'
      const paid = await order()
      const result = await run()
      assert.equal(result.rejected, 1, JSON.stringify(result))
      const job = (await q('select state,awb,dispatch_started_at,attempt_count,last_error from public.shipping_order_jobs where order_id=$1', [paid])).rows[0]
      assert.equal(job.state, 'failed'); assert.equal(job.awb, null); assert.equal(job.dispatch_started_at, null); assert.equal(job.attempt_count, 0)
      assert.equal(job.last_error, 'PDC rejected the booking: Receiver phone # is invalid')
      assert.equal((await q('select count(*)::int n from private.pdc_dispatches where order_id=$1', [paid])).rows[0].n, 0)
      assert.equal((await q('select count(*)::int n from private.pdc_rejections where order_id=$1', [paid])).rows[0].n, 1)
      assert.deepEqual(await due(), [], 'a rejected order waits for staff')
      await q("select set_config('request.jwt.claim.role','service_role',false)")
      const attached = (await q("select public.shipping_order_attach_existing_awb($1,$2,'PORTAL123') r", [paid, f.actors.owner])).rows[0].r
      assert.equal(attached.awb, 'PORTAL123')
    })

    await t.test('cash on delivery can be automatic too; only managers change the flow', async () => {
      mode = 'created'
      await flow('auto', 'auto')
      const cash = await order('cash')
      assert.deepEqual(await due(), [cash])
      assert.equal((await run()).booked, 1)
      await assert.rejects(() => flow('review', 'review', f.actors.viewer), /permission/i)
      await flow('review', 'review')
      assert.deepEqual(await due(), [])
    })
  } finally { globalThis.useRuntimeConfig = previous; await f.close() }
})
