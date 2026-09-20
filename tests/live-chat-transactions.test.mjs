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

test('browser roles cannot execute write RPCs or access private chat tables', async () => {
  const signatures = [
    'public.chat_create_or_resume(uuid,boolean,text,text,text,uuid,uuid,text)',
    'public.chat_start_with_message(uuid,boolean,text,text,text,uuid,uuid,text,text,uuid)',
    'public.chat_send_message(uuid,uuid,text,text,text,uuid,text,boolean)',
    'public.chat_transition(uuid,uuid,text,uuid,bigint)',
    'public.chat_consume_limit(text,text,integer,integer)'
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
