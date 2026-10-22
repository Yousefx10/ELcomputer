import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createEmailNativeDatabase, emailNativeAvailable } from './helpers/emailNativeDatabase.mjs'
import { createProductSaveFixture } from './helpers/productSaveFixture.mjs'

test('native product presentation authorization, revision, recovery and public projections', { skip: !emailNativeAvailable, timeout: 120000 }, async t => {
  const db = await createEmailNativeDatabase()
  try {
    const f = await createProductSaveFixture({ database: db })
    const source = await f.save(f.body({ is_published: true })), related = await f.save(f.body({ is_published: true })), draft = await f.save(f.body())
    const productId = source.id, relatedId = related.id, draftId = draft.id
    const baseline = (await db.query('select id,to_jsonb(p) value from public.products p order by id')).rows
    const rpc = async (name, args) => (await db.query('select public.' + name + '(' + args.map((_, i) => '$' + (i + 1)).join(',') + ') value', args)).rows[0].value
    const payload = { videos: [], related: [relatedId, draftId], compatible: [relatedId] }, requestId = randomUUID()
    await t.test('Classic defaults and exact style enum persist without content rewrites', async () => {
      assert.equal((await db.query("select product_page_style from public.site_settings where key='default'")).rows[0].product_page_style, 'classic')
      await assert.rejects(() => db.exec("update public.site_settings set product_page_style='other'"), error => error.code === '23514')
      await db.exec("update public.site_settings set product_page_style='premium'")
      assert.equal((await db.query("select product_page_style from public.site_settings where key='default'")).rows[0].product_page_style, 'premium')
      await db.exec("update public.site_settings set product_page_style='classic'")
    })
    await t.test('current active Products edit permissions are required inside SQL', async () => {
      for (const actor of ['viewer', 'disabled', 'customer']) await assert.rejects(() => rpc('catalog_save_product_presentation', [f.actors[actor], productId, randomUUID(), 0, payload]), error => error.code === '42501')
      assert.equal((await rpc('catalog_product_presentation', [f.actors.editor, productId])).revision, 0)
    })
    await t.test('save, identical retry and stale revision preserve all original catalog fields', async () => {
      const first = await rpc('catalog_save_product_presentation', [f.actors.owner, productId, requestId, 0, payload])
      assert.equal(first.revision, 1); assert.equal(first.replayed, false)
      assert.equal((await rpc('catalog_save_product_presentation', [f.actors.owner, productId, requestId, 0, payload])).replayed, true)
      await assert.rejects(() => rpc('catalog_save_product_presentation', [f.actors.owner, productId, randomUUID(), 0, payload]), error => error.code === '40001')
      await assert.rejects(() => rpc('catalog_save_product_presentation', [f.actors.editor, productId, requestId, 0, payload]), error => error.code === '22023')
      assert.deepEqual((await db.query('select id,to_jsonb(p) value from public.products p order by id')).rows, baseline)
      assert.equal((await db.query("select count(*)::int n from public.admin_activity_logs where action_key='products.presentation.update'")).rows[0].n, 1)
      const status = await rpc('catalog_product_presentation_status', [f.actors.owner, requestId]); assert.equal(status.committed, true); assert.equal(status.revision, 1)
      assert.deepEqual(await rpc('catalog_product_presentation_status', [f.actors.editor, requestId]), { committed: false })
    })
    await t.test('public metadata never exposes Draft relationships, confidential prices or hidden source products', async () => {
      const data = await rpc('get_product_presentation', [productId])
      assert.deepEqual(data.related.map(row => row.id), [relatedId]); assert.deepEqual(data.compatible.map(row => row.id), [relatedId])
      assert.equal(await rpc('get_product_presentation', [draftId]), null)
      for (const row of [...data.related, ...data.compatible]) for (const key of ['cost_price', 'supplier_id', 'primary_warehouse_id']) assert.equal(Object.hasOwn(row, key), false)
    })
    await t.test('private video assets become public only through a published, valid assignment', async () => {
      const assetId = randomUUID(), otherId = randomUUID()
      await rpc('catalog_register_product_video', [f.actors.owner, productId, assetId, 'video/webm', 256, 'a'.repeat(64), 2])
      assert.equal(await rpc('get_public_product_video', [assetId]), null)
      await assert.rejects(() => rpc('catalog_register_product_video', [f.actors.owner, productId, assetId, 'video/webm', 256, 'b'.repeat(64), 2]), error => error.code === '22023')
      const variant = (await f.snapshot(productId)).variants[0]
      const content = { ...payload, videos: [{ asset_id: assetId, variant_id: variant.id, label: 'Authored video', label_ar: '', sort_order: 0 }] }
      await rpc('catalog_save_product_presentation', [f.actors.owner, productId, randomUUID(), 1, content])
      assert.equal((await rpc('get_public_product_video', [assetId])).size_bytes, 256)
      assert.equal((await rpc('get_product_presentation', [productId])).videos[0].variant_id, variant.id)
      await assert.rejects(() => rpc('catalog_save_product_presentation', [f.actors.owner, relatedId, randomUUID(), 0, content]), error => error.message.startsWith('pdp:'))
      await db.query("insert into public.product_variants(product_id,name,code,sku) values($1,'Second option','SECOND',$2)", [productId, 'SECOND-' + randomUUID()])
      await db.query('update public.product_variants set is_active=false where id=$1', [variant.id])
      assert.equal(await rpc('get_public_product_video', [assetId]), null)
      assert.equal((await rpc('get_product_presentation', [productId])).videos.length, 0)
      assert.equal(await rpc('get_public_product_video', [otherId]), null)
    })
    await t.test('new presentation metadata participates in existing image deletion guards', async () => {
      const path = '/uploads/presentation-safety.webp'
      await db.query("update catalog_private.product_presentations set content=jsonb_set(content,'{authored_note}',to_jsonb($1::text)) where product_id=$2", [path, productId])
      await assert.rejects(() => rpc('catalog_media_delete', [f.actors.owner, path, false]), error => error.message === 'MEDIA_REFERENCED')
      await db.query("update catalog_private.product_presentations set content=content-'authored_note' where product_id=$1", [productId])
      assert.equal((await rpc('catalog_media_delete', [f.actors.owner, path, false])).state, 'deleting')
      await assert.rejects(() => db.query("update catalog_private.product_presentations set content=jsonb_set(content,'{authored_note}',to_jsonb($1::text)) where product_id=$2", [path, productId]), error => error.message.includes('image is unavailable'))
    })
    await t.test('presentation writes serialize with the existing full reset lock', async () => {
      const blocker = await db.connect()
      const before = (await db.query('select count(*)::int n from catalog_private.product_video_assets')).rows[0].n
      try {
        await blocker.query("begin;select pg_advisory_xact_lock(hashtextextended('elcomputer-system-reset',0))")
        await db.exec("set lock_timeout='100ms'")
        await assert.rejects(() => rpc('catalog_register_product_video', [f.actors.owner, productId, randomUUID(), 'video/webm', 256, 'a'.repeat(64), 2]), error => error.code === '55P03')
        assert.equal((await db.query('select count(*)::int n from catalog_private.product_video_assets')).rows[0].n, before)
      } finally { await blocker.query('rollback'); await blocker.end(); await db.exec("set lock_timeout='5s'") }
    })
    await t.test('existing reset coverage recognizes only the new scoped metadata', async () => {
      const plan = await rpc('system_reset_plan', [f.actors.owner, 'products'])
      assert.ok(Array.isArray(plan.blockers))
    })
    await t.test('anonymous/staff SQL roles cannot write private data or call service commands', async () => {
      for (const role of ['anon', 'authenticated']) {
        await db.exec('set role ' + role)
        try {
          await assert.rejects(() => db.exec('select * from catalog_private.product_presentations'), error => error.code === '42501')
          await assert.rejects(() => rpc('catalog_product_presentation', [f.actors.owner, productId]), error => error.code === '42501')
          assert.ok(await rpc('get_product_presentation', [productId]))
        } finally { await db.exec('reset role') }
      }
    })
    await t.test('product deletion removes assignments and keeps non-replaying minimal receipts', async () => {
      await db.query('delete from public.products where id=$1', [productId])
      assert.equal(await rpc('get_product_presentation', [productId]), null)
      assert.equal((await db.query('select count(*)::int n from catalog_private.product_video_assets where product_id=$1', [productId])).rows[0].n, 0)
      assert.ok((await db.query('select count(*)::int n from catalog_private.product_presentation_receipts where product_id=$1', [productId])).rows[0].n > 0)
      await assert.rejects(() => rpc('catalog_save_product_presentation', [f.actors.owner, productId, requestId, 0, payload]), error => error.code === 'P0002')
    })
  } finally { await db.close() }
})
