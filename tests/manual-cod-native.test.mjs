import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createCodCheckoutFixture } from './helpers/codCheckoutFixture.mjs'
import { emailNativeAvailable } from './helpers/emailNativeDatabase.mjs'

const migration = '20261028170000_manual_cod_eligibility.sql'
const address = { first_name: 'Synthetic', last_name: 'Buyer', email: 'customer@product-save.example.invalid', street_address: 'Fixture street', city: 'Fixture city', governorate: 'Cairo', phone: '01012345678' }
const setup = async f => {
  await f.db.query("update public.site_settings set payment_cash_enabled=true,payment_cash_fee=0,payment_card_enabled=true,allow_out_of_stock_purchases=true,inventory_tracking_required=true where key='default'")
  const product = (await f.db.query("insert into public.products(title,slug,price,is_serialized,is_published,primary_warehouse_id) values('Synthetic COD item',$1,100,true,true,$2) returning id", ['cod-' + randomUUID(), f.warehouse])).rows[0].id
  const variant = (await f.db.query('select id from public.product_variants where product_id=$1', [product])).rows[0].id
  const received = await f.client.rpc('commerce_create_procurement_order', { p_supplier_id: f.supplier, p_warehouse_id: f.warehouse, p_invoice_number: randomUUID(), p_notes: 'Owned synthetic receipt', p_paid_amount: 0, p_items: [{ product_id: product, variant_id: variant, quantity: 20, unit_cost: 60 }] })
  assert.ifError(received.error)
  const company = (await f.db.query("insert into public.commerce_shipping_companies(name,provider,client_shipping_price,checkout_enabled,checkout_governorates) values('Synthetic manual delivery','manual',50,true,array['Cairo']) returning id")).rows[0].id
  const body = () => ({ cart_id: randomUUID(), items: [{ id: product, variant_id: variant, quantity: 1 }], address, shipping_method: 'shipping', payment_method: 'cash', shipping_company_id: company, locale: 'en' })
  return { product, variant, company, body }
}
const quote = async (f, body) => {
  const r = await f.call('/api/checkout/quote', { method: 'POST', body })
  assert.equal(r.response.status, 200, JSON.stringify(r.body))
  return { ...body, quote_id: r.body.quoteId }
}
const send = (f, body) => f.call('/api/checkout', { method: 'POST', body })
const row = async (f, id) => (await f.db.query('select * from public.customer_orders where id=$1', [id])).rows[0]
const counts = async f => (await f.db.query(`select
 (select count(*)::int from public.customer_orders) orders,
 (select count(*)::int from public.payment_attempts) attempts,
 (select count(*)::int from public.shipping_order_jobs) jobs,
 (select count(*)::int from public.order_cod_collections) cash,
 (select count(*)::int from public.treasury_transactions where customer_order_id is not null) treasury`)).rows[0]

test('Manual COD gates, transactions and cancellation on current schema', { skip: !emailNativeAvailable }, async t => {
  const f = await createCodCheckoutFixture()
  try {
    const { company, body, product } = await setup(f)
    await t.test('delivery defaults closed; forged capability and PDC assignment fail', async () => {
      assert.equal((await f.call('/api/checkout/shipping')).body.options[0].cashAvailable, false)
      assert.equal((await f.call('/api/checkout/quote', { method: 'POST', body: body() })).response.status, 409)
      assert.equal((await f.call('/api/checkout/quote', { method: 'POST', body: { ...body(), cod_collection_enabled: true } })).response.status, 400)
      await assert.rejects(f.db.query("update public.commerce_shipping_companies set provider='pdc',cod_collection_enabled=true where id=$1", [company]), /shipping_manual_cod_collection_check/)
      await f.db.query('update public.commerce_shipping_companies set cod_collection_enabled=true where id=$1', [company])
      for (const role of ['anon', 'authenticated', 'service_role']) {
        assert.equal((await f.db.query("select has_function_privilege($1,'private.require_manual_cod_collection(uuid)','EXECUTE') allowed", [role])).rows[0].allowed, false)
      }
    })
    await t.test('server rechecks method, coverage and cash capability at commit', async () => {
      for (const [change, undo] of [
        ['cod_collection_enabled=false', 'cod_collection_enabled=true'],
        ["checkout_governorates=array['Giza']", "checkout_governorates=array['Cairo']"]
      ]) {
        const command = await quote(f, body()), before = await counts(f)
        await f.db.query('update public.commerce_shipping_companies set ' + change + ' where id=$1', [company])
        assert.equal((await send(f, command)).response.status, 409)
        assert.deepEqual(await counts(f), before)
        await f.db.query('update public.commerce_shipping_companies set ' + undo + ' where id=$1', [company])
      }
      const command = await quote(f, body())
      await f.db.query("update public.site_settings set payment_cash_enabled=false where key='default'")
      assert.equal((await send(f, command)).response.status, 409)
      await f.db.query("update public.site_settings set payment_cash_enabled=true where key='default'")
    })
    await t.test('zero recorded stock remains ineligible when tracking is required', async () => {
      const unavailable = (await f.db.query("insert into public.products(title,slug,price,is_serialized,is_published,primary_warehouse_id) values('Synthetic unavailable item',$1,100,true,true,$2) returning id", ['unavailable-' + randomUUID(), f.warehouse])).rows[0].id
      const variant = (await f.db.query('select id from public.product_variants where product_id=$1', [unavailable])).rows[0].id
      const request = { ...body(), items: [{ id: unavailable, variant_id: variant, quantity: 1 }] }
      assert.equal((await f.call('/api/checkout/quote', { method: 'POST', body: request })).response.status, 409)
      assert.equal((await counts(f)).orders, 0)
    })
    let command, orderId
    await t.test('Manual50 is unpaid, owned, atomic and creates no gateway or provider work', async () => {
      command = await quote(f, body())
      const responses = await Promise.all(Array.from({ length: 5 }, () => send(f, command)))
      assert.ok(responses.every(r => r.response.status === 200), JSON.stringify(responses.map(r => r.body)))
      orderId = responses[0].body.order.id
      assert.ok(responses.every(r => r.body.order.id === orderId))
      const order = await row(f, orderId)
      assert.equal(order.user_id, f.actors.customer)
      assert.equal(order.payment_status, 'pending'); assert.equal(order.amount_paid, '0.00'); assert.equal(order.paid_at, null)
      assert.equal(order.shipping_fee_amount, '50.00'); assert.equal(order.total_amount, '150.00')
      assert.equal(order.stock_fulfillment_state, 'ready'); assert.equal(order.card_checkout_verified, false)
      assert.equal((await f.db.query('select stock_quantity from public.products where id=$1', [product])).rows[0].stock_quantity, 19)
      assert.deepEqual(await counts(f), { orders: 1, attempts: 0, jobs: 0, cash: 0, treasury: 0 })
      assert.equal((await f.client.rpc('commerce_claim_payment_attempt', { p_order_id: orderId, p_user_id: f.actors.customer, p_mode: 'live', p_integration_id: 123 })).error.message, 'Order is not payable.')
      const detail = await f.call('/api/admin-orders/' + orderId, { actor: 'owner' })
      assert.equal(detail.body.codCash.outstanding, 150)
      const list = await f.call('/api/admin-orders', { actor: 'owner' })
      assert.equal(list.body.items[0].payment_method, 'cash')
      assert.equal((await f.call('/api/admin-orders/' + orderId, { actor: 'customer' })).response.status, 403)
    })
    await t.test('exact receipt survives disabling new COD and changed coverage', async () => {
      await f.db.query("update public.commerce_shipping_companies set cod_collection_enabled=false,checkout_governorates=array['Giza'] where id=$1", [company])
      await f.db.query("update public.site_settings set payment_cash_enabled=false where key='default'")
      const recovered = await send(f, command)
      assert.equal(recovered.response.status, 200, JSON.stringify(recovered.body)); assert.equal(recovered.body.order.id, orderId)
      assert.equal((await counts(f)).orders, 1)
      await f.db.query("update public.commerce_shipping_companies set cod_collection_enabled=true,checkout_governorates=array['Cairo'] where id=$1", [company])
      await f.db.query("update public.site_settings set payment_cash_enabled=true where key='default'")
    })
    await t.test('unfulfilled cancellation returns original stock once and cannot reopen', async () => {
      const cancel = () => f.call('/api/admin-orders/' + orderId, { actor: 'owner', method: 'PATCH', body: { status: 'cancelled' } })
      assert.equal((await cancel()).response.status, 200)
      assert.equal((await cancel()).response.status, 200)
      assert.equal((await f.db.query('select stock_quantity from public.products where id=$1', [product])).rows[0].stock_quantity, 20)
      assert.equal((await f.db.query("select count(*)::int n from public.commerce_inventory_movements where reference_id=$1 and movement_type='return_in'", [orderId])).rows[0].n, 1)
      await assert.rejects(f.db.query("update public.customer_orders set status='processing' where id=$1", [orderId]), /cannot be reopened/)
      assert.equal((await row(f, orderId)).payment_status, 'pending')
    })
    await t.test('shipped cash cannot be cancelled into immediately saleable stock', async () => {
      const created = await send(f, await quote(f, body())); const id = created.body.order.id
      await f.db.query("update public.customer_orders set status='out_for_delivery' where id=$1", [id])
      await assert.rejects(f.db.query("update public.customer_orders set status='cancelled' where id=$1", [id]), /Review cash, stock and delivery/)
      assert.equal((await row(f, id)).payment_status, 'pending')
    })
  } finally { await f.close() }
})

test('schema98 cash receipt recovers after default-off eligibility migration', { skip: !emailNativeAvailable }, async () => {
  const f = await createCodCheckoutFixture({ stopBefore: migration })
  try {
    const { body } = await setup(f), input = body()
    assert.equal((await f.call('/api/checkout/quote', { method: 'POST', body: input })).response.status, 503)
    const p_order = { ...address, payment_method: 'cash', shipping_method: 'shipping', shipping_company_id: input.shipping_company_id, locale: 'en', backorder_accepted: false }
    const p_items = input.items.map(item => ({ product_id: item.id, variant_id: item.variant_id, quantity: item.quantity }))
    const q = await f.client.rpc('commerce_checkout_quote', { p_user_id: f.actors.customer, p_cart_id: input.cart_id, p_order, p_items })
    assert.ifError(q.error)
    const original = await f.client.rpc('commerce_checkout_command', { p_user_id: f.actors.customer, p_cart_id: input.cart_id, p_quote_id: q.data.quoteId, p_order, p_items })
    assert.ifError(original.error)
    const before = await row(f, original.data.order.id)
    await f.db.exec(await readFile(new URL('../supabase/migrations/' + migration, import.meta.url), 'utf8'))
    assert.deepEqual(await row(f, original.data.order.id), before)
    const replay = await send(f, { ...input, quote_id: q.data.quoteId })
    assert.equal(replay.response.status, 200, JSON.stringify(replay.body))
    assert.equal(replay.body.order.id, original.data.order.id)
    assert.equal((await counts(f)).orders, 1)
  } finally { await f.close() }
})
