import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir, access, mkdir, writeFile, copyFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createStorageNativeDatabase, storageNativeAvailable } from './helpers/storageNativeDatabase.mjs'
import { createCatalogFixture, reproduceCatalogCorrection, catalogDataSnapshot, correctedTables, confidentialColumns } from './helpers/catalogFixture.mjs'
import { createOrderSmsFixture } from './helpers/orderSmsFixture.mjs'

const directory = new URL('../supabase/migrations/', import.meta.url)
// This audit reproduces the historical 64–69 Storage release boundary.
const files = (await readdir(directory)).filter(name => name.endsWith('.sql')).sort().slice(0, 69)
const pending = files.slice(63)
const sql = await readFile(new URL(pending[0], directory), 'utf8')
const evidencePolicy = "create policy after_sales_evidence_server_boundary on storage.objects as restrictive for all to anon,authenticated\n  using(bucket_id<>'after-sales-evidence') with check(bucket_id<>'after-sales-evidence');"
const checks = async db => (await db.query("select oid,conname,convalidated,pg_get_constraintdef(oid) definition from pg_constraint where conrelid='public.customer_orders'::regclass and conname in ('customer_orders_subtotal_amount_check','customer_orders_discount_amount_check') order by conname")).rows
const storageState = async db => (await db.query("select oid,relname,relowner,relacl,relrowsecurity,relforcerowsecurity,relkind from pg_class where relnamespace='storage'::regnamespace and relname in ('objects','buckets') order by relname")).rows
const catalogPolicies = async db => (await db.query('select oid,polname,polrelid,polqual::text,polwithcheck::text from pg_policy where polrelid in (select oid from pg_class where relnamespace=\'public\'::regnamespace and relname=any($1)) order by oid', [correctedTables])).rows
const memberships = async db => (await db.query('select * from pg_auth_members order by roleid,member')).rows

const assertExecutor = async (db, delegation) => {
  const c = (await db.query(`select current_user,session_user,
    (select rolsuper from pg_roles where rolname=current_user) superuser,
    pg_has_role(current_user,'fixture_storage_owner','USAGE') owner_usage,
    pg_has_role(current_user,'fixture_storage_owner','MEMBER') owner_member,
    pg_has_role(current_user,'fixture_storage_owner','SET') owner_set,
    pg_has_role(current_user,'storage_audit','MEMBER') bootstrap_member,
    (select context from pg_settings where name='supautils.policy_grants') hook_context,
    current_setting('supautils.policy_grants')::jsonb delegation`)).rows[0]
  assert.equal(c.current_user, 'postgres'); assert.equal(c.session_user, 'postgres')
  for (const key of ['superuser','owner_usage','owner_member','owner_set','bootstrap_member']) assert.equal(c[key], false, key)
  assert.equal(c.hook_context, 'sighup', 'registered hook GUC, not a placeholder')
  assert.equal(db.preload, process.env.SUPAUTILS_REVIEW_LIBRARY)
  assert.deepEqual(c.delegation, { postgres: ['realtime.messages', ...(delegation ? ['storage.objects','storage.buckets'] : [])] })
}

const rollbackSnapshot = async db => ({
  data: await catalogDataSnapshot(db),
  storage: await storageState(db),
  memberships: await memberships(db),
  objects: (await db.query('select to_jsonb(t) row from storage.objects t order by id')).rows,
  buckets: (await db.query('select to_jsonb(t) row from storage.buckets t order by id')).rows,
  catalog: (await db.query(`select jsonb_build_object(
    'relations',(select jsonb_agg(to_jsonb(x) order by oid) from (select oid,relname,relowner,relacl,relrowsecurity,relforcerowsecurity,relkind from pg_class where relnamespace='public'::regnamespace) x),
    'functions',(select jsonb_agg(to_jsonb(x) order by oid) from (select oid,proname,prosrc,proacl,proconfig,proowner from pg_proc where pronamespace='public'::regnamespace) x),
    'policies',(select jsonb_agg(to_jsonb(x) order by oid) from (select oid,polname,polrelid,polroles,polcmd,polpermissive,polqual::text,polwithcheck::text from pg_policy) x),
    'columns',(select jsonb_agg(to_jsonb(x) order by attrelid,attnum) from (select a.attrelid,a.attnum,a.attname,a.attnotnull,d.adbin::text from pg_attribute a join pg_class c on c.oid=a.attrelid left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where c.relnamespace='public'::regnamespace and a.attnum>0) x),
    'constraints',(select jsonb_agg(to_jsonb(x) order by oid) from (select oid,conname,conrelid,convalidated,conbin::text from pg_constraint where connamespace='public'::regnamespace) x),
    'triggers',(select jsonb_agg(to_jsonb(x) order by oid) from (select oid,tgname,tgrelid,tgfoid,tgenabled from pg_trigger where tgrelid in (select oid from pg_class where relnamespace='public'::regnamespace)) x)
  ) state`)).rows[0].state
})

const assertPolicies = async db => {
  const policies = (await db.query("select policyname,permissive,roles::text[] roles,cmd,qual,with_check from pg_policies where schemaname='storage' and tablename='objects' order by policyname")).rows
  assert.deepEqual(policies, [
    { policyname: 'after_sales_evidence_server_boundary', permissive: 'RESTRICTIVE', roles: ['anon','authenticated'], cmd: 'ALL', qual: "(bucket_id <> 'after-sales-evidence'::text)", with_check: "(bucket_id <> 'after-sales-evidence'::text)" },
    { policyname: 'reverse_label_server_boundary', permissive: 'RESTRICTIVE', roles: ['anon','authenticated'], cmd: 'ALL', qual: "((bucket_id <> 'shipping-labels'::text) OR (name !~~ 'claims/%'::text))", with_check: "((bucket_id <> 'shipping-labels'::text) OR (name !~~ 'claims/%'::text))" }
  ])
}

const assertDormant = async db => {
  for (const table of ['after_sales_claims','after_sales_claim_events','after_sales_claim_information','after_sales_claim_evidence','shipping_claim_jobs','shipping_order_jobs','shipping_webhook_events','sms_batches','sms_messages','sms_attempts','email_messages','email_attempts','email_events','after_sales_communications','payment_attempts','payment_transactions','erp_sync_jobs']) assert.equal((await db.query('select count(*)::int n from public.' + table)).rows[0].n, 0, table)
  assert.equal((await db.query('select count(*)::int n from public.after_sales_communication_settings where is_enabled or sms_enabled or email_enabled')).rows[0].n, 0)
  assert.equal((await db.query("select is_enabled or auto_create_labels or reverse_enabled active from public.shipping_provider_settings where id='pdc'")).rows[0].active, false)
  assert.equal((await db.query("select is_enabled from public.sms_provider_settings where id='vodafone'")).rows[0].is_enabled, false)
  const email = (await db.query("select config from public.email_provider_settings where id='brevo'")).rows[0].config
  for (const key of ['is_enabled','marketing_enabled','webhook_enabled']) assert.equal(email[key], false, key)
  for (const table of ['sms_order_event_settings','sms_templates']) assert.equal((await db.query('select count(*)::int n from public.' + table + ' where is_enabled')).rows[0].n, 0)
  assert.equal((await db.query('select count(*)::int n from public.after_sales_policies where return_enabled or warranty_enabled')).rows[0].n, 0)
  assert.equal((await db.query("select count(*)::int n from public.sms_order_events where status<>'suppressed'")).rows[0].n, 0)
}

test('pending managed Storage SQL preserves both restrictive boundaries without ownership DDL', async () => {
  assert.equal(files.length, 69)
  assert.deepEqual(pending, ['20261008120000_after_sales_claims_core.sql','20261008160000_after_sales_reverse_logistics.sql','20261008180000_email_foundation.sql','20261009120000_after_sales_communications.sql','20261011120000_catalog_confidentiality.sql','20261011140000_order_amount_constraints_reconciliation.sql'])
  assert.ok(sql.includes(evidencePolicy))
  assert.equal(createHash('sha256').update(sql).digest('hex'), '7db914fecd7be043281f18fe7dbbb0563de8180665634880e9c80e0a581af4cd')
  for (const name of pending) {
    const text = await readFile(new URL(name, directory), 'utf8')
    assert.doesNotMatch(text, /\b(?:alter|drop|truncate)\s+(?:table|schema|function|index)\s+storage\b/i, name)
    assert.doesNotMatch(text, /\bset\s+(?:local\s+)?role\b|\bowner\s+to\b|\bgrant\b[^;]*supabase_(?:storage_admin|admin)/i, name)
  }
})

for (const [name, options, code] of [
  ['no policy delegation', { delegation: false }, '42501'],
  ['disabled RLS', { rls: false }, '55000'],
  ['conflicting policy', { conflict: true }, '42710'],
  ['nonordinary partitioned Storage table', { partitioned: true }, '55000']
]) test('actual Supautils: ' + name + ' aborts the complete migration', { skip: !storageNativeAvailable, timeout: 90000 }, async t => {
  const db = await createStorageNativeDatabase(options)
  try {
    await assertExecutor(db, options.delegation !== false)
    const f = await createOrderSmsFixture({ database: db })
    await f.checkout()
    const before = await rollbackSnapshot(db)
    await assert.rejects(() => db.exec(sql), error => error.code === code)
    await db.exec('rollback')
    assert.deepEqual(await rollbackSnapshot(db), before, 'data, functions, policies, bucket, grants and defaults roll back')
    assert.equal((await db.query("select to_regclass('public.after_sales_claims') claims")).rows[0].claims, null)
    await assertExecutor(db, options.delegation !== false)
    t.diagnostic('PostgreSQL ' + db.version + ', real session-preloaded Supautils, expected SQLSTATE ' + code)
  } finally { await db.close() }
  await assert.rejects(() => access(db.directory), error => error.code === 'ENOENT')
})

for (const scenario of ['A fresh canonical','B corrected populated checkpoint 63','C canonical populated checkpoint 63','D supported absent pair','E corrected checkpoint 63 with observed profile drift']) test('non-owner postgres + Supautils ordered 64→69: ' + scenario, { skip: !storageNativeAvailable, timeout: 90000 }, async t => {
  const executed = [], db = await createStorageNativeDatabase({ onMigration: name => executed.push(name) })
  try {
    let customer
    const corrected = scenario.startsWith('B') || scenario.startsWith('E')
    await assertExecutor(db, true)
    assert.deepEqual(executed, files.slice(0, 63))
    if (!scenario.startsWith('A')) {
      await createCatalogFixture({ database: db })
      const f = await createOrderSmsFixture({ database: db })
      await f.checkout({ locale: 'en' }); await f.checkout({ locale: 'ar', method: 'bank_transfer', preorder: true })
      customer = f.customer
    }
    if (corrected) {
      await reproduceCatalogCorrection(db)
      const archive = await readFile(new URL('../docs/security/20261011-order-constraints-correction.sql', import.meta.url), 'utf8')
      await db.exec('alter table public.customer_orders drop constraint customer_orders_subtotal_amount_check, drop constraint customer_orders_discount_amount_check;')
      await db.exec('begin;\n' + archive.slice(archive.indexOf('ALTER TABLE public.customer_orders'), archive.indexOf('NOTIFY pgrst')) + '\ncommit;')
    }
    if (scenario.startsWith('E')) {
      await db.exec('alter table public.customer_profiles alter column email drop not null; alter table public.customer_profiles drop constraint customer_profiles_email_key; create unique index customer_profiles_email_uidx on public.customer_profiles(email);')
      await db.query('update public.customer_profiles set email=null where id=$1', [customer])
    }
    if (scenario.startsWith('D')) await db.exec('alter table public.customer_orders drop constraint customer_orders_subtotal_amount_check, drop constraint customer_orders_discount_amount_check;')
    const original = await catalogDataSnapshot(db), storage = await storageState(db), roles = await memberships(db), orderChecks = await checks(db), policies = await catalogPolicies(db)
    await t.test('all identities execute under the original non-owner login; Storage ownership and grants remain intact', async () => {
      await assert.rejects(() => db.exec('alter table storage.objects enable row level security'), error => error.code === '42501')
      for (const name of pending) { await db.exec(await readFile(new URL(name, directory), 'utf8')); executed.push(name) }
      assert.deepEqual(executed, files)
      assert.equal(new Set(executed).size, 69)
      await assertExecutor(db, true)
      assert.deepEqual(await storageState(db), storage)
      assert.deepEqual(await memberships(db), roles)
      await assertPolicies(db)
      assert.equal((await db.query("select count(*)::int n from pg_proc where pronamespace='public'::regnamespace and proowner<>(select oid from pg_roles where rolname='postgres')")).rows[0].n, 0)
      await assert.rejects(() => db.exec('alter table storage.objects disable row level security'), error => error.code === '42501')
    })
    await t.test('historical rows, reviewed security corrections and order checks are preserved', async () => {
      const after = await catalogDataSnapshot(db)
      for (const [table, rows] of Object.entries(original)) {
        const keys = Object.keys(rows[0]?.row || {})
        assert.deepEqual(after[table].map(({ row }) => ({ row: Object.fromEntries(keys.map(key => [key,row[key]])) })), rows, table)
      }
      const finalChecks = await checks(db)
      assert.equal(finalChecks.length, 2); assert.ok(finalChecks.every(c => c.convalidated))
      if (orderChecks.length) assert.deepEqual(finalChecks, orderChecks)
      const finalPolicies = await catalogPolicies(db)
      assert.equal(finalPolicies.length, 45)
      if (corrected) assert.deepEqual(finalPolicies, policies)
      if (scenario.startsWith('E')) {
        assert.deepEqual((await db.query("select a.attnotnull,email is null nullable_email,pg_get_indexdef('public.customer_profiles_email_uidx'::regclass) definition from public.customer_profiles p join pg_attribute a on a.attrelid='public.customer_profiles'::regclass and a.attname='email' where p.id=$1", [customer])).rows[0], {
          attnotnull: false, nullable_email: true, definition: 'CREATE UNIQUE INDEX customer_profiles_email_uidx ON public.customer_profiles USING btree (email)'
        })
        assert.equal((await db.query('select public.after_sales_claim_items($1) result', [customer])).rows[0].result.items.length, 2)
      }
      for (const role of ['anon','authenticated']) for (const [table, columns] of Object.entries(confidentialColumns)) for (const column of columns) assert.equal((await db.query("select has_column_privilege($1,$2,$3,'SELECT') allowed", [role,'public.' + table,column])).rows[0].allowed, false)
    })
    await t.test('all provider/policy gates stay OFF and no historical sending/shipping work is created', async () => {
      await assertDormant(db)
      assert.deepEqual((await db.query("select public,file_size_limit,allowed_mime_types from storage.buckets where id='after-sales-evidence'")).rows[0], { public: false, file_size_limit: '5242880', allowed_mime_types: ['image/jpeg','image/png','image/webp','application/pdf'] })
    })
  } finally { await db.close() }
  await assert.rejects(() => access(db.directory), error => error.code === 'ENOENT')
})

test('actual delegated restrictive Storage policies defeat permissive policies for anonymous/customers', { skip: !storageNativeAvailable, timeout: 90000 }, async t => {
  const db = await createStorageNativeDatabase({ stopBefore: null })
  try {
    await assertExecutor(db, true); await assertPolicies(db)
    await db.owner.query("create policy fixture_broad_storage on storage.objects for all to anon,authenticated using(true) with check(true); insert into storage.objects(bucket_id,name) values('after-sales-evidence','private.png'),('shipping-labels','claims/private.pdf'),('shipping-labels','outbound.pdf'),('unrelated','public.png')")
    for (const role of ['anon','authenticated']) await t.test(role + ' cannot SELECT/INSERT/UPDATE/DELETE private evidence or reverse labels; unrelated CRUD works', async () => {
      const client = await db.connect(role)
      const flags = (await client.query('select rolsuper,rolbypassrls from pg_roles where rolname=current_user')).rows[0]
      assert.deepEqual(flags, { rolsuper: false, rolbypassrls: false })
      assert.deepEqual((await client.query('select name from storage.objects order by name')).rows, [{ name: 'outbound.pdf' }, { name: 'public.png' }])
      for (const [bucket, name] of [['after-sales-evidence','private.png'],['shipping-labels','claims/private.pdf']]) {
        await assert.rejects(() => client.query('insert into storage.objects(bucket_id,name) values($1,$2)', [bucket,name]), error => error.code === '42501')
        assert.equal((await client.query("update storage.objects set bucket_id='unrelated',name='escaped' where bucket_id=$1 and name=$2 returning id", [bucket,name])).rowCount, 0)
        assert.equal((await client.query('delete from storage.objects where bucket_id=$1 and name=$2 returning id', [bucket,name])).rowCount, 0)
      }
      const id = (await client.query("insert into storage.objects(bucket_id,name) values('unrelated',$1) returning id", [role + '.png'])).rows[0].id
      for (const [bucket, name] of [['after-sales-evidence','forged.png'],['shipping-labels','claims/forged.pdf']]) await assert.rejects(() => client.query('update storage.objects set bucket_id=$1,name=$2 where id=$3', [bucket,name,id]), error => error.code === '42501')
      await assert.rejects(() => client.query("update storage.objects set name='claims/forged.pdf' where bucket_id='shipping-labels' and name='outbound.pdf'"), error => error.code === '42501')
      assert.equal((await client.query('update storage.objects set name=$1 where id=$2 returning id', [role + '-edited.png',id])).rowCount, 1)
      assert.equal((await client.query('delete from storage.objects where id=$1 returning id', [id])).rowCount, 1)
      await assert.rejects(() => client.query('drop policy after_sales_evidence_server_boundary on storage.objects'), error => error.code === '42501')
      await client.end()
    })
    await t.test('existing trusted service access remains available; private records were not changed', async () => {
      const service = await db.connect('service_role')
      assert.equal((await service.query('select count(*)::int n from storage.objects')).rows[0].n, 4)
      assert.deepEqual((await db.query("select bucket_id,name from storage.objects where bucket_id='after-sales-evidence' or name like 'claims/%' order by bucket_id")).rows, [{ bucket_id: 'after-sales-evidence', name: 'private.png' }, { bucket_id: 'shipping-labels', name: 'claims/private.pdf' }])
      await service.end()
    })
  } finally { await db.close() }
})

for (const delegation of [true, false]) test('actual CLI records only executed migration history: Storage delegation ' + delegation, { skip: !storageNativeAvailable, timeout: 90000 }, async () => {
  const db = await createStorageNativeDatabase({ stopBefore: files[0], delegation })
  try {
    // The historical schema fixture ends with an open transaction. Normally
    // migration 1 commits it; a separate CLI connection needs it committed first.
    await db.exec('commit')
    await assertExecutor(db, delegation)
    // A new loopback cluster and an unlinked temporary project are mandatory.
    // Only the actual CLI writes history after executing the original SQL files.
    const project = join(db.directory, 'runner'), migrations = join(project, 'supabase', 'migrations')
    await mkdir(migrations, { recursive: true })
    await writeFile(join(project, 'supabase', 'config.toml'), 'project_id = "storage-policy-audit"\n')
    const cli = fileURLToPath(new URL('../node_modules/.bin/supabase', import.meta.url))
    const run = extra => promisify(execFile)(cli, ['--workdir', project, '--agent', 'no', 'db', 'push', '--db-url', 'postgresql://postgres@127.0.0.1:' + db.port + '/postgres?sslmode=disable', '--yes', ...extra], {
      timeout: 45000, maxBuffer: 8 * 1024 * 1024,
      // CLI 2.109.1 round-trips its URL; repeat the SSL setting in the
      // environment only for this newly owned 127.0.0.1 test cluster.
      env: { PATH: process.env.PATH, DYLD_LIBRARY_PATH: process.env.DYLD_LIBRARY_PATH || '', PGSSLMODE: 'disable', DO_NOT_TRACK: '1', LANG: 'C' }
    })
    for (const name of files.slice(0, 63)) await copyFile(new URL(name, directory), join(migrations, name))
    await run([])
    const history = async () => (await db.query('select version,name from supabase_migrations.schema_migrations order by version')).rows
    const identities = names => names.map(name => ({ version: name.split('_')[0], name: name.replace(/^\d+_/, '').replace(/\.sql$/, '') }))
    assert.deepEqual(await history(), identities(files.slice(0, 63)))
    await createCatalogFixture({ database: db })
    const f = await createOrderSmsFixture({ database: db })
    await f.checkout()
    await reproduceCatalogCorrection(db)
    const before = await rollbackSnapshot(db), originalChecks = await checks(db)
    for (const name of pending) await copyFile(new URL(name, directory), join(migrations, name))
    const preview = await run(['--dry-run'])
    for (const name of pending) assert.ok((preview.stdout + preview.stderr).includes(name), name)
    assert.deepEqual(await history(), identities(files.slice(0, 63)))
    if (!delegation) {
      await assert.rejects(() => run([]), error => (error.stdout + error.stderr).includes('42501'))
      assert.deepEqual(await history(), identities(files.slice(0, 63)))
      assert.deepEqual(await rollbackSnapshot(db), before)
    } else {
      await run([])
      assert.deepEqual(await history(), identities(files))
      await assertPolicies(db); await assertDormant(db)
      assert.deepEqual(await checks(db), originalChecks)
      assert.deepEqual(await storageState(db), before.storage)
      assert.deepEqual(await memberships(db), before.memberships)
      const after = await catalogDataSnapshot(db)
      for (const [table, rows] of Object.entries(before.data)) {
        const keys = Object.keys(rows[0]?.row || {})
        assert.deepEqual(after[table].map(({ row }) => ({ row: Object.fromEntries(keys.map(key => [key,row[key]])) })), rows, table)
      }
    }
    await assertExecutor(db, delegation)
  } finally { await db.close() }
})
