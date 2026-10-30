import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createEmailFixture } from './helpers/emailFixture.mjs'
import { createEmailNativeDatabase, emailNativeAvailable, nativeWaitFor } from './helpers/emailNativeDatabase.mjs'
import { smsDatabaseClient } from './helpers/smsDatabase.mjs'
import { emailRpc } from '../server/utils/email/core.js'
import { prepareEmail, createEmailService, processEmailQueue } from '../server/utils/email/service.js'
import { emailLayout } from '../app/utils/email.js'
import { prepareOrderEmail, processOrderEmailNotifications } from '../server/utils/orderEmailNotifications.js'

const sample = (changes = {}) => ({ id: randomUUID(), copy_version: 1, event_type: 'order_received', locale: 'en',
  recipient: 'buyer@fixture.example.invalid', payload: { id: randomUUID(), order_number: 'ORD-SYNTHETIC', payment_method: 'card', total_amount: '200.35', currency: 'EGP' }, ...changes })
test('order email copy uses one stable event key and escaped bilingual facts', () => {
  for (const locale of ['en', 'ar']) {
    const row = sample({ locale }), input = prepareOrderEmail(row)
    assert.equal(input.idempotency_key, row.id); assert.match(input.body, /200.35 EGP/)
    assert.equal(input.idempotency_key, prepareOrderEmail({ ...row, locale: locale === 'en' ? 'ar' : 'en' }).idempotency_key)
    const html = emailLayout({ ...input, brand: '<Fixture store>', body: input.body + '\n\n<script>canary</script>' })
    assert.ok(!html.includes('<script>')); assert.match(html, /&lt;script&gt;/)
    assert.ok(html.includes(locale === 'ar' ? 'dir="rtl"' : 'dir="ltr"'))
  }
  const cash = sample(); cash.payload.payment_method = 'cash'
  assert.match(prepareOrderEmail(cash).body, /not collected/)
  assert.throws(() => prepareOrderEmail({ ...cash, event_type: 'payment_verified' }))
  for (const changes of [{ copy_version: 2 }, { locale: 'xx' }, { event_type: 'shipped' }, { recipient: 'bad\n@example.invalid' }]) assert.throws(() => prepareOrderEmail(sample(changes)))
})

const exercise = async (t, database = null) => {
  const f = await createEmailFixture({ database }), db = f.db
  await db.query("select set_config('request.jwt.claim.role','service_role',false)")
  const originalRpc = f.client.rpc.bind(f.client)
  f.client.rpc = async (name, args) => {
    const result = await originalRpc(name, args)
    if (name === 'order_email_take' && result.error) throw Object.assign(Error(result.error.message), result.error)
    return result
  }
  await db.query("insert into public.site_settings(key,payment_card_enabled,payment_cash_enabled) values('default',true,false) on conflict(key) do update set payment_card_enabled=true")
  const rpc = async (name, args = {}) => { const result = await f.client.rpc(name, args); if (result.error) throw Object.assign(Error(result.error.message), result.error); return result.data }
  const setting = async enabled => rpc('order_email_configure', { p_actor: f.actors.owner,
    p_revision: (await db.query('select revision from public.order_email_settings')).rows[0].revision, p_enabled: enabled })
  const make = async ({ locale = 'en', cart = randomUUID(), email = 'buyer@email.example.invalid' } = {}) => (await db.query(`insert into public.customer_orders(user_id,checkout_cart_id,order_number,email,first_name,last_name,phone,street_address,city,governorate,payment_method,status,payment_status,total_amount,currency,sms_locale)
    values($1,$2,$3,$4,'Synthetic','Buyer','01012345678','Synthetic street','Cairo','Cairo','card','pending_payment','pending',200.35,'EGP',$5) returning *`, [f.actors.customer, cart, 'ORD-' + randomUUID(), email, locale])).rows[0]
  const events = async order => (await db.query('select * from public.order_email_events where order_id=$1 order by created_at,id', [order.id])).rows
  const settle = async (o, id = '731234') => {
    const a = (await db.query(`insert into public.payment_attempts(order_id,mode,integration_id,amount_minor,currency,status,provider_order_id) values($1,'live',12345,20035,'EGP','pending',$2) returning *`, [o.id, String(Number(id) + 100)])).rows[0]
    const tx = { provider_order_id: a.provider_order_id, transaction_id: id, status: 'succeeded', mode: 'live', integration_id: 12345, amount_minor: 20035, currency: 'EGP' }
    await rpc('commerce_reconcile_payment_transaction', { p_transaction: tx }); return { a, tx }
  }
  try {
    await t.test('104 leaves provider, order capture and queues off; no historical event replay', async () => {
      assert.equal((await db.query('select is_enabled from public.order_email_settings')).rows[0].is_enabled, false)
      assert.equal((await f.settings()).config.is_enabled, false)
      const before = await make(); assert.deepEqual(await events(before), [])
      await f.activate(); assert.deepEqual(await events(before), [])
      const stillOff = await make(); assert.deepEqual(await events(stillOff), [])
      await setting(true); assert.deepEqual(await events(before), []); assert.deepEqual(await events(stillOff), [])
      assert.equal((await db.query('select count(*)::int n from public.email_messages')).rows[0].n, 0)
    })
    let received, receivedEvent, paidOrder
    await t.test('new bilingual order capture snapshots one recipient/event without touching payment', async () => {
      received = await make({ locale: 'ar' }); [receivedEvent] = await events(received)
      assert.equal(receivedEvent.state, 'pending'); assert.equal(receivedEvent.locale, 'ar')
      assert.equal(receivedEvent.event_type, 'order_received'); assert.equal(receivedEvent.recipient, received.email)
      assert.equal(received.payment_status, 'pending'); assert.equal(Number(received.amount_paid), 0)
      assert.equal((await db.query('select count(*)::int n from public.payment_attempts where order_id=$1', [received.id])).rows[0].n, 0)
    })
    await t.test('replayed order updates and worker recovery create one central email', async () => {
      await db.query('update public.customer_orders set payment_status=payment_status where id=$1', [received.id])
      assert.equal((await events(received)).length, 1)
      const result = await processOrderEmailNotifications(f.client)
      assert.equal(result.processed.length, 1); assert.equal(result.processed[0].state, 'queued')
      const e = (await events(received))[0], m = await f.message(e.email_message_id)
      assert.equal(m.idempotency_key, e.id); assert.equal(m.category, 'orders:order_received'); assert.equal(m.locale, 'ar')
      assert.equal(m.state, 'queued'); assert.equal(m.delivery_state, 'unobserved')
      assert.deepEqual(await processOrderEmailNotifications(f.client), { processed: [] })
    })
    await t.test('verified live settlement captures once; stale awaiting-payment receipt is suppressed', async () => {
      paidOrder = await make(); const { tx } = await settle(paidOrder)
      await rpc('commerce_reconcile_payment_transaction', { p_transaction: tx })
      const all = await events(paidOrder); assert.equal(all.length, 2)
      await processOrderEmailNotifications(f.client, { limit: 3 })
      const updated = await events(paidOrder)
      assert.equal(updated.find(e => e.event_type === 'order_received').state, 'suppressed')
      const paid = updated.find(e => e.event_type === 'payment_verified'); assert.equal(paid.state, 'queued')
      assert.match((await f.message(paid.email_message_id)).subject, /Payment confirmed/)
      assert.equal((await db.query('select count(*)::int n from public.shipping_order_jobs')).rows[0].n, 0)
    })
    await t.test('provider acceptance is distinct from delivery; uncertain dispatch never resends', async () => {
      await f.unthrottle(); let calls = 0
      const provider = { submit: async (_s, _k, _m, dispatch) => { await dispatch(); calls++; return { state: 'uncertain', error_category: 'transport_unknown' } } }
      const result = await processEmailQueue(f.client, { provider })
      assert.equal(result[0].state, 'uncertain'); assert.equal(calls, 1)
      const id = result[0].id
      await f.unthrottle(); await processEmailQueue(f.client, { provider: { submit: async (_s, _k, m, dispatch) => { assert.notEqual(m.id, id); await dispatch(); return { state: 'accepted', provider_message_id: randomUUID() + '@fixture.invalid', http_status: 201 } } } })
      assert.equal((await f.message(id)).state, 'uncertain'); assert.equal((await f.message(id)).delivery_state, 'unobserved')
      assert.equal((await db.query('select count(*)::int n from public.email_attempts where message_id=$1', [id])).rows[0].n, 1)
    })
    await t.test('disabling order emails before dispatch suppresses queued mail and cannot replay on reenable', async () => {
      const o = await make(); await processOrderEmailNotifications(f.client); const e = (await events(o))[0]
      await f.unthrottle(); const lease = await emailRpc(f.client, 'claim'); assert.equal(lease.id, e.email_message_id)
      await setting(false)
      assert.equal((await emailRpc(f.client, 'dispatch', { id: lease.id, work_token: lease.work_token })).allowed, false)
      assert.equal((await f.message(lease.id)).state, 'suppressed')
      const duringOff = await make(); await setting(true); assert.deepEqual(await events(duringOff), [])
      assert.deepEqual(await processOrderEmailNotifications(f.client), { processed: [] })
    })
    await t.test('legacy/imported orders and malformed recipients cannot enqueue', async () => {
      const legacy = await make({ cart: null }); assert.deepEqual(await events(legacy), [])
      const bad = await make({ email: 'bad\n@example.invalid' })
      assert.deepEqual(await events(bad), [])
      assert.deepEqual(await processOrderEmailNotifications(f.client), { processed: [] })
    })
    await t.test('Test-mode success and a rejected wrong amount cannot create verified-paid mail', async () => {
      const o = await make(), a = (await db.query("insert into public.payment_attempts(order_id,mode,integration_id,amount_minor,currency,status,provider_order_id) values($1,'test',12345,20035,'EGP','pending','12388001') returning *", [o.id])).rows[0]
      const tx = { provider_order_id: a.provider_order_id, transaction_id: '12388002', status: 'succeeded', mode: 'test', integration_id: 12345, amount_minor: 20035, currency: 'EGP' }
      await assert.rejects(() => rpc('commerce_reconcile_payment_transaction', { p_transaction: { ...tx, amount_minor: 20034 } }))
      await rpc('commerce_reconcile_payment_transaction', { p_transaction: tx })
      assert.equal((await db.query('select payment_status from public.customer_orders where id=$1', [o.id])).rows[0].payment_status, 'pending')
      assert.ok((await events(o)).every(e => e.event_type !== 'payment_verified'))
      await processOrderEmailNotifications(f.client)
      const m = await f.message((await events(o))[0].email_message_id)
      assert.match(m.subject, /awaiting payment/); assert.doesNotMatch(m.subject, /confirmed/)
      // Retire the fixture queue so later cases have an explicit single candidate.
      await setting(false); await setting(true)
    })
    await t.test('forged recipient and wrong preparation token cannot create a central message', async () => {
      const o = await make(), row = await rpc('order_email_take'), input = prepareOrderEmail(row)
      assert.equal(row.order_id, o.id)
      const context = { id: row.id, token: row.work_token, event_type: row.event_type }
      const count = (await db.query('select count(*)::int n from public.email_messages')).rows[0].n
      await assert.rejects(() => createEmailService(f.client).sendTransactional({ ...input, recipient: 'other@fixture.invalid' }, { orderNotification: context }))
      await assert.rejects(() => createEmailService(f.client).sendTransactional(input, { orderNotification: { ...context, token: randomUUID() } }))
      assert.equal((await db.query('select count(*)::int n from public.email_messages')).rows[0].n, count)
      await rpc('order_email_finish', { p_id: row.id, p_token: row.work_token, p_reason: 'invalid_content' })
    })
    await t.test('lost enqueue acknowledgement recovers one durable linked email without resend', async () => {
      const o = await make(), original = f.client.rpc; let lost = false
      f.client.rpc = async (name, args) => {
        const result = await original(name, args)
        if (name === 'order_email_enqueue' && !lost && !result.error) { lost = true; throw Error('Synthetic lost HTTP acknowledgement') }
        return result
      }
      try { await processOrderEmailNotifications(f.client) } finally { f.client.rpc = original }
      const e = (await events(o))[0]; assert.equal(e.state, 'queued'); assert.ok(e.email_message_id)
      assert.deepEqual(await processOrderEmailNotifications(f.client), { processed: [] })
      assert.equal((await db.query('select count(*)::int n from public.email_messages where idempotency_key=$1', [e.id])).rows[0].n, 1)
      await setting(false); await setting(true)
    })
    await t.test('worker revocation after claim suppresses preparation without provider work', async () => {
      const o = await make(); let authorizations = 0
      await assert.rejects(() => processOrderEmailNotifications(f.client, { authorize: () => {
        if (++authorizations === 2) throw Object.assign(Error('Fixture worker revoked'), { statusCode: 401 })
      } }))
      const e = (await events(o))[0]; assert.equal(e.state, 'suppressed'); assert.equal(e.email_message_id, null)
    })
    await t.test('capture storage failure cannot roll back the customer order', async () => {
      await db.exec("create function public.fixture_order_email_fail() returns trigger language plpgsql as $$begin raise exception 'synthetic capture failure';end$$; create trigger a_fixture_order_email_fail before insert on public.order_email_events for each row execute function public.fixture_order_email_fail()")
      try { const o = await make(); assert.ok(o.id); assert.equal(o.payment_status, 'pending'); assert.deepEqual(await events(o), []) }
      finally { await db.exec('drop trigger a_fixture_order_email_fail on public.order_email_events;drop function public.fixture_order_email_fail()') }
    })
    await t.test('unauthorized configuration and browser-role table/RPC access are denied', async () => {
      const revision = (await db.query('select revision from public.order_email_settings')).rows[0].revision
      await assert.rejects(() => rpc('order_email_configure', { p_actor: f.actors.customer, p_revision: revision, p_enabled: true }))
      await assert.rejects(() => rpc('order_email_configure', { p_actor: f.actors.owner, p_revision: revision - 1, p_enabled: true }))
      for (const role of ['anon', 'authenticated']) {
        await db.exec('set role ' + role)
        await assert.rejects(() => db.query('select * from public.order_email_events'))
        await assert.rejects(() => db.query('select public.order_email_take()'))
        await db.exec('reset role')
      }
      await db.exec('set role service_role'); await assert.rejects(() => db.query('update public.order_email_settings set is_enabled=true')); await db.exec('reset role')
    })
    await t.test('retained notification evidence prevents order or event deletion', async () => {
      await assert.rejects(() => db.query('delete from public.customer_orders where id=$1', [received.id]), /foreign key|reference|retained/i)
      await assert.rejects(() => db.query('delete from public.order_email_events where order_id=$1', [received.id]), /Canonical/)
    })
    return { f, make, events, rpc, setting }
  } catch (error) { if (!database) await db.close(); throw error }
}

test('order receipts and verified payment use the existing private email transaction', { timeout: 90000 }, async t => {
  const result = await exercise(t)
  await result.f.db.close()
})

test('independent PostgreSQL workers cannot duplicate order receipt materialization', { skip: !emailNativeAvailable, timeout: 90000 }, async t => {
  const db = await createEmailNativeDatabase()
  try {
    const { f, make } = await exercise(t, db), o = await make(), workers = await Promise.all([db.connect('service_role'), db.connect('service_role')]), clients = workers.map(c => smsDatabaseClient(c)), blocker = await db.connect()
    await blocker.query('begin'); await blocker.query("select id from public.email_provider_settings where id='brevo' for update")
    const pending = clients.map(c => c.rpc('order_email_take'))
    await nativeWaitFor(async () => Number((await db.query("select count(*) n from pg_stat_activity where pid=any($1::int[]) and wait_event_type='Lock'", [workers.map(c => c.processID)])).rows[0].n) === 2)
    await blocker.query('commit'); const results = await Promise.all(pending)
    assert.ok(results.every(x => !x.error), JSON.stringify(results)); const row = results.map(x => x.data).find(Boolean)
    assert.equal(results.filter(x => x.data).length, 1); assert.equal(row.order_id, o.id)
    const input = prepareOrderEmail(row), context = { id: row.id, token: row.work_token, event_type: row.event_type }
    const values = await Promise.all(clients.map(c => createEmailService(c).sendTransactional(input, { orderNotification: context })))
    assert.equal(new Set(values.map(x => x.id)).size, 1)
    assert.equal((await db.query('select count(*)::int n from public.email_messages where idempotency_key=$1', [row.id])).rows[0].n, 1)
    await f.unthrottle()
  } finally { await db.close() }
})
