import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createCodCheckoutFixture } from './helpers/codCheckoutFixture.mjs'
import { emailNativeAvailable } from './helpers/emailNativeDatabase.mjs'

const migration = '20261020120000_cod_shipping_checkout.sql'
const setupStock = async (f, quantity = 40) => {
  await f.db.query("update public.site_settings set payment_cash_enabled=true,payment_cash_fee=5,payment_card_enabled=false,payment_bank_transfer_enabled=false,payment_instapay_enabled=false,payment_paypal_enabled=false,allow_out_of_stock_purchases=true where key='default'")
  const product = (await f.db.query("insert into public.products(title,slug,price,is_serialized,is_published,primary_warehouse_id) values('Synthetic COD item',$1,100,true,true,$2) returning id", ['cod-' + randomUUID(), f.warehouse])).rows[0].id
  const variant = (await f.db.query('select id from public.product_variants where product_id=$1', [product])).rows[0].id
  const received = await f.client.rpc('commerce_create_procurement_order', { p_supplier_id: f.supplier, p_warehouse_id: f.warehouse, p_invoice_number: randomUUID(), p_notes: 'Owned synthetic stock receipt', p_paid_amount: 0, p_items: [{ product_id: product, variant_id: variant, quantity, unit_cost: 60 }] })
  assert.equal(received.error, null, JSON.stringify(received.error))
  return { product, variant }
}
const address = { first_name: 'Synthetic', last_name: 'Buyer', email: 'customer@product-save.example.invalid', street_address: 'Fixture street', city: 'Fixture city', governorate: 'Cairo', phone: '01012345678' }
const input = (stock, company) => ({ cart_id: randomUUID(), items: [{ id: stock.product, variant_id: stock.variant, quantity: 1 }], address, shipping_method: 'shipping', payment_method: 'cash', shipping_company_id: company, locale: 'en' })

test('COD migration preserves exact82 receipts and rejects premature application activation', { skip: !emailNativeAvailable }, async () => {
  const f = await createCodCheckoutFixture({ stopBefore: migration })
  try {
    const stock = await setupStock(f), body = input(stock)
    assert.equal((await f.call('/api/checkout/quote', { method: 'POST', body })).response.status, 503)
    const p_order = { ...address, shipping_method: 'shipping', payment_method: 'cash', locale: 'en' }
    const p_items = [{ product_id: stock.product, variant_id: stock.variant, quantity: 1 }]
    const quote = await f.client.rpc('commerce_checkout_quote', { p_user_id: f.actors.customer, p_cart_id: body.cart_id, p_order, p_items })
    assert.equal(quote.error, null, JSON.stringify(quote.error))
    const original = await f.client.rpc('commerce_checkout_command', { p_user_id: f.actors.customer, p_cart_id: body.cart_id, p_quote_id: quote.data.quoteId, p_order, p_items })
    assert.equal(original.error, null, JSON.stringify(original.error))
    await f.db.exec(await readFile(new URL('../supabase/migrations/' + migration, import.meta.url), 'utf8'))
    const replay = await f.call('/api/checkout', { method: 'POST', body: { ...body, quote_id: quote.data.quoteId } })
    assert.equal(replay.response.status, 200, JSON.stringify(replay.body))
    assert.equal(replay.body.order.id, original.data.order.id)
    assert.equal(replay.body.order.totalAmount, 105)
    assert.equal((await f.db.query('select count(*)::int n from public.customer_orders')).rows[0].n, 1)
    assert.equal((await f.call('/api/checkout/quote', { method: 'POST', body: input(stock) })).response.status, 409)
  } finally { await f.close() }
})

test('COD uses received stock, reviewed delivery and durable order commands', { skip: !emailNativeAvailable }, async t => {
  const f = await createCodCheckoutFixture()
  try {
    const stock = await setupStock(f)
    const company = (await f.db.query("insert into public.commerce_shipping_companies(name,client_shipping_price,shipping_cost,return_cost,notes,checkout_enabled,checkout_governorates) values('Fixture carrier',40,17,9,'PRIVATE INTERNAL NOTES',true,array['Cairo']) returning id")).rows[0].id
    await f.db.query("insert into public.site_coupons(code,discount_type,discount_value,is_active) values('COD10','fixed',10,true)")
    const quote = async body => {
      const r = await f.call('/api/checkout/quote', { method: 'POST', body }); assert.equal(r.response.status, 200, JSON.stringify(r.body))
      return { ...body, quote_id: r.body.quoteId }
    }
    const send = body => f.call('/api/checkout', { method: 'POST', body })
    const counts = async () => (await f.db.query("select (select count(*)::int from public.customer_orders) orders,(select count(*)::int from private.checkout_commands) commands,(select count(*)::int from public.commerce_serialized_units where customer_order_id is not null) assigned,(select count(*)::int from public.shipping_order_jobs) provider_jobs")).rows[0]
    let command, stored
    await t.test('authenticated delivery projection excludes costs and secrets', async () => {
      const options = await f.call('/api/checkout/shipping')
      assert.deepEqual(options.body.options, [{ id: company, name: 'Fixture carrier', price: 40, governorates: ['Cairo'] }])
      assert.equal(options.response.headers.get('cache-control'), 'private, no-store')
      assert.equal((await f.call('/api/checkout/shipping', { actor: null })).response.status, 401)
      assert.equal((await f.call('/api/checkout/shipping', { actor: 'invalid' })).response.status, 401)
    })
    await t.test('server totals include configured delivery, coupon and COD fee exactly once', async () => {
      command = await quote({ ...input(stock, company), address: { ...address, email: 'delivery-contact@fixture.invalid' }, coupon_code: 'COD10' })
      const r = await send(command); assert.equal(r.response.status, 200, JSON.stringify(r.body)); stored = r.body.order
      assert.equal(stored.subtotalAmount, 100); assert.equal(stored.discountAmount, 10)
      assert.equal(stored.paymentFeeAmount, 5); assert.equal(stored.shippingFeeAmount, 40); assert.equal(stored.totalAmount, 135)
      const order = (await f.db.query('select * from public.customer_orders where id=$1', [stored.id])).rows[0]
      assert.equal(order.payment_method, 'cash'); assert.equal(order.payment_status, 'pending')
      assert.equal(order.shipping_company_name, 'Fixture carrier'); assert.equal(order.user_id, f.actors.customer)
      assert.equal(order.email, 'delivery-contact@fixture.invalid')
      assert.equal((await f.db.query('select email from public.customer_profiles where id=$1', [f.actors.customer])).rows[0].email, 'customer@product-save.example.invalid')
      assert.deepEqual(await counts(), { orders: 1, commands: 1, assigned: 1, provider_jobs: 0 })
    })
    await t.test('order appears in guarded dashboard list/detail and remains unpaid while processing', async () => {
      const list = await f.call('/api/admin-orders', { actor: 'owner' })
      assert.equal(list.response.status, 200, JSON.stringify(list.body)); assert.equal(list.body.items[0].id, stored.id)
      const detail = await f.call('/api/admin-orders/' + stored.id, { actor: 'owner' })
      assert.equal(detail.response.status, 200, JSON.stringify(detail.body)); assert.equal(Number(detail.body.order.shipping_fee_amount), 40)
      assert.equal((await f.call('/api/admin-orders', { actor: 'customer' })).response.status, 403)
      const processing = await f.call('/api/admin-orders/' + stored.id, { actor: 'owner', method: 'PATCH', body: { status: 'processing' } })
      assert.equal(processing.response.status, 200, JSON.stringify(processing.body)); assert.equal(processing.body.order.payment_status, 'pending')
    })
    await t.test('concurrent identical commands create one order and one stock deduction', async () => {
      const before = await counts(), body = await quote(input(stock, company))
      const results = await Promise.all(Array.from({ length: 8 }, () => send(body)))
      assert.ok(results.every(r => r.response.status === 200), JSON.stringify(results.map(r => r.body)))
      assert.equal(new Set(results.map(r => r.body.order.id)).size, 1)
      const after = await counts(); assert.equal(after.orders, before.orders + 1); assert.equal(after.assigned, before.assigned + 1)
    })
    await t.test('two carts competing for the last received unit cannot oversell', async () => {
      const last = await setupStock(f, 1), bodies = await Promise.all([quote(input(last, company)), quote(input(last, company))])
      const results = await Promise.all(bodies.map(send))
      assert.equal(results.filter(r => r.response.status === 200).length, 1)
      assert.equal(results.filter(r => r.response.status === 409).length, 1)
      assert.equal(Number((await f.db.query('select stock_quantity from public.products where id=$1', [last.product])).rows[0].stock_quantity), 0)
    })
    await t.test('lost acknowledgement recovers the same order', async () => {
      const body = await quote(input(stock, company)), before = await counts()
      f.controls.loseResponse = true; await assert.rejects(() => send(body))
      const recovered = await send(body); assert.equal(recovered.response.status, 200, JSON.stringify(recovered.body))
      assert.equal((await send(body)).body.order.id, recovered.body.order.id)
      assert.equal((await counts()).orders, before.orders + 1)
    })
    await t.test('shipping price or coverage changes require a new review without creating an order', async () => {
      for (const [change, undo] of [
        ['client_shipping_price=41', 'client_shipping_price=40'],
        ["checkout_governorates=array['Giza']", "checkout_governorates=array['Cairo']"],
        ['checkout_enabled=false', 'checkout_enabled=true']
      ]) {
        const body = await quote(input(stock, company)), before = await counts()
        await f.db.query('update public.commerce_shipping_companies set ' + change + ' where id=$1', [company])
        assert.equal((await send(body)).response.status, 409); assert.deepEqual(await counts(), before)
        await f.db.query('update public.commerce_shipping_companies set ' + undo + ' where id=$1', [company])
      }
      const before = await counts()
      assert.equal((await send({ ...command, shipping_company_id: randomUUID() })).response.status, 409)
      assert.equal((await send({ ...command, shipping_fee_amount: .01 })).response.status, 400)
      assert.deepEqual(await counts(), before)
    })
    await t.test('changed prices and forged financial values cannot authorize a cheaper purchase', async () => {
      const body = await quote(input(stock, company)), before = await counts()
      await f.db.query('update public.products set price=101 where id=$1', [stock.product])
      assert.equal((await send(body)).response.status, 409)
      await f.db.query('update public.products set price=100 where id=$1', [stock.product])
      assert.equal((await send({ ...body, items: [{ ...body.items[0], price: .01 }] })).response.status, 400)
      assert.equal((await send({ ...body, total_amount: .01 })).response.status, 400)
      assert.deepEqual(await counts(), before)
      const other = await f.call('/api/checkout', { method: 'POST', actor: 'viewer', body: command })
      assert.equal(other.response.status, 409)
    })
    await t.test('exact recovery survives disabled shipping and cash', async () => {
      await f.db.query('update public.commerce_shipping_companies set checkout_enabled=false where id=$1', [company])
      await f.db.query("update public.site_settings set payment_cash_enabled=false where key='default'")
      assert.equal((await send(command)).body.order.id, stored.id)
      await f.db.query('update public.commerce_shipping_companies set checkout_enabled=true where id=$1', [company])
      await f.db.query("update public.site_settings set payment_cash_enabled=true where key='default'")
    })
    await t.test('another configured area supports explicit free delivery and multiple units', async () => {
      const alternate = (await f.db.query("insert into public.commerce_shipping_companies(name,client_shipping_price,checkout_enabled,checkout_governorates) values('Other fixture delivery',0,true,array['Giza']) returning id")).rows[0].id
      const body = { ...input(stock, alternate), address: { ...address, governorate: 'Giza' }, items: [{ id: stock.product, variant_id: stock.variant, quantity: 2 }] }
      const r = await send(await quote(body))
      assert.equal(r.response.status, 200, JSON.stringify(r.body))
      assert.equal(r.body.order.shippingFeeAmount, 0); assert.equal(r.body.order.totalAmount, 205)
      const wrongArea = await f.call('/api/checkout/quote', { method: 'POST', body: input(stock, alternate) })
      assert.equal(wrongArea.response.status, 409)
    })
    await t.test('deactivating the primary warehouse prevents a new order', async () => {
      const body = await quote(input(stock, company)), before = await counts()
      await f.db.query('update public.commerce_warehouses set is_active=false where id=$1', [f.warehouse])
      assert.equal((await send(body)).response.status, 409); assert.deepEqual(await counts(), before)
      await f.db.query('update public.commerce_warehouses set is_active=true where id=$1', [f.warehouse])
    })
    await t.test('stock zero cannot use the existing out-of-stock flag', async () => {
      const body = await quote(input(stock, company)), before = await counts()
      await f.db.query("update public.commerce_serialized_units set status='damaged' where product_id=$1 and status='in_stock'", [stock.product])
      assert.equal((await send(body)).response.status, 409); assert.deepEqual(await counts(), before)
      assert.equal((await f.call('/api/checkout/quote', { method: 'POST', body: input(stock, company) })).response.status, 409)
    })
    await t.test('unconfirmed or inactive identities and unapproved payments are denied', async () => {
      await f.db.query('update auth.users set email_confirmed_at=null where id=$1', [f.actors.customer])
      const unconfirmed = await send(command)
      assert.equal(unconfirmed.response.status, 403)
      assert.equal(unconfirmed.body.statusMessage, 'Confirm your account email before ordering.')
      await f.db.query('update auth.users set email_confirmed_at=now() where id=$1', [f.actors.customer])
      await f.db.query('update public.customer_profiles set is_active=false where id=$1', [f.actors.customer])
      assert.equal((await send(command)).response.status, 403)
      await f.db.query('update public.customer_profiles set is_active=true where id=$1', [f.actors.customer])
      for (const method of ['card', 'paypal', 'bank_transfer', 'instapay']) {
        const r = await f.call('/api/checkout/quote', { method: 'POST', body: { ...input(stock), payment_method: method } })
        assert.ok([400, 409].includes(r.response.status), method + ': ' + JSON.stringify(r.body))
      }
      assert.equal((await f.db.query('select count(*)::int n from auth.users')).rows[0].n, Object.keys(f.actors).length)
    })
    await t.test('private helpers and legacy creators remain unavailable to browser roles', async () => {
      for (const role of ['anon', 'authenticated', 'service_role']) {
        const privileges = await f.db.query("select has_function_privilege($1,'private.cod_shipping(uuid,text)','EXECUTE') helper,has_function_privilege($1,'public.commerce_create_normal_customer_order(uuid,jsonb,jsonb,boolean,uuid)','EXECUTE') creator", [role])
        assert.deepEqual(privileges.rows[0], { helper: false, creator: false })
      }
      assert.equal((await counts()).provider_jobs, 0)
    })
    await t.test('deleting a carrier preserves the saved delivery snapshot and exact recovery', async () => {
      const before = await counts()
      await f.db.query('delete from public.commerce_shipping_companies where id=$1', [company])
      const recovered = await send(command)
      assert.equal(recovered.response.status, 200, JSON.stringify(recovered.body))
      assert.equal(recovered.body.order.id, stored.id)
      const order = (await f.db.query('select shipping_company_name,shipping_fee_amount from public.customer_orders where id=$1', [stored.id])).rows[0]
      assert.equal(order.shipping_company_name, 'Fixture carrier'); assert.equal(Number(order.shipping_fee_amount), 40)
      assert.deepEqual(await counts(), before)
    })
  } finally { await f.close() }
})
