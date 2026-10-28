import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { createCodCheckoutFixture } from './helpers/codCheckoutFixture.mjs'
import { emailNativeAvailable } from './helpers/emailNativeDatabase.mjs'
import { deliveryLocationReference, findDeliveryLocation } from '../app/utils/deliveryLocationReference.js'

const filename = '20261029010000_customer_delivery_locations.sql'
test('LOC-01 actual SQL and HTTP: reference validation, ownership and legacy recovery', { skip: !emailNativeAvailable }, async t => {
  const f = await createCodCheckoutFixture({ stopBefore: filename, routes: [
    ['post', '/api/account/addresses', 'server/api/account/addresses/index.post.js'],
    ['put', '/api/account/addresses/:id', 'server/api/account/addresses/[id].put.js']
  ] })
  try {
    const legacy = { label: 'Legacy', first_name: 'Synthetic', last_name: 'Buyer', street_address: 'Owned street', address_line_2: '', city: 'Unmatched old city', governorate: 'Cairo', phone: '01012345678' }
    const id = randomUUID()
    assert.equal((await f.call('/api/account/addresses', { method: 'POST', body: { id, address: legacy } })).response.status, 200)
    await f.db.query("update public.customer_profiles set city='Legacy profile city',state='Cairo' where id=$1", [f.actors.customer])
    const before = (await f.db.query('select to_jsonb(p) row from public.customer_profiles p order by id')).rows
    const sql = await readFile(new URL('../supabase/migrations/' + filename, import.meta.url), 'utf8')
    await f.db.exec(sql)
    await t.test('27 governorates/381 supported cities match the reviewed offline names; no backfill', async () => {
      assert.equal((await f.db.query('select count(*)::int n from private.delivery_location_governorates')).rows[0].n, 27)
      assert.equal((await f.db.query('select count(*)::int n from private.delivery_location_cities where is_active')).rows[0].n, 381)
      assert.deepEqual((await f.db.query('select to_jsonb(p) row from public.customer_profiles p order by id')).rows, before)
      for (const city of deliveryLocationReference.cities) {
        const g = deliveryLocationReference.governorates.find(g => g.id === city.governorate_id)
        assert.equal((await f.db.query('select private.delivery_location_supported($1,$2) valid', [g.checkout_name, city.name_en])).rows[0].valid, true)
        assert.equal(findDeliveryLocation(g.checkout_name, city.name_en).city.id, city.id)
      }
    })
    await t.test('Arabic/English aliases resolve only within their evidenced parent', async () => {
      for (const pair of [['Cairo 2', 'رمسيس'], ['القاهرة', 'Ramses'], ['Giza', 'الدقي']]) assert.equal((await f.db.query('select private.delivery_location_supported($1,$2) valid', pair)).rows[0].valid, true)
      for (const pair of [['Giza', 'Ramses'], ['Cairo', 'Dokki'], ['Cairo', 'Others'], ['Missing', 'Ramses'], ['Cairo', '']]) assert.equal((await f.db.query('select private.delivery_location_supported($1,$2) valid', pair)).rows[0].valid, false)
    })
    await t.test('unchanged legacy book edits and exact lost acknowledgements retain revisions', async () => {
      const input = { revision: 1, address: { ...legacy, phone: '01011111111' } }
      const saved = await f.call('/api/account/addresses/' + id, { method: 'PUT', body: input })
      assert.equal(saved.response.status, 200); assert.equal(saved.body.address.revision, 2)
      assert.equal(saved.body.address.city, legacy.city)
      assert.equal((await f.call('/api/account/addresses/' + id, { method: 'PUT', body: input })).body.address.revision, 2)
      assert.equal((await f.call('/api/account/addresses/' + id, { method: 'PUT', body: { revision: 1, address: legacy } })).response.status, 409)
    })
    await t.test('new invalid pairs and foreign legacy substitutions fail without exposing addresses', async () => {
      for (const address of [{ ...legacy }, { ...legacy, city: 'Dokki' }, { ...legacy, governorate: 'Giza', city: 'Ramses' }]) {
        const result = await f.call('/api/account/addresses', { method: 'POST', body: { id: randomUUID(), address } })
        assert.equal(result.response.status, 400); assert.doesNotMatch(JSON.stringify(result.body), /Owned street|01012345678/)
      }
      const rejected = await f.call('/api/account/addresses/' + id, { actor: 'viewer', method: 'PUT', body: { revision: 2, address: legacy } })
      assert.equal(rejected.response.status, 404)
      assert.equal((await f.call('/api/account/addresses', { actor: null, method: 'POST', body: { id: randomUUID(), address: legacy } })).response.status, 401)
    })
    await t.test('legacy checkout eligibility is strictly scoped to the active owning account', async () => {
      for (const city of [legacy.city, 'Legacy profile city', 'Ramses']) await f.db.query('select private.validate_checkout_location($1,$2)', [f.actors.customer, { governorate: 'Cairo', city }])
      await assert.rejects(f.db.query('select private.validate_checkout_location($1,$2)', [f.actors.viewer, { governorate: 'Cairo', city: legacy.city }]), e => e.code === '22023')
      await assert.rejects(f.db.query('select private.validate_checkout_location($1,$2)', [f.actors.customer, { governorate: 'Giza', city: 'Ramses' }]), e => e.code === '22023')
      await f.db.query('update public.customer_profiles set is_active=false where id=$1', [f.actors.customer])
      await assert.rejects(f.db.query('select private.validate_checkout_location($1,$2)', [f.actors.customer, { governorate: 'Cairo', city: legacy.city }]), e => e.code === '22023')
      await f.db.query('update public.customer_profiles set is_active=true where id=$1', [f.actors.customer])
    })
    await t.test('profile contact edits preserve legacy values; changed pairs validate inside SQL', async () => {
      await f.db.query("update public.customer_profiles set phone='01022222222',city=city,state=state where id=$1", [f.actors.customer])
      await assert.rejects(f.db.query("update public.customer_profiles set city='Dokki',state='Cairo' where id=$1", [f.actors.customer]), e => e.code === '22023')
      await f.db.query("update public.customer_profiles set city='الدقي',state='الجيزة' where id=$1", [f.actors.customer])
      assert.equal((await f.db.query('select city from public.customer_profiles where id=$1', [f.actors.customer])).rows[0].city, 'الدقي')
    })
    await t.test('actual checkout quote and commit reject invalid pairs with safe errors', async () => {
      const body = {cart_id:randomUUID(),quote_id:randomUUID(),items:[{id:randomUUID(),variant_id:randomUUID(),quantity:1}],address:{...legacy,governorate:'Giza',city:'Ramses',email:'fixture@example.invalid'},payment_method:'bank_transfer',shipping_method:'shipping'}
      for (const path of ['/api/checkout/quote','/api/checkout']) {
        const result=await f.call(path,{method:'POST',body})
        assert.equal(result.response.status,400,JSON.stringify(result.body))
        assert.equal(result.body.data.code,'checkout:location')
        assert.doesNotMatch(JSON.stringify(result.body),/Owned street|01012345678/)
      }
    })
    await t.test('new supported address creation remains idempotent and revision protected', async () => {
      const next = randomUUID(), address = { ...legacy, city: 'Ramses' }
      for (let i = 0; i < 2; i++) assert.equal((await f.call('/api/account/addresses', { method: 'POST', body: { id: next, address } })).body.address.revision, 1)
      assert.equal((await f.call('/api/account/addresses/' + next, { method: 'PUT', body: { revision: 1, address: { ...address, governorate: 'Giza', city: 'Dokki' } } })).body.address.revision, 2)
      assert.equal((await f.call('/api/account/addresses/' + next, { method: 'PUT', body: { revision: 1, address } })).response.status, 409)
    })
    await t.test('browser and server roles cannot alter the offline reference or bypass private validation', async () => {
      for (const role of ['anon', 'authenticated', 'service_role']) {
        const connection = await f.db.connect(role)
        try { await assert.rejects(connection.query('delete from private.delivery_location_cities'), e => e.code === '42501') }
        finally { await connection.end() }
      }
      const counts = (await f.db.query('select (select count(*)::int from public.customer_orders) orders,(select count(*)::int from public.payment_attempts) attempts,(select count(*)::int from public.shipping_order_jobs) jobs')).rows[0]
      assert.deepEqual(counts, { orders: 0, attempts: 0, jobs: 0 })
    })
  } finally { await f.close() }
})
