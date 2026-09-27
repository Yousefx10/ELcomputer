import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createResetDatabase } from './helpers/resetDatabase.mjs'
import { calculatePreorderAmounts, serializeSellingConfig } from '../app/utils/preorder.js'

test('preorders preserve financial snapshots, limits, idempotency and fulfillment safety', async () => {
  const db = await createResetDatabase()
  const customer = randomUUID()
  const admin = randomUUID()
  const product = randomUUID()
  const normalProduct = randomUUID()
  const soonProduct = randomUUID()
  const variantProduct = randomUUID()
  const variantId = randomUUID()
  const warehouseId = randomUUID()
  const orderPayload = number => ({ order_number: `PRE-${number}`, first_name: 'Buyer', phone: '01000000000', street_address: 'Street', city: 'Cairo', governorate: 'Cairo', payment_method: 'bank_transfer' })
  const item = (id, quantity = 1) => [{ product_id: id, quantity }]
  const checkout = async (id, cart, quantity = 1, suffix = cart.slice(0, 8)) => (await db.query(
    `select public.commerce_create_preorder($1,$2::jsonb,$3::jsonb,$4) as value`,
    [customer, JSON.stringify(orderPayload(suffix)), JSON.stringify(item(id, quantity)), cart]
  )).rows[0].value
  const fails = async (operation, pattern) => {
    await db.exec('savepoint expected_failure')
    await assert.rejects(operation, pattern)
    await db.exec('rollback to savepoint expected_failure')
  }

  try {
    await db.exec('begin')
    await db.query("select set_config('request.jwt.claim.role', 'service_role', true)")
    await db.query(`insert into auth.users(id,email) values($1,'pre-buyer@example.com'),($2,'pre-admin@example.com')`, [customer, admin])
    await db.query(`insert into public.admin_users(id,email,role) values($1,'pre-admin@example.com','owner')`, [admin])
    await db.query(`insert into public.site_settings(key,payment_bank_transfer_enabled,payment_bank_transfer_fee,erp_mode,daftra_connection_status) values('default',true,12.50,'daftra','connected') on conflict(key) do update set payment_bank_transfer_enabled=true,payment_bank_transfer_fee=12.50,erp_mode='daftra',daftra_connection_status='connected'`)
    await db.query(`update public.shipping_provider_settings set is_enabled=true,auto_create_labels=true where id='pdc'`)
    await db.query("select set_config('app.serialized_inventory_write', 'on', true)")
    await db.query(`insert into public.products(id,title,slug,price,stock_quantity,is_serialized,selling_mode,preorder_payment_mode,preorder_deposit_percent,preorder_total_limit,preorder_customer_limit) values($1,'Upcoming GPU',($1::uuid)::text,10000,0,false,'preorder','deposit',25,3,2)`, [product])
    await db.query(`insert into public.products(id,title,slug,price,stock_quantity,is_serialized) values($1,'Normal',($1::uuid)::text,100,5,false)`, [normalProduct])
    await db.query(`insert into public.products(id,title,slug,price,stock_quantity,is_serialized,selling_mode) values($1,'Soon',($1::uuid)::text,100,0,false,'coming_soon')`, [soonProduct])
    await db.query("select set_config('app.serialized_inventory_write', 'off', true)")

    await fails(() => db.query(`select public.commerce_create_customer_order($1,$2::jsonb,$3::jsonb,false,$4)`, [customer, JSON.stringify(orderPayload('soon')), JSON.stringify(item(soonProduct)), randomUUID()]), /not available for normal checkout/)
    await fails(() => db.query(`select public.commerce_create_customer_order($1,$2::jsonb,$3::jsonb,false,$4)`, [customer, JSON.stringify(orderPayload('pre')), JSON.stringify(item(product)), randomUUID()]), /not available for normal checkout/)

    const cart = randomUUID()
    const first = await checkout(product, cart, 2)
    assert.equal(first.created, true)
    assert.equal(Number(first.order.subtotal_amount), 20000)
    assert.equal(Number(first.order.total_amount), 20012.5)
    assert.equal(Number(first.order.initial_amount_due), 5012.5)
    assert.equal(Number(first.order.amount_paid), 0)
    assert.equal(first.order.payment_status, 'pending')
    assert.equal(first.order.status, 'on_hold')
    assert.equal((await checkout(product, cart, 2)).created, false)
    assert.equal((await db.query(`select count(*)::int as count from public.customer_orders where checkout_cart_id=$1`, [cart])).rows[0].count, 1)
    const snapshot = (await db.query(`select * from public.customer_order_items where order_id=$1`, [first.order.id])).rows[0]
    assert.equal(Number(snapshot.unit_price), 10000)
    assert.equal(Number(snapshot.preorder_deposit_percent), 25)
    assert.equal(Number(snapshot.initial_amount_due), 5000)
    assert.equal((await db.query(`select stock_quantity from public.products where id=$1`, [product])).rows[0].stock_quantity, 0)

    await db.query(`update public.products set price=12000, preorder_deposit_percent=30 where id=$1`, [product])
    assert.equal(Number((await db.query(`select unit_price from public.customer_order_items where order_id=$1`, [first.order.id])).rows[0].unit_price), 10000)
    await fails(() => checkout(product, randomUUID(), 1), /quantity limit/)
    await db.query(`update public.products set preorder_customer_limit=null where id=$1`, [product])
    const second = await checkout(product, randomUUID(), 1)
    assert.equal(Number(second.order.initial_amount_due), 3612.5)
    await fails(() => checkout(product, randomUUID(), 1), /allocation is sold out/)

    await fails(() => db.query(`update public.customer_orders set status='processing' where id=$1`, [first.order.id]), /awaiting stock/)
    await db.query(`update public.customer_orders set payment_status='paid' where id=$1`, [first.order.id])
    assert.equal((await db.query(`select count(*)::int as count from public.shipping_order_jobs where order_id=$1`, [first.order.id])).rows[0].count, 0)
    assert.equal((await db.query(`select count(*)::int as count from public.erp_sync_jobs where local_id=$1`, [first.order.id])).rows[0].count, 0)
    await db.query(`update public.customer_orders set payment_status='pending' where id=$1`, [first.order.id])

    const paid = (await db.query(`select public.commerce_record_preorder_payment($1,$2,5012.50,'BANK-TRANSFER-123') as value`, [first.order.id, admin])).rows[0].value
    assert.equal(Number(paid.amount_paid), 5012.5)
    assert.equal(paid.payment_status, 'partially_paid')
    assert.equal(Number(paid.total_amount) - Number(paid.amount_paid), 15000)
    await fails(() => db.query(`select public.commerce_record_preorder_payment($1,$2,5012.50,'BANK-TRANSFER-123')`, [first.order.id, admin]), /duplicate key/)
    await db.query(`update public.customer_orders set status='cancelled' where id=$1`, [first.order.id])
    assert.equal((await db.query(`select count(*)::int as count from public.preorder_payments where order_id=$1`, [first.order.id])).rows[0].count, 1)
    const replacement = await checkout(product, randomUUID(), 2)
    assert.equal(replacement.created, true)

    await db.query(`update public.products set preorder_starts_at=now()+interval '1 day' where id=$1`, [product])
    await fails(() => checkout(product, randomUUID()), /not opened yet/)
    await db.query(`update public.products set preorder_starts_at=null,preorder_ends_at=now()-interval '1 day' where id=$1`, [product])
    await fails(() => checkout(product, randomUUID()), /has closed/)
    await db.query(`update public.products set preorder_ends_at=null,preorder_payment_mode='full',preorder_total_limit=null where id=$1`, [product])
    const full = await checkout(product, randomUUID())
    assert.equal(Number(full.order.initial_amount_due), Number(full.order.total_amount))
    await fails(() => db.query(`update public.products set preorder_payment_mode='deposit',preorder_deposit_percent=0 where id=$1`, [product]), /products_preorder_payment_check/)
    await fails(() => db.query(`update public.products set preorder_payment_mode='deposit',preorder_deposit_percent=100 where id=$1`, [product]), /products_preorder_payment_check/)
    await fails(() => db.query(`update public.products set price=0 where id=$1`, [product]), /products_preorder_price_check/)
    await db.query(`select public.commerce_record_preorder_payment($1,$2,$3,'STANDARD-PAID-123')`, [full.order.id, admin, Number(full.order.total_amount)])
    await fails(() => db.query(`select public.commerce_release_preorder($1,$2)`, [full.order.id, admin]), /Physical product stock has not arrived/)
    await db.query(`update public.products set stock_quantity=1 where id=$1`, [product])
    const standardRelease = (await db.query(`select public.commerce_release_preorder($1,$2) as value`, [full.order.id, admin])).rows[0].value
    assert.equal(standardRelease.preorder_fulfillment_state, 'ready')
    assert.equal((await db.query(`select stock_quantity from public.products where id=$1`, [product])).rows[0].stock_quantity, 0)

    const normal = (await db.query(`select public.commerce_create_customer_order($1,$2::jsonb,$3::jsonb,false,$4) as value`, [customer, JSON.stringify({ ...orderPayload('normal'), payment_method: 'cash' }), JSON.stringify(item(normalProduct)), randomUUID()])).rows[0].value
    assert.equal(normal.created, true)
    assert.equal(normal.order.is_preorder, false)
    assert.equal((await db.query(`select stock_quantity from public.products where id=$1`, [normalProduct])).rows[0].stock_quantity, 4)

    await db.query("select set_config('app.serialized_inventory_write', 'on', true)")
    await db.query(`insert into public.commerce_warehouses(id,name) values($1,'Preorder warehouse')`, [warehouseId])
    await db.query(`insert into public.products(id,title,slug,price,is_serialized,primary_warehouse_id,selling_mode) values($1,'New phone',($1::uuid)::text,1234.56,true,$2,'preorder')`, [variantProduct, warehouseId])
    await db.query(`insert into public.product_variants(id,product_id,name,code,price,stock_quantity) values($1,$2,'Blue','BLUE',1,0)`, [variantId, variantProduct])
    await db.query("select set_config('app.serialized_inventory_write', 'off', true)")
    const variantOrder = (await db.query(`select public.commerce_create_preorder($1,$2::jsonb,$3::jsonb,$4) as value`, [customer, JSON.stringify(orderPayload('variant')), JSON.stringify([{ product_id: variantProduct, variant_id: variantId, quantity: 1 }]), randomUUID()])).rows[0].value
    assert.equal(Number(variantOrder.order.initial_amount_due), 1247.06)
    const variantSnapshot = (await db.query(`select variant_id,unit_price from public.customer_order_items where order_id=$1`, [variantOrder.order.id])).rows[0]
    assert.equal(variantSnapshot.variant_id, variantId)
    assert.equal(Number(variantSnapshot.unit_price), 1234.56)
    const forgedLine = (await db.query(`select public.commerce_create_preorder($1,$2::jsonb,$3::jsonb,$4) as value`, [customer, JSON.stringify(orderPayload('forged')), JSON.stringify([{ product_id: variantProduct, variant_id: variantId, quantity: 1, price: 0.01, preorder_deposit_percent: 99, initial_amount_due: 0.01 }]), randomUUID()])).rows[0].value
    assert.equal(Number(forgedLine.order.initial_amount_due), 1247.06)
    assert.equal(Number((await db.query(`select unit_price from public.customer_order_items where order_id=$1`, [forgedLine.order.id])).rows[0].unit_price), 1234.56)
    assert.equal((await db.query(`select stock_quantity from public.product_variants where id=$1`, [variantId])).rows[0].stock_quantity, 0)
    await db.query(`select public.commerce_record_preorder_payment($1,$2,1247.06,'PHONE-PAID-123')`, [variantOrder.order.id, admin])
    await fails(() => db.query(`select public.commerce_release_preorder($1,$2)`, [variantOrder.order.id, admin]), /serialized units have arrived/)
    await db.query("select set_config('app.serialized_inventory_write', 'on', true)")
    await db.query(`update public.products set stock_quantity=1 where id=$1`, [variantProduct])
    await db.query(`update public.product_variants set stock_quantity=1 where id=$1`, [variantId])
    await db.query(`insert into public.commerce_warehouse_inventory(warehouse_id,product_id,quantity) values($1,$2,1)`, [warehouseId, variantProduct])
    await db.query(`insert into public.commerce_serialized_units(unit_code,product_id,variant_id,warehouse_id) values('PHONE-UNIT-1',$1,$2,$3)`, [variantProduct, variantId, warehouseId])
    await db.query("select set_config('app.serialized_inventory_write', 'off', true)")
    const released = (await db.query(`select public.commerce_release_preorder($1,$2) as value`, [variantOrder.order.id, admin])).rows[0].value
    assert.equal(released.preorder_fulfillment_state, 'ready')
    assert.equal(released.status, 'processing')
    assert.equal((await db.query(`select status,customer_order_item_id from public.commerce_serialized_units where unit_code='PHONE-UNIT-1'`)).rows[0].status, 'sold')
    assert.equal((await db.query(`select stock_quantity from public.product_variants where id=$1`, [variantId])).rows[0].stock_quantity, 0)
    assert.equal((await db.query(`select quantity from public.commerce_warehouse_inventory where product_id=$1`, [variantProduct])).rows[0].quantity, 0)
    assert.equal((await db.query(`select count(*)::int as count from public.erp_sync_jobs where local_id=$1`, [variantOrder.order.id])).rows[0].count, 0)
    assert.equal((await db.query(`select count(*)::int as count from public.shipping_order_jobs where order_id=$1`, [variantOrder.order.id])).rows[0].count, 1)
    assert.equal((await db.query(`select public.commerce_release_preorder($1,$2) as value`, [variantOrder.order.id, admin])).rows[0].value.status, 'processing')
  } finally {
    await db.exec('rollback').catch(() => {})
    await db.close()
  }
})

test('money preview uses cents for percentage deposits', () => {
  assert.deepEqual(calculatePreorderAmounts('12999.00', 1, 'deposit', '25'), { total: 12999, due: 3249.75, balance: 9749.25 })
  assert.deepEqual(calculatePreorderAmounts('0.01', 3, 'deposit', '25'), { total: 0.03, due: 0.01, balance: 0.02 })
})

test('staff preorder times are saved as explicit instants', () => {
  const value = '2026-10-01T10:30'
  assert.equal(serializeSellingConfig({ preorder_starts_at: value, preorder_ends_at: '' }).preorder_starts_at, new Date(value).toISOString())
  assert.equal(serializeSellingConfig({ preorder_starts_at: value, preorder_ends_at: '' }).preorder_ends_at, null)
})
