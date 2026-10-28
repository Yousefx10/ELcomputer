import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { join, resolve } from 'node:path'
import { createCodCheckoutFixture } from './helpers/codCheckoutFixture.mjs'
import { createPrivatePackingFixture } from './helpers/privatePackingFixture.mjs'
import { emailNativeAvailable } from './helpers/emailNativeDatabase.mjs'

const address = { first_name: 'Synthetic', last_name: 'Buyer', email: 'customer@product-save.example.invalid', street_address: 'Fixture street', city: 'Fixture city', governorate: 'Cairo', phone: '01012345678' }
const snapshot = async f => (await f.db.query(`select
 (select coalesce(jsonb_agg(jsonb_build_array(id,stock_quantity) order by id),'[]') from public.products) products,
 (select coalesce(jsonb_agg(jsonb_build_array(id,stock_quantity) order by id),'[]') from public.product_variants) variants,
 (select coalesce(jsonb_agg(to_jsonb(i) order by warehouse_id,product_id),'[]') from public.commerce_warehouse_inventory i) balances,
 (select coalesce(jsonb_agg(to_jsonb(u) order by id),'[]') from public.commerce_serialized_units u) units,
 (select count(*)::int from public.commerce_inventory_movements) movements`)).rows[0]
const row = async (f, id) => (await f.db.query('select * from public.customer_orders where id=$1', [id])).rows[0]
const post = (f, path, body, actor = 'customer') => f.call(path, { method: 'POST', body, actor })
const reviewed = async (f, body) => {
  const result = await post(f, '/api/checkout/quote', body)
  assert.equal(result.response.status, 200, JSON.stringify(result.body))
  return { ...body, quote_id: result.body.quoteId }
}

test('untracked normal COD uses the existing sales setting without manufacturing stock', { skip: !emailNativeAvailable }, async t => {
  const runtime = { public: { purchasingEnabled: true, betaPurchasingEnabled: true }, betaPurchasePolicy: { shipping_company_id: randomUUID(), excluded_product_ids: [], payment_methods: ['card', 'cash'] } }
  const f = await createCodCheckoutFixture({ runtime })
  try {
    await f.db.query("update public.site_settings set inventory_tracking_required=false,allow_out_of_stock_purchases=false,payment_cash_enabled=true,payment_cash_fee=0,backorder_fulfillment_message='Delivery timing depends on your address.',backorder_fulfillment_message_ar='تختلف مدة التوصيل حسب العنوان.' where key='default'")
    const product = (await f.db.query("insert into public.products(title,slug,price,is_serialized,is_published,primary_warehouse_id) values('Synthetic normal item',$1,100,true,true,$2) returning id", ['cod-' + randomUUID(), f.warehouse])).rows[0].id
    const variant = (await f.db.query('select id from public.product_variants where product_id=$1', [product])).rows[0].id
    const company = (await f.db.query("insert into public.commerce_shipping_companies(name,client_shipping_price,checkout_enabled,checkout_governorates) values('Synthetic Manual',50,true,array['Cairo']) returning id")).rows[0].id
    runtime.betaPurchasePolicy.shipping_company_id = company
    const body = () => ({ cart_id: randomUUID(), items: [{ id: product, variant_id: variant, quantity: 2 }], address, shipping_method: 'shipping', shipping_company_id: company, payment_method: 'cash', locale: 'en' })
    await t.test('untracked inventory option alone never enables cash collection', async () => {
      assert.equal((await post(f, '/api/checkout/quote', body())).response.status, 409)
      await f.db.query('update public.commerce_shipping_companies set cod_collection_enabled=true where id=$1', [company])
    })
    let command, id
    const stock = await snapshot(f)
    await t.test('EN/AR server quote is an ordinary untracked sale with trusted delivery and no backorder consent', async () => {
      for (const locale of ['en', 'ar']) {
        const result = await post(f, '/api/checkout/quote', { ...body(), locale })
        assert.equal(result.response.status, 200, JSON.stringify(result.body))
        assert.equal(result.body.stockFulfillmentState, 'untracked')
        assert.equal(result.body.totalAmount, 250); assert.equal(result.body.shippingFee, 50)
        assert.equal(result.body.isPreorder, false)
      }
      command = await reviewed(f, body())
    })
    await t.test('concurrent double confirmation creates one unpaid order, no stock movement and no Paymob work', async () => {
      const results = await Promise.all(Array.from({ length: 6 }, () => post(f, '/api/checkout', command)))
      assert.ok(results.every(r => r.response.status === 200), JSON.stringify(results.map(r => r.body)))
      id = results[0].body.order.id
      assert.ok(results.every(r => r.body.order.id === id))
      const order = await row(f, id)
      assert.equal(order.stock_fulfillment_state, 'untracked'); assert.equal(order.status, 'pending_payment')
      assert.equal(order.payment_method, 'cash'); assert.equal(order.amount_paid, '0.00'); assert.equal(order.payment_status, 'pending')
      assert.equal(order.user_id, f.actors.customer); assert.equal(order.card_checkout_verified, false)
      assert.deepEqual(await snapshot(f), stock)
      assert.equal((await f.db.query('select count(*)::int n from public.payment_attempts')).rows[0].n, 0)
      assert.equal((await f.db.query('select count(*)::int n from public.shipping_order_jobs')).rows[0].n, 0)
      assert.equal((await f.db.query('select count(*)::int n from public.order_cod_collections')).rows[0].n, 0)
      assert.equal((await f.client.rpc('commerce_claim_payment_attempt', { p_order_id: id, p_user_id: f.actors.customer, p_mode: 'live', p_integration_id: 123 })).error.message, 'Order is not payable.')
    })
    await t.test('collection or method assertions cannot relabel the unpaid order', async () => {
      await assert.rejects(f.db.query("update public.customer_orders set amount_paid=total_amount,payment_status='paid',paid_at=now() where id=$1", [id]), /cod:history/)
      await assert.rejects(f.db.query("update public.customer_orders set payment_method='card' where id=$1", [id]), /Payment method cannot change/)
    })
    await t.test('committed recovery survives settings changes without changing the saved inventory mode', async () => {
      await f.db.query("update public.site_settings set inventory_tracking_required=true,payment_cash_enabled=false where key='default'")
      await f.db.query('update public.commerce_shipping_companies set cod_collection_enabled=false where id=$1', [company])
      const replay = await post(f, '/api/checkout', command)
      assert.equal(replay.response.status, 200, JSON.stringify(replay.body)); assert.equal(replay.body.order.id, id)
      assert.equal((await row(f, id)).stock_fulfillment_state, 'untracked')
      await f.db.query("update public.site_settings set inventory_tracking_required=false,payment_cash_enabled=true where key='default'")
      await f.db.query('update public.commerce_shipping_companies set cod_collection_enabled=true where id=$1', [company])
    })
    await t.test('unfulfilled cancellation changes no inventory and cannot reopen', async () => {
      const cancel = () => f.call('/api/admin-orders/' + id, { actor: 'owner', method: 'PATCH', body: { status: 'cancelled' } })
      assert.equal((await cancel()).response.status, 200); assert.equal((await cancel()).response.status, 200)
      assert.deepEqual(await snapshot(f), stock)
      await assert.rejects(f.db.query("update public.customer_orders set status='processing' where id=$1", [id]), /cannot be reopened/)
    })
    await t.test('draft, unpriced, inactive-model, excluded and preorder products stay ineligible', async () => {
      for (const [change, undo] of [['is_published=false', 'is_published=true'], ['price=0', 'price=100'], ["selling_mode='preorder'", "selling_mode='normal'"]]) {
        await f.db.query('update public.products set ' + change + ' where id=$1', [product])
        assert.equal((await post(f, '/api/checkout/quote', body())).response.status, 409)
        await f.db.query('update public.products set ' + undo + ' where id=$1', [product])
      }
      const inactive = (await f.db.query("insert into public.product_variants(product_id,name,code,is_active) values($1,'Inactive','INACTIVE',false) returning id", [product])).rows[0].id
      const request = body(); request.items[0].variant_id = inactive
      assert.equal((await post(f, '/api/checkout/quote', request)).response.status, 409)
      runtime.betaPurchasePolicy.excluded_product_ids = [product]
      assert.equal((await post(f, '/api/checkout/quote', body())).response.status, 403)
      runtime.betaPurchasePolicy.excluded_product_ids = []
    })
    await t.test('switching recorded inventory back on restores strict COD quantity checks', async () => {
      await f.db.query("update public.site_settings set inventory_tracking_required=true,allow_out_of_stock_purchases=true where key='default'")
      assert.equal((await post(f, '/api/checkout/quote', { ...body(), backorder_accepted: true })).response.status, 409)
    })
  } finally { await f.close() }
})

test('unpaid untracked COD retains actual quantity scans, private video and cash/Treasury separation', { skip: !emailNativeAvailable }, async () => {
  const f = await createPrivatePackingFixture({ extraRoutes: [
    ['post', '/api/admin-orders/:id/cod-cash', resolve('server/api/admin-orders/[id]/cod-cash.post.js')],
    ['patch', '/api/admin-orders/:id', resolve('server/api/admin-orders/[id].patch.js')]
  ] })
  try {
    await f.db.query("update public.site_settings set inventory_tracking_required=false,backorder_fulfillment_message='Delivery timing depends on your address.',backorder_fulfillment_message_ar='تختلف مدة التوصيل حسب العنوان.' where key='default'")
    const stock = await snapshot(f), pack = await f.newPack(2)
    assert.equal(pack.units.length, 0); assert.equal((await row(f, pack.order)).payment_status, 'pending')
    const code = (await f.db.query('select variant_code from public.customer_order_items where order_id=$1', [pack.order])).rows[0].variant_code
    assert.equal((await post(f, pack.path + '/complete', {}, 'editor')).response.status, 409)
    const start = Date.now() - 1000
    for (let i = 0; i < 2; i++) assert.equal((await post(f, pack.path + '/scan', { code }, 'editor')).response.status, 200)
    assert.equal((await post(f, pack.path + '/scan', { code }, 'editor')).response.status, 409)
    assert.equal((await post(f, pack.path + '/complete', {}, 'editor')).response.status, 409)
    const videoPath = join(f.directory, 'synthetic.webm')
    await promisify(execFile)('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:size=64x64:rate=10', '-t', '6', '-an', '-c:v', 'libvpx', videoPath])
    const bytes = await readFile(videoPath)
    const upload = await post(f, pack.path + '/video-upload', { mimeType: 'video/webm', sizeBytes: bytes.length, recordingStartedAt: new Date(start).toISOString(), recordingEndedAt: new Date(start + 6000).toISOString() }, 'editor')
    assert.equal(upload.response.status, 200, JSON.stringify(upload.body))
    assert.equal((await f.call(upload.body.upload.url, { actor: 'editor', method: 'PUT', body: bytes, raw: true, headers: { 'Content-Type': 'video/webm' } })).response.status, 200)
    assert.equal((await post(f, pack.path + '/video-complete', {}, 'editor')).response.status, 200)
    const done = await post(f, pack.path + '/complete', {}, 'editor')
    assert.equal(done.response.status, 200, JSON.stringify(done.body))
    assert.equal((await row(f, pack.order)).status, 'ready_to_deliver')
    assert.equal((await row(f, pack.order)).payment_status, 'pending')
    assert.deepEqual(await snapshot(f), stock)
    const status = await f.call('/api/admin-orders/' + pack.order, { actor: 'editor', method: 'PATCH', body: { status: 'delivered' } })
    assert.equal(status.response.status, 200, JSON.stringify(status.body))
    const cash = { command_id: randomUUID(), action: 'receive', collection_id: null, amount: (await row(f, pack.order)).total_amount, reference: 'SYNTHETIC-' + randomUUID(), received_on: (await f.db.query('select current_date::text received_date')).rows[0].received_date, confirmed: true }
    const received = await post(f, '/api/admin-orders/' + pack.order + '/cod-cash', cash, 'owner')
    assert.equal(received.response.status, 200, JSON.stringify(received.body))
    assert.equal((await row(f, pack.order)).payment_status, 'paid')
    assert.equal((await f.db.query('select count(*)::int n from public.treasury_transactions where customer_order_id=$1', [pack.order])).rows[0].n, 0)
    assert.equal((await post(f, '/api/admin-orders/' + pack.order + '/cod-cash', cash, 'owner')).response.status, 200)
    assert.equal((await f.db.query('select count(*)::int n from public.order_cod_collections where order_id=$1', [pack.order])).rows[0].n, 1)
  } finally { await f.close() }
})
