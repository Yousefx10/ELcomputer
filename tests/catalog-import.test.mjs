import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { TABLES, guideRows } from '../server/utils/catalogTransferContract.js'
import { writeCsv, readCsv } from '../server/utils/catalogTransferCsv.js'
import { writeXlsx } from '../server/utils/catalogTransferXlsx.js'
import { snapshotTables } from '../server/utils/catalogTransferPreview.js'
import { createProductSaveHttpFixture } from './helpers/productSaveHttpFixture.mjs'
import { createMediaFixture } from './helpers/mediaFixture.mjs'
import { createEmailNativeDatabase, emailNativeAvailable } from './helpers/emailNativeDatabase.mjs'
import { nativeWaitFor } from './helpers/emailNativeDatabase.mjs'
const empty = () => ({
  ...Object.fromEntries(Object.keys(TABLES).map((k) => [k, []])),
  Guide: guideRows(),
})
export function newCatalog(count = 1) {
  const t = empty()
  for (let i = 0; i < count; i++) {
    const key = 'p' + i
    t.Products.push({
      product_key: key,
      title: 'منتج ' + i,
      slug: 'import-' + randomUUID(),
      sku: '00' + randomUUID(),
      price: '19.90',
      selling_mode: 'normal',
    })
    t.Variants.push({
      product_key: key,
      entity_key: 'v' + i,
      name: 'أسود',
      code: 'BLACK',
      sku: '000' + randomUUID(),
      is_active: true,
    })
  }
  return t
}
async function raw(f, t, { format = 'csv', actor = 'owner', path = '', query = {}, bytes } = {}) {
  const response = await fetch(
    f.url +
      '/api/admin-products/transfer/import' +
      path +
      '?' +
      new URLSearchParams({ format, ...query }),
    {
      method: 'POST',
      headers: {
        authorization: actor ? 'Bearer ' + actor : '',
        'content-type': 'application/octet-stream',
      },
      body: bytes || (format === 'csv' ? writeCsv(t) : writeXlsx(t)),
    },
  )
  return { response, body: await response.json() }
}
async function stage(f, t, options = {}) {
  return raw(f, t, {
    ...options,
    query: {
      job_id: randomUUID(),
      ...(t.Products.some((p) => !p.product_id) ? { warehouse_id: f.warehouse } : {}),
      ...options.query,
    },
  })
}
async function approve(f, job, publish = false, actor = 'owner') {
  return f.call('/api/admin-products/transfer/import/approve', {
    method: 'POST',
    actor,
    body: { job_id: job.id, review_hash: job.review_hash, publish },
  })
}
async function apply(f, t, job, options = {}) {
  return raw(f, t, {
    ...options,
    path: '/apply',
    query: { job_id: job.id, review_hash: job.review_hash, ...options.query },
  })
}
async function status(f, job, actor = 'owner') {
  return f.call('/api/admin-products/transfer/import?job_id=' + job.id, { actor })
}
async function exported(f, id) {
  const { data, error } = await f.client.rpc('catalog_transfer_snapshot', {
    p_admin_id: f.actors.owner,
    p_purpose: 'export',
    p_scope: 'selected',
    p_ids: [id],
    p_filters: {},
    p_match: {},
    p_media: {},
  })
  assert.equal(error, null)
  return snapshotTables(data, guideRows())
}
test('approved catalog import application over actual routes and SQL', async (t) => {
  const f = await createProductSaveHttpFixture()
  const media = await createMediaFixture({ fixture: f })
  f.client.__ownedUploadsDir = media.root
  t.after(async () => {
    await media.close()
    await f.close()
  })
  await t.test(
    'empty catalog, Draft default, Arabic, leading zero SKU and explicit warehouse',
    async () => {
      const source = newCatalog()
      let r = await stage(f, source, { query: { warehouse_id: undefined } })
      assert.equal(r.response.status, 400)
      r = await stage(f, source)
      assert.equal(r.response.status, 200, JSON.stringify(r.body))
      assert.equal(r.body.preview.products.create, 1)
      const job = r.body.job
      const sameReview = await stage(f, source, { format: 'xlsx' })
      assert.equal(sameReview.body.job.id, job.id)
      assert.equal(sameReview.body.preview.products.create, 1)
      assert.equal(job.counts.pending, 1)
      assert.equal((await f.counts()).products, 0)
      assert.equal((await apply(f, source, job)).response.status, 400)
      assert.equal((await approve(f, job)).response.status, 200)
      r = await apply(f, source, job)
      assert.equal(r.response.status, 200, JSON.stringify(r.body))
      assert.equal(r.body.counts.succeeded, 1, JSON.stringify(r.body))
      const p = (await f.snapshot(r.body.items[0].result_id)).product
      assert.equal(p.title, source.Products[0].title)
      assert.equal(p.sku, source.Products[0].sku)
      assert.equal(p.is_published, false)
      assert.equal(p.primary_warehouse_id, f.warehouse)
      assert.equal(p.stock_quantity, 0)
      assert.equal(p.cost_price, 0)
      assert.equal(
        (await f.db.query('select count(*)::int n from public.commerce_serialized_units')).rows[0]
          .n,
        0,
      )
      assert.deepEqual((await apply(f, source, job)).body.counts, r.body.counts)
      assert.equal((await stage(f, source, { format: 'xlsx' })).body.job.id, job.id)
    },
  )
  await t.test('publication requires review approval and existing publication rules', async () => {
    const source = newCatalog()
    source.Products[0].is_published = true
    const r = await stage(f, source)
    assert.ok(r.body.job)
    assert.equal(r.body.job.publish_count, 1)
    assert.equal((await approve(f, r.body.job)).response.status, 400)
    await approve(f, r.body.job, true)
    const done = await apply(f, source, r.body.job)
    assert.equal(done.body.counts.succeeded, 1, JSON.stringify(done.body))
    assert.equal((await f.snapshot(done.body.items[0].result_id)).product.is_published, true)
  })
  await t.test(
    'sparse update, null, empty text, omitted assignments and unchanged replay',
    async () => {
      const saved = await f.save(f.body({ description: 'before', long_description: 'before' }))
      const source = await exported(f, saved.id)
      source.Products[0].description = null
      source.Products[0].long_description = ''
      delete source.Products[0].category_id
      delete source.Products[0].brand_id
      const staged = await stage(f, source)
      assert.ok(staged.body.job, JSON.stringify(staged.body))
      await approve(f, staged.body.job)
      const r = await apply(f, source, staged.body.job)
      assert.equal(r.body.counts.succeeded, 1, JSON.stringify(r.body))
      const p = (await f.snapshot(saved.id)).product
      assert.equal(p.description, null)
      assert.equal(p.long_description, '')
      assert.equal(p.category_id, f.category)
      assert.equal(p.brand_id, f.brand)
      const round = await exported(f, saved.id)
      const j = (await stage(f, round)).body.job
      await approve(f, j)
      assert.equal((await apply(f, round, j)).body.counts.unchanged, 1)
    },
  )
  await t.test(
    'new variants, specifications and authorized gallery are one product transaction',
    async () => {
      const source = newCatalog()
      await media.addFile('products/import.png')
      const image = { url: '/uploads/products/import.png' }
      source.Products[0].image_url = image.url
      source.Specifications.push({
        product_key: 'p0',
        entity_key: 's',
        label: 'الذاكرة',
        value: '16 GB',
        sort_order: 0,
        is_highlight: true,
      })
      source.Images.push({
        product_key: 'p0',
        entity_key: 'i',
        variant_key: 'v0',
        image_url: image.url,
        alt_text: '',
        sort_order: 0,
      })
      const staged = await stage(f, source, { actor: 'editor' })
      assert.ok(staged.body.job, JSON.stringify(staged.body))
      await approve(f, staged.body.job, false, 'editor')
      const r = await apply(f, source, staged.body.job, { actor: 'editor' })
      assert.equal(r.body.counts.succeeded, 1, JSON.stringify(r.body))
      const id = r.body.items[0].result_id
      assert.equal(
        (
          await f.db.query('select value from public.product_specifications where product_id=$1', [
            id,
          ])
        ).rows[0].value,
        '16 GB',
      )
      assert.equal(
        (
          await f.db.query(
            'select count(*)::int n from public.product_images where product_id=$1',
            [id],
          )
        ).rows[0].n,
        1,
      )
    },
  )
  await t.test(
    'altered bytes, reused job ID, stale revisions and related graph changes',
    async () => {
      const saved = await f.save(f.body())
      const source = await exported(f, saved.id)
      source.Products[0].title = 'Updated title'
      const j = (await stage(f, source)).body.job
      await approve(f, j)
      const changed = structuredClone(source)
      changed.Products[0].price = '20.00'
      assert.equal((await apply(f, changed, j)).response.status, 409)
      assert.equal((await stage(f, changed, { query: { job_id: j.id } })).response.status, 409)
      await f.db.query(
        "insert into public.product_specifications(product_id,label,value,sort_order,is_highlight) values($1,'Other','Other',0,false)",
        [saved.id],
      )
      const r = await apply(f, source, j)
      assert.equal(r.body.counts.conflicted, 1, JSON.stringify(r.body))
      assert.notEqual((await f.snapshot(saved.id)).product.title, 'Updated title')
    },
  )
  await t.test('partial bounded processing, cancellation and exact persisted results', async () => {
    const source = newCatalog(7)
    const j = (await stage(f, source)).body.job
    await approve(f, j)
    await f.db.query('update public.commerce_warehouses set is_active=false where id=$1', [
      f.warehouse,
    ])
    let r = await apply(f, source, j)
    assert.equal(r.body.counts.failed, 5, JSON.stringify(r.body))
    assert.equal(r.body.counts.pending, 2)
    await f.db.query('update public.commerce_warehouses set is_active=true where id=$1', [
      f.warehouse,
    ])
    r = await apply(f, source, j)
    assert.equal(r.body.counts.succeeded, 2)
    assert.equal(r.body.counts.failed, 5)
    assert.equal(r.body.counts.pending, 0)
    assert.deepEqual((await status(f, j)).body.counts, r.body.counts)
    const other = newCatalog(2)
    const jc = (await stage(f, other)).body.job
    await approve(f, jc)
    r = await f.call('/api/admin-products/transfer/import/cancel', {
      method: 'POST',
      body: { job_id: jc.id, review_hash: jc.review_hash },
    })
    assert.equal(r.body.counts.failed, 2)
    assert.equal((await apply(f, other, jc)).body.counts.failed, 2)
  })
  await t.test('expired reviews cannot apply and report remaining records precisely', async () => {
    const source = newCatalog()
    const j = (await stage(f, source)).body.job
    await approve(f, j)
    await f.db.query(
      "update catalog_private.import_jobs set expires_at=clock_timestamp()-interval '1 second' where id=$1",
      [j.id],
    )
    const r = await apply(f, source, j)
    assert.equal(r.body.closed_reason, 'expired')
    assert.equal(r.body.counts.failed, 1)
  })
  await t.test(
    'authorization, foreign receipts, revoked permissions and upload limits',
    async () => {
      const source = newCatalog()
      for (const actor of ['viewer', 'disabled', 'customer', null])
        assert.ok([401, 403].includes((await stage(f, source, { actor })).response.status))
      const j = (await stage(f, source)).body.job
      assert.equal((await status(f, j, 'editor')).response.status, 404)
      const edit = (await stage(f, newCatalog(), { actor: 'editor' })).body.job
      await approve(f, edit, false, 'editor')
      await f.db.query('update public.admin_users set is_active=false where id=$1', [
        f.actors.editor,
      ])
      assert.equal((await status(f, edit, 'editor')).response.status, 403)
      await f.db.query('update public.admin_users set is_active=true where id=$1', [
        f.actors.editor,
      ])
      const r = await raw(f, source, {
        bytes: Buffer.alloc(4 * 1024 * 1024 + 1),
        query: { job_id: randomUUID() },
      })
      assert.equal(r.response.status, 413)
    },
  )
  await t.test(
    'invalid price, unsupported inventory fields, bad references and arbitrary media fail before approval',
    async () => {
      for (const change of [
        { price: '-1' },
        { category_id: randomUUID() },
        { image_url: 'https://arbitrary.invalid/image.png' },
        { price: '' },
      ]) {
        const source = newCatalog()
        Object.assign(source.Products[0], change)
        const r = await stage(f, source)
        assert.equal(r.body.job, null, JSON.stringify(r.body))
        assert.ok(r.body.preview.products.invalid)
      }
      const bytes = writeCsv(newCatalog()).toString().replace('"record_type"', '"stock_quantity"')
      assert.equal(
        (await raw(f, null, { bytes: Buffer.from(bytes), query: { job_id: randomUUID() } }))
          .response.status,
        400,
      )
    },
  )
  await t.test('database rollback includes related rows, core audit and receipt', async () => {
    const source = newCatalog()
    source.Specifications.push({
      product_key: 'p0',
      entity_key: 's',
      label: 'Rollback fixture',
      value: 'v',
      sort_order: 0,
      is_highlight: false,
    })
    const j = (await stage(f, source)).body.job
    await approve(f, j)
    const before = await f.counts()
    await f.db.exec(
      "create function public.import_review_fail() returns trigger language plpgsql as $$ begin if new.label='Rollback fixture' then raise exception 'Owned rollback fixture';end if;return new;end $$;create trigger import_review_fail before insert on public.product_specifications for each row execute function public.import_review_fail()",
    )
    const r = await apply(f, source, j)
    assert.equal(r.body.counts.failed, 1)
    assert.deepEqual(await f.counts(), before)
    await f.db.exec(
      'drop trigger import_review_fail on public.product_specifications;drop function public.import_review_fail()',
    )
  })
})

test(
  'native import concurrency, receipts and protected data',
  { skip: !emailNativeAvailable },
  async (t) => {
    const db = await createEmailNativeDatabase()
    const monitor = await db.connect()
    const transport = {
      ...db,
      query: async (sql, args) => {
        if (!/^select public\.catalog_/.test(sql)) return db.query(sql, args)
        const c = await db.connect()
        try {
          return await c.query(sql, args)
        } finally {
          await c.end()
        }
      },
    }
    const f = await createProductSaveHttpFixture({ database: transport, closeDatabase: false })
    t.after(async () => {
      await f.close()
      await db.close()
    })
    const rpc = async (name, args) => {
      const r = await f.client.rpc(name, args)
      assert.equal(r.error, null, JSON.stringify(r.error))
      return r.data
    }
    await t.test('two administrators: an uncommitted newer edit wins', async () => {
      const saved = await f.save(f.body())
      const source = await exported(f, saved.id)
      source.Products[0].title = 'Import title'
      const j = (await stage(f, source)).body.job
      await approve(f, j)
      const other = await db.connect()
      await other.query('begin')
      await other.query("update public.products set title='Concurrent title' where id=$1", [
        saved.id,
      ])
      const pending = apply(f, source, j)
      await nativeWaitFor(
        async () =>
          (
            await monitor.query(
              "select exists(select 1 from pg_stat_activity where wait_event_type='Lock' and query like '%catalog_import_apply_item%') waiting",
            )
          ).rows[0].waiting,
      )
      await other.query('commit')
      const result = await pending
      assert.equal(result.body.counts.conflicted, 1)
      assert.equal((await f.snapshot(saved.id)).product.title, 'Concurrent title')
    })
    await t.test('duplicate concurrent processors create each product only once', async () => {
      const source = newCatalog(7)
      const j = (await stage(f, source)).body.job
      await approve(f, j)
      await Promise.all([apply(f, source, j), apply(f, source, j)])
      let result = await status(f, j)
      if (result.body.counts.pending) result = await apply(f, source, j)
      assert.equal(result.body.counts.succeeded, 7, JSON.stringify(result.body))
      assert.equal(result.body.counts.pending, 0)
      for (const p of source.Products)
        assert.equal(
          (await db.query('select count(*)::int n from public.products where slug=$1', [p.slug]))
            .rows[0].n,
          1,
        )
      assert.equal(
        (
          await db.query(
            "select count(*)::int n from public.admin_activity_logs where metadata->>'import_job_id'=$1",
            [j.id],
          )
        ).rows[0].n,
        7,
      )
    })
    await t.test(
      'a lost response is recovered from durable receipts without replaying creates',
      async () => {
        const source = newCatalog(2)
        const j = (await stage(f, source)).body.job
        await approve(f, j)
        const before = await f.counts()
        f.controls.loseResponse = true
        await assert.rejects(() => apply(f, source, j))
        const recovered = (await status(f, j)).body
        assert.equal(recovered.counts.succeeded, 2)
        const replay = await stage(f, source, { format: 'xlsx' })
        assert.equal(replay.body.job.id, j.id)
        await apply(f, source, j)
        const after = await f.counts()
        assert.equal(after.products - before.products, 2)
        assert.equal(after.audits - before.audits, 2)
      },
    )
    await t.test('ordinary product creation and import serialize SKU claims', async () => {
      const source = newCatalog()
      const j = (await stage(f, source)).body.job
      await approve(f, j)
      const other = await db.connect()
      await other.query('begin')
      await other.query(
        "insert into public.products(title,slug,sku,price,is_serialized,primary_warehouse_id) values('Other writer',$1,$2,19.90,true,$3)",
        ['other-' + randomUUID(), source.Products[0].sku, f.warehouse],
      )
      const pending = apply(f, source, j)
      await nativeWaitFor(
        async () =>
          (
            await monitor.query(
              "select exists(select 1 from pg_stat_activity where wait_event_type='Lock' and query like '%catalog_import_apply_item%') waiting",
            )
          ).rows[0].waiting,
      )
      await other.query('commit')
      const result = await pending
      assert.equal(result.body.counts.failed, 1)
      assert.equal(result.body.items[0].reason, 'identifier')
      assert.equal(
        (
          await db.query('select count(*)::int n from public.products where slug=$1', [
            source.Products[0].slug,
          ])
        ).rows[0].n,
        0,
      )
    })
    await t.test('revocation is rechecked after waiting at commit', async () => {
      const source = newCatalog()
      const j = (await stage(f, source, { actor: 'editor' })).body.job
      await approve(f, j, false, 'editor')
      const other = await db.connect()
      await other.query('begin')
      await other.query('update public.admin_users set is_active=false where id=$1', [
        f.actors.editor,
      ])
      const pending = apply(f, source, j, { actor: 'editor' })
      await nativeWaitFor(
        async () =>
          (
            await monitor.query(
              "select exists(select 1 from pg_stat_activity where wait_event_type='Lock' and query like '%catalog_import_status%') waiting",
            )
          ).rows[0].waiting,
      )
      await other.query('commit')
      assert.equal((await pending).response.status, 403)
      await db.query('update public.admin_users set is_active=true where id=$1', [f.actors.editor])
      assert.equal((await status(f, j, 'editor')).body.counts.pending, 1)
    })
    await t.test(
      'retry review excludes every committed product from the original file',
      async () => {
        const source = newCatalog(7)
        const j = (await stage(f, source)).body.job
        await approve(f, j)
        const partial = await apply(f, source, j)
        assert.equal(partial.body.counts.succeeded, 5)
        assert.equal(partial.body.counts.pending, 2)
        await f.call('/api/admin-products/transfer/import/cancel', {
          method: 'POST',
          body: { job_id: j.id, review_hash: j.review_hash },
        })
        const child = await stage(f, source, { query: { retry_of: j.id } })
        assert.ok(child.body.job, JSON.stringify(child.body))
        assert.equal(child.body.job.items.length, 2)
        assert.equal(child.body.preview.products.create, 2)
        await approve(f, child.body.job)
        assert.equal((await apply(f, source, child.body.job)).body.counts.succeeded, 2)
        for (const p of source.Products)
          assert.equal(
            (await db.query('select count(*)::int n from public.products where slug=$1', [p.slug]))
              .rows[0].n,
            1,
          )
      },
    )
    await t.test('audit failure rolls back an existing update with its receipt', async () => {
      const saved = await f.save(f.body())
      const source = await exported(f, saved.id)
      source.Products[0].title = 'Audit failure'
      const j = (await stage(f, source)).body.job
      await approve(f, j)
      const before = await f.snapshot(saved.id)
      await db.exec(
        "create function public.import_review_audit_fail() returns trigger language plpgsql as $$ begin if new.metadata ? 'import_job_id' then raise exception 'Owned audit failure';end if;return new;end $$;create trigger import_review_audit_fail before insert on public.admin_activity_logs for each row execute function public.import_review_audit_fail()",
      )
      const r = await apply(f, source, j)
      assert.equal(r.body.counts.failed, 1)
      assert.deepEqual(await f.snapshot(saved.id), before)
      await db.exec(
        'drop trigger import_review_audit_fail on public.admin_activity_logs;drop function public.import_review_audit_fail()',
      )
    })
    await t.test(
      'ERP setting change invalidates review; private ledgers expose no catalog values',
      async () => {
        const source = newCatalog()
        const j = (await stage(f, source)).body.job
        await approve(f, j)
        await db.exec("update public.site_settings set erp_mode='daftra' where key='default'")
        const r = await apply(f, source, j)
        assert.equal(r.body.counts.conflicted, 1)
        await db.exec("update public.site_settings set erp_mode='built_in' where key='default'")
        const docs = (
          await db.query(
            'select to_jsonb(j) doc from catalog_private.import_jobs j union all select to_jsonb(i) from catalog_private.import_items i',
          )
        ).rows
        assert.ok(!JSON.stringify(docs).includes(source.Products[0].title))
        assert.ok(!JSON.stringify(docs).includes(source.Products[0].slug))
        for (const role of ['anon', 'authenticated', 'service_role']) {
          const c = await db.connect(role)
          await assert.rejects(
            () => c.query('select * from catalog_private.import_jobs'),
            /permission denied/,
          )
          if (role !== 'service_role')
            await assert.rejects(
              () => c.query('select public.catalog_import_options($1)', [f.actors.owner]),
              /permission denied/,
            )
        }
      },
    )
  },
)

test(
  'migration 78 is additive under native non-superuser ownership',
  { skip: !process.env.SUPAUTILS_REVIEW_LIBRARY },
  async (t) => {
    const { createStorageNativeDatabase } = await import('./helpers/storageNativeDatabase.mjs')
    const { readFile } = await import('node:fs/promises')
    const db = await createStorageNativeDatabase({
      stopBefore: '20261014180000_catalog_import.sql',
    })
    t.after(() => db.close())
    const collect = async () => ({
      functions: (
        await db.query(
          "select n.nspname,p.proname,p.proargtypes::text,p.proacl::text,p.prosrc,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','catalog_private') order by 1,2,3",
        )
      ).rows,
      tables: (
        await db.query(
          "select n.nspname,c.relname,c.relacl::text,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','storage','catalog_private') and c.relkind in ('r','p') order by 1,2",
        )
      ).rows,
    })
    const before = await collect()
    await db.exec(await readFile('supabase/migrations/20261014180000_catalog_import.sql', 'utf8'))
    const after = await collect()
    assert.deepEqual(
      after.functions.filter(
        (row) => !row.proname.startsWith('catalog_import_') && !row.proname.startsWith('import_'),
      ),
      before.functions,
    )
    assert.deepEqual(
      after.tables.filter((row) => !['import_jobs', 'import_items'].includes(row.relname)),
      before.tables,
    )
    for (const role of ['anon', 'authenticated', 'service_role'])
      for (const name of ['import_jobs', 'import_items'])
        assert.equal(
          (
            await db.query(
              "select has_table_privilege($1,$2,'select,insert,update,delete') allowed",
              [role, 'catalog_private.' + name],
            )
          ).rows[0].allowed,
          false,
        )
  },
)

test(
  'bounded 250-product application in a 10000-product catalog',
  { skip: !emailNativeAvailable },
  async (t) => {
    const db = await createEmailNativeDatabase()
    const f = await createProductSaveHttpFixture({ database: db, closeDatabase: false })
    t.after(async () => {
      await f.close()
      await db.close()
    })
    await db.exec("set statement_timeout='30s'")
    await db.query(
      "insert into public.products(title,slug,sku,price,is_serialized,is_published,primary_warehouse_id) select 'Import catalog '||i,'import-large-'||i,'IMPORT-LARGE-'||i,10,true,false,$1 from generate_series(1,10000) i",
      [f.warehouse],
    )
    await db.exec("set statement_timeout='10s'")
    const protectedBefore = (
      await db.query(
        "select md5(string_agg((to_jsonb(p))::text,'' order by id)) hash from public.products p where slug like 'import-large-%'",
      )
    ).rows[0].hash
    const source = newCatalog(250)
    const started = performance.now()
    const reviewed = await stage(f, source, { format: 'xlsx' })
    assert.ok(reviewed.body.job, JSON.stringify(reviewed.body))
    const j = reviewed.body.job
    assert.equal(j.items.length, 250)
    await approve(f, j)
    const first = await apply(f, source, j)
    assert.equal(first.body.counts.succeeded, 5)
    assert.equal(first.body.counts.pending, 245)
    let result = first.body,
      calls = 1
    while (result.counts.pending) {
      result = (await apply(f, source, j)).body
      calls++
      assert.equal(result.counts.failed, 0, JSON.stringify(result))
    }
    assert.equal(result.counts.succeeded, 250)
    assert.equal(calls, 50)
    assert.equal(
      (
        await db.query(
          "select md5(string_agg((to_jsonb(p))::text,'' order by id)) hash from public.products p where slug like 'import-large-%'",
        )
      ).rows[0].hash,
      protectedBefore,
    )
    assert.equal(
      (await db.query('select count(*)::int n from public.commerce_serialized_units')).rows[0].n,
      0,
    )
    const report = {
      catalog: 10000,
      products: 250,
      per_request: 5,
      requests: calls,
      ms: Math.round(performance.now() - started),
      stock_created: 0,
      existing_catalog_unchanged: true,
    }
    if (process.env.CATALOG_TRANSFER_REVIEW_ARTIFACTS) {
      const { writeFile } = await import('node:fs/promises')
      await writeFile(
        process.env.CATALOG_TRANSFER_REVIEW_ARTIFACTS + '/import-performance.json',
        JSON.stringify(report, null, 2) + '\n',
      )
    }
    assert.ok(report.ms < 120000)
  },
)

test('import preserves physical inventory, ERP fields and media deletion boundary', async (t) => {
  const f = await createProductSaveHttpFixture()
  const media = await createMediaFixture({ fixture: f })
  f.client.__ownedUploadsDir = media.root
  t.after(async () => {
    await media.close()
    await f.close()
  })
  const saved = await f.save(f.body())
  let edit = await f.snapshot(saved.id)
  const received = await f.client.rpc('commerce_create_procurement_order', {
    p_supplier_id: f.supplier,
    p_warehouse_id: f.warehouse,
    p_invoice_number: 'IMPORT-OWNED-FIXTURE',
    p_notes: null,
    p_paid_amount: 0,
    p_items: [
      { product_id: saved.id, variant_id: edit.variants[0].id, quantity: 2, unit_cost: 30 },
    ],
  })
  assert.equal(received.error, null, JSON.stringify(received.error))
  const protectedData = async () => ({
    product: (
      await f.db.query(
        "select to_jsonb(p)-array['title','price'] doc from public.products p where id=$1",
        [saved.id],
      )
    ).rows,
    variants: (
      await f.db.query(
        "select to_jsonb(v)-array['price','updated_at'] doc from public.product_variants v where product_id=$1 order by id",
        [saved.id],
      )
    ).rows,
    units: (
      await f.db.query('select to_jsonb(u) doc from public.commerce_serialized_units u order by id')
    ).rows,
    inventory: (
      await f.db.query(
        'select to_jsonb(i) doc from public.commerce_warehouse_inventory i order by id',
      )
    ).rows,
  })
  const before = await protectedData()
  const source = await exported(f, saved.id)
  source.Products[0].title = 'Imported authored title'
  source.Products[0].price = '150.50'
  const j = (await stage(f, source)).body.job
  await approve(f, j)
  assert.equal((await apply(f, source, j)).body.counts.succeeded, 1)
  assert.deepEqual(await protectedData(), before)
  await t.test('options with unit history cannot be deactivated', async () => {
    const next = await exported(f, saved.id)
    next.Variants[0].is_active = false
    next.Variants.push({
      product_key: saved.id,
      entity_key: 'replacement',
      name: 'Replacement',
      code: 'REPLACEMENT',
      sku: 'NEW-' + randomUUID(),
      is_active: true,
    })
    const j = (await stage(f, next)).body.job
    assert.ok(j)
    await approve(f, j)
    const r = await apply(f, next, j)
    assert.equal(r.body.counts.failed, 1)
    assert.equal(r.body.items[0].reason, 'history')
    assert.deepEqual(await protectedData(), before)
  })
  await t.test('authorized media rejects a deletion reservation made after review', async () => {
    await media.addFile('products/deletion-race.png')
    const next = newCatalog()
    next.Products[0].image_url = '/uploads/products/deletion-race.png'
    const j = (await stage(f, next)).body.job
    await approve(f, j)
    const reserved = await f.client.rpc('catalog_media_delete', {
      p_admin_id: f.actors.owner,
      p_path: next.Products[0].image_url,
      p_finish: false,
    })
    assert.equal(reserved.error, null)
    const r = await apply(f, next, j)
    assert.equal(r.body.counts.failed, 1)
    assert.equal(r.body.items[0].reason, 'media')
  })
  await t.test('product editors cannot add protected public-media sections', async () => {
    await media.addFile('settings/site-logo/protected.png')
    const next = newCatalog()
    next.Products[0].image_url = '/uploads/settings/site-logo/protected.png'
    const r = await stage(f, next, { actor: 'editor' })
    assert.equal(r.body.job, null)
    assert.equal(r.body.preview.products.invalid, 1)
  })
  await t.test(
    'direct service commands cannot smuggle inventory fields through a review',
    async () => {
      const source = newCatalog()
      const staged = (await stage(f, source)).body.job
      await approve(f, staged)
      const r = await f.client.rpc('catalog_import_apply_item', {
        p_admin_id: f.actors.owner,
        p_job_id: staged.id,
        p_key: 'p0',
        p_source: staged.source_hash,
        p_review: staged.review_hash,
        p_command: {
          fields: { stock_quantity: 200 },
          variants: [],
          specifications: [],
          images: [],
        },
        p_failure: null,
      })
      assert.equal(r.error, null)
      assert.equal(r.data.counts.conflicted, 1)
      assert.deepEqual(await protectedData(), before)
    },
  )
})

test('related-only updates retain definitions and exact optional text', async (t) => {
  const f = await createProductSaveHttpFixture()
  const media = await createMediaFixture({ fixture: f })
  f.client.__ownedUploadsDir = media.root
  t.after(async () => {
    await media.close()
    await f.close()
  })
  const saved = await f.save(f.body())
  const old = await f.snapshot(saved.id)
  await media.addFile('products/gallery/related.png')
  const source = await exported(f, saved.id)
  source.Variants[0].sku = ''
  source.Variants[0].color_name = ''
  source.Variants.push({
    product_key: saved.id,
    entity_key: 'new_option',
    name: 'Authored option',
    code: 'NEW_OPTION',
    sku: '000' + randomUUID(),
    is_active: true,
  })
  source.Specifications.push({
    product_key: saved.id,
    entity_key: 'spec',
    label: 'Authored label',
    value: 'Authored value',
    sort_order: 1,
    is_highlight: false,
  })
  source.Images.push({
    product_key: saved.id,
    entity_key: 'image',
    variant_key: 'new_option',
    image_url: '/uploads/products/gallery/related.png',
    alt_text: '',
    sort_order: 1,
  })
  const reviewed = await stage(f, source)
  assert.ok(reviewed.body.job, JSON.stringify(reviewed.body))
  assert.equal(reviewed.body.preview.products.update, 1)
  await approve(f, reviewed.body.job)
  const r = await apply(f, source, reviewed.body.job)
  assert.equal(r.body.counts.succeeded, 1, JSON.stringify(r.body))
  const after = await f.snapshot(saved.id)
  assert.ok(after.revision > old.revision)
  assert.equal(after.variants.length, 2)
  assert.equal(after.variants.find((v) => v.id === old.variants[0].id).sku, '')
  assert.deepEqual(after.product, old.product)
  const image = (
    await f.db.query('select variant_id,alt_text from public.product_images where product_id=$1', [
      saved.id,
    ])
  ).rows[0]
  assert.equal(image.variant_id, after.variants.find((v) => v.code === 'NEW_OPTION').id)
  assert.equal(image.alt_text, '')
  await assert.rejects(
    () =>
      f.db.query('select public.catalog_media_delete($1,$2,false)', [
        f.actors.owner,
        '/uploads/products/gallery/related.png',
      ]),
    /MEDIA_REFERENCED/,
  )
})

test('product price projection includes options reactivated in the same import', async (t) => {
  const f = await createProductSaveHttpFixture()
  t.after(() => f.close())
  const saved = await f.save(f.body())
  const inactive = (
    await f.db.query(
      "insert into public.product_variants(product_id,name,code,price,is_active,stock_quantity,cost_price) values($1,'Historical option','HISTORICAL',12.50,false,0,0) returning id",
      [saved.id],
    )
  ).rows[0].id
  const source = await exported(f, saved.id)
  source.Products[0].price = '200.50'
  source.Variants.find((v) => v.id === inactive).is_active = true
  const reviewed = await stage(f, source)
  assert.ok(reviewed.body.job, JSON.stringify(reviewed.body))
  await approve(f, reviewed.body.job)
  const result = await apply(f, source, reviewed.body.job)
  assert.equal(result.body.counts.succeeded, 1, JSON.stringify(result.body))
  const after = await f.snapshot(saved.id)
  assert.equal(after.variants.length, 2)
  for (const option of after.variants) {
    assert.equal(Number(option.price), 200.5)
    assert.equal(option.stock_quantity, 0)
    assert.equal(option.cost_price, 0)
  }
})

test(
  'PostgREST import RPCs reload service-only and private ledgers remain inaccessible',
  { skip: !emailNativeAvailable },
  async (t) => {
    const { createCatalogRestFixture } = await import('./helpers/catalogRestFixture.mjs')
    const { readFile, readdir } = await import('node:fs/promises')
    const rest = await createCatalogRestFixture()
    t.after(() => rest.close())
    for (const name of (await readdir('supabase/migrations'))
      .filter(
        (n) =>
          n.endsWith('.sql') &&
          n > '20261011120000_catalog_confidentiality.sql' &&
          n < '20261014180000_catalog_import.sql',
      )
      .sort())
      await rest.db.exec(await readFile('supabase/migrations/' + name, 'utf8'))
    assert.equal(
      (
        await rest.request('/rpc/catalog_import_options', {
          actor: 'service',
          method: 'POST',
          body: { p_admin_id: rest.actors.owner },
        })
      ).status,
      404,
    )
    await rest.db.exec(
      await readFile('supabase/migrations/20261014180000_catalog_import.sql', 'utf8'),
    )
    const f = await createProductSaveHttpFixture({ database: rest.db, closeDatabase: false })
    t.after(() => f.close())
    Object.assign(rest.actors, f.actors)
    await nativeWaitFor(
      async () =>
        (
          await rest.request('/rpc/catalog_import_options', {
            actor: 'service',
            method: 'POST',
            body: { p_admin_id: f.actors.owner },
          })
        ).status === 200,
    )
    const id = randomUUID(),
      hash = 'a'.repeat(64)
    const calls = {
      catalog_import_options: { p_admin_id: f.actors.owner },
      catalog_import_status: { p_admin_id: f.actors.owner, p_job_id: id },
      catalog_import_find: {
        p_admin_id: f.actors.owner,
        p_job_id: id,
        p_source: hash,
        p_warehouse: null,
        p_retry_of: null,
      },
      catalog_import_stage: {
        p_admin_id: f.actors.owner,
        p_job_id: id,
        p_source: hash,
        p_warehouse: null,
        p_retry_of: null,
        p_items: [],
        p_row_count: 1,
      },
      catalog_import_approve: {
        p_admin_id: f.actors.owner,
        p_job_id: id,
        p_review: hash,
        p_publish: false,
      },
      catalog_import_cancel: { p_admin_id: f.actors.owner, p_job_id: id, p_review: hash },
      catalog_import_apply_item: {
        p_admin_id: f.actors.owner,
        p_job_id: id,
        p_key: 'p',
        p_source: hash,
        p_review: hash,
        p_command: {},
        p_failure: null,
      },
    }
    for (const actor of [null, 'customer', 'viewer', 'editor', 'owner']) {
      for (const [name, body] of Object.entries(calls))
        assert.notEqual(
          (await rest.request('/rpc/' + name, { actor, method: 'POST', body })).status,
          200,
        )
      for (const table of ['import_jobs', 'import_items'])
        assert.notEqual((await rest.request('/' + table, { actor })).status, 200)
    }
    const c = await rest.db.connect('service_role')
    await c.query('begin isolation level repeatable read')
    await assert.rejects(
      () => c.query('select public.catalog_import_options($1)', [f.actors.owner]),
      /import:invalid/,
    )
    await c.query('rollback')
  },
)
