import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createEmailNativeDatabase, emailNativeAvailable, nativeWaitFor } from './helpers/emailNativeDatabase.mjs'
import { createProductSaveFixture } from './helpers/productSaveFixture.mjs'
import { smsDatabaseClient } from './helpers/smsDatabase.mjs'
import { readFile } from 'node:fs/promises'
import { createStorageNativeDatabase, storageNativeAvailable } from './helpers/storageNativeDatabase.mjs'
import { productSaveMigration } from './helpers/productSaveFixture.mjs'

test('native independent product saves serialize edits, retries, revocation and ERP ownership', { skip: !emailNativeAvailable, timeout: 60000 }, async t => {
  const database = await createEmailNativeDatabase()
  try {
    const f = await createProductSaveFixture({ database })
    const workers = await Promise.all([database.connect('service_role'), database.connect('service_role')])
    const clients = workers.map(smsDatabaseClient), blocker = await database.connect()
    const blocked = count => nativeWaitFor(async () => Number((await database.query(
      "select count(*) n from pg_stat_activity where pid=any($1::int[]) and wait_event_type='Lock'",
      [workers.map(client => client.processID)])).rows[0].n) === count)
    const input = f.body(), created = await f.save(input)
    let snapshot = await f.snapshot(created.id)
    const edit = overrides => ({ ...input, request_id: randomUUID(), expected_revision: snapshot.revision,
      variants: snapshot.variants, ...overrides })
    await t.test('two administrators with one loaded revision commit one edit and one audit', async () => {
      const before = await f.counts()
      await blocker.query('begin')
      await blocker.query('select id from public.products where id=$1 for update', [created.id])
      const pending = Promise.allSettled(clients.map((transport, index) => f.save(edit({ title: 'Administrator ' + index }),
        { transport, actor: index ? 'editor' : 'owner', operation: 'update', id: created.id })))
      await blocked(2); await blocker.query('commit')
      const outcomes = await pending
      assert.equal(outcomes.filter(item => item.status === 'fulfilled').length, 1)
      assert.equal(outcomes.filter(item => item.status === 'rejected' && item.reason.statusCode === 409).length, 1)
      assert.equal((await f.counts()).audits, before.audits + 1)
      snapshot = await f.snapshot(created.id)
    })
    await t.test('simultaneous identical creation requests return one product and one receipt', async () => {
      const before = await f.counts(), retry = f.body()
      await blocker.query('begin')
      await blocker.query("select pg_advisory_xact_lock(hashtextextended('catalog:save:'||$1::text,0))", [retry.request_id])
      const pending = Promise.allSettled(clients.map(transport => f.save(retry, { transport })))
      await blocked(2); await blocker.query('commit')
      const outcomes = await pending
      assert.ok(outcomes.every(item => item.status === 'fulfilled'), JSON.stringify(outcomes))
      assert.equal(outcomes[0].value.id, outcomes[1].value.id)
      assert.equal(outcomes.filter(item => item.value.replayed).length, 1)
      const after = await f.counts()
      assert.equal(after.products, before.products + 1)
      assert.equal(after.audits, before.audits + 1)
      assert.equal(after.receipts, before.receipts + 1)
    })
    await t.test('a lost acknowledgement after a real commit is reconciled by another session', async () => {
      const before = await f.counts(), retry = f.body()
      const lost = { rpc: async (name, args) => {
        const response = await clients[0].rpc(name, args)
        assert.equal(response.error, null)
        return { data: null, error: { message: 'Synthetic response loss after native commit' } }
      } }
      await assert.rejects(() => f.save(retry, { transport: lost }), e => e.statusCode === 503)
      const recovered = await f.save(retry, { transport: clients[1] })
      assert.equal(recovered.replayed, true)
      assert.equal((await f.counts()).products, before.products + 1)
      assert.equal((await f.counts()).audits, before.audits + 1)
      const status = await clients[1].rpc('catalog_product_save_status', { p_admin_id: f.actors.owner, p_request_id: retry.request_id })
      assert.equal(status.data.id, recovered.id)
    })
    await t.test('administrator revocation before the authorization lock denies the waiting save', async () => {
      const before = await f.snapshot(created.id), counts = await f.counts()
      await blocker.query('begin')
      await blocker.query('select id from public.admin_users where id=$1 for update', [f.actors.editor])
      const pending = Promise.allSettled([f.save(edit({ title: 'Revoked edit' }), { actor: 'editor', transport: clients[0], operation: 'update', id: created.id })])
      await blocked(1)
      await blocker.query('update public.admin_users set is_active=false where id=$1', [f.actors.editor])
      await blocker.query('commit')
      const [outcome] = await pending
      assert.equal(outcome.status, 'rejected'); assert.equal(outcome.reason.statusCode, 403)
      assert.deepEqual(await f.snapshot(created.id), before)
      assert.deepEqual(await f.counts(), counts)
      await database.query('update public.admin_users set is_active=true where id=$1', [f.actors.editor])
    })
    await t.test('ERP ownership committed before its lock blocks the waiting local inventory edit', async () => {
      const before = await f.snapshot(created.id), counts = await f.counts()
      await blocker.query('begin')
      await blocker.query("select key from public.site_settings where key='default' for update")
      const pending = Promise.allSettled([f.save(edit({ primary_warehouse_id: f.otherWarehouse }), { transport: clients[0], operation: 'update', id: created.id })])
      await blocked(1)
      await blocker.query("update public.site_settings set erp_mode='daftra' where key='default'")
      await blocker.query('commit')
      const [outcome] = await pending
      assert.equal(outcome.status, 'rejected'); assert.equal(outcome.reason.statusCode, 409)
      assert.deepEqual(await f.snapshot(created.id), before)
      assert.deepEqual(await f.counts(), counts)
      const content = await f.save(edit({ description: 'Staff authored content' }), { transport: clients[1], operation: 'update', id: created.id })
      assert.equal((await f.snapshot(content.id)).product.description, 'Staff authored content')
      await database.exec("update public.site_settings set erp_mode='built_in' where key='default'")
    })
    await t.test('direct authorized catalog edits advance the same conflict token', async () => {
      snapshot = await f.snapshot(created.id)
      await database.query('update public.products set description=$1 where id=$2', ['Other catalog writer', created.id])
      await assert.rejects(() => f.save(edit({ title: 'Old snapshot' }), { transport: clients[0], operation: 'update', id: created.id }), e => e.statusCode === 409)
    })
  } finally { await database.close() }
})

test('migration 72 and product saves work under native non-superuser postgres ownership', {
  skip: !storageNativeAvailable, timeout: 60000
}, async () => {
  const database = await createStorageNativeDatabase({ stopBefore: productSaveMigration })
  try {
    const role = (await database.query('select current_user name,rolsuper from pg_roles where rolname=current_user')).rows[0]
    assert.equal(role.name, 'postgres')
    assert.equal(role.rolsuper, false)
    await database.exec(await readFile(new URL('../supabase/migrations/' + productSaveMigration, import.meta.url), 'utf8'))
    const f = await createProductSaveFixture({ database })
    const service = await database.connect('service_role'), transport = smsDatabaseClient(service)
    const created = await f.save(f.body(), { transport })
    const snapshot = await f.snapshot(created.id), counts = await f.counts()
    assert.equal(snapshot.revision, created.revision)
    await assert.rejects(() => f.save({ ...f.body(), expected_revision: snapshot.revision,
      variants: [{ id: randomUUID(), name: 'Foreign', code: 'FOREIGN' }] }, { transport, operation: 'update', id: created.id }), e => e.statusCode === 400)
    assert.deepEqual(await f.snapshot(created.id), snapshot)
    assert.deepEqual(await f.counts(), counts)
    await assert.rejects(() => service.query('select * from catalog_private.product_save_receipts'), e => e.code === '42501')
    for (const role of ['anon', 'authenticated']) {
      assert.equal((await database.query("select has_column_privilege($1,'public.products','cost_price','SELECT') allowed", [role])).rows[0].allowed, false)
    }
  } finally { await database.close() }
})
