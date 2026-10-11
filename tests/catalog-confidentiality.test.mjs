import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createCatalogFixture, catalogMigration, migrateCatalog, reproduceCatalogCorrection, catalogDataSnapshot, confidentialColumns, correctedTables } from './helpers/catalogFixture.mjs'
import { createEmailNativeDatabase, emailNativeAvailable } from './helpers/emailNativeDatabase.mjs'
import { createResetDatabase } from './helpers/resetDatabase.mjs'

const verifySecurity = async (t, f) => {
  const { db, actors, asRole } = f
  for (const [label, role, actor] of [['anonymous', 'anon', null], ['customer', 'authenticated', actors.customer], ['inactive staff', 'authenticated', actors.inactive]]) {
    await t.test(label + ' cannot read any confidential column, including filters and whole records', async () => {
      for (const [table, columns] of Object.entries(confidentialColumns)) for (const column of columns) {
        await assert.rejects(() => asRole(role, actor, () => db.query(`select ${column} from public.${table}`)), /permission denied/)
        await assert.rejects(() => asRole(role, actor, () => db.query(`select id from public.${table} where ${column} is not null`)), /permission denied/)
      }
      for (const table of Object.keys(confidentialColumns)) await assert.rejects(() => asRole(role, actor, () => db.query(`select to_jsonb(t) from public.${table} t`)), /permission denied/)
      for (const rpc of ['catalog_staff_products', 'catalog_staff_product_variants']) await assert.rejects(() => asRole(role, actor, () => db.query(`select * from public.${rpc}()`)), /permission denied|Staff catalog access required/)
    })
    await t.test(label + ' keeps published public projections, prices, variants, images and specifications', async () => {
      await asRole(role, actor, async () => {
        const rows = (await db.query('select * from public.storefront_products')).rows
        assert.equal(rows.length, 1)
        assert.equal(rows[0].id, f.published)
        assert.equal(Number(rows[0].price), 125.5)
        assert.equal(rows[0].stock_quantity, 8)
        for (const key of confidentialColumns.products) assert.ok(!Object.hasOwn(rows[0], key))
        const variants = (await db.query('select * from public.storefront_product_variants')).rows
        assert.equal(variants.length, 1)
        assert.ok(!Object.hasOwn(variants[0], 'cost_price'))
        assert.equal((await db.query('select id from public.products where not is_published')).rows.length, 0)
        assert.equal((await db.query('select id from public.product_images')).rows.length, 1)
        assert.equal((await db.query('select id from public.product_specifications')).rows.length, 1)
      })
    })
  }
  for (const name of ['owner', 'editor', 'commerce']) await t.test(name + ' reads internal fields through identity-gated staff RPCs with the existing draft scope', async () => {
    await asRole('authenticated', actors[name], async () => {
      const products = (await db.query('select * from public.catalog_staff_products() order by id')).rows
      assert.equal(products.length, name === 'commerce' ? 1 : 2)
      for (const p of products) {
        assert.equal(Number(p.cost_price), 991.37)
        assert.equal(p.primary_warehouse_id, f.warehouse)
        assert.equal(p.default_supplier_id, f.supplier)
      }
      assert.equal((await db.query('select * from public.catalog_staff_product_variants()')).rows.length, 2)
      assert.equal(Number((await db.query('select cost_price from public.catalog_staff_product_variants() where id=$1', [f.variant])).rows[0].cost_price), 882.43)
    })
    // Staff share the browser role: direct confidential table reads remain denied.
    await assert.rejects(() => asRole('authenticated', actors[name], () => db.query('select cost_price from public.products')), /permission denied/)
  })
  await t.test('service workflows retain full raw access and staff RPCs; customer writes stay denied', async () => {
    await asRole('service_role', null, async () => {
      assert.equal((await db.query('select * from public.products')).rows.length, 2)
      assert.equal((await db.query('select * from public.catalog_staff_products()')).rows.length, 2)
    })
    await asRole('authenticated', actors.customer, async () => {
      assert.equal((await db.query('update public.products set title=$1 where id=$2 returning id', ['Unauthorized', f.published])).rows.length, 0)
      assert.equal((await db.query('delete from public.products where id=$1 returning id', [f.published])).rows.length, 0)
    })
    await assert.rejects(() => asRole('authenticated', actors.customer, () => db.query("insert into public.products(title,slug,primary_warehouse_id) values('Unauthorized','unauthorized',$1)", [f.warehouse])), /row-level security/)
  })
  await t.test('authorized product editor retains safe catalog writes and inventory cost guards', async () => {
    await asRole('authenticated', actors.editor, async () => {
      const row = (await db.query('update public.products set title=$1 where id=$2 returning id,title', ['Local edited title', f.draft])).rows[0]
      assert.equal(row.title, 'Local edited title')
    })
    await assert.rejects(() => asRole('authenticated', actors.editor, () => db.query('update public.products set cost_price=1 where id=$1', [f.published])), /permission denied|projection|inventory|cost/i)
  })
  await t.test('all four secret column ACLs and invoker projections stay restricted, including future columns', async () => {
    for (const role of ['anon', 'authenticated']) for (const [table, columns] of Object.entries(confidentialColumns)) for (const column of columns) {
      assert.equal((await db.query("select has_column_privilege($1,$2,$3,'SELECT') allowed", [role, 'public.' + table, column])).rows[0].allowed, false)
    }
    for (const view of ['storefront_products', 'storefront_product_variants']) assert.ok((await db.query('select reloptions from pg_class where oid=$1::regclass', ['public.' + view])).rows[0].reloptions.includes('security_invoker=true'))
    await db.exec('begin; alter table public.products add column future_private_cost numeric')
    try {
      assert.equal((await db.query("select has_column_privilege('anon','public.products','future_private_cost','SELECT') allowed")).rows[0].allowed, false)
      assert.equal((await db.query("select count(*)::int n from information_schema.columns where table_schema='public' and table_name='storefront_products' and column_name='future_private_cost'")).rows[0].n, 0)
    } finally { await db.exec('rollback') }
  })
}

test('catalog confidentiality: canonical schema converges without changing records, providers or existing function bodies', async t => {
  const f = await createCatalogFixture()
  try {
    const data = await catalogDataSnapshot(f.db)
    // Table revocation alone must not leave pre-existing column grants behind.
    await f.db.exec('grant select(cost_price,primary_warehouse_id,default_supplier_id) on public.products to public; grant select(cost_price) on public.product_variants to authenticated')
    const functions = (await f.db.query("select oid,prosrc from pg_proc where pronamespace='public'::regnamespace order by oid")).rows
    await migrateCatalog(f.db)
    assert.deepEqual(await catalogDataSnapshot(f.db), data)
    for (const fn of functions) assert.equal((await f.db.query('select prosrc from pg_proc where oid=$1', [fn.oid])).rows[0].prosrc, fn.prosrc)
    assert.equal((await f.db.query("select count(*)::int n from pg_policies where schemaname='public' and tablename=any($1)", [correctedTables])).rows[0].n, 45)
    await verifySecurity(t, f)
  } finally { await f.db.close() }
})

test('catalog migration retains the manually corrected policy objects and stops on unknown authorization drift', async t => {
  const f = await createCatalogFixture()
  try {
    await reproduceCatalogCorrection(f.db)
    const policies = (await f.db.query('select oid,polname,polqual::text,polwithcheck::text from pg_policy order by oid')).rows
    await f.db.exec("create policy unexpected_public_write on public.products for update to authenticated using(true)")
    await assert.rejects(() => migrateCatalog(f.db), /Unexpected authorization policies/)
    await f.db.exec('rollback')
    assert.equal((await f.db.query("select has_table_privilege('anon','public.products','SELECT') allowed")).rows[0].allowed, true)
    await f.db.exec('drop policy unexpected_public_write on public.products')
    const data = await catalogDataSnapshot(f.db)
    await migrateCatalog(f.db)
    assert.deepEqual((await f.db.query('select oid,polname,polqual::text,polwithcheck::text from pg_policy order by oid')).rows, policies)
    assert.deepEqual(await catalogDataSnapshot(f.db), data)
    await verifySecurity(t, f)
  } finally { await f.db.close() }
})

test('archived correction is unchanged; earlier pending migrations retain reviewed hashes and ordering', async () => {
  const hash = file => readFile(new URL(file, import.meta.url)).then(data => createHash('sha256').update(data).digest('hex'))
  assert.equal(await hash('../docs/security/20261010-nine-table-correction.sql'), 'f8e6f35fef987f0ca7a84575d156895aadc47988394b0e0c9990923afdec3e94')
  for (const [name, sha] of [
    ['20261008120000_after_sales_claims_core.sql', '7db914fecd7be043281f18fe7dbbb0563de8180665634880e9c80e0a581af4cd'],
    ['20261008160000_after_sales_reverse_logistics.sql', '833b36b9dcf7acefbc47de95b2f21af64202b94233d73e673328348aaa8942d2'],
    ['20261008180000_email_foundation.sql', 'e32c88ad21f6fb971bcf82da293857d10eb6a4f5eb25bcf219392597ab78784d'],
    ['20261009120000_after_sales_communications.sql', 'df83fed86e8cb119a67b12e84974de059c665ea3b449c5d8724f5e35e9543f63']
  ]) assert.equal(await hash('../supabase/migrations/' + name), sha)
  const sql = await readFile(new URL('../supabase/migrations/' + catalogMigration, import.meta.url), 'utf8')
  assert.ok(!/CASCADE|migration_repair|schema_migrations|ENABLE.*provider/i.test(sql.replace(/--[^\n]*/g, '')))
})

test('populated checkpoint 63 with the manual correction upgrades in exact 64→65→66→67→68 order', async () => {
  const db = await createResetDatabase({ stopBefore: '20261008120000_after_sales_claims_core.sql' })
  try {
    await createCatalogFixture({ database: db })
    await reproduceCatalogCorrection(db)
    const data = await catalogDataSnapshot(db)
    const policies = (await db.query('select oid,polname,polqual::text,polwithcheck::text from pg_policy order by oid')).rows
    for (const file of ['20261008120000_after_sales_claims_core.sql', '20261008160000_after_sales_reverse_logistics.sql', '20261008180000_email_foundation.sql', '20261009120000_after_sales_communications.sql']) {
      await db.exec(await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8'))
    }
    await migrateCatalog(db)
    const after = await catalogDataSnapshot(db)
    for (const [table, rows] of Object.entries(data)) {
      const keys = Object.keys(rows[0]?.row || {})
      const retained = after[table].map(({ row }) => ({ row: Object.fromEntries(keys.map(key => [key, row[key]])) }))
      assert.deepEqual(retained, rows, table)
    }
    for (const policy of policies) assert.deepEqual((await db.query('select oid,polname,polqual::text,polwithcheck::text from pg_policy where oid=$1', [policy.oid])).rows[0], policy)
    for (const table of ['after_sales_claims', 'shipping_claim_jobs', 'email_messages', 'after_sales_communications']) {
      assert.equal((await db.query('select count(*)::int n from public.' + table)).rows[0].n, 0)
    }
  } finally { await db.close() }
})

test('native PostgreSQL independently enforces confidentiality on the corrected production policy baseline', { skip: !emailNativeAvailable, timeout: 60000 }, async t => {
  const database = await createEmailNativeDatabase({ stopBefore: catalogMigration })
  try {
    const f = await createCatalogFixture({ database })
    await reproduceCatalogCorrection(database)
    await migrateCatalog(database)
    await verifySecurity(t, f)
  } finally { await database.close() }
})
