import { after, afterEach, before, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createResetDatabase } from './helpers/resetDatabase.mjs'

let db

const createOrder = async (status = 'pending_payment') => {
  const id = randomUUID()
  await db.query(`
    insert into public.customer_orders (
      id, first_name, phone, street_address, city, governorate, status
    ) values ($1, 'Daftra Test', '100', 'Test Street', 'Cairo', 'Cairo', $2)
  `, [id, status])
  return id
}

before(async () => { db = await createResetDatabase() })
after(async () => { await db?.close() })
beforeEach(async () => {
  await db.exec('begin')
  await db.query(`select set_config('request.jwt.claim.role', 'service_role', true)`)
  await db.exec(`
    delete from public.erp_sync_jobs;
    insert into public.site_settings (key, erp_mode, daftra_connection_status)
    values ('default', 'built_in', 'disconnected')
    on conflict (key) do update set
      erp_mode = excluded.erp_mode,
      daftra_connection_status = excluded.daftra_connection_status;
  `)
})
afterEach(async () => { await db.exec('rollback') })

test('orders queue only while Daftra is active and connected', async () => {
  await createOrder()
  assert.equal((await db.query('select count(*)::int as count from public.erp_sync_jobs')).rows[0].count, 0)

  await db.exec(`
    update public.site_settings
    set erp_mode = 'daftra', daftra_connection_status = 'connected'
    where key = 'default'
  `)
  const orderId = await createOrder()
  let jobs = (await db.query('select * from public.erp_sync_jobs order by created_at')).rows

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].local_id, orderId)
  assert.equal(jobs[0].operation, 'order.export')

  await db.query('update public.customer_orders set first_name = $1 where id = $2', ['Changed', orderId])
  jobs = (await db.query('select * from public.erp_sync_jobs')).rows
  assert.equal(jobs.length, 1)

  await db.query('update public.customer_orders set status = $1 where id = $2', ['processing', orderId])
  jobs = (await db.query('select * from public.erp_sync_jobs order by created_at')).rows
  assert.equal(jobs.length, 2)
})

test('missing ERP settings fail closed', async () => {
  await db.exec(`delete from public.site_settings where key = 'default'`)
  await createOrder()
  assert.equal((await db.query('select count(*)::int as count from public.erp_sync_jobs')).rows[0].count, 0)
})

test('claiming a job is atomic and increments attempts', async () => {
  await db.exec(`
    update public.site_settings
    set erp_mode = 'daftra', daftra_connection_status = 'connected'
    where key = 'default'
  `)
  await createOrder()

  const claimed = (await db.query('select * from public.claim_daftra_sync_job(null)')).rows
  assert.equal(claimed.length, 1)
  assert.equal(claimed[0].status, 'processing')
  assert.equal(claimed[0].attempts, 1)
  assert.equal((await db.query('select count(*)::int as count from public.claim_daftra_sync_job(null)')).rows[0].count, 0)
})

test('ERP credentials use a private provider settings table', async () => {
  await db.query(`
    insert into public.erp_provider_settings (
      id, account_url, api_key_encrypted, client_id_encrypted
    ) values ('daftra', 'https://example.daftra.com', 'encrypted-key', 'encrypted-client')
  `)

  const settings = (await db.query(`
    select id, account_url, api_key_encrypted, client_id_encrypted
    from public.erp_provider_settings
    where id = 'daftra'
  `)).rows[0]

  assert.equal(settings.id, 'daftra')
  assert.equal(settings.account_url, 'https://example.daftra.com')
  assert.equal(settings.api_key_encrypted, 'encrypted-key')
})
