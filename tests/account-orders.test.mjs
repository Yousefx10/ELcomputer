import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createResetDatabase } from './helpers/resetDatabase.mjs'
import { accountOrderFilters, formatAccountMoney, orderProgress, paymentStatusLabel } from '../app/utils/accountOrders.js'

test('account filters use real order statuses and progress does not invent stages', () => {
  assert.deepEqual(accountOrderFilters.find(item => item.value === 'active').statuses.includes('on_hold'), true)
  assert.deepEqual(accountOrderFilters.find(item => item.value === 'closed').statuses, ['cancelled', 'refunded'])
  assert.deepEqual(orderProgress({ status: 'cancelled', created_at: '2026-01-01T00:00:00Z' }).map(step => step.label), ['Order placed', 'Order cancelled'])
  assert.deepEqual(orderProgress({ status: 'out_for_delivery', created_at: '2026-01-01T00:00:00Z' }).map(step => step.label), ['Order placed', 'Out for delivery'])
  assert.equal(paymentStatusLabel('paid'), 'Paid')
  assert.match(formatAccountMoney(12.5), /12\.50/)
})

test('customer order and item RLS still isolate two accounts', async () => {
  const db = await createResetDatabase()
  try {
    const alice = randomUUID(), bob = randomUUID(), aliceOrder = randomUUID(), bobOrder = randomUUID()
    await db.exec('begin')
    await db.query('insert into auth.users(id,email) values($1,$2),($3,$4)', [alice, 'account-alice@example.test', bob, 'account-bob@example.test'])
    await db.query("insert into public.customer_orders(id,user_id,first_name,phone,street_address,city,governorate) values($1,$2,'Alice','1','Street','Cairo','Cairo'),($3,$4,'Bob','2','Street','Giza','Giza')", [aliceOrder, alice, bobOrder, bob])
    await db.query("insert into public.customer_order_items(order_id,product_title,quantity) values($1,'Alice item',1),($2,'Bob item',1)", [aliceOrder, bobOrder])
    // Supabase supplies these table grants outside the checked-in schema dump.
    await db.exec('grant select on public.customer_orders, public.customer_order_items to authenticated')
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [alice])
    await db.exec('set local role authenticated')
    assert.deepEqual((await db.query('select id from public.customer_orders order by id')).rows.map(row => row.id), [aliceOrder])
    assert.deepEqual((await db.query('select product_title from public.customer_order_items')).rows.map(row => row.product_title), ['Alice item'])
    await db.exec('reset role')
    await db.exec('rollback')
  } finally { await db.close() }
})
