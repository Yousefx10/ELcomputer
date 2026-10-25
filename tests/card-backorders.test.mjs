import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createResetDatabase } from './helpers/resetDatabase.mjs'
import { createEmailNativeDatabase, emailNativeAvailable } from './helpers/emailNativeDatabase.mjs'

test('card backorders preserve stock, payment authority, ownership and fulfillment', async t => {
  const db = process.env.BETA_NATIVE_DB === '1' ? await createEmailNativeDatabase() : await createResetDatabase()
  const buyer = randomUUID(), other = randomUUID(), admin = randomUUID(), warehouse = randomUUID(), product = randomUUID()
  const execute = (sql, args = []) => db.query(sql, args.map(value => Array.isArray(value) ? JSON.stringify(value) : value))
  const result = async (sql, args = []) => (await execute(sql, args)).rows[0]
  const fails = async (sql, args, match) => {
    await db.exec('savepoint rejected_command')
    await assert.rejects(() => execute(sql, args), match)
    await db.exec('rollback to savepoint rejected_command')
  }
  try {
    await db.exec("begin;select set_config('request.jwt.claim.role','service_role',true)")
    await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'buyer@fixture.invalid',now()),($2,'other@fixture.invalid',now()),($3,'staff@fixture.invalid',now())", [buyer, other, admin])
    await db.query("insert into public.admin_users(id,email,role) values($1,'staff@fixture.invalid','owner')", [admin])
    await db.exec("insert into public.site_settings(key,payment_card_enabled,payment_card_fee,allow_out_of_stock_purchases,backorder_fulfillment_message,backorder_fulfillment_message_ar) values('default',true,0,true,'Special order. Timing requires confirmation.','طلب خاص. الموعد يحتاج إلى تأكيد.') on conflict(key) do update set payment_card_enabled=true,payment_card_fee=0,allow_out_of_stock_purchases=true,backorder_fulfillment_message=excluded.backorder_fulfillment_message,backorder_fulfillment_message_ar=excluded.backorder_fulfillment_message_ar")
    await db.query("insert into public.commerce_warehouses(id,name) values($1,'Fixture warehouse')", [warehouse])
    const company = (await result("insert into public.commerce_shipping_companies(name,client_shipping_price,checkout_enabled,checkout_governorates) values('Fixture delivery',50,true,array['Cairo']) returning id")).id
    await db.query("insert into public.products(id,title,slug,price,is_published,is_serialized,primary_warehouse_id) values($1,'Fixture model',($1::uuid)::text,100,true,true,$2)", [product, warehouse])
    const variant = (await result('select id from public.product_variants where product_id=$1', [product])).id
    const items = [{ product_id: product, variant_id: variant, quantity: 1 }]
    const order = { first_name: 'Buyer', last_name: 'Fixture', email: 'buyer@fixture.invalid', phone: '01000000000', street_address: 'Fixture street', city: 'Fixture city', governorate: 'Cairo', shipping_method: 'shipping', shipping_company_id: company, payment_method: 'card', locale: 'en', backorder_accepted: true }
    const quote = async (cart, changes = {}) => (await result('select public.commerce_checkout_quote($1,$2,$3,$4) value', [buyer, cart, { ...order, ...changes }, items])).value
    const commit = async (cart, reviewed) => (await result('select public.commerce_checkout_command($1,$2,$3,$4,$5) value', [buyer, cart, reviewed.quoteId, order, items])).value
    const stock = async () => result('select p.stock_quantity product,v.stock_quantity variant,(select count(*)::int from public.commerce_serialized_units) units,(select count(*)::int from public.commerce_inventory_movements) movements from public.products p join public.product_variants v on v.product_id=p.id where p.id=$1', [product])
    let cart, review, created
    await t.test('zero-stock review quotes the configured fee and discloses special fulfillment', async () => {
      cart = randomUUID(); review = await quote(cart)
      assert.equal(review.stockFulfillmentState, 'awaiting_stock')
      assert.equal(review.fulfillmentMessage, 'Special order. Timing requires confirmation.')
      assert.equal(review.shippingFee, 50); assert.equal(review.totalAmount, 150)
      assert.equal((await quote(randomUUID(), { locale: 'ar' })).fulfillmentMessage, 'طلب خاص. الموعد يحتاج إلى تأكيد.')
    })
    await t.test('order and identical retry create no physical unit, deduction or second order', async () => {
      const before = await stock(); created = await commit(cart, review)
      assert.equal(created.created, true)
      assert.equal(created.order.status, 'on_hold'); assert.equal(created.order.payment_status, 'pending')
      assert.equal(created.order.stock_fulfillment_state, 'awaiting_stock'); assert.equal(created.order.is_preorder, false)
      assert.equal(Number(created.order.total_amount), 150)
      assert.deepEqual(await stock(), before)
      assert.equal((await commit(cart, review)).created, false)
      await fails('select public.commerce_checkout_command($1,$2,$3,$4,$5)', [other, cart, review.quoteId, order, items], /checkout:conflict/)
    })
    await t.test('signed-settlement SQL marks paid while keeping the stock hold', async () => {
      const attempt = (await result("select public.commerce_claim_payment_attempt($1,$2,'live',12345) value", [created.order.id, buyer])).value.attempt
      await db.query("select public.commerce_store_payment_intention($1,'pi_live_fixture_backorder','930001','egy_csk_live_fixture_backorder')", [attempt.id])
      const tx = { provider_order_id: '930001', transaction_id: '930002', mode: 'live', integration_id: 12345, amount_minor: 15000, currency: 'EGP', status: 'succeeded' }
      await db.query('select public.commerce_reconcile_payment_transaction($1)', [tx])
      await db.query('select public.commerce_reconcile_payment_transaction($1)', [tx])
      const paid = await result('select status,payment_status,amount_paid from public.customer_orders where id=$1', [created.order.id])
      assert.equal(paid.payment_status, 'paid'); assert.equal(Number(paid.amount_paid), 150); assert.equal(paid.status, 'on_hold')
      assert.equal((await result('select count(*)::int n from public.shipping_order_jobs')).n, 0)
      await fails("update public.customer_orders set status='processing' where id=$1", [created.order.id], /awaiting physical stock/)
      await fails("insert into public.shipping_order_jobs(order_id,to_ref) values($1,'FIXTURE')", [created.order.id], /awaiting physical stock/)
      await fails('select public.commerce_release_backorder($1,$2)', [created.order.id, other], /permission/)
      await fails('select public.commerce_release_backorder($1,$2)', [created.order.id, admin], /stock|units/i)
    })
    await t.test('real fixture stock is allocated once through the existing Orders permission', async () => {
      await db.exec("select set_config('app.serialized_inventory_write','on',true)")
      await db.query('update public.products set stock_quantity=1 where id=$1', [product])
      await db.query('update public.product_variants set stock_quantity=1 where id=$1', [variant])
      await db.query('insert into public.commerce_warehouse_inventory(warehouse_id,product_id,quantity) values($1,$2,1)', [warehouse, product])
      await db.query("insert into public.commerce_serialized_units(unit_code,product_id,variant_id,warehouse_id) values('FIXTURE-ARRIVED',$1,$2,$3)", [product, variant, warehouse])
      await db.exec("select set_config('app.serialized_inventory_write','off',true)")
      const released = (await result('select public.commerce_release_backorder($1,$2) value', [created.order.id, admin])).value
      assert.equal(released.status, 'processing'); assert.equal(released.stock_fulfillment_state, 'ready')
      const before = await stock()
      assert.equal(before.product, 0); assert.equal(before.variant, 0)
      await db.query('select public.commerce_release_backorder($1,$2)', [created.order.id, admin])
      assert.deepEqual(await stock(), before)
      assert.equal((await result("select count(*)::int n from public.commerce_serialized_units where status='sold' and customer_order_id=$1", [created.order.id])).n, 1)
    })
    await t.test('expiry restores a real reservation once; late success requires refund review', async () => {
      await db.exec("select set_config('app.serialized_inventory_write','on',true)")
      await db.query('update public.products set stock_quantity=1 where id=$1', [product])
      await db.query('update public.product_variants set stock_quantity=1 where id=$1', [variant])
      await db.query('update public.commerce_warehouse_inventory set quantity=1 where warehouse_id=$1 and product_id=$2', [warehouse, product])
      await db.query("insert into public.commerce_serialized_units(unit_code,product_id,variant_id,warehouse_id) values('FIXTURE-READY',$1,$2,$3)", [product, variant, warehouse])
      await db.exec("select set_config('app.serialized_inventory_write','off',true)")
      const nextCart = randomUUID(), nextReview = await quote(nextCart)
      assert.equal(nextReview.stockFulfillmentState, 'ready')
      const ready = await commit(nextCart, nextReview)
      assert.equal((await stock()).product, 0)
      const attempt = (await result("select public.commerce_claim_payment_attempt($1,$2,'live',12345) value", [ready.order.id, buyer])).value.attempt
      await db.query("select public.commerce_store_payment_intention($1,'pi_live_fixture_expiry','940001','egy_csk_live_fixture_expiry')", [attempt.id])
      await fails("update public.customer_orders set status='cancelled' where id=$1", [ready.order.id], /Reconcile this payment/)
      await db.query("update public.customer_orders set created_at=clock_timestamp()-interval '3 hours' where id=$1", [ready.order.id])
      await db.query("update public.payment_attempts set expires_at=clock_timestamp()-interval '2 hours' where id=$1", [attempt.id])
      const expired = (await result('select public.commerce_expire_unpaid_card_orders(25) value')).value
      assert.ok(expired.cancelled.includes(ready.order.id))
      const before = await stock(); assert.equal(before.product, 1); assert.equal(before.variant, 1)
      assert.equal((await result('select public.commerce_expire_unpaid_card_orders(25) value')).value.cancelled.length, 0)
      assert.deepEqual(await stock(), before)
      await db.query('select public.commerce_reconcile_payment_transaction($1)', [{ provider_order_id: '940001', transaction_id: '940002', mode: 'live', integration_id: 12345, amount_minor: 15000, currency: 'EGP', status: 'succeeded' }])
      const state = await result('select o.status,a.status attempt_status,a.error_code from public.customer_orders o join public.payment_attempts a on a.order_id=o.id where o.id=$1', [ready.order.id])
      assert.equal(state.status, 'cancelled'); assert.equal(state.attempt_status, 'succeeded'); assert.equal(state.error_code, 'order_requires_review')
      assert.deepEqual(await stock(), before)
      await fails("update public.customer_orders set status='pending_payment' where id=$1", [ready.order.id], /cannot be reopened/)
    })
    await t.test('unpaid backorders release no fictional stock; uncertain intentions remain for review', async () => {
      items[0].quantity = 2
      const abandonedCart = randomUUID(), abandoned = await commit(abandonedCart, await quote(abandonedCart))
      const before = await stock()
      await db.query("update public.customer_orders set created_at=clock_timestamp()-interval '3 hours' where id=$1", [abandoned.order.id])
      assert.ok((await result('select public.commerce_expire_unpaid_card_orders(25) value')).value.cancelled.includes(abandoned.order.id))
      assert.deepEqual(await stock(), before)
      const unknownCart = randomUUID(), unknown = await commit(unknownCart, await quote(unknownCart))
      const attempt = (await result("select public.commerce_claim_payment_attempt($1,$2,'live',12345) value", [unknown.order.id, buyer])).value.attempt
      await db.query("update public.customer_orders set created_at=clock_timestamp()-interval '3 hours' where id=$1", [unknown.order.id])
      await db.query("update public.payment_attempts set expires_at=clock_timestamp()-interval '2 hours' where id=$1", [attempt.id])
      assert.ok((await result('select public.commerce_expire_unpaid_card_orders(25) value')).value.requiresReview.includes(unknown.order.id))
      assert.equal((await result('select status from public.customer_orders where id=$1', [unknown.order.id])).status, 'on_hold')
      assert.deepEqual(await stock(), before)
    })
    await t.test('PDC selection uses configured fifty-pound customer pricing and exact city mappings', async () => {
      await db.query("update public.commerce_shipping_companies set provider='pdc' where id=$1", [company])
      await db.exec(`update public.shipping_provider_settings set is_enabled=true,auto_create_labels=false,cod_enabled=false,
        access_token_encrypted='v1.fixture',webhook_secret_encrypted='v1.fixture',shipment_type_id=1,
        origin_city_id=999991,origin_address='Fixture origin',origin_contact_name='Fixture',origin_phone='01000000000',product_id=40,
        cities_cache='[{"id":999991,"name":"Origin fixture"},{"id":999992,"name":"Destination fixture"}]',
        products_cache='[{"id":40,"name":"Fixture service"}]' where id='pdc'`)
      await db.exec("insert into public.shipping_city_mappings(provider_city_id,governorate,city) values(999992,'Cairo','Fixture city')")
      const mapped = await quote(randomUUID())
      assert.equal(mapped.shippingFee, 50); assert.equal(mapped.totalAmount, 250)
      await fails('select public.commerce_checkout_quote($1,$2,$3,$4)', [buyer, randomUUID(), { ...order, city: 'Unknown fixture' }, items], /destination is unavailable/)
      assert.equal((await result('select count(*)::int n from public.shipping_order_jobs')).n, 0)
    })
    await t.test('closed backorders, missing wording and unpublished products fail before ordering', async () => {
      items[0].quantity = 2
      await db.exec('update public.site_settings set allow_out_of_stock_purchases=false')
      await fails('select public.commerce_checkout_quote($1,$2,$3,$4)', [buyer, randomUUID(), order, items], /checkout:unavailable|checkout:stock/)
      await db.exec("update public.site_settings set allow_out_of_stock_purchases=true,backorder_fulfillment_message=''")
      await fails('select public.commerce_checkout_quote($1,$2,$3,$4)', [buyer, randomUUID(), order, items], /delivery information/)
      await db.query('update public.products set is_published=false where id=$1', [product])
      await fails('select public.commerce_checkout_quote($1,$2,$3,$4)', [buyer, randomUUID(), order, items], /checkout:unavailable/)
    })
  } finally { await db.exec('rollback').catch(() => {}); await db.close() }
})

test('native competing carts and expiry versus settlement preserve one physical unit', { skip: !emailNativeAvailable }, async () => {
  const db = await createEmailNativeDatabase()
  const buyer = randomUUID(), warehouse = randomUUID(), product = randomUUID()
  const sql = async (connection, query, args = []) => (await connection.query(query, args.map(v => v !== null && typeof v === 'object' ? JSON.stringify(v) : v))).rows[0]
  const workers = []
  try {
    await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'native@fixture.invalid',now())", [buyer])
    await db.query("insert into public.site_settings(key,payment_card_enabled,allow_out_of_stock_purchases,backorder_fulfillment_message,backorder_fulfillment_message_ar) values('default',true,true,'Special order. Timing is unconfirmed.','طلب خاص.') on conflict(key) do update set payment_card_enabled=true,allow_out_of_stock_purchases=true,backorder_fulfillment_message=excluded.backorder_fulfillment_message")
    await db.query('insert into public.commerce_warehouses(id,name) values($1,\'Native fixture\')', [warehouse])
    const company = (await sql(db, "insert into public.commerce_shipping_companies(name,checkout_enabled,checkout_governorates,client_shipping_price) values('Native delivery',true,array['Cairo'],50) returning id")).id
    await db.query("insert into public.products(id,title,slug,price,is_published,is_serialized,primary_warehouse_id) values($1,'Native fixture',($1::uuid)::text,100,true,true,$2)", [product, warehouse])
    const variant = (await sql(db, 'select id from public.product_variants where product_id=$1', [product])).id
    await db.query("select set_config('app.serialized_inventory_write','on',false)")
    await db.query('update public.products set stock_quantity=1 where id=$1', [product])
    await db.query('update public.product_variants set stock_quantity=1 where id=$1', [variant])
    await db.query('insert into public.commerce_warehouse_inventory(warehouse_id,product_id,quantity) values($1,$2,1)', [warehouse, product])
    await db.query("insert into public.commerce_serialized_units(unit_code,product_id,variant_id,warehouse_id) values('NATIVE-ONE',$1,$2,$3)", [product, variant, warehouse])
    await db.query("select set_config('app.serialized_inventory_write','off',false)")
    const order = { first_name: 'Native', email: 'native@fixture.invalid', phone: '01000000000', street_address: 'Fixture', city: 'Fixture', governorate: 'Cairo', shipping_method: 'shipping', shipping_company_id: company, payment_method: 'card', locale: 'en', backorder_accepted: true }
    const items = [{ product_id: product, variant_id: variant, quantity: 1 }], carts = [randomUUID(), randomUUID()]
    const reviews = await Promise.all(carts.map(cart => sql(db, 'select public.commerce_checkout_quote($1,$2,$3,$4) value', [buyer, cart, order, items])))
    workers.push(await db.connect(), await db.connect())
    const race = await Promise.allSettled(workers.map((worker, i) => sql(worker, 'select public.commerce_checkout_command($1,$2,$3,$4,$5) value', [buyer, carts[i], reviews[i].value.quoteId, order, items])))
    assert.equal(race.filter(r => r.status === 'fulfilled').length, 1)
    assert.match(race.find(r => r.status === 'rejected').reason.message, /checkout:quote/)
    const committed = race.find(r => r.status === 'fulfilled').value.value.order
    assert.equal((await sql(db, 'select stock_quantity from public.products where id=$1', [product])).stock_quantity, 0)
    assert.equal((await sql(db, "select count(*)::int n from public.commerce_serialized_units where status='sold'")).n, 1)
    const attempt = (await sql(db, "select public.commerce_claim_payment_attempt($1,$2,'live',12345) value", [committed.id, buyer])).value.attempt
    await db.query("select public.commerce_store_payment_intention($1,'pi_live_native_race','950001','egy_csk_live_native_race')", [attempt.id])
    await db.query("update public.customer_orders set created_at=clock_timestamp()-interval '3 hours' where id=$1", [committed.id])
    await db.query("update public.payment_attempts set expires_at=clock_timestamp()-interval '2 hours' where id=$1", [attempt.id])
    await Promise.all([
      sql(workers[0], 'select public.commerce_expire_unpaid_card_orders(25) value'),
      sql(workers[1], 'select public.commerce_reconcile_payment_transaction($1)', [{ provider_order_id: '950001', transaction_id: '950002', mode: 'live', integration_id: 12345, amount_minor: 15000, currency: 'EGP', status: 'succeeded' }])
    ])
    const final = await sql(db, 'select status,payment_status,stock_reservation_released_at from public.customer_orders where id=$1', [committed.id])
    const stock = (await sql(db, 'select stock_quantity from public.products where id=$1', [product])).stock_quantity
    if (final.status === 'cancelled') { assert.equal(stock, 1); assert.ok(final.stock_reservation_released_at) }
    else { assert.equal(final.payment_status, 'paid'); assert.equal(stock, 0); assert.equal(final.stock_reservation_released_at, null) }
    assert.equal((await sql(db, 'select count(*)::int n from public.shipping_order_jobs')).n, 0)
  } finally { await Promise.allSettled(workers.map(c => c.end())); await db.close() }
})
