import { after, afterEach, before, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createResetDatabase } from './helpers/resetDatabase.mjs'

let db, customer, guest, staff, otherStaff, viewer
const query = (sql, args = []) => db.query(sql, args)
const first = async (sql, args = []) => (await query(sql, args)).rows[0]
const denied = async (action, pattern) => {
  await db.exec('savepoint expected_denial')
  await assert.rejects(action, pattern)
  await db.exec('rollback to savepoint expected_denial')
}
const makeChat = async ({ guestChat = false, email = 'customer@example.test', mobile = '+966500000001' } = {}) => {
  const row = await first(`insert into public.chat_conversations
    (customer_id,guest_auth_user_id,contact_name,contact_email,contact_mobile,creation_key)
    values($1,$2,'Chat visitor',$3,$4,$5) returning id`,
  [guestChat ? null : customer, guestChat ? guest : null, email, mobile, randomUUID()])
  await query("update public.chat_conversations set status='active',assigned_admin_id=$1 where id=$2", [staff, row.id])
  return first('select id,revision from public.chat_conversations where id=$1', [row.id])
}

before(async () => { db = await createResetDatabase() })
after(async () => { await db?.close() })
beforeEach(async () => {
  customer = randomUUID(); guest = randomUUID(); staff = randomUUID()
  otherStaff = randomUUID(); viewer = randomUUID()
  await db.exec('begin')
  await query(`insert into auth.users(id,email,is_anonymous) values
    ($1,'customer@example.test',false),($2,null,true),
    ($3,'ticket-agent@example.test',false),($4,'other-agent@example.test',false),
    ($5,'viewer@example.test',false)`, [customer, guest, staff, otherStaff, viewer])
  await query(`insert into public.admin_users(id,email,full_name,role,permissions) values
    ($1,'ticket-agent@example.test','Ticket Agent','admin',$2),
    ($3,'other-agent@example.test','Other Agent','admin',$4),
    ($5,'viewer@example.test','Viewer','admin',$6)`, [
    staff, JSON.stringify({ 'support.view': true, 'support.reply': true, 'support.manage': true }),
    otherStaff, JSON.stringify({ 'support.view': true, 'support.reply': true }),
    viewer, JSON.stringify({ 'support.view': true })
  ])
})
afterEach(async () => { await db.exec('rollback') })

test('conversion creates one linked ticket without copying transcript or attachments', async () => {
  const order = randomUUID()
  await query(`insert into public.customer_orders
    (id,user_id,first_name,phone,street_address,city,governorate)
    values($1,$2,'Customer','123','Street','Riyadh','Riyadh')`, [order, customer])
  const chat = await makeChat()
  await query('update public.chat_conversations set order_id=$1 where id=$2', [order, chat.id])
  const message = await first(`insert into public.chat_messages
    (conversation_id,sender_id,sender_kind,sender_name,body,idempotency_key)
    values($1,$2,'customer','Customer','Please keep this transcript',$3) returning id`,
  [chat.id, customer, randomUUID()])
  await query(`insert into public.chat_attachments
    (conversation_id,message_id,uploaded_by,original_name,storage_path,mime_type,size_bytes,content_sha256,is_ready)
    values($1,$2,$3,'evidence.pdf',$4,'application/pdf',100,$5,true)`,
  [chat.id, message.id, customer, `${chat.id}/${message.id}/${randomUUID()}.pdf`, 'a'.repeat(64)])
  const current = await first('select revision from public.chat_conversations where id=$1', [chat.id])
  const converted = await first("select public.chat_create_ticket($1,$2,'Order follow-up',$3) as id",
    [chat.id, staff, current.revision])
  const ticket = await first(`select customer_id,customer_email,customer_mobile,customer_name,
    order_id,subject,assigned_admin_id from public.support_tickets where id=$1`, [converted.id])
  assert.equal(ticket.customer_id, customer)
  assert.equal(ticket.customer_email, 'customer@example.test')
  assert.equal(ticket.customer_mobile, '+966500000001')
  assert.equal(ticket.order_id, order)
  assert.equal(ticket.subject, 'Order follow-up')
  assert.equal(ticket.assigned_admin_id, staff)
  assert.equal((await first('select ticket_id from public.chat_conversations where id=$1', [chat.id])).ticket_id, converted.id)
  assert.equal((await first('select count(*)::int as count from public.support_ticket_messages where ticket_id=$1', [converted.id])).count, 0)
  assert.equal((await first('select count(*)::int as count from public.chat_messages where conversation_id=$1', [chat.id])).count, 1)
  assert.equal((await first('select count(*)::int as count from public.chat_attachments where conversation_id=$1 and is_ready', [chat.id])).count, 1)

  const ticketEvents = (await query(`select event_type,actor_id,actor_name,new_value
    from public.support_ticket_events where ticket_id=$1 order by created_at,id`, [converted.id])).rows
  assert.deepEqual(ticketEvents.map(event => event.event_type).sort(), ['created', 'source_chat'])
  assert.ok(ticketEvents.every(event => event.actor_id === staff && event.actor_name === 'Ticket Agent'))
  assert.equal(ticketEvents.find(event => event.event_type === 'source_chat').new_value, chat.id)
  const chatEvent = await first(`select actor_id,actor_name,new_value from public.chat_events
    where conversation_id=$1 and event_type='ticket_created'`, [chat.id])
  assert.equal(chatEvent.actor_id, staff)
  assert.equal(chatEvent.actor_name, 'Ticket Agent')
  assert.equal(chatEvent.new_value.ticket_id, converted.id)

  const retry = await first("select public.chat_create_ticket($1,$2,'Ignored retry subject',0) as id", [chat.id, staff])
  assert.equal(retry.id, converted.id)
  assert.equal((await first('select count(*)::int as count from public.support_tickets where idempotency_key=$1', [chat.id])).count, 1)
  await denied(() => query('update public.chat_conversations set order_id=null where id=$1', [chat.id]), /CHAT_TICKET_ORDER_LOCKED/)
})

test('mobile-only guest conversion preserves the real contact channel', async () => {
  const chat = await makeChat({ guestChat: true, email: null, mobile: '+966 50 000 0002' })
  const converted = await first("select public.chat_create_ticket($1,$2,'Guest follow-up',$3) as id",
    [chat.id, staff, chat.revision])
  const ticket = await first('select customer_id,customer_email,customer_mobile from public.support_tickets where id=$1', [converted.id])
  assert.equal(ticket.customer_id, null)
  assert.equal(ticket.customer_email, null)
  assert.equal(ticket.customer_mobile, '+966 50 000 0002')
})

test('conversion enforces assignment, permissions, revision and service-only execution', async () => {
  const chat = await makeChat()
  await denied(() => query("select public.chat_create_ticket($1,$2,'Denied',$3)",
    [chat.id, otherStaff, chat.revision]), /CHAT_TICKET_DENIED/)
  await denied(() => query("select public.chat_create_ticket($1,$2,'Denied',$3)",
    [chat.id, viewer, chat.revision]), /Support reply access/)
  await denied(() => query("select public.chat_create_ticket($1,$2,'Stale',$3)",
    [chat.id, staff, Number(chat.revision) - 1]), /CHAT_STALE/)
  assert.equal((await first('select count(*)::int as count from public.support_tickets where idempotency_key=$1', [chat.id])).count, 0)
  await db.exec('set local role authenticated')
  await denied(() => query("select public.chat_create_ticket($1,$2,'Browser',$3)",
    [chat.id, staff, chat.revision]), /permission denied/)
  await db.exec('reset role')
})
