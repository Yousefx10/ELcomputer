import { before, after, beforeEach, afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createResetDatabase } from './helpers/resetDatabase.mjs'

let db, customerA, customerB, staff, categoryId
const query = (sql, args = []) => db.query(sql, args)
const first = async (sql, args = []) => (await query(sql, args)).rows[0]
const denied = async (action, pattern) => {
  await db.exec('savepoint expected_denial')
  await assert.rejects(action, pattern)
  await db.exec('rollback to savepoint expected_denial')
}

before(async () => { db = await createResetDatabase() })
after(async () => { await db?.close() })
beforeEach(async () => {
  customerA = randomUUID(); customerB = randomUUID(); staff = randomUUID()
  await db.exec('begin')
  await query('insert into auth.users(id,email) values($1,$2),($3,$4),($5,$6)', [
    customerA, 'alice@example.test', customerB, 'bob@example.test', staff, 'staff@example.test'
  ])
  await query("insert into public.admin_users(id,email,role,permissions) values($1,'staff@example.test','admin',$2)", [
    staff, JSON.stringify({ 'support.view': true, 'support.reply': true, 'support.manage': true })
  ])
  categoryId = (await first("select id from public.help_categories where slug='orders'")).id
})
afterEach(async () => { await db.exec('rollback') })

test('draft articles are invisible to public roles, including direct database reads', async () => {
  await query("insert into public.help_articles(category_id,title,slug,status) values($1,'Public','public','published'),($1,'Draft','draft','draft'),($1,'Old','old','archived')", [categoryId])
  await db.exec('set local role anon')
  assert.deepEqual((await query('select title from public.help_articles')).rows.map(item => item.title), ['Public'])
  await denied(() => query("insert into public.help_articles(category_id,title,slug) values($1,'Attack','attack')", [categoryId]), /permission denied/)
  await db.exec('reset role')
})

test('customers cannot query private ticket tables or call privileged ticket functions', async () => {
  await db.exec('set local role authenticated')
  await denied(() => query('select id from public.support_tickets'), /permission denied/)
  await denied(() => query('select id from public.support_ticket_messages'), /permission denied/)
  await denied(() => query('select id from public.support_ticket_attachments'), /permission denied/)
  await denied(() => query("select public.support_create_ticket($1,null,null,'Subject','Message',$2)", [customerA, randomUUID()]), /permission denied/)
  await denied(() => query("select public.support_add_message($1,$2,'customer','Alice','Reply',false,$3)", [randomUUID(), customerA, randomUUID()]), /permission denied/)
  await denied(() => query("select public.support_update_ticket($1,$2,'customer','closed',null,null,false)", [randomUUID(), customerA]), /permission denied/)
  await db.exec('reset role')
  const bucket = await first("select public, file_size_limit from storage.buckets where id='support-attachments'")
  assert.equal(bucket.public, false)
  assert.equal(Number(bucket.file_size_limit), 5242880)
  const policies = await first("select count(*)::int as count from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'support%'")
  assert.equal(policies.count, 0)
})

test('ticket creation rejects another customer’s order and deduplicates submissions', async () => {
  const order = randomUUID()
  await query("insert into public.customer_orders(id,user_id,first_name,phone,street_address,city,governorate) values($1,$2,'Bob','123','Street','Cairo','Cairo')", [order, customerB])
  const key = randomUUID()
  await db.exec('savepoint denied_order')
  await assert.rejects(() => query('select public.support_create_ticket($1,$2,$3,$4,$5,$6)', [customerA, order, categoryId, 'Order help', 'Please help', key]), /Order is unavailable/)
  await db.exec('rollback to savepoint denied_order')
  const ticketId = (await first('select public.support_create_ticket($1,null,$2,$3,$4,$5) as id', [customerA, categoryId, 'Order help', 'Please help', key])).id
  const repeatedId = (await first('select public.support_create_ticket($1,null,$2,$3,$4,$5) as id', [customerA, categoryId, 'Order help', 'Please help', key])).id
  assert.equal(ticketId, repeatedId)
  assert.equal((await first('select count(*)::int as count from public.support_ticket_messages where ticket_id=$1', [ticketId])).count, 1)
})

test('customer B cannot reply to customer A’s ticket or add internal notes', async () => {
  const id = (await first('select public.support_create_ticket($1,null,null,$2,$3,$4) as id', [customerA, 'Help', 'First message', randomUUID()])).id
  await db.exec('savepoint denied_reply')
  await assert.rejects(() => query('select public.support_add_message($1,$2,$3,$4,$5,$6,$7)', [id, customerB, 'customer', 'Bob', 'I am in', false, randomUUID()]), /Ticket is unavailable/)
  await db.exec('rollback to savepoint denied_reply')
  await db.exec('savepoint denied_note')
  await assert.rejects(() => query('select public.support_add_message($1,$2,$3,$4,$5,$6,$7)', [id, customerA, 'customer', 'Alice', 'Secret', true, randomUUID()]), /Ticket is unavailable/)
  await db.exec('rollback to savepoint denied_note')
  const noteId = (await first('select public.support_add_message($1,$2,$3,$4,$5,$6,$7) as id', [id, staff, 'staff', 'Staff', 'Private', true, randomUUID()])).id
  assert.equal((await first('select is_internal from public.support_ticket_messages where id=$1', [noteId])).is_internal, true)
  assert.equal((await first('select status from public.support_tickets where id=$1', [id])).status, 'open')
})

test('disabled customers cannot create or reply to tickets', async () => {
  const id = (await first('select public.support_create_ticket($1,null,null,$2,$3,$4) as id', [customerA, 'Help', 'First message', randomUUID()])).id
  await query('update public.customer_profiles set is_active=false where id=$1', [customerA])
  await denied(() => query('select public.support_create_ticket($1,null,null,$2,$3,$4)', [customerA, 'Another', 'Message', randomUUID()]), /Customer account is unavailable/)
  await denied(() => query('select public.support_add_message($1,$2,$3,$4,$5,$6,$7)', [id, customerA, 'customer', 'Alice', 'More', false, randomUUID()]), /Customer account is unavailable/)
})

test('ticket status, priority, assignment and history follow existing staff permissions', async () => {
  const id = (await first('select public.support_create_ticket($1,null,null,$2,$3,$4) as id', [customerA, 'Help', 'First message', randomUUID()])).id
  const viewOnly = randomUUID()
  await query("insert into auth.users(id,email) values($1,'viewer@example.test')", [viewOnly])
  await query("insert into public.admin_users(id,email,role,permissions) values($1,'viewer@example.test','admin',$2)", [viewOnly, JSON.stringify({ 'support.view': true })])
  await denied(() => query("select public.support_update_ticket($1,$2,'staff',null,null,$3,true)", [id, staff, viewOnly]), /Assignee cannot access support tickets/)
  await db.exec('savepoint denied_priority')
  await assert.rejects(() => query("select public.support_update_ticket($1,$2,'customer',null,'urgent',null,false)", [id, customerA]), /Ticket is unavailable/)
  await db.exec('rollback to savepoint denied_priority')
  await query("select public.support_update_ticket($1,$2,'staff','in_progress','high',$2,true)", [id, staff])
  const ticket = await first('select status,priority,assigned_admin_id from public.support_tickets where id=$1', [id])
  assert.deepEqual([ticket.status, ticket.priority, ticket.assigned_admin_id], ['in_progress', 'high', staff])
  const events = (await query('select event_type from public.support_ticket_events where ticket_id=$1 order by created_at', [id])).rows.map(item => item.event_type)
  assert.deepEqual(events, ['created', 'status', 'priority', 'assignment'])
  await query("select public.support_update_ticket($1,$2,'customer','closed',null,null,false)", [id, customerA])
  assert.equal((await first('select status from public.support_tickets where id=$1', [id])).status, 'closed')
  await db.exec('savepoint closed_reply')
  await assert.rejects(() => query('select public.support_add_message($1,$2,$3,$4,$5,$6,$7)', [id, customerA, 'customer', 'Alice', 'More', false, randomUUID()]), /Reopen/)
  await db.exec('rollback to savepoint closed_reply')
  await query("select public.support_update_ticket($1,$2,'customer','open',null,null,false)", [id, customerA])
  assert.equal((await first('select status from public.support_tickets where id=$1', [id])).status, 'open')
})

test('another customer and staff without support permissions cannot manage a ticket', async () => {
  const id = (await first('select public.support_create_ticket($1,null,null,$2,$3,$4) as id', [customerA, 'Help', 'First message', randomUUID()])).id
  await denied(() => query("select public.support_update_ticket($1,$2,'customer','closed',null,null,false)", [id, customerB]), /Ticket is unavailable/)
  await query("update public.admin_users set permissions='{}'::jsonb where id=$1", [staff])
  await denied(() => query("select public.support_add_message($1,$2,'staff','Staff','Reply',false,$3)", [id, staff, randomUUID()]), /Support access is required/)
  await denied(() => query("select public.support_update_ticket($1,$2,'staff','closed',null,null,false)", [id, staff]), /Support management access is required/)
})

test('attachments cannot reference a message from another ticket', async () => {
  const ticketA = (await first('select public.support_create_ticket($1,null,null,$2,$3,$4) as id', [customerA, 'One', 'Message', randomUUID()])).id
  const ticketB = (await first('select public.support_create_ticket($1,null,null,$2,$3,$4) as id', [customerB, 'Two', 'Message', randomUUID()])).id
  const messageB = (await first('select id from public.support_ticket_messages where ticket_id=$1', [ticketB])).id
  await db.exec('savepoint invalid_attachment')
  await assert.rejects(() => query("insert into public.support_ticket_attachments(ticket_id,message_id,original_name,storage_path,mime_type,size_bytes) values($1,$2,'file.pdf','wrong/file.pdf','application/pdf',100)", [ticketA, messageB]), /foreign key/)
  await db.exec('rollback to savepoint invalid_attachment')
})
