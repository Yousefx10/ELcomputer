import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createEmailNativeDatabase, emailNativeAvailable } from './helpers/emailNativeDatabase.mjs'
import { createCatalogFixture, reproduceCatalogCorrection, catalogDataSnapshot, correctedTables, confidentialColumns } from './helpers/catalogFixture.mjs'
import { createOrderSmsFixture } from './helpers/orderSmsFixture.mjs'

const directory = new URL('../supabase/migrations/', import.meta.url)
const first = '20261008120000_after_sales_claims_core.sql'
const migration = '20261011140000_order_amount_constraints_reconciliation.sql'
const sql = await readFile(new URL(migration, directory), 'utf8')
const targets = ['customer_orders_subtotal_amount_check', 'customer_orders_discount_amount_check']
// Preserve the historical release's exact ordered 64–69 test boundary.
const files = (await readdir(directory)).filter(n => n.endsWith('.sql')).sort().slice(0, 69)
const constraints = async db => (await db.query("select oid,conname,convalidated,pg_get_constraintdef(oid,false) definition from pg_constraint where conrelid='public.customer_orders'::regclass and conname=any($1) order by conname", [targets])).rows
const policies = async db => (await db.query("select oid,polname,polrelid,polqual::text,polwithcheck::text from pg_policy where polrelid in (select oid from pg_class where relnamespace='public'::regnamespace and relname=any($1)) order by oid", [correctedTables])).rows
const removeChecks = 'alter table public.customer_orders drop constraint customer_orders_subtotal_amount_check, drop constraint customer_orders_discount_amount_check;'
const addChecks = 'alter table public.customer_orders add constraint customer_orders_subtotal_amount_check check(subtotal_amount>=0), add constraint customer_orders_discount_amount_check check(discount_amount>=0);'

// Snapshot actual catalogs, not an emulated migration ledger. Callback tracing
// records only successfully executed SQL identities; no history entries are invented.
const metadata = async db => (await db.query(`select jsonb_build_object(
 'constraints',(select jsonb_agg(to_jsonb(x) order by oid) from (select oid,conrelid,conname,contype,convalidated,conbin::text,conkey,connoinherit from pg_constraint where connamespace='public'::regnamespace) x),
 'columns',(select jsonb_agg(to_jsonb(x) order by attrelid,attnum) from (select a.attrelid,a.attnum,a.attname,a.atttypid,a.atttypmod,a.attnotnull,a.attgenerated,a.attidentity,d.adbin::text from pg_attribute a join pg_class c on c.oid=a.attrelid left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where c.relnamespace='public'::regnamespace and a.attnum>0) x),
 'relations',(select jsonb_agg(to_jsonb(x) order by oid) from (select oid,relname,relowner,relacl,reloptions,relrowsecurity,relforcerowsecurity,relkind,relpersistence from pg_class where relnamespace='public'::regnamespace) x),
 'policies',(select jsonb_agg(to_jsonb(x) order by oid) from (select oid,polname,polrelid,polroles,polcmd,polpermissive,polqual::text,polwithcheck::text from pg_policy) x),
 'functions',(select jsonb_agg(to_jsonb(x) order by oid) from (select oid,proname,prosrc,proacl,proconfig,prosecdef,provolatile,proowner from pg_proc where pronamespace='public'::regnamespace) x),
 'triggers',(select jsonb_agg(to_jsonb(x) order by oid) from (select oid,tgrelid,tgname,tgenabled,tgfoid,tgtype,tgargs from pg_trigger where tgrelid in (select oid from pg_class where relnamespace='public'::regnamespace)) x),
 'roles',(select jsonb_agg(to_jsonb(x) order by rolname) from pg_roles x),
 'memberships',(select jsonb_agg(to_jsonb(x) order by roleid,member) from pg_auth_members x),
 'defaultPrivileges',(select jsonb_agg(to_jsonb(x) order by oid) from pg_default_acl x)
) state`)).rows[0].state

const verifyDormant = async db => {
  for (const table of ['after_sales_claims','after_sales_claim_events','after_sales_claim_information','after_sales_claim_evidence','shipping_claim_jobs','shipping_order_jobs','shipping_webhook_events','sms_batches','sms_messages','sms_attempts','email_messages','email_attempts','email_events','after_sales_communications','payment_attempts','payment_transactions','erp_sync_jobs']) {
    assert.equal((await db.query('select count(*)::int n from public.' + table)).rows[0].n, 0, table)
  }
  assert.equal((await db.query('select count(*)::int n from public.after_sales_communication_settings where is_enabled or sms_enabled or email_enabled')).rows[0].n, 0)
  assert.equal((await db.query("select is_enabled or auto_create_labels or reverse_enabled active from public.shipping_provider_settings where id='pdc'")).rows[0].active, false)
  assert.equal((await db.query("select is_enabled from public.sms_provider_settings where id='vodafone'")).rows[0].is_enabled, false)
  assert.equal((await db.query("select (config->>'is_enabled')::boolean active from public.email_provider_settings where id='brevo'")).rows[0].active, false)
  assert.equal((await db.query('select count(*)::int n from public.sms_order_event_settings where is_enabled')).rows[0].n, 0)
  assert.equal((await db.query('select count(*)::int n from public.sms_templates where is_enabled')).rows[0].n, 0)
  assert.equal((await db.query('select count(*)::int n from public.after_sales_policies where return_enabled or warranty_enabled')).rows[0].n, 0)
  assert.equal((await db.query("select count(*)::int n from public.sms_order_events where status<>'suppressed'")).rows[0].n, 0)
}

const verifySecurity = async (db, f = null) => {
  for (const role of ['anon', 'authenticated']) for (const [table, columns] of Object.entries(confidentialColumns)) for (const column of columns) {
    assert.equal((await db.query("select has_column_privilege($1,$2,$3,'SELECT') allowed", [role, 'public.' + table, column])).rows[0].allowed, false)
  }
  assert.equal((await policies(db)).length, 45)
  for (const table of correctedTables) {
    assert.equal((await db.query("select relrowsecurity from pg_class where oid=$1::regclass", ['public.' + table])).rows[0].relrowsecurity, true)
    for (const privilege of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) assert.equal((await db.query('select has_table_privilege($1,$2,$3) allowed', ['anon', 'public.' + table, privilege])).rows[0].allowed, false)
  }
  if (!f) return
  await assert.rejects(() => f.asRole('authenticated', f.actors.customer, () => db.query("insert into public.products(title,slug,primary_warehouse_id) values('Denied','denied-order-reconciliation',$1)", [f.warehouse])), /row-level security/)
  await assert.rejects(() => f.asRole('anon', null, () => db.query('select cost_price from public.products')), /permission denied/)
  await assert.rejects(() => f.asRole('authenticated', f.actors.customer, () => db.query('select * from public.catalog_staff_products()')), /Staff catalog access required/)
  const publicRows = await f.asRole('anon', null, () => db.query('select id,price from public.storefront_products'))
  assert.ok(publicRows.rows.some(row => row.id === f.published))
  assert.ok(!publicRows.rows.some(row => row.id === f.draft))
  const internal = await f.asRole('authenticated', f.actors.owner, () => db.query('select id,cost_price,primary_warehouse_id,default_supplier_id from public.catalog_staff_products() where id=$1', [f.published]))
  assert.equal(Number(internal.rows[0].cost_price), 991.37)
  const edited = await f.asRole('authenticated', f.actors.editor, () => db.query('update public.products set title=$1 where id=$2 returning id', ['Local order reconciliation edit', f.draft]))
  assert.equal(edited.rows[0].id, f.draft)
}

test('migration 69 has the next identity and leaves every reviewed pending migration unchanged', async () => {
  assert.equal(files.length, 69)
  assert.equal(files[68], migration)
  const archive = await readFile(new URL('../docs/security/20261011-order-constraints-correction.sql', import.meta.url))
  assert.equal(createHash('sha256').update(archive).digest('hex'), '94305f9983dbc993b1e28c304a20837a575b4accdd43815499cac5966e349181')
  assert.equal(createHash('sha256').update(await readFile(new URL(files[67], directory))).digest('hex'), 'e7d9fb35a05f9c8cb2b82c343efdb79e515c607842e0d7f9c5369e4365bb3cae')
})

for (const scenario of ['A fresh canonical', 'B corrected populated checkpoint 63', 'C canonical populated checkpoint 63', 'D supported absent pair']) {
  test('native ordered 64→69: ' + scenario, { skip: !emailNativeAvailable, timeout: 90000 }, async t => {
    const executed = []
    const db = await createEmailNativeDatabase({ stopBefore: first, onMigration: name => executed.push(name) })
    let f, orderFixture
    try {
      assert.match(db.version, /^17\./)
      assert.deepEqual(executed, files.slice(0, 63))
      if (!scenario.startsWith('A')) {
        f = await createCatalogFixture({ database: db })
        orderFixture = await createOrderSmsFixture({ database: db })
        await orderFixture.checkout({ locale: 'en' })
        await orderFixture.checkout({ locale: 'ar', method: 'bank_transfer', preorder: true })
      }
      if (scenario.startsWith('B')) {
        await reproduceCatalogCorrection(db)
        await db.exec(removeChecks)
        const archive = await readFile(new URL('../docs/security/20261011-order-constraints-correction.sql', import.meta.url), 'utf8')
        // Exact approved ALTER statements, only inside this disposable fixture.
        await db.exec('begin;\n' + archive.slice(archive.indexOf('ALTER TABLE public.customer_orders'), archive.indexOf("NOTIFY pgrst")) + '\ncommit;')
      }
      if (scenario.startsWith('D')) await db.exec(removeChecks)
      const initialChecks = await constraints(db), initialPolicies = await policies(db)
      const data = await catalogDataSnapshot(db)
      const orders = (await db.query('select to_jsonb(t) row from public.customer_orders t order by id')).rows
      let pre69
      await t.test('every pending identity executes in order and 69 preserves or restores exactly two checks', async () => {
        for (const name of files.slice(63)) {
          if (name === migration) pre69 = await metadata(db)
          await db.exec(await readFile(new URL(name, directory), 'utf8'))
          executed.push(name)
        }
        assert.deepEqual(executed, files)
        assert.equal(new Set(executed).size, 69)
        const finalChecks = await constraints(db)
        assert.equal(finalChecks.length, 2)
        for (const c of finalChecks) {
          assert.equal(c.convalidated, true)
          assert.equal(c.definition, 'CHECK ((' + c.conname.slice('customer_orders_'.length, -'_check'.length) + ' >= (0)::numeric))')
        }
        if (initialChecks.length) assert.deepEqual(finalChecks, initialChecks, 'existing CHECK OIDs and definitions preserved')
        const current = await metadata(db)
        const ordersId = (await db.query("select 'public.customer_orders'::regclass::oid id")).rows[0].id
        current.constraints = current.constraints.filter(c => !targets.includes(c.conname) || String(c.conrelid) !== String(ordersId))
        const baseline = { ...pre69, constraints: pre69.constraints.filter(c => !targets.includes(c.conname) || String(c.conrelid) !== String(ordersId)) }
        assert.deepEqual(current, baseline, '69 changes no unrelated schema/authorization object')
        assert.deepEqual((await db.query('select to_jsonb(t) row from public.customer_orders t order by id')).rows, orders)
        const after = await catalogDataSnapshot(db)
        for (const [table, rows] of Object.entries(data)) {
          const keys = Object.keys(rows[0]?.row || {})
          assert.deepEqual(after[table].map(({ row }) => ({ row: Object.fromEntries(keys.map(key => [key, row[key]])) })), rows, table)
        }
        if (scenario.startsWith('B')) for (const p of initialPolicies) assert.deepEqual((await db.query('select oid,polname,polrelid,polqual::text,polwithcheck::text from pg_policy where oid=$1', [p.oid])).rows[0], p)
      })
      await t.test('catalog authorization, confidential columns, staff CRUD and dormant ledgers survive', async () => {
        await verifySecurity(db, f)
        await verifyDormant(db)
      })
      await t.test('reapplying 69 preserves objects/data and unchanged checkout remains server-authoritative', async () => {
        const state = await metadata(db), before = await catalogDataSnapshot(db)
        await db.exec(sql)
        assert.deepEqual(await metadata(db), state)
        assert.deepEqual(await catalogDataSnapshot(db), before)
        if (orderFixture) {
          await db.exec('begin')
          try {
            const payload = { order_number: 'LOCAL-RECONCILIATION-CHECKOUT', first_name: 'Synthetic', phone: '01012345678', street_address: 'Fixture', city: 'Cairo', governorate: 'Cairo', payment_method: 'cash', locale: 'ar', subtotal_amount: -1, discount_amount: -1, total_amount: -1 }
            const order = (await db.query('select public.commerce_create_customer_order($1,$2::jsonb,$3::jsonb,false,gen_random_uuid()) result', [orderFixture.customer, JSON.stringify(payload), JSON.stringify([{ product_id: orderFixture.product, quantity: 1, unit_price: -1 }])])).rows[0].result.order
            assert.equal(Number(order.subtotal_amount), 125.5)
            assert.equal(Number(order.discount_amount), 0)
            assert.equal(Number(order.total_amount), 130.5)
            for (const column of ['subtotal_amount','discount_amount']) {
              await db.exec('savepoint amount_rejection')
              await assert.rejects(() => db.query('update public.customer_orders set ' + column + '=-1 where id=$1', [order.id]), error => error.code === '23514' && error.constraint === 'customer_orders_' + column + '_check')
              await db.exec('rollback to savepoint amount_rejection')
            }
          } finally { await db.exec('rollback') }
          assert.deepEqual(await catalogDataSnapshot(db), before)
        }
      })
    } finally { await db.close() }
  })
}

test('native drift and invalid history fail atomically without replacing or weakening objects', { skip: !emailNativeAvailable, timeout: 90000 }, async t => {
  const db = await createEmailNativeDatabase({ stopBefore: migration })
  try {
    await createCatalogFixture({ database: db })
    const cases = [
      ['one missing check', 'alter table public.customer_orders drop constraint customer_orders_discount_amount_check', 'alter table public.customer_orders add constraint customer_orders_discount_amount_check check(discount_amount>=0)'],
      ['weaker expression', 'alter table public.customer_orders drop constraint customer_orders_discount_amount_check; alter table public.customer_orders add constraint customer_orders_discount_amount_check check(discount_amount>=-1)', 'alter table public.customer_orders drop constraint customer_orders_discount_amount_check; alter table public.customer_orders add constraint customer_orders_discount_amount_check check(discount_amount>=0)'],
      ['correct but NOT VALID', 'alter table public.customer_orders drop constraint customer_orders_discount_amount_check; alter table public.customer_orders add constraint customer_orders_discount_amount_check check(discount_amount>=0) not valid', 'alter table public.customer_orders validate constraint customer_orders_discount_amount_check'],
      ['wrong target column', 'alter table public.customer_orders drop constraint customer_orders_discount_amount_check; alter table public.customer_orders add constraint customer_orders_discount_amount_check check(subtotal_amount>=0)', 'alter table public.customer_orders drop constraint customer_orders_discount_amount_check; alter table public.customer_orders add constraint customer_orders_discount_amount_check check(discount_amount>=0)'],
      ['wrong constraint kind', 'alter table public.customer_orders drop constraint customer_orders_discount_amount_check; alter table public.customer_orders add constraint customer_orders_discount_amount_check unique(discount_amount)', 'alter table public.customer_orders drop constraint customer_orders_discount_amount_check; alter table public.customer_orders add constraint customer_orders_discount_amount_check check(discount_amount>=0)'],
      ['NO INHERIT', 'alter table public.customer_orders drop constraint customer_orders_discount_amount_check; alter table public.customer_orders add constraint customer_orders_discount_amount_check check(discount_amount>=0) no inherit', 'alter table public.customer_orders drop constraint customer_orders_discount_amount_check; alter table public.customer_orders add constraint customer_orders_discount_amount_check check(discount_amount>=0)'],
      ['nullable amount', 'alter table public.customer_orders alter column subtotal_amount drop not null', 'alter table public.customer_orders alter column subtotal_amount set not null'],
      ['wrong numeric precision', 'alter table public.customer_orders alter column discount_amount type numeric(10,2)', 'alter table public.customer_orders alter column discount_amount type numeric(12,2)'],
      ['wrong column type', 'alter table public.customer_orders alter column discount_amount type double precision', 'alter table public.customer_orders alter column discount_amount type numeric(12,2); alter table public.customer_orders drop constraint customer_orders_discount_amount_check; alter table public.customer_orders add constraint customer_orders_discount_amount_check check(discount_amount>=0)'],
      ['unexpected default', 'alter table public.customer_orders alter column subtotal_amount set default 1', 'alter table public.customer_orders alter column subtotal_amount set default 0'],
      ['missing column', 'alter table public.customer_orders rename column subtotal_amount to unexpected_subtotal', 'alter table public.customer_orders rename column unexpected_subtotal to subtotal_amount'],
      ['missing existing total invariant', 'alter table public.customer_orders drop constraint customer_orders_total_amount_check', 'alter table public.customer_orders add constraint customer_orders_total_amount_check check(total_amount>=0)'],
      ['nullable total column', 'alter table public.customer_orders alter column total_amount drop not null', 'alter table public.customer_orders alter column total_amount set not null'],
      ['inherited relation', 'create table public.order_amount_inherited_fixture() inherits(public.customer_orders)', 'drop table public.order_amount_inherited_fixture'],
      ['unexpected overlapping check', 'alter table public.customer_orders add constraint unexpected_amount_check check(subtotal_amount+discount_amount>=0)', 'alter table public.customer_orders drop constraint unexpected_amount_check'],
      ['RLS disabled', 'alter table public.customer_orders disable row level security', 'alter table public.customer_orders enable row level security'],
      ['negative historical subtotal with absent pair', removeChecks + 'update public.customer_orders set subtotal_amount=-1', 'update public.customer_orders set subtotal_amount=0;' + addChecks],
      ['negative historical discount with absent pair', removeChecks + 'update public.customer_orders set discount_amount=-1', 'update public.customer_orders set discount_amount=0;' + addChecks]
    ]
    for (const [name, setup, restore] of cases) await t.test(name, async () => {
      await db.exec(setup)
      const before = await metadata(db), rows = await catalogDataSnapshot(db)
      await assert.rejects(() => db.exec(sql), error => ['P0001','23514'].includes(error.code))
      await db.exec('rollback')
      assert.deepEqual(await metadata(db), before, 'unknown objects preserved')
      assert.deepEqual(await catalogDataSnapshot(db), rows, 'invalid records were not rewritten')
      await db.exec(restore)
    })
    await t.test('five-second lock guard aborts without changes', async () => {
      const blocker = await db.connect()
      await blocker.query('begin; lock table public.customer_orders in access exclusive mode')
      const before = await metadata(db)
      try {
        await assert.rejects(() => db.exec(sql), error => error.code === '55P03')
        await db.exec('rollback')
        assert.deepEqual(await metadata(db), before)
      } finally { await blocker.query('rollback'); await blocker.end() }
    })
  } finally { await db.close() }
})
