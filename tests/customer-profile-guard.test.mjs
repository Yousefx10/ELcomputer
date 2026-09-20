import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createResetDatabase } from './helpers/resetDatabase.mjs'

test('customers can edit profile text but cannot set wallet value or reactivate themselves', async () => {
  const db = await createResetDatabase()
  try {
    const customer = randomUUID()
    await db.exec('begin')
    await db.query('insert into auth.users(id,email) values($1,$2)', [customer, 'profile-guard@example.test'])
    // Supabase grants Data API table privileges outside the checked-in schema dump.
    await db.exec('grant select, insert, update on public.customer_profiles to authenticated')
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [customer])
    await db.exec('set local role authenticated')

    await db.query("insert into public.customer_profiles(id,email,full_name) values($1,'profile-guard@example.test','Updated name') on conflict(id) do update set full_name=excluded.full_name", [customer])
    assert.equal((await db.query('select full_name from public.customer_profiles where id=$1', [customer])).rows[0].full_name, 'Updated name')

    await db.exec('savepoint wallet_denied')
    await assert.rejects(() => db.query('update public.customer_profiles set wallet_balance=999 where id=$1', [customer]), /Customer account fields cannot be changed/)
    await db.exec('rollback to savepoint wallet_denied')
    await db.exec('reset role')

    await db.query('update public.customer_profiles set is_active=false where id=$1', [customer])
    await db.exec('set local role authenticated')
    await db.exec('savepoint active_denied')
    await assert.rejects(() => db.query('update public.customer_profiles set is_active=true where id=$1', [customer]), /Customer account fields cannot be changed/)
    await db.exec('rollback to savepoint active_denied')
    await db.exec('reset role')

    // Trusted server-side operations still retain control of these fields.
    await db.exec('grant update, select on public.customer_profiles to service_role')
    await db.exec('set local role service_role')
    await db.query('update public.customer_profiles set is_active=true, wallet_balance=25 where id=$1', [customer])
    const trusted = (await db.query('select is_active,wallet_balance from public.customer_profiles where id=$1', [customer])).rows[0]
    assert.equal(trusted.is_active, true)
    assert.equal(Number(trusted.wallet_balance), 25)
    await db.exec('reset role')
    await db.exec('rollback')
  } finally { await db.close() }
})

test('customers cannot create their own profile with a forged wallet balance', async () => {
  const db = await createResetDatabase()
  try {
    const customer = randomUUID()
    await db.exec('begin')
    await db.query('insert into auth.users(id,email) values($1,$2)', [customer, 'profile-insert@example.test'])
    await db.query('delete from public.customer_profiles where id=$1', [customer])
    await db.exec('grant select, insert on public.customer_profiles to authenticated')
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [customer])
    await db.exec('set local role authenticated')
    await db.exec('savepoint insert_denied')
    await assert.rejects(() => db.query("insert into public.customer_profiles(id,email,wallet_balance) values($1,'profile-insert@example.test',100)", [customer]), /Customer account fields cannot be changed/)
    await db.exec('rollback to savepoint insert_denied')
    await db.query("insert into public.customer_profiles(id,email,full_name) values($1,'profile-insert@example.test','Customer')", [customer])
    const safe = (await db.query('select is_active,wallet_balance from public.customer_profiles where id=$1', [customer])).rows[0]
    assert.equal(safe.is_active, true)
    assert.equal(Number(safe.wallet_balance), 0)
    await db.exec('reset role')
    await db.exec('rollback')
  } finally { await db.close() }
})
