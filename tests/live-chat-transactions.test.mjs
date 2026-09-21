import { before, after, beforeEach, afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { createResetDatabase } from './helpers/resetDatabase.mjs'

let db, customerA, customerB, guestA, staffA, staffB, viewer
const hash = id => createHash('sha256').update(`chat:actor:${id}`).digest('hex')
const query = (sql, args = []) => db.query(sql, args)
const first = async (sql, args = []) => (await query(sql, args)).rows[0]
const denied = async (action, pattern) => {
  await db.exec('savepoint chat_denied')
  await assert.rejects(action, pattern)
  await db.exec('rollback to savepoint chat_denied')
}
const create = async (id, guest = false, key = randomUUID()) =>
  (await first('select public.chat_create_or_resume($1,$2,$3,$4,$5,null,$6,$7) as id',
    [id, guest, 'Chat user', 'chat@example.test', null, key, hash(id)])).id
const send = async (chat, id, kind, body, key = randomUUID(), internal = false) =>
  (await first('select public.chat_send_message($1,$2,$3,$4,$5,$6,$7,$8) as id',
    [chat, id, kind, kind === 'staff' ? 'Agent' : 'Chat user', body, key, hash(id), internal])).id
const transition = async (chat, id, action, revision, target = null) =>
  (await first('select public.chat_transition($1,$2,$3,$4,$5) as id',
    [chat, id, action, target, revision])).id
const reserveAttachment = async ({ attachment = randomUUID(), chat, message, actor,
  kind = 'customer', name = 'proof.pdf', mime = 'application/pdf', size = 100,
  hashValue = 'a'.repeat(64), path = null }) => first(
  'select public.chat_reserve_attachment($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) as result',
  [attachment, chat, message, actor, kind, name,
    path || `${chat}/${message}/${attachment}.${mime === 'application/pdf' ? 'pdf' : 'jpg'}`,
    mime, size, hashValue, hash(actor)])

before(async () => { db = await createResetDatabase() })
after(async () => { await db?.close() })
beforeEach(async () => {
  customerA = randomUUID(); customerB = randomUUID(); guestA = randomUUID()
  staffA = randomUUID(); staffB = randomUUID(); viewer = randomUUID()
  await db.exec('begin')
  await query(`insert into auth.users(id,email,is_anonymous) values
    ($1,'customer-a@example.test',false),($2,'customer-b@example.test',false),
    ($3,null,true),($4,'staff-a@example.test',false),
    ($5,'staff-b@example.test',false),($6,'viewer@example.test',false)`,
  [customerA, customerB, guestA, staffA, staffB, viewer])
  await query(`insert into public.admin_users(id,email,role,permissions) values
    ($1,'staff-a@example.test','admin',$2),($3,'staff-b@example.test','admin',$2),
    ($4,'viewer@example.test','admin',$5)`, [
    staffA, JSON.stringify({ 'support.view': true, 'support.reply': true, 'support.manage': true }),
    staffB, viewer, JSON.stringify({ 'support.view': true })
  ])
  await query('update public.chat_settings set is_enabled=true')
})
afterEach(async () => { await db.exec('rollback') })

test('create resumes one open conversation, preserves retry key and rejects wrong actor identity', async () => {
  const key = randomUUID()
  const chat = await create(customerA, false, key)
  assert.equal(await create(customerA, false, key), chat)
  assert.equal(await create(customerA), chat)
  assert.notEqual(await create(customerB), chat)
  assert.ok(await create(guestA, true))
  const otherOrder = randomUUID()
  await query(`insert into public.customer_orders(id,user_id,first_name,phone,street_address,city,governorate)
    values($1,$2,'B','123','Street','Cairo','Cairo')`, [otherOrder, customerB])
  await denied(() => first('select public.chat_create_or_resume($1,false,$2,$3,null,$4,$5,$6)',
    [customerA, 'A', 'a@example.test', otherOrder, randomUUID(), hash(customerA)]), /Chat order does not belong/)
  await denied(() => first('select public.chat_create_or_resume($1,true,$2,$3,null,$4,$5,$6)',
    [guestA, 'Guest', 'g@example.test', otherOrder, randomUUID(), hash(guestA)]), /Guest orders require/)
  await denied(() => create(guestA, false), /Customer account is unavailable/)
  await denied(() => create(customerA, true), /Guest identity is unavailable/)
  assert.equal((await first('select count(*)::int as count from public.chat_events where conversation_id=$1 and event_type=\'created\'', [chat])).count, 1)
  await query("update public.chat_conversations set status='closed',closed_at=now() where id=$1", [chat])
  assert.equal(await create(customerA, false, key), chat)
  assert.notEqual(await create(customerA), chat)
  await query("update public.chat_conversations set status='closed',closed_at=now() where customer_id=$1", [customerB])
  await query('update public.chat_settings set is_enabled=false')
  await denied(() => create(customerB), /CHAT_DISABLED/)
  await query('update public.customer_profiles set is_active=false where id=$1', [customerA])
  await denied(() => create(customerA, false, key), /Customer account is unavailable/)
})

test('customer send is serialized, idempotent, cooldown-limited and cannot cross conversations', async () => {
  const chat = await create(customerA)
  const other = await create(customerB)
  const key = randomUUID()
  const firstId = await send(chat, customerA, 'customer', 'First', key)
  assert.equal(await send(chat, customerA, 'customer', 'First', key), firstId)
  await denied(() => send(chat, customerA, 'customer', 'Changed', key), /CHAT_KEY_CONFLICT/)
  await denied(() => send(chat, customerA, 'customer', 'Second'), /CHAT_COOLDOWN/)
  await denied(() => send(chat, customerB, 'customer', 'Wrong chat'), /actor is invalid/)
  await query("update public.chat_settings set customer_send_cooldown_seconds=0")
  await denied(() => send(chat, customerA, 'customer', 'First'), /CHAT_DUPLICATE/)
  const secondId = await send(chat, customerA, 'customer', 'Second')
  assert.notEqual(secondId, firstId)
  assert.equal((await first('select last_customer_message_seq from public.chat_conversations where id=$1', [chat])).last_customer_message_seq,
    (await first('select sequence_number from public.chat_messages where id=$1', [secondId])).sequence_number)
  await denied(() => send(other, customerA, 'customer', 'Wrong chat'), /actor is invalid/)
})

test('shared message rate limit and configured contact rule hold at the database boundary', async () => {
  await query("update public.chat_settings set guest_contact_rule='both',customer_send_cooldown_seconds=0")
  await denied(() => first('select public.chat_create_or_resume($1,true,$2,$3,null,null,$4,$5)',
    [guestA, 'Guest', 'guest@example.test', randomUUID(), hash(guestA)]), /Chat contact is incomplete/)
  await query("update public.chat_settings set guest_contact_rule='either'")
  const chat = await create(customerA)
  for (let index = 0; index < 12; index++) {
    assert.ok(await send(chat, customerA, 'customer', `Message ${index}`))
  }
  await denied(() => send(chat, customerA, 'customer', 'Thirteenth message'), /CHAT_RATE_LIMIT/)
  assert.equal((await first('select count(*)::int as count from public.chat_messages where conversation_id=$1', [chat])).count, 12)
})

test('availability chooses truthful intake and first message commits atomically', async () => {
  assert.equal((await first('select public.chat_live_available() as available')).available, false)
  await query("update public.chat_settings set availability_override='online'")
  assert.equal((await first('select public.chat_live_available() as available')).available, false)
  await query(`insert into public.chat_agent_availability(admin_id,declared_state,lease_expires_at)
    values($1,'online',now()+interval '10 minutes')`, [staffA])
  assert.equal((await first('select public.chat_live_available() as available')).available, true)
  const liveChat = await create(customerA)
  assert.equal((await first('select intake_mode from public.chat_conversations where id=$1', [liveChat])).intake_mode, 'live')
  await query("update public.chat_settings set availability_override='offline'")
  assert.equal((await first('select public.chat_live_available() as available')).available, false)
  const creationKey = randomUUID(), messageKey = randomUUID()
  const args = [guestA, true, 'Guest', 'guest@example.test', null, null,
    creationKey, hash(guestA), 'Please contact me', messageKey]
  const started = (await first('select public.chat_start_with_message($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as result', args)).result
  assert.equal((await first('select intake_mode from public.chat_conversations where id=$1', [started.conversationId])).intake_mode, 'offline')
  assert.equal((await first('select count(*)::int as count from public.chat_messages where conversation_id=$1', [started.conversationId])).count, 1)
  const retried = (await first('select public.chat_start_with_message($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as result', args)).result
  assert.deepEqual(retried, started)
  await denied(() => first('select public.chat_start_with_message($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
    [customerB, false, 'B', 'b@example.test', null, null,
      randomUUID(), hash(customerB), ' ', randomUUID()]), /message length is invalid/)
  assert.equal((await first('select count(*)::int as count from public.chat_conversations where customer_id=$1', [customerB])).count, 0)
})

test('service role can save first message without direct auth schema access', async () => {
  assert.equal((await first("select has_schema_privilege('service_role','auth','USAGE') as allowed")).allowed, false)
  await db.exec('set local role service_role')
  const result = await first('select public.chat_start_with_message($1,false,$2,$3,null,null,$4,$5,$6,$7) as started',
    [customerA, 'Customer A', 'customer-a@example.test', randomUUID(),
      hash(customerA), 'Service role path', randomUUID()])
  assert.ok(result.started.conversationId)
  assert.ok(result.started.messageId)
  await db.exec('reset role')
})

test('claim, stale claim, transfer, close and reopen preserve history and serialize sends', async () => {
  const chat = await create(customerA)
  const revision = Number((await first('select revision from public.chat_conversations where id=$1', [chat])).revision)
  await denied(() => transition(chat, viewer, 'claim', revision), /Support reply access is required/)
  await transition(chat, staffA, 'claim', revision)
  await denied(() => transition(chat, staffB, 'claim', revision), /CHAT_STALE/)
  await denied(() => send(chat, staffB, 'staff', 'Wrong agent'), /actor is invalid/)
  const reply = await send(chat, staffA, 'staff', 'Hello')
  assert.ok(reply)
  const nextRevision = Number((await first('select revision from public.chat_conversations where id=$1', [chat])).revision)
  await transition(chat, staffA, 'transfer', nextRevision, staffB)
  await denied(() => send(chat, staffA, 'staff', 'No longer assigned'), /actor is invalid/)
  const closeRevision = Number((await first('select revision from public.chat_conversations where id=$1', [chat])).revision)
  await transition(chat, staffB, 'close', closeRevision)
  await denied(() => send(chat, customerA, 'customer', 'After close'), /CHAT_CLOSED/)
  const reopenRevision = Number((await first('select revision from public.chat_conversations where id=$1', [chat])).revision)
  await transition(chat, staffA, 'reopen', reopenRevision)
  const events = (await query('select event_type from public.chat_events where conversation_id=$1 order by created_at,id', [chat])).rows.map(row => row.event_type)
  for (const event of ['created','claimed','agent_replied','transferred','closed','reopened']) assert.ok(events.includes(event))
})

test('manager assignment has one winner and accepts only eligible targets', async () => {
  const chat = await create(customerA)
  await denied(() => transition(chat, viewer, 'assign', 0, staffB), /Support reply access is required/)
  await denied(() => transition(chat, staffA, 'assign', 0, viewer), /CHAT_TARGET_UNAVAILABLE/)
  await query('update public.admin_users set permissions=$2 where id=$1', [staffB,
    JSON.stringify({ 'support.view': true, 'support.reply': true })])
  await denied(() => transition(chat, staffB, 'assign', 0, staffA), /CHAT_TRANSITION_DENIED/)
  await transition(chat, staffA, 'assign', 0, staffB)
  await denied(() => transition(chat, staffA, 'claim', 0), /CHAT_STALE/)
  const state = await first('select status,assigned_admin_id,revision from public.chat_conversations where id=$1', [chat])
  assert.equal(state.status, 'active')
  assert.equal(state.assigned_admin_id, staffB)
  assert.equal(Number(state.revision), 1)
  assert.ok(await send(chat, staffB, 'staff', 'Assigned agent reply'))
  await denied(() => send(chat, staffA, 'staff', 'Wrong agent'), /actor is invalid/)
  await query('update public.chat_settings set transfers_enabled=false')
  await denied(() => transition(chat, staffA, 'transfer', Number(state.revision) + 1, staffA), /CHAT_TRANSITION_DENIED/)
  await query('update public.chat_settings set transfers_enabled=true')
  await denied(() => transition(chat, staffA, 'transfer', Number(state.revision) + 1, viewer), /CHAT_TARGET_UNAVAILABLE/)
  const assigned = await first("select event_type,actor_id,new_value->>'assigned_admin_id' as target from public.chat_events where conversation_id=$1 and event_type='assigned'", [chat])
  assert.equal(assigned.actor_id, staffA)
  assert.equal(assigned.target, staffB)
})

test('audit keyset paging has no gaps when event timestamps match', async () => {
  const chat = await create(customerA)
  await query(`insert into public.chat_events(conversation_id,actor_id,actor_kind,event_type,created_at)
    select $1,$2,'staff','status_changed','2026-09-20T10:00:00Z'::timestamptz
    from generate_series(1,65)`, [chat, staffA])
  const all = (await query('select id,created_at from public.chat_events where conversation_id=$1 order by created_at desc,id desc', [chat])).rows
  const firstPage = all.slice(0, 30)
  const last = firstPage.at(-1)
  const nextPage = (await query(`select id,created_at from public.chat_events
    where conversation_id=$1 and (created_at < $2 or (created_at = $2 and id < $3))
    order by created_at desc,id desc limit 30`, [chat, last.created_at, last.id])).rows
  assert.deepEqual(firstPage.concat(nextPage).map(row => row.id), all.slice(0, 60).map(row => row.id))
  assert.equal(new Set(firstPage.concat(nextPage).map(row => row.id)).size, 60)
})

test('audit snapshots retain actor and transfer names after staff changes', async () => {
  await query('update public.admin_users set full_name=$2 where id=$1', [staffA, 'Agent Ahmed'])
  await query('update public.admin_users set full_name=$2 where id=$1', [staffB, 'Agent Sara'])
  const chat = await create(customerA)
  await db.exec('set local role service_role')
  await transition(chat, staffA, 'assign', 0, staffB)
  await transition(chat, staffA, 'transfer', 1, staffA)
  await send(chat, staffA, 'staff', 'Handled by Ahmed')
  await transition(chat, staffA, 'close', 3)
  await db.exec('reset role')
  await query('update public.admin_users set full_name=$2 where id=$1', [staffA, 'Renamed A'])
  await query('update public.admin_users set full_name=$2 where id=$1', [staffB, 'Renamed B'])
  await query('delete from auth.users where id=$1', [staffB])
  const events = (await query("select event_type,actor_name,old_assignee_name,new_assignee_name from public.chat_events where conversation_id=$1 and event_type in ('assigned','transferred','agent_replied','closed') order by created_at,id", [chat])).rows
  assert.deepEqual(events.find(entry => entry.event_type === 'assigned'), {
    event_type: 'assigned', actor_name: 'Agent Ahmed', old_assignee_name: null, new_assignee_name: 'Agent Sara'
  })
  assert.deepEqual(events.find(entry => entry.event_type === 'transferred'), {
    event_type: 'transferred', actor_name: 'Agent Ahmed', old_assignee_name: 'Agent Sara', new_assignee_name: 'Agent Ahmed'
  })
  assert.equal(events.find(entry => entry.event_type === 'closed').actor_name, 'Agent Ahmed')
  assert.equal(events.find(entry => entry.event_type === 'agent_replied').actor_name, 'Agent Ahmed')
})

test('internal notes generate staff-only message signals and no customer signal', async () => {
  const chat = await create(customerA)
  await transition(chat, staffA, 'claim', 0)
  const publicBefore = (await first("select count(*)::int as count from realtime.messages where topic=$1 and payload->>'kind'='message'", [`chat:public:${chat}`])).count
  const totalPublicBefore = (await first('select count(*)::int as count from realtime.messages where topic=$1', [`chat:public:${chat}`])).count
  await send(chat, staffA, 'staff', 'Private note', randomUUID(), true)
  const publicAfter = (await first("select count(*)::int as count from realtime.messages where topic=$1 and payload->>'kind'='message'", [`chat:public:${chat}`])).count
  const totalPublicAfter = (await first('select count(*)::int as count from realtime.messages where topic=$1', [`chat:public:${chat}`])).count
  const staffSignals = (await first("select count(*)::int as count from realtime.messages where topic=$1 and payload->>'kind'='message'", [`chat:staff:${chat}`])).count
  assert.equal(publicAfter, publicBefore)
  assert.equal(totalPublicAfter, totalPublicBefore)
  assert.equal(staffSignals, 1)
  await send(chat, staffA, 'staff', 'Public reply')
  assert.equal((await first("select count(*)::int as count from realtime.messages where topic=$1 and payload->>'kind'='message'", [`chat:public:${chat}`])).count, 1)
  const payload = await first("select payload from realtime.messages where topic=$1 and payload->>'kind'='message' limit 1", [`chat:public:${chat}`])
  assert.deepEqual(Object.keys(payload.payload).sort(), ['conversationId','kind','messageId','sequence'])
})

test('read markers are scoped, incoming-only and monotonic across tabs', async () => {
  const chat = await create(customerA)
  const other = await create(customerB)
  await transition(chat, staffA, 'claim', 0)
  const customerOne = await send(chat, customerA, 'customer', 'Question one')
  const staffOne = await send(chat, staffA, 'staff', 'Answer one')
  await query('update public.chat_settings set customer_send_cooldown_seconds=0')
  const customerTwo = await send(chat, customerA, 'customer', 'Question two')
  const staffTwo = await send(chat, staffA, 'staff', 'Answer two')
  const note = await send(chat, staffA, 'staff', 'Internal only', randomUUID(), true)
  const sequence = async id => Number((await first('select sequence_number from public.chat_messages where id=$1', [id])).sequence_number)
  const staffOneSeq = await sequence(staffOne)
  const customerOneSeq = await sequence(customerOne)
  const noteSeq = await sequence(note)
  const summary = async (id, kind, ids = [chat]) => (await query(
    'select * from public.chat_unread_summary($1,$2,$3)', [id, kind, ids])).rows
  assert.equal(Number((await summary(customerA, 'customer'))[0].unread_count), 2)
  assert.equal(Number((await summary(staffA, 'staff'))[0].unread_count), 2)
  assert.equal((await summary(customerA, 'customer', [chat, other])).length, 1)
  await denied(() => first('select public.chat_mark_read($1,$2,$3,$4)',
    [chat, customerB, 'customer', staffOneSeq]), /Chat access denied/)
  await denied(() => first('select public.chat_mark_read($1,$2,$3,$4)',
    [chat, customerA, 'customer', customerOneSeq]), /visible incoming message/)
  await denied(() => first('select public.chat_mark_read($1,$2,$3,$4)',
    [chat, customerA, 'customer', noteSeq]), /visible incoming message/)
  await db.exec('set local role service_role')
  const newest = await sequence(staffTwo)
  await first('select public.chat_mark_read($1,$2,$3,$4)', [chat, customerA, 'customer', newest])
  await first('select public.chat_mark_read($1,$2,$3,$4)', [chat, customerA, 'customer', staffOneSeq])
  await first('select public.chat_mark_read($1,$2,$3,$4)', [chat, staffA, 'staff', await sequence(customerTwo)])
  await db.exec('reset role')
  assert.equal(Number((await summary(customerA, 'customer'))[0].last_read_sequence), newest)
  assert.equal(Number((await summary(customerA, 'customer'))[0].unread_count), 0)
  assert.equal(Number((await summary(staffA, 'staff'))[0].unread_count), 0)
})

test('agent availability needs reply access and expires without a heartbeat', async () => {
  await denied(() => first('select * from public.chat_set_agent_availability($1,$2)',
    [viewer, 'online']), /availability access denied/)
  await db.exec('set local role service_role')
  const online = await first('select * from public.chat_set_agent_availability($1,$2)', [staffA, 'online'])
  assert.equal(online.declared_state, 'online')
  assert.ok(new Date(online.lease_expires_at).getTime() > Date.now())
  await db.exec('reset role')
  await query("update public.chat_settings set availability_override='online'")
  assert.equal((await first('select public.chat_live_available() as available')).available, true)
  await query("update public.chat_agent_availability set lease_expires_at=now()-interval '1 second' where admin_id=$1", [staffA])
  assert.equal((await first('select public.chat_live_available() as available')).available, false)
  await db.exec('set local role service_role')
  await first('select * from public.chat_set_agent_availability($1,$2)', [staffA, 'away'])
  await db.exec('reset role')
  assert.equal((await first('select declared_state,lease_expires_at from public.chat_agent_availability where admin_id=$1', [staffA])).lease_expires_at, null)
  assert.equal((await first('select public.chat_live_available() as available')).available, false)
})

test('typing relay uses a short shared limit without saving typing state', async () => {
  const chat = await create(customerA)
  const before = Number((await first('select count(*)::int as count from public.chat_events where conversation_id=$1', [chat])).count)
  await db.exec('set local role service_role')
  for (let index = 0; index < 3; index++) {
    await first("select public.chat_consume_limit('typing',$1,10,3)", [hash(`${customerA}:${chat}`)])
  }
  await denied(() => first("select public.chat_consume_limit('typing',$1,10,3)",
    [hash(`${customerA}:${chat}`)]), /CHAT_RATE_LIMIT/)
  await db.exec('reset role')
  assert.equal(Number((await first('select count(*)::int as count from public.chat_events where conversation_id=$1', [chat])).count), before)
  assert.equal(Number((await first("select count(*)::int as count from public.chat_rate_limits where scope='typing'")).count), 1)
})

test('order linking accepts only the verified owner and saves each change', async () => {
  const chat = await create(customerA)
  const ownOrder = randomUUID(); const otherOrder = randomUUID()
  await query(`insert into public.customer_orders(id,user_id,first_name,phone,street_address,city,governorate)
    values($1,$2,'A','123','Street','Cairo','Cairo'),($3,$4,'B','123','Street','Cairo','Cairo')`,
  [ownOrder, customerA, otherOrder, customerB])
  const link = (actor, kind, order, revision) => first(
    'select public.chat_set_order($1,$2,$3,$4,$5) as id', [chat, actor, kind, order, revision])
  await denied(() => link(customerB, 'customer', ownOrder, 0), /CHAT_ORDER_DENIED/)
  await denied(() => link(customerA, 'customer', otherOrder, 0), /CHAT_ORDER_DENIED/)
  await denied(() => link(guestA, 'guest', ownOrder, 0), /CHAT_ORDER_DENIED/)
  await denied(() => link(viewer, 'staff', ownOrder, 0), /CHAT_ORDER_DENIED/)
  await db.exec('set local role service_role')
  assert.equal((await link(customerA, 'customer', ownOrder, 0)).id, chat)
  await db.exec('reset role')
  await denied(() => link(staffA, 'staff', null, 0), /CHAT_STALE/)
  assert.equal((await link(staffA, 'staff', null, 1)).id, chat)
  assert.equal((await first('select order_id from public.chat_conversations where id=$1', [chat])).order_id, null)
  const events = (await query(`select event_type,actor_kind,old_value,new_value from public.chat_events
    where conversation_id=$1 and event_type in ('order_linked','order_unlinked') order by created_at,id`, [chat])).rows
  assert.deepEqual(events.map(event => event.event_type).sort(), ['order_linked','order_unlinked'])
  assert.equal(events.find(event => event.event_type === 'order_linked').new_value.order_id, ownOrder)
  assert.equal(events.find(event => event.event_type === 'order_unlinked').old_value.order_id, ownOrder)
  await query("update public.chat_conversations set status='closed',closed_at=now() where id=$1", [chat])
  await denied(() => link(customerA, 'customer', ownOrder, 3), /CHAT_ORDER_DENIED/)
})

test('guest chat association requires both verified identities and preserves history', async () => {
  const guestChat = await create(guestA, true)
  const accountChat = await create(customerA)
  const identify = (guest, customer, revision) => first(
    'select public.chat_identify_guest($1,$2,$3,$4) as id', [guestChat, guest, customer, revision])
  await denied(() => identify(customerB, customerA, 0), /CHAT_IDENTIFY_DENIED/)
  await denied(() => identify(guestA, guestA, 0), /CHAT_IDENTIFY_DENIED/)
  await denied(() => identify(guestA, customerA, 0), /CHAT_ACCOUNT_BUSY/)
  await query("update public.chat_conversations set status='closed',closed_at=now() where id=$1", [accountChat])
  await denied(() => identify(guestA, customerA, 1), /CHAT_STALE/)
  await db.exec('set local role service_role')
  assert.equal((await identify(guestA, customerA, 0)).id, guestChat)
  await db.exec('reset role')
  const chat = await first('select customer_id,guest_auth_user_id,revision from public.chat_conversations where id=$1', [guestChat])
  assert.equal(chat.customer_id, customerA)
  assert.equal(chat.guest_auth_user_id, null)
  assert.equal(Number(chat.revision), 1)
  assert.equal((await first("select count(*)::int as count from public.chat_events where conversation_id=$1 and event_type='identified'", [guestChat])).count, 1)
  await denied(() => identify(guestA, customerB, 1), /CHAT_IDENTIFY_DENIED/)
})

test('attachment reservation enforces ownership, settings, count and idempotency', async () => {
  await query("update public.chat_settings set customer_send_cooldown_seconds=0,max_attachments_per_message=1")
  const chat = await create(customerA)
  const message = await send(chat, customerA, 'customer', 'See the file')
  const attachment = randomUUID()
  await denied(() => reserveAttachment({ attachment, chat, message, actor: customerB }), /access denied/)
  await denied(() => reserveAttachment({ attachment, chat, message, actor: customerA,
    mime: 'text/plain', path: `${chat}/${message}/${attachment}.txt` }), /type or size is invalid/)
  await denied(() => reserveAttachment({ attachment, chat, message, actor: customerA,
    path: `${customerB}/${message}/${attachment}.pdf` }), /path is invalid/)
  await db.exec('set local role service_role')
  const reserved = await reserveAttachment({ attachment, chat, message, actor: customerA })
  assert.equal(reserved.result.created, true)
  assert.equal(reserved.result.ready, false)
  const retried = await reserveAttachment({ attachment, chat, message, actor: customerA })
  assert.equal(retried.result.created, false)
  await db.exec('reset role')
  await denied(() => reserveAttachment({ attachment, chat, message, actor: customerA,
    hashValue: 'b'.repeat(64) }), /CHAT_ATTACHMENT_KEY_CONFLICT/)
  await denied(() => reserveAttachment({ chat, message, actor: customerA }), /CHAT_ATTACHMENT_LIMIT/)
  await denied(() => first('select public.chat_complete_attachment($1,$2,$3) as id',
    [attachment, customerB, 'a'.repeat(64)]), /access denied/)
  await query('delete from realtime.messages')
  await db.exec('set local role service_role')
  assert.equal((await first('select public.chat_complete_attachment($1,$2,$3) as id',
    [attachment, customerA, 'a'.repeat(64)])).id, attachment)
  await db.exec('reset role')
  assert.equal((await first('select is_ready from public.chat_attachments where id=$1', [attachment])).is_ready, true)
  const topics = (await query("select topic from realtime.messages where payload->>'kind'='attachment' order by topic")).rows.map(row => row.topic)
  assert.deepEqual(topics, [`chat:public:${chat}`, `chat:staff:${chat}`])
  await query('update public.chat_settings set attachments_enabled=false')
  const secondMessage = await send(chat, customerA, 'customer', 'No attachment')
  await denied(() => reserveAttachment({ chat, message: secondMessage, actor: customerA }), /CHAT_ATTACHMENTS_DISABLED/)
})

test('staff internal attachments remain staff-only and require the assigned sender', async () => {
  await query("update public.chat_settings set customer_send_cooldown_seconds=0")
  const chat = await create(customerA)
  const customerMessage = await send(chat, customerA, 'customer', 'Public file')
  await transition(chat, staffA, 'claim', Number((await first(
    'select revision from public.chat_conversations where id=$1', [chat])).revision))
  const note = await send(chat, staffA, 'staff', 'Private file', randomUUID(), true)
  const attachment = randomUUID()
  await denied(() => reserveAttachment({ attachment, chat, message: note,
    actor: viewer, kind: 'staff' }), /access denied/)
  await denied(() => reserveAttachment({ attachment, chat, message: note,
    actor: staffB, kind: 'staff' }), /access denied/)
  await reserveAttachment({ attachment, chat, message: note, actor: staffA, kind: 'staff' })
  await query('delete from realtime.messages')
  await first('select public.chat_complete_attachment($1,$2,$3)',
    [attachment, staffA, 'a'.repeat(64)])
  const topics = (await query("select topic from realtime.messages where payload->>'kind'='attachment'")).rows.map(row => row.topic)
  assert.deepEqual(topics, [`chat:staff:${chat}`])
  await query("update public.chat_conversations set status='closed',closed_at=now() where id=$1", [chat])
  await denied(() => reserveAttachment({ chat, message: customerMessage,
    actor: customerA }), /CHAT_CLOSED/)
})

test('browser roles cannot execute write RPCs or access private chat tables', async () => {
  const signatures = [
    'public.chat_create_or_resume(uuid,boolean,text,text,text,uuid,uuid,text)',
    'public.chat_start_with_message(uuid,boolean,text,text,text,uuid,uuid,text,text,uuid)',
    'public.chat_send_message(uuid,uuid,text,text,text,uuid,text,boolean)',
    'public.chat_transition(uuid,uuid,text,uuid,bigint)',
    'public.chat_event_name(uuid)',
    'public.chat_snapshot_event()',
    'public.chat_mark_read(uuid,uuid,text,bigint)',
    'public.chat_unread_summary(uuid,text,uuid[])',
    'public.chat_set_agent_availability(uuid,text)',
    'public.chat_consume_limit(text,text,integer,integer)',
    'public.chat_consume_network_limits(text,text,text)',
    'public.chat_set_order(uuid,uuid,text,uuid,bigint)',
    'public.chat_identify_guest(uuid,uuid,uuid,bigint)',
    'public.chat_reserve_attachment(uuid,uuid,uuid,uuid,text,text,text,text,integer,text,text)',
    'public.chat_complete_attachment(uuid,uuid,text)'
  ]
  for (const signature of signatures) {
    for (const role of ['anon','authenticated']) {
      assert.equal((await first('select has_function_privilege($1,$2,\'EXECUTE\') as allowed', [role, signature])).allowed, false)
    }
  }
  await db.exec('set local role authenticated')
  await denied(() => query('select public.chat_transition(null,null,null,null,null)'), /permission denied/)
  await db.exec('reset role')
})
