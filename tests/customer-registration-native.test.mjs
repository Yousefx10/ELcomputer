import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createEmailNativeDatabase, emailNativeAvailable } from './helpers/emailNativeDatabase.mjs'

// Disposable PostgreSQL and the real application schema, with a stub auth.users
// table. These checks do not exercise GoTrue, SMTP, CAPTCHA or hosted registration.
test('ordinary customer provisioning and ownership on the full schema', { skip: !emailNativeAvailable }, async t => {
  const db = await createEmailNativeDatabase()
  t.after(db.close)
  const a = randomUUID(), b = randomUUID(), source = randomUUID()
  const emails = ['registration-a@example.test', 'registration-b@example.test']
  const history = {
    customers: [{ legacy_id: '1', email: emails[0], profile: { full_name: 'Archived name' }, billing_address: {}, shipping_address: {}, claim_approved: true, review_evidence: 'a'.repeat(64) }],
    orders: [{ legacy_id: '10', customer_legacy_id: '1', kind: 'shop_order', total: '2.00', currency: 'EGP' }], items: []
  }
  await db.query('select public.customer_history_import_batch($1,$2,$3,$4,$5)', [source, 'registration-fixture', 'b'.repeat(64), randomUUID(), history])
  await db.query(`insert into auth.users(id,email,raw_user_meta_data) values
    ($1,$2,'{"full_name":"New customer A","role":"owner","wallet_balance":999,"is_active":false}'),
    ($3,$4,'{"full_name":"New customer B","role":"admin"}')`, [a, emails[0], b, emails[1]])

  await t.test('Auth inserts create exactly one ordinary profile without staff permissions', async () => {
    const profiles = (await db.query('select id,email,full_name,is_active,wallet_balance::text from public.customer_profiles order by email')).rows
    assert.deepEqual(profiles.map(p => [p.id, p.email, p.full_name, p.is_active, Number(p.wallet_balance)]), [
      [a, emails[0], 'New customer A', true, 0], [b, emails[1], 'New customer B', true, 0]
    ])
    assert.equal((await db.query('select count(*)::int n from public.admin_users')).rows[0].n, 0)
    await assert.rejects(db.query('insert into public.customer_profiles(id,email) values($1,$2)', [a, emails[0]]), { code: '23505' })
    // This proves the profile constraint, not GoTrue email normalization.
    await assert.rejects(db.query('insert into auth.users(id,email) values($1,$2)', [randomUUID(), emails[0]]), { code: '23505' })
    assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n, 2)
  })

  await t.test('new accounts do not automatically claim WordPress history; verification is required', async () => {
    assert.equal((await db.query('select count(*)::int n from customer_history_private.customers where auth_user_id is not null')).rows[0].n, 0)
    await assert.rejects(db.query('select public.customer_history_claim($1)', [a]), /Verified customer access required/)
    await db.query('update auth.users set email_confirmed_at=now() where id in ($1,$2)', [a, b])
    assert.equal((await db.query('select count(*)::int n from customer_history_private.customers where auth_user_id is not null')).rows[0].n, 0)
  })

  // Supabase supplies these ordinary table grants outside the schema dump.
  // Keep the actual RLS policies and trigger functions unchanged.
  await db.exec('grant select,insert,update on public.customer_profiles to authenticated; grant select on public.customer_orders,public.customer_order_items,public.admin_users to authenticated')
  const actors = []
  for (const id of [a, b]) {
    const actor = await db.connect('authenticated')
    await actor.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false),set_config('request.jwt.claims',$2,false)", [id, JSON.stringify({ sub: id, role: 'authenticated', is_anonymous: false })])
    actors.push(actor)
  }
  const [alice, bob] = actors

  await t.test('each customer can save only their own address and cannot change privileged defaults', async () => {
    for (const [actor, id, address] of [[alice, a, 'A private address'], [bob, b, 'B private address']]) {
      assert.equal((await actor.query('update public.customer_profiles set address_line_1=$1 where id=$2', [address, id])).rowCount, 1)
      assert.deepEqual((await actor.query('select id,address_line_1 from public.customer_profiles')).rows, [{ id, address_line_1: address }])
      assert.equal((await actor.query('update public.customer_profiles set address_line_1=$1 where id<>$2', ['Foreign overwrite', id])).rowCount, 0)
      await assert.rejects(actor.query('update public.customer_profiles set wallet_balance=1 where id=$1', [id]), { code: '42501' })
      await assert.rejects(actor.query('update public.customer_profiles set is_active=false where id=$1', [id]), { code: '42501' })
      assert.equal((await actor.query('select public.has_admin_permission($1) allowed', ['settings.edit'])).rows[0].allowed, false)
    }
  })

  const orderA = randomUUID(), orderB = randomUUID()
  await db.query(`insert into public.customer_orders(id,user_id,first_name,phone,street_address,city,governorate)
    values($1,$2,'A','1','A address','Fixture','Fixture'),($3,$4,'B','2','B address','Fixture','Fixture')`, [orderA, a, orderB, b])
  await db.query("insert into public.customer_order_items(order_id,product_title,quantity) values($1,'A item',1),($2,'B item',1)", [orderA, orderB])
  await t.test('both customers see a positive owned order and no foreign order or items', async () => {
    for (const [actor, owned, foreign, title] of [[alice, orderA, orderB, 'A item'], [bob, orderB, orderA, 'B item']]) {
      assert.deepEqual((await actor.query('select id from public.customer_orders')).rows, [{ id: owned }])
      assert.deepEqual((await actor.query('select product_title from public.customer_order_items')).rows, [{ product_title: title }])
      assert.equal((await actor.query('select id from public.customer_orders where id=$1', [foreign])).rowCount, 0)
      assert.equal((await actor.query('select id from public.customer_order_items where order_id=$1', [foreign])).rowCount, 0)
    }
  })

  await t.test('explicit verified historical claims preserve the new profile and deny another customer', async () => {
    assert.deepEqual((await db.query('select public.customer_history_claim($1) result', [a])).rows[0].result, { connected: 1 })
    assert.equal((await db.query('select public.customer_history_read($1,$2,$3) result', [a, source, '10'])).rows[0].result.order.legacy_id, '10')
    assert.equal((await db.query('select public.customer_history_read($1,$2,$3) result', [b, source, '10'])).rows[0].result, null)
    assert.deepEqual((await alice.query('select full_name,address_line_1 from public.customer_profiles')).rows, [{ full_name: 'New customer A', address_line_1: 'A private address' }])
    await assert.rejects(bob.query('select public.customer_history_claim($1)', [a]), { code: '42501' })
  })
})
