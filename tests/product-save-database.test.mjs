import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createProductSaveFixture, productSaveMigration } from './helpers/productSaveFixture.mjs'
import { catalogDataSnapshot } from './helpers/catalogFixture.mjs'

test('atomic product saves retain catalog, inventory, audit and security rules', async t => {
  const f = await createProductSaveFixture()
  try {
    let input, result, loaded
    await t.test('owner creates one zero-stock product with valid definitions and a transactional audit', async () => {
      input = f.body({ warranty_status: 'included', warranty_duration_value: 12, warranty_duration_unit: 'months' })
      result = await f.save(input)
      loaded = await f.snapshot(result.id)
      assert.equal(loaded.revision, result.revision)
      assert.equal(loaded.product.price, 125.5)
      assert.equal(loaded.product.stock_quantity, 0)
      assert.equal(loaded.product.cost_price, 0)
      assert.equal(loaded.variants.length, 1)
      assert.equal(loaded.variants[0].code, 'DEFAULT')
      assert.deepEqual(await f.counts(), { products: 1, variants: 1, audits: 1, receipts: 1 })
    })
    await t.test('lost create acknowledgement returns the original receipt without another product or audit', async () => {
      const before = await f.counts()
      const replay = await f.save(input)
      assert.equal(replay.id, result.id)
      assert.equal(replay.revision, result.revision)
      assert.equal(replay.replayed, true)
      assert.deepEqual(await f.counts(), before)
      await assert.rejects(() => f.save({ ...input, title: 'Changed retry' }), e => e.statusCode === 409)
      await assert.rejects(() => f.save(input, { actor: 'editor' }), e => e.statusCode === 409)
    })
    await t.test('late variant failure rolls back product, default option, revision and receipt', async () => {
      const before = await f.counts()
      await assert.rejects(() => f.save(f.body({ variants: [{ id: randomUUID(), name: 'Foreign', code: 'FOREIGN' }] })), e => e.statusCode === 400)
      assert.deepEqual(await f.counts(), before)
    })
    await t.test('editor updates the existing product and options, preserving omitted warranty', async () => {
      const edit = { ...input, request_id: randomUUID(), expected_revision: loaded.revision, title: 'Edited product',
        variants: [{ ...input.variants[0], id: loaded.variants[0].id, name: 'Black', code: 'BLACK' }] }
      for (const key of ['warranty_status', 'warranty_duration_value', 'warranty_duration_unit']) delete edit[key]
      result = await f.save(edit, { actor: 'editor', operation: 'update', id: result.id })
      loaded = await f.snapshot(result.id)
      assert.equal(loaded.product.title, 'Edited product')
      assert.equal(loaded.variants[0].code, 'BLACK')
      assert.equal(loaded.product.warranty_duration_value, 12)
      assert.equal((await f.counts()).audits, 2)
      assert.equal((await f.save(edit, { actor: 'editor', operation: 'update', id: result.id })).replayed, true)
    })
    await t.test('stale administrator cannot overwrite a successful save', async () => {
      const before = await f.snapshot(result.id)
      await assert.rejects(() => f.save({ ...input, request_id: randomUUID(), expected_revision: 0, title: 'Stale edit' }, { operation: 'update', id: result.id }), e => e.statusCode === 409 && e.data.productSaveError === 'conflict')
      assert.deepEqual(await f.snapshot(result.id), before)
    })
    await t.test('failed option update retains the complete previous product and revision', async () => {
      const before = await f.snapshot(result.id), counts = await f.counts()
      await assert.rejects(() => f.save({ ...input, request_id: randomUUID(), expected_revision: before.revision, price: 99,
        variants: [{ id: randomUUID(), name: 'Foreign', code: 'FOREIGN' }] }, { operation: 'update', id: result.id }), e => e.statusCode === 400)
      assert.deepEqual(await f.snapshot(result.id), before)
      assert.deepEqual(await f.counts(), counts)
    })
    await t.test('audit outage rolls back both product creation and editing', async () => {
      await f.db.exec("create function public.product_save_audit_failure() returns trigger language plpgsql as $$begin if new.action_key in ('products.create','products.update') then raise exception 'private audit outage';end if;return new;end$$;create trigger product_save_audit_failure before insert on public.admin_activity_logs for each row execute function public.product_save_audit_failure()")
      const before = await f.snapshot(result.id), counts = await f.counts()
      await assert.rejects(() => f.save(f.body()), e => e.statusCode === 503)
      await assert.rejects(() => f.save({ ...input, request_id: randomUUID(), expected_revision: before.revision, title: 'Audit failure' }, { operation: 'update', id: result.id }), e => e.statusCode === 503)
      assert.deepEqual(await f.snapshot(result.id), before)
      assert.deepEqual(await f.counts(), counts)
      await f.db.exec('drop trigger product_save_audit_failure on public.admin_activity_logs;drop function public.product_save_audit_failure()')
    })
    await t.test('viewer, disabled staff and customer are rejected, including receipt replay', async () => {
      const before = await f.counts()
      for (const actor of ['viewer', 'disabled', 'customer']) {
        await assert.rejects(() => f.save(f.body(), { actor }), e => e.statusCode === 403)
        await assert.rejects(() => f.save(input, { actor }), e => e.statusCode === 403)
      }
      assert.deepEqual(await f.counts(), before)
    })
    await t.test('physical procurement updates stock/cost without staling editorial data', async () => {
      const before = await f.snapshot(result.id)
      const receipt = await f.client.rpc('commerce_create_procurement_order', { p_supplier_id: f.supplier, p_warehouse_id: f.warehouse,
        p_invoice_number: 'PRODUCT-SAVE-RECEIPT', p_notes: null, p_paid_amount: 0,
        p_items: [{ product_id: result.id, variant_id: before.variants[0].id, quantity: 2, unit_cost: 30 }] })
      assert.equal(receipt.error, null)
      const received = await f.snapshot(result.id)
      assert.equal(received.revision, before.revision)
      assert.equal(received.product.stock_quantity, 2)
      assert.equal(received.product.cost_price, 30)
      const edit = { ...input, request_id: randomUUID(), expected_revision: before.revision, description: 'Actual authored text', variants: before.variants }
      result = await f.save(edit, { operation: 'update', id: result.id })
      loaded = await f.snapshot(result.id)
      assert.equal(loaded.product.stock_quantity, 2)
      assert.equal(loaded.product.cost_price, 30)
      assert.equal(loaded.variants[0].stock_quantity, 2)
    })
    await t.test('history and warehouse restrictions fail atomically', async () => {
      const before = await f.snapshot(result.id), counts = await f.counts()
      for (const change of [{ primary_warehouse_id: f.otherWarehouse }, { variants: [{ name: 'Replacement', code: 'REPLACEMENT' }] }]) {
        await assert.rejects(() => f.save({ ...input, ...change, request_id: randomUUID(), expected_revision: before.revision }, { operation: 'update', id: result.id }), e => e.statusCode === 400)
        assert.deepEqual(await f.snapshot(result.id), before)
        assert.deepEqual(await f.counts(), counts)
      }
    })
    await t.test('browser roles cannot read private metadata or invoke service commands', async () => {
      for (const role of ['anon', 'authenticated']) {
        await f.db.exec('set role ' + role)
        try {
          await assert.rejects(() => f.db.query('select * from catalog_private.product_revisions'), /permission denied/)
          await assert.rejects(() => f.db.query('select public.catalog_product_edit_snapshot($1,$2)', [f.actors.owner, result.id]), /permission denied/)
          await assert.rejects(() => f.db.query('select public.catalog_product_save_status($1,$2)', [f.actors.owner, input.request_id]), /permission denied/)
          await assert.rejects(() => f.db.query('select public.catalog_save_product($1,$2,$3,$4,$5,$6,$7)', [f.actors.owner, randomUUID(), 'create', null, null, '{}', '[]']), /permission denied/)
        } finally { await f.db.exec('reset role') }
      }
      await f.db.exec("set role service_role;select set_config('request.jwt.claim.role','service_role',false)")
      try { await assert.rejects(() => f.db.query('delete from catalog_private.product_save_receipts'), /permission denied/) }
      finally { await f.db.exec('reset role') }
    })
    await t.test('retained receipt prevents resurrection after product deletion', async () => {
      const deletedInput = f.body(), deleted = await f.save(deletedInput)
      await f.db.query('delete from public.products where id=$1', [deleted.id])
      await assert.rejects(() => f.save(deletedInput), e => e.statusCode === 409 && e.data.productSaveError === 'unavailable')
      assert.equal((await f.db.query('select count(*)::int n from public.products where id=$1', [deleted.id])).rows[0].n, 0)
    })
    await t.test('legacy stock edits retain primary-warehouse deltas and Daftra ownership', async () => {
      const id = randomUUID()
      await f.db.exec("select set_config('app.serialized_inventory_write','on',false)")
      await f.db.query("insert into public.products(id,title,slug,price,is_serialized,stock_quantity,cost_price,primary_warehouse_id) values($1,'Legacy product',$1::uuid::text,10,false,5,7,$2)", [id, f.warehouse])
      await f.db.exec("select set_config('app.serialized_inventory_write','',false)")
      await f.db.query('insert into public.commerce_warehouse_inventory(product_id,warehouse_id,quantity,average_cost) values($1,$2,5,7)', [id, f.warehouse])
      let snapshot = await f.snapshot(id)
      const edit = f.body({ slug: snapshot.product.slug, expected_revision: snapshot.revision, is_serialized: false, variants: [], stock_quantity: '7' })
      await f.save(edit, { operation: 'update', id })
      snapshot = await f.snapshot(id)
      assert.equal(snapshot.product.stock_quantity, 7)
      assert.equal(snapshot.product.cost_price, 7)
      assert.equal((await f.db.query('select quantity from public.commerce_warehouse_inventory where product_id=$1 and warehouse_id=$2', [id, f.warehouse])).rows[0].quantity, 7)
      for (const change of [{ stock_quantity: '2.9' }, { primary_warehouse_id: f.otherWarehouse }]) {
        await assert.rejects(() => f.save({ ...edit, ...change, request_id: randomUUID(), expected_revision: snapshot.revision }, { operation: 'update', id }), e => e.statusCode === 400)
        assert.deepEqual(await f.snapshot(id), snapshot)
      }
      await f.db.exec("update public.site_settings set erp_mode='daftra' where key='default'")
      await assert.rejects(() => f.save({ ...edit, request_id: randomUUID(), expected_revision: snapshot.revision, stock_quantity: 8 }, { operation: 'update', id }), e => e.statusCode === 409 && e.data.productSaveError === 'erp')
      assert.deepEqual(await f.snapshot(id), snapshot)
      await f.save({ ...edit, request_id: randomUUID(), expected_revision: snapshot.revision, price: 13 }, { operation: 'update', id })
      assert.equal((await f.snapshot(id)).product.price, 13)
      await f.db.exec("update public.site_settings set erp_mode='built_in' where key='default'")
    })
    await t.test('duplicate SKU/slug and deferred image integrity failures roll back whole saves', async () => {
      const source = f.body({ variants: [{ name: 'First', code: 'FIRST', sku: 'IMAGE-' + randomUUID() }, { name: 'Second', code: 'SECOND' }] })
      const saved = await f.save(source), snapshot = await f.snapshot(saved.id)
      await f.db.query("insert into public.product_images(product_id,variant_id,image_url) values($1,$2,'/fixture-extra.webp')", [saved.id, snapshot.variants.find(v => v.code === 'FIRST').id])
      const before = await f.counts()
      for (const change of [{ slug: source.slug }, { sku: source.sku }, { variants: [source.variants[0]] }]) {
        await assert.rejects(() => f.save(f.body(change)), e => [400, 409].includes(e.statusCode))
        assert.deepEqual(await f.counts(), before)
      }
      await assert.rejects(() => f.save({ ...source, request_id: randomUUID(), expected_revision: snapshot.revision,
        price: 17, variants: [snapshot.variants.find(v => v.code === 'SECOND')] }, { operation: 'update', id: saved.id }), e => e.statusCode === 400)
      assert.deepEqual(await f.snapshot(saved.id), snapshot)
      assert.deepEqual(await f.counts(), before)
    })
    await t.test('revoked Products access disables saved granular permissions at the SQL boundary', async () => {
      const before = await f.counts()
      await f.db.query("update public.admin_users set permissions=jsonb_set(permissions,'{products.view}','false') where id=$1", [f.actors.editor])
      await assert.rejects(() => f.save(f.body(), { actor: 'editor' }), e => e.statusCode === 403)
      assert.deepEqual(await f.counts(), before)
    })
  } finally { await f.db.close() }
})

test('migration 72 preserves populated business data, original functions, policies and confidential grants', async () => {
  const f = await createProductSaveFixture({ stopBefore: productSaveMigration })
  try {
    const id = randomUUID()
    await f.db.query("insert into public.products(id,title,slug,price,primary_warehouse_id,is_serialized) values($1,'Existing product',$1::uuid::text,12.50,$2,true)", [id, f.warehouse])
    const before = await catalogDataSnapshot(f.db)
    const functions = async () => (await f.db.query("select p.oid::regprocedure::text name,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' order by name")).rows
    const policies = async () => (await f.db.query("select * from pg_policies where schemaname='public' order by tablename,policyname")).rows
    const oldFunctions = await functions(), oldPolicies = await policies()
    await f.db.exec(await readFile(new URL('../supabase/migrations/' + productSaveMigration, import.meta.url), 'utf8'))
    assert.deepEqual(await catalogDataSnapshot(f.db), before)
    const newFunctions = await functions()
    for (const old of oldFunctions) assert.deepEqual(newFunctions.find(row => row.name === old.name), old)
    assert.deepEqual(await policies(), oldPolicies)
    assert.equal((await f.snapshot(id)).revision, 0)
    for (const role of ['anon', 'authenticated']) for (const column of ['cost_price', 'default_supplier_id', 'primary_warehouse_id']) {
      assert.equal((await f.db.query("select has_column_privilege($1,'public.products',$2,'SELECT') allowed", [role, column])).rows[0].allowed, false)
    }
  } finally { await f.db.close() }
})

test('existing guarded catalog/full resets retain retry tombstones without new blockers', async () => {
  for (const scope of ['products', 'full']) {
    const f = await createProductSaveFixture()
    try {
      const input = f.body(), created = await f.save(input)
      const generation = (await f.db.query('select revision from catalog_private.product_revisions where product_id=$1', [created.id])).rows[0].revision
      const run = (await f.db.query('select public.system_reset_begin($1,$2,$3) result', [f.actors.owner, scope, randomUUID()])).rows[0].result
      assert.equal(run.status, 'cleanup_pending')
      assert.equal((await f.counts()).products, 0)
      assert.equal((await f.counts()).receipts, 1)
      assert.equal((await f.db.query('select revision from catalog_private.product_revisions where product_id=$1', [created.id])).rows[0].revision, generation)
      await assert.rejects(() => f.save(input), e => e.statusCode === 409 && e.data.productSaveError === 'unavailable')
      assert.equal((await f.counts()).products, 0)
    } finally { await f.db.close() }
  }
})
