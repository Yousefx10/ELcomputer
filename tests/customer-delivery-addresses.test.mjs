import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createCodCheckoutFixture } from './helpers/codCheckoutFixture.mjs'
import { emailNativeAvailable } from './helpers/emailNativeDatabase.mjs'

const address = overrides => ({ label: 'Synthetic home', first_name: 'Synthetic', last_name: 'Buyer', street_address: 'Owned street', address_line_2: 'Owned unit', city: 'Fixture city', governorate: 'Cairo', phone: '01012345678', ...overrides })
test('owned address book: actual PostgreSQL, RLS and HTTP commands', { skip: !emailNativeAvailable }, async t => {
  const f = await createCodCheckoutFixture({ routes: [
    ['get', '/api/account/addresses', 'server/api/account/addresses/index.get.js'],
    ['post', '/api/account/addresses', 'server/api/account/addresses/index.post.js'],
    ['put', '/api/account/addresses/:id', 'server/api/account/addresses/[id].put.js'],
    ['delete', '/api/account/addresses/:id', 'server/api/account/addresses/[id].delete.js']
  ] })
  try {
    // Supabase's existing Data API grants are external to the schema dump.
    await f.db.query('grant select on public.customer_profiles to authenticated')
    const profiles = (await f.db.query("select to_jsonb(p)-'updated_at' row from public.customer_profiles p order by id")).rows
    const before = (await f.db.query(`select
      (select count(*) from public.customer_orders)::int orders,
      (select count(*) from public.payment_attempts)::int attempts,
      (select count(*) from public.shipping_order_jobs)::int jobs,
      (select to_jsonb(s) from public.site_settings s where key='default') settings`)).rows[0]
    const id = randomUUID(), initial = address()
    const create = body => f.call('/api/account/addresses', { method: 'POST', body })
    await t.test('missing, expired and anonymous sessions cannot read or mutate', async () => {
      for (const actor of [null, 'expired']) {
        assert.equal((await f.call('/api/account/addresses', { actor })).response.status, 401)
        assert.equal((await f.call('/api/account/addresses', { actor, method: 'POST', body: { id, address: initial } })).response.status, 401)
      }
      const original = f.client.auth.getUser
      f.client.auth.getUser = async () => ({ data: { user: { id: f.actors.customer, is_anonymous: true } }, error: null })
      try { assert.equal((await f.call('/api/account/addresses')).response.status, 403) }
      finally { f.client.auth.getUser = original }
      assert.equal((await f.db.query('select count(*)::int n from public.customer_delivery_addresses')).rows[0].n, 0)
    })
    await t.test('new customer list is private and bounded; identity cannot come from query/body', async () => {
      const list = await f.call('/api/account/addresses')
      assert.equal(list.response.status, 200); assert.match(list.response.headers.get('cache-control'), /private, no-store/)
      assert.deepEqual(list.body, { addresses: [], limit: 20 })
      assert.equal((await f.call('/api/account/addresses?customer_id=' + f.actors.owner)).response.status, 400)
      for (const body of [{ id, address: initial, customer_id: f.actors.owner }, { id, address: { ...initial, customer_id: f.actors.owner } }]) assert.equal((await create(body)).response.status, 400)
    })
    await t.test('parallel exact creates and explicit lost-ack retries produce one owned row', async () => {
      const results = await Promise.all(Array.from({ length: 5 }, () => create({ id, address: initial })))
      assert.ok(results.every(r => r.response.status === 200), JSON.stringify(results.map(r => r.body)))
      for (const r of results) { assert.equal(r.body.address.id, id); assert.equal(r.body.address.revision, 1); assert.equal('customer_id' in r.body.address, false); assert.equal('email' in r.body.address, false) }
      assert.equal((await f.db.query('select count(*)::int n from public.customer_delivery_addresses where id=$1', [id])).rows[0].n, 1)
      assert.equal((await f.call('/api/account/addresses')).body.addresses.length, 1)
      assert.equal((await f.call('/api/account/addresses', { actor: 'viewer' })).body.addresses.length, 0)
    })
    await t.test('foreign IDs never permit editing, deletion or identity reassignment', async () => {
      const revision = 1, changed = address({ street_address: 'Foreign edit' })
      for (const [method, body] of [['PUT', { revision, address: changed }], ['DELETE', { revision }]]) assert.equal((await f.call('/api/account/addresses/' + id, { actor: 'viewer', method, body })).response.status, 404)
      assert.equal((await f.call('/api/account/addresses', { actor: 'viewer', method: 'POST', body: { id, address: changed } })).response.status, 409)
      assert.equal((await f.db.query('select street_address,customer_id from public.customer_delivery_addresses where id=$1', [id])).rows[0].street_address, initial.street_address)
    })
    await t.test('revisions stop lost updates and stale removals; acknowledged content can be recovered', async () => {
      const changed = address({ street_address: 'Revised owned street' }), put = body => f.call('/api/account/addresses/' + id, { method: 'PUT', body })
      assert.equal((await put({ revision: 1, address: changed })).body.address.revision, 2)
      assert.equal((await put({ revision: 1, address: changed })).body.address.revision, 2)
      const stale = await put({ revision: 1, address: initial })
      assert.equal(stale.response.status, 409); assert.doesNotMatch(JSON.stringify(stale.body), /01012345678|Revised owned street/)
      assert.equal((await f.call('/api/account/addresses/' + id, { method: 'DELETE', body: { revision: 1 } })).response.status, 409)
      assert.equal((await put({ revision: '2', address: changed })).response.status, 400)
    })
    await t.test('invalid fields and test markers fail before saving, without echoing personal data', async () => {
      for (const changed of [{ first_name: '' }, { city: '' }, { governorate: 'Unsupported' }, { phone: '123' }, { address_line_2: 'Signup isolation A' }, { street_address: 'Ｓｉｇｎｕｐ ｉｓｏｌａｔｉｏｎ Ａ' }, { label: 'x'.repeat(61) }, { city: 'City\nline' }, { first_name: {} }]) {
        const r = await create({ id: randomUUID(), address: address(changed) })
        assert.equal(r.response.status, 400, JSON.stringify(changed)); assert.doesNotMatch(JSON.stringify(r.body), /01012345678|Owned street/)
      }
    })
    await t.test('Arabic recipient, label and address remain intact without modifying the profile', async () => {
      const arabicId = randomUUID(), values = address({ label: 'المنزل', first_name: 'عميل', last_name: 'تجريبي', street_address: 'شارع تجريبي', city: 'مدينة تجريبية', address_line_2: 'شقة تجريبية' })
      const saved = await create({ id: arabicId, address: values })
      assert.equal(saved.response.status, 200); assert.equal(saved.body.address.street_address, values.street_address)
      assert.equal(saved.body.address.first_name, values.first_name)
      assert.equal((await f.call('/api/account/addresses/' + arabicId, { method: 'DELETE', body: { revision: 1 } })).response.status, 200)
    })
    await t.test('RLS reads only the active owner; direct clients cannot invoke writes or RPCs', async () => {
      for (const [actor, expected] of [['customer', 1], ['viewer', 0]]) {
        const c = await f.db.connect('authenticated')
        try {
          await c.query("select set_config('request.jwt.claim.sub',$1,false)", [f.actors[actor]])
          assert.equal((await c.query('select count(*)::int n from public.customer_delivery_addresses')).rows[0].n, expected)
          await assert.rejects(c.query('delete from public.customer_delivery_addresses where id=$1', [id]), e => e.code === '42501')
          await assert.rejects(c.query('select public.customer_save_delivery_address($1,$2,null,$3)', [f.actors.customer, randomUUID(), initial]), e => e.code === '42501')
        } finally { await c.end() }
      }
      for (const role of ['anon', 'service_role']) {
        const c = await f.db.connect(role)
        try { await assert.rejects(c.query('delete from public.customer_delivery_addresses'), e => e.code === '42501') }
        finally { await c.end() }
      }
    })
    await t.test('disabled customers lose reads and writes without altering their records', async () => {
      await f.db.query('update public.customer_profiles set is_active=false where id=$1', [f.actors.customer])
      try {
        assert.equal((await f.call('/api/account/addresses')).response.status, 403)
        assert.equal((await create({ id: randomUUID(), address: initial })).response.status, 403)
        const c = await f.db.connect('authenticated')
        try {
          await c.query("select set_config('request.jwt.claim.sub',$1,false)", [f.actors.customer])
          assert.equal((await c.query('select count(*)::int n from public.customer_delivery_addresses')).rows[0].n, 0)
        } finally { await c.end() }
      } finally { await f.db.query('update public.customer_profiles set is_active=true where id=$1', [f.actors.customer]) }
    })
    await t.test('the 20-address bound survives concurrent independent connections', async () => {
      const results = await Promise.all(Array.from({ length: 22 }, (_, index) => f.call('/api/account/addresses', { actor: 'viewer', method: 'POST', body: { id: randomUUID(), address: address({ label: 'Synthetic ' + index }) } })))
      assert.equal(results.filter(r => r.response.status === 200).length, 20)
      assert.equal(results.filter(r => r.response.status === 409 && r.body.statusMessage === 'You can save up to 20 addresses.').length, 2)
      assert.equal((await f.db.query('select count(*)::int n from public.customer_delivery_addresses where customer_id=$1', [f.actors.viewer])).rows[0].n, 20)
      assert.equal((await f.call('/api/account/addresses', { actor: 'viewer' })).body.addresses.length, 20)
    })
    await t.test('removal changes only the book; existing profile, orders, payments and shipping stay intact', async () => {
      assert.equal((await f.call('/api/account/addresses/' + id, { method: 'DELETE', body: { revision: 2 } })).response.status, 200)
      assert.deepEqual((await f.call('/api/account/addresses')).body.addresses, [])
      assert.equal((await f.db.query('select count(*)::int n from public.customer_delivery_addresses where id=$1', [id])).rows[0].n, 0)
      assert.deepEqual((await f.db.query("select to_jsonb(p)-'updated_at' row from public.customer_profiles p order by id")).rows, profiles)
      assert.deepEqual((await f.db.query(`select
        (select count(*) from public.customer_orders)::int orders,
        (select count(*) from public.payment_attempts)::int attempts,
        (select count(*) from public.shipping_order_jobs)::int jobs,
        (select to_jsonb(s) from public.site_settings s where key='default') settings`)).rows[0], before)
    })
  } finally { await f.close() }
})
