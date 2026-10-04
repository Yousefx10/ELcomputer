import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createServer } from 'node:net'
import { prepareResetDatabase } from './helpers/resetDatabase.mjs'

// No database URL is accepted: these checks create and destroy their own local cluster.
// Set both paths to run. Ordinary tests retain PGlite coverage without installing a server.
const bin = process.env.PAYMOB_REVIEW_PG_BIN
const driver = process.env.PAYMOB_REVIEW_PG_DRIVER
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const waitFor = async predicate => {
  for (let i = 0; i < 100; i++) { if (await predicate()) return; await delay(50) }
  throw new Error('Native PostgreSQL barrier did not become ready')
}

test('native PostgreSQL concurrent claims, webhook replay, transaction binding and cancellation', { skip: !bin || !driver, timeout: 60000 }, async t => {
  const { default: pg } = await import(pathToFileURL(driver).href)
  const directory = await mkdtemp(join(tmpdir(), 'paymob-review-pg-'))
  const probe = createServer()
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve))
  const port = probe.address().port
  await new Promise(resolve => probe.close(resolve))
  let server, logs = '', db
  const clients = []
  const connect = async () => {
    const client = new pg.Client({ host: '127.0.0.1', port, user: 'payment_review', database: 'postgres', connectionTimeoutMillis: 1000 })
    await client.connect(); clients.push(client)
    await client.query("set statement_timeout='10s'; select set_config('request.jwt.claim.role','service_role',false)")
    return client
  }
  try {
    await promisify(execFile)(join(bin, 'initdb'), ['-D', directory, '-U', 'payment_review', '-A', 'trust', '--no-sync', '--locale=C', '--encoding=UTF8'])
    server = spawn(join(bin, 'postgres'), ['-D', directory, '-h', '127.0.0.1', '-p', String(port), '-k', directory], { stdio: ['ignore', 'ignore', 'pipe'] })
    server.stderr.on('data', chunk => { logs = (logs + chunk).slice(-3000) })
    await waitFor(async () => { try { db = await connect(); return true } catch { return false } })
    await prepareResetDatabase({ exec: sql => db.query(sql) })
    const customer = randomUUID(), product = randomUUID(), variant = randomUUID(), warehouse = randomUUID()
    await db.query("insert into auth.users(id,email) values($1,'concurrent@example.invalid')", [customer])
    await db.query("insert into public.site_settings(key,payment_card_enabled,payment_card_fee) values('default',true,12.50) on conflict(key) do update set payment_card_enabled=true,payment_card_fee=12.50")
    await db.query("update public.shipping_provider_settings set is_enabled=true,auto_create_labels=true where id='pdc'")
    await db.query("select set_config('app.serialized_inventory_write','on',false)")
    await db.query("insert into public.commerce_warehouses(id,name) values($1,'Concurrency fixture')", [warehouse])
    await db.query("insert into public.products(id,title,slug,price,stock_quantity,is_serialized,primary_warehouse_id) values($1,'Serialized fixture',($1::uuid)::text,100,5,true,$2)", [product, warehouse])
    await db.query("insert into public.product_variants(id,product_id,name,code,price,stock_quantity) values($1,$2,'Fixture','FIXTURE',1,5)", [variant, product])
    await db.query("insert into public.commerce_warehouse_inventory(warehouse_id,product_id,quantity) values($1,$2,5)", [warehouse, product])
    for (let i = 0; i < 5; i++) await db.query("insert into public.commerce_serialized_units(unit_code,product_id,variant_id,warehouse_id) values($1,$2,$3,$4)", ['REVIEW-' + i, product, variant, warehouse])
    await db.query("select set_config('app.serialized_inventory_write','off',false)")
    // Observe every paid transition independently of the production shipping dedupe.
    await db.query("create table public.review_paid_events(order_id uuid); create function public.review_count_paid() returns trigger language plpgsql as $$ begin if new.payment_status='paid' and old.payment_status is distinct from 'paid' then insert into public.review_paid_events values(new.id); end if; return new; end $$; create trigger review_count_paid after update on public.customer_orders for each row execute function public.review_count_paid()")
    const checkout = async cart => (await db.query('select public.commerce_create_customer_order($1,$2::jsonb,$3::jsonb,false,$4) result', [customer, JSON.stringify({ first_name: 'Buyer', phone: '01000000000', street_address: 'Street', city: 'Cairo', governorate: 'Cairo', payment_method: 'card' }), JSON.stringify([{ product_id: product, variant_id: variant, quantity: 1 }]), cart])).rows[0].result
    const cart = randomUUID(), first = await checkout(cart), id = first.order.id
    const workers = await Promise.all([connect(), connect(), connect()]), blocker = await connect()
    const blocked = count => waitFor(async () => Number((await db.query("select count(*) n from pg_stat_activity where pid=any($1::int[]) and wait_event_type='Lock'", [workers.map(client => client.processID)])).rows[0].n) === count)
    const hold = async ids => { await blocker.query('begin'); await blocker.query('select id from public.customer_orders where id=any($1::uuid[]) order by id for update', [ids]) }
    const claim = client => client.query("select public.commerce_claim_payment_attempt($1,$2,'test',12345) result", [id, customer])
    let attempt
    await t.test('independent sessions wait on the same order and create exactly one attempt', async () => {
      await hold([id])
      const pending = workers.map(claim)
      await blocked(3); await blocker.query('commit')
      const values = (await Promise.all(pending)).map(value => value.rows[0].result)
      assert.equal(values.filter(value => value.created).length, 1)
      assert.equal(new Set(values.map(value => value.attempt.id)).size, 1)
      attempt = values[0].attempt
      await db.query("select public.commerce_store_payment_intention($1,'pi_test_concurrent','90001','egy_csk_test_concurrent')", [attempt.id])
    })
    const reconcile = (client, changes = {}) => client.query('select public.commerce_reconcile_payment_transaction($1::jsonb)', [JSON.stringify({ provider_order_id: '90001', transaction_id: '80001', mode: 'test', integration_id: 12345, amount_minor: 11250, currency: 'EGP', status: 'succeeded', ...changes })])
    const snapshot = async () => ({
      units: (await db.query('select id,status,customer_order_id,customer_order_item_id from public.commerce_serialized_units order by id')).rows,
      movements: (await db.query('select count(*)::int n from public.commerce_serialized_unit_movements')).rows[0].n,
      stock: (await db.query('select stock_quantity from public.product_variants where id=$1', [variant])).rows[0].stock_quantity
    })
    await t.test('racing test successes cannot settle or repeat serialized allocation/events/fulfillment', async () => {
      const before = await snapshot()
      await hold([id]); const pending = workers.map(client => reconcile(client)); await blocked(3); await blocker.query('commit'); await Promise.all(pending)
      assert.deepEqual(await snapshot(), before)
      assert.equal((await db.query('select payment_status from public.customer_orders where id=$1', [id])).rows[0].payment_status, 'pending')
      assert.equal((await db.query('select count(*)::int n from public.review_paid_events')).rows[0].n, 0)
      assert.equal((await db.query('select count(*)::int n from public.shipping_order_jobs')).rows[0].n, 0)
      assert.equal((await db.query('select count(*)::int n from public.payment_transactions')).rows[0].n, 1)
      assert.equal((await checkout(cart)).created, false)
      assert.deepEqual(await snapshot(), before)
    })
    await t.test('dormant live fixture racing success/failure/pending creates one paid event and shipping job', async () => {
      // Fixture only: production claim/config remain test-only. Never call a provider.
      await db.query("update public.payment_attempts set mode='live',status='pending',paid_at=null where id=$1", [attempt.id])
      const before = await snapshot()
      await hold([id]); const pending = workers.map((client, i) => reconcile(client, { mode: 'live', status: ['succeeded','failed','pending'][i] })); await blocked(3); await blocker.query('commit'); await Promise.all(pending)
      assert.equal((await db.query('select payment_status,status from public.customer_orders where id=$1', [id])).rows[0].payment_status, 'paid')
      assert.equal((await db.query('select count(*)::int n from public.review_paid_events where order_id=$1', [id])).rows[0].n, 1)
      assert.equal((await db.query('select count(*)::int n from public.shipping_order_jobs where order_id=$1', [id])).rows[0].n, 1)
      const paid = (await db.query('select * from public.customer_orders where id=$1', [id])).rows[0]
      await Promise.all(workers.map(client => reconcile(client, { mode: 'live' })))
      assert.deepEqual((await db.query('select * from public.customer_orders where id=$1', [id])).rows[0], paid)
      assert.deepEqual(await snapshot(), before)
      assert.equal((await db.query("select count(*)::int n from public.payment_transactions where transaction_id='80001'")).rows[0].n, 1)
    })
    await t.test('the unique provider transaction cannot move between different orders racing its first insert', async () => {
      const ids = []
      for (const providerOrder of ['90002','90003']) {
        const order = await checkout(randomUUID()); ids.push(order.order.id)
        await db.query("insert into public.payment_attempts(order_id,mode,integration_id,amount_minor,currency,status,provider_order_id) values($1,'live',12345,11250,'EGP','pending',$2)", [order.order.id, providerOrder])
      }
      await hold(ids)
      const pending = workers.slice(0, 2).map((client, i) => reconcile(client, { mode: 'live', provider_order_id: ['90002','90003'][i], transaction_id: '80002' }))
      // Attach rejection handlers before releasing the barrier.
      const results = Promise.allSettled(pending)
      await blocked(2); await blocker.query('commit')
      const values = await results
      assert.equal(values.filter(value => value.status === 'fulfilled').length, 1)
      assert.match(values.find(value => value.status === 'rejected').reason.message, /another payment/)
      assert.equal((await db.query("select count(*)::int n from public.payment_transactions where transaction_id='80002'")).rows[0].n, 1)
      assert.equal((await db.query("select count(*)::int n from public.customer_orders where id=any($1::uuid[]) and payment_status='paid'", [ids])).rows[0].n, 1)
    })
    await t.test('callback blocked behind cancellation sees the committed cancelled state', async () => {
      const order = await checkout(randomUUID()), cancelled = order.order.id
      await db.query("insert into public.payment_attempts(order_id,mode,integration_id,amount_minor,currency,status,provider_order_id) values($1,'live',12345,11250,'EGP','pending','90004')", [cancelled])
      await hold([cancelled])
      const pending = reconcile(workers[0], { mode: 'live', provider_order_id: '90004', transaction_id: '80004' })
      await blocked(1); await blocker.query("update public.customer_orders set status='cancelled' where id=$1", [cancelled]); await blocker.query('commit'); await pending
      assert.equal((await db.query('select payment_status from public.customer_orders where id=$1', [cancelled])).rows[0].payment_status, 'pending')
      assert.equal((await db.query('select error_code from public.payment_attempts where order_id=$1', [cancelled])).rows[0].error_code, 'order_requires_review')
      assert.equal((await db.query('select count(*)::int n from public.shipping_order_jobs where order_id=$1', [cancelled])).rows[0].n, 0)
    })
  } catch (error) {
    if (!db) error.message += '\n' + logs
    throw error
  } finally {
    await Promise.allSettled(clients.map(client => client.end()))
    if (server && server.exitCode === null) { const ended = new Promise(resolve => server.once('exit', resolve)); server.kill('SIGTERM'); await ended }
    await rm(directory, { recursive: true, force: true })
  }
})
