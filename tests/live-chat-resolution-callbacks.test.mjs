import { after, afterEach, before, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createResetDatabase } from './helpers/resetDatabase.mjs'
import { chatCallbackMobile } from '../server/utils/liveChatContact.js'

let db, customer, guest, staff, otherStaff, order
const query = (sql, args = []) => db.query(sql, args)
const first = async (sql, args = []) => (await query(sql, args)).rows[0]
const denied = async (action, pattern) => {
  await db.exec('savepoint expected_denial')
  await assert.rejects(action, pattern)
  await db.exec('rollback to savepoint expected_denial')
}
const startCustomer = async ({ orderId = null, body = 'I need help' } = {}) => first(
  `select public.chat_start_with_message($1,false,'Account Customer','customer@example.test',null,$2,
    $3,$4,$5,$6) as result`,
  [customer, orderId, randomUUID(), 'a'.repeat(64), body, randomUUID()])

before(async () => { db = await createResetDatabase() })
after(async () => { await db?.close() })
beforeEach(async () => {
  customer = randomUUID(); guest = randomUUID(); staff = randomUUID()
  otherStaff = randomUUID(); order = randomUUID()
  await db.exec('begin')
  await query(`insert into auth.users(id,email,is_anonymous,raw_user_meta_data) values
    ($1,'customer@example.test',false,'{"full_name":"Account Customer"}'),
    ($2,null,true,'{}'),($3,'agent@example.test',false,'{}'),
    ($4,'other-agent@example.test',false,'{}')`, [customer, guest, staff, otherStaff])
  await query(`update public.customer_profiles set full_name='Account Customer',phone=null where id=$1`, [customer])
  await query(`insert into public.admin_users(id,email,full_name,role,permissions) values
    ($1,'agent@example.test','Assigned Agent','admin',$2),
    ($3,'other-agent@example.test','Other Agent','admin',$4)`, [
    staff, JSON.stringify({ 'support.view': true, 'support.reply': true, 'support.manage': true }),
    otherStaff, JSON.stringify({ 'support.view': true, 'support.reply': true })
  ])
  await query(`insert into public.customer_orders
    (id,user_id,order_number,first_name,phone,street_address,city,governorate)
    values($1,$2,'ORD-CALLBACK','Account','+966500000111','Street','Riyadh','Riyadh')`, [order, customer])
  await query("update public.chat_settings set is_enabled=true,availability_override='online',customer_send_cooldown_seconds=0")
})
afterEach(async () => { await db.exec('rollback') })

test('signed-in customers start immediately with saved identity and an optional order', async () => {
  const started = await startCustomer()
  assert.equal(started.result.ticketId, null)
  const chat = await first(`select customer_id,contact_name,contact_email,contact_mobile,
    order_id,ticket_id from public.chat_conversations where id=$1`, [started.result.conversationId])
  assert.equal(chat.customer_id, customer)
  assert.equal(chat.contact_name, 'Account Customer')
  assert.equal(chat.contact_email, 'customer@example.test')
  assert.equal(chat.contact_mobile, null)
  assert.equal(chat.order_id, null)
  assert.equal(chat.ticket_id, null)
  assert.equal((await first('select count(*)::int as count from public.chat_messages where conversation_id=$1', [started.result.conversationId])).count, 1)

  const revision = (await first('select revision from public.chat_conversations where id=$1', [started.result.conversationId])).revision
  await query('select public.chat_set_order($1,$2,$3,$4,$5)',
    [started.result.conversationId, customer, 'customer', order, revision])
  assert.equal((await first('select order_id from public.chat_conversations where id=$1', [started.result.conversationId])).order_id, order)
})

test('closed-chat feedback creates exactly one follow-up ticket only for a negative result', async () => {
  const positive = await startCustomer()
  await query("update public.chat_conversations set status='closed',closed_at=now() where id=$1", [positive.result.conversationId])
  const positiveFeedback = await first('select public.chat_submit_resolution_feedback($1,$2,false,true,5::smallint) as result',
    [positive.result.conversationId, customer])
  assert.equal(positiveFeedback.result.ticketId, null)
  assert.equal((await first('select count(*)::int as count from public.support_tickets')).count, 0)

  const negative = await startCustomer({ orderId: order, body: 'My order still has a problem' })
  await query("update public.chat_conversations set status='active',assigned_admin_id=$1 where id=$2", [staff, negative.result.conversationId])
  await query(`insert into public.chat_messages
    (conversation_id,sender_id,sender_kind,sender_name,body,idempotency_key)
    values($1,$2,'staff','Assigned Agent','I checked the order.',$3)`,
  [negative.result.conversationId, staff, randomUUID()])
  await query("update public.chat_conversations set status='closed',closed_at=now() where id=$1", [negative.result.conversationId])
  const firstFeedback = await first('select public.chat_submit_resolution_feedback($1,$2,false,false,4::smallint) as result',
    [negative.result.conversationId, customer])
  assert.ok(firstFeedback.result.ticketId)
  const retry = await first('select public.chat_submit_resolution_feedback($1,$2,false,false,1::smallint) as result',
    [negative.result.conversationId, customer])
  assert.equal(retry.result.ticketId, firstFeedback.result.ticketId)
  assert.equal(retry.result.rating, 4)

  const ticket = await first(`select customer_id,customer_email,customer_name,order_id,
    assigned_admin_id,subject from public.support_tickets where id=$1`, [firstFeedback.result.ticketId])
  assert.equal(ticket.customer_id, customer)
  assert.equal(ticket.customer_email, 'customer@example.test')
  assert.equal(ticket.customer_name, 'Account Customer')
  assert.equal(ticket.order_id, order)
  assert.equal(ticket.assigned_admin_id, staff)
  assert.match(ticket.subject, /^Unresolved live chat #/)
  assert.equal((await first('select count(*)::int as count from public.support_tickets where idempotency_key=$1', [negative.result.conversationId])).count, 1)
  assert.equal((await first("select count(*)::int as count from public.support_ticket_events where ticket_id=$1 and event_type='source_chat' and new_value=$2", [firstFeedback.result.ticketId, negative.result.conversationId])).count, 1)
  assert.equal((await first('select count(*)::int as count from public.chat_messages where conversation_id=$1', [negative.result.conversationId])).count, 2)
})

test('callback settings, saved numbers, missing numbers and staff status are enforced', async () => {
  const started = await startCustomer()
  await denied(() => query('select public.chat_request_callback($1,$2,false,$3)',
    [started.result.conversationId, customer, '+966500000222']), /CHAT_CALLBACK_DISABLED/)

  assert.equal(chatCallbackMobile({ kind: 'customer', profile: { phone: '+966500000333' } }, {}, '+966500000444'), '+966500000333')
  assert.equal(chatCallbackMobile({ kind: 'customer', profile: { phone: null } }, {}, '+966500000444'), '+966500000444')
  assert.equal(chatCallbackMobile({ kind: 'guest' }, { contact_mobile: '+966500000555' }, '+966500000666'), '+966500000555')

  await query('update public.chat_settings set request_call_enabled=true')
  const requested = await first('select public.chat_request_callback($1,$2,false,$3) as result',
    [started.result.conversationId, customer, '+966500000444'])
  assert.equal(requested.result.status, 'pending')
  const pending = await first("select callback_status,callback_mobile from public.chat_conversations where id=$1 and callback_status='pending'", [started.result.conversationId])
  assert.equal(pending.callback_mobile, '+966500000444')
  const retry = await first('select public.chat_request_callback($1,$2,false,$3) as result',
    [started.result.conversationId, customer, '+966500000999'])
  assert.equal(retry.result.mobile, '+966500000444')
  assert.equal((await first("select count(*)::int as count from public.chat_events where conversation_id=$1 and event_type='callback_requested'", [started.result.conversationId])).count, 1)

  await query("update public.chat_conversations set status='active',assigned_admin_id=$1 where id=$2", [staff, started.result.conversationId])
  await denied(() => query("select public.chat_set_callback_status($1,$2,'completed')",
    [started.result.conversationId, otherStaff]), /CHAT_CALLBACK_DENIED/)
  await query("select public.chat_set_callback_status($1,$2,'completed')", [started.result.conversationId, staff])
  assert.equal((await first('select callback_status from public.chat_conversations where id=$1', [started.result.conversationId])).callback_status, 'completed')

  await db.exec('set local role authenticated')
  await denied(() => query('select public.chat_request_callback($1,$2,false,$3)',
    [started.result.conversationId, customer, '+966500000444']), /permission denied/)
  await db.exec('reset role')
})
