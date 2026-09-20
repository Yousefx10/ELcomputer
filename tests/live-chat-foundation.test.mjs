import { before, after, beforeEach, afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createResetDatabase } from './helpers/resetDatabase.mjs'

let db, customerA, customerB, guestA, guestB, staff, viewer
const query = (sql, args = []) => db.query(sql, args)
const first = async (sql, args = []) => (await query(sql, args)).rows[0]
const denied = async (action, pattern) => {
  await db.exec('savepoint chat_expected_denial')
  await assert.rejects(action, pattern)
  await db.exec('rollback to savepoint chat_expected_denial')
}
const makeConversation = async (actorId, actorKind, orderId = null, key = randomUUID()) => {
  const isGuest = actorKind === 'guest'
  return first(`insert into public.chat_conversations
    (customer_id, guest_auth_user_id, contact_name, contact_email, order_id, creation_key)
    values ($1,$2,'Chat visitor','visitor@example.test',$3,$4)
    returning id, reference_number, revision`,
  [isGuest ? null : actorId, isGuest ? actorId : null, orderId, key])
}
const setIdentity = async (id, isAnonymous = false) => {
  await query("select set_config('request.jwt.claim.sub',$1,true)", [id])
  await query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ is_anonymous: isAnonymous })])
}

before(async () => { db = await createResetDatabase() })
after(async () => { await db?.close() })
beforeEach(async () => {
  customerA = randomUUID(); customerB = randomUUID()
  guestA = randomUUID(); guestB = randomUUID()
  staff = randomUUID(); viewer = randomUUID()
  await db.exec('begin')
  await query(`insert into auth.users(id,email,is_anonymous) values
    ($1,'chat-a@example.test',false),($2,'chat-b@example.test',false),
    ($3,null,true),($4,null,true),($5,'chat-staff@example.test',false),
    ($6,'chat-viewer@example.test',false)`,
  [customerA, customerB, guestA, guestB, staff, viewer])
  await query(`insert into public.admin_users(id,email,role,permissions) values
    ($1,'chat-staff@example.test','admin',$2),
    ($3,'chat-viewer@example.test','admin',$4)`, [
    staff, JSON.stringify({ 'support.view': true, 'support.reply': true, 'support.manage': true }),
    viewer, JSON.stringify({ 'support.view': true })
  ])
})
afterEach(async () => { await db.exec('rollback') })

test('settings are private, disabled by default, and constrained', async () => {
  const settings = await first('select * from public.chat_settings')
  assert.equal(settings.is_enabled, false)
  assert.equal(settings.customer_send_cooldown_seconds, 4)
  assert.equal(settings.business_timezone, 'Africa/Cairo')
  assert.deepEqual(settings.weekly_hours['0'], [['09:00', '18:00']])
  assert.deepEqual(settings.weekly_hours['5'], [])
  assert.equal(settings.offline_behavior, 'conversation')
  await denied(() => query("update public.chat_settings set customer_send_cooldown_seconds=61"), /check constraint/)
  await denied(() => query("update public.chat_settings set business_timezone='NoSuch\/Zone'"), /Invalid chat business timezone/)
  await denied(() => query("update public.chat_settings set weekly_hours='{}'::jsonb"), /seven days/)
  await denied(() => query(`update public.chat_settings set weekly_hours =
    '{"0":[["09:00","12:00"],["11:00","14:00"]],"1":[],"2":[],"3":[],"4":[],"5":[],"6":[]}'::jsonb`), /interval is invalid/)
  await denied(() => query('insert into public.chat_settings(singleton) values (false)'), /check constraint/)
})

test('anonymous Auth users have no customer profile and cannot forge one', async () => {
  assert.equal((await first('select count(*)::int as count from public.customer_profiles where id=$1', [guestA])).count, 0)
  assert.equal((await first('select count(*)::int as count from public.customer_profiles where id=$1', [customerA])).count, 1)
  await db.exec('grant select, insert on public.customer_profiles to authenticated')
  await setIdentity(guestA, true)
  await db.exec('set local role authenticated')
  await denied(() => query(`insert into public.customer_profiles(id,email,full_name)
    values($1,'forged@example.test','Forged')`, [guestA]), /Anonymous chat guests cannot create customer profiles/)
  await db.exec('reset role')
})

test('chat tables, private bucket and privileged topic access stay closed to browser roles', async () => {
  const tables = ['chat_settings', 'chat_conversations', 'chat_messages', 'chat_events',
    'chat_read_state', 'chat_attachments', 'chat_agent_availability', 'chat_rate_limits']
  for (const table of tables) {
    const rls = await first('select relrowsecurity from pg_class where oid=$1::regclass', [`public.${table}`])
    assert.equal(rls.relrowsecurity, true)
    for (const role of ['anon', 'authenticated']) {
      const allowed = await first('select has_table_privilege($1,$2,$3) as allowed', [role, `public.${table}`, 'SELECT'])
      assert.equal(allowed.allowed, false, `${role} can read ${table}`)
    }
  }
  const bucket = await first("select public,file_size_limit from storage.buckets where id='chat-attachments'")
  assert.equal(bucket.public, false)
  assert.equal(Number(bucket.file_size_limit), 5242880)
  const storagePolicies = await first("select count(*)::int as count from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'chat%'")
  assert.equal(storagePolicies.count, 0)
  await db.exec('set local role anon')
  await denied(() => query("select public.chat_can_receive_topic('chat:inbox')"), /permission denied/)
  await db.exec('reset role')
  await db.exec('set local role authenticated')
  await denied(() => query('select id from public.chat_conversations'), /permission denied/)
  await denied(() => query("insert into realtime.messages(topic,extension) values('chat:inbox','broadcast')"), /row-level security/)
  await db.exec('reset role')
})

test('conversation constraints reject forged orders, guests as customers, and duplicate open chats', async () => {
  const ownOrder = randomUUID(), otherOrder = randomUUID()
  await query(`insert into public.customer_orders(id,user_id,first_name,phone,street_address,city,governorate)
    values($1,$2,'A','123','Street','Cairo','Cairo'),($3,$4,'B','123','Street','Cairo','Cairo')`,
  [ownOrder, customerA, otherOrder, customerB])
  await denied(() => makeConversation(customerA, 'customer', otherOrder), /Chat order does not belong/)
  await denied(() => makeConversation(guestA, 'guest', ownOrder), /Chat order does not belong/)
  await denied(() => makeConversation(guestA, 'customer'), /Customer identity is unavailable/)
  const firstChat = await makeConversation(customerA, 'customer', ownOrder)
  const otherTicket = (await first("select public.support_create_ticket($1,null,null,'Other order','Help',$2) as id", [customerB, randomUUID()])).id
  await denied(() => query('update public.chat_conversations set ticket_id=$1 where id=$2',
    [otherTicket, firstChat.id]), /Chat ticket does not belong/)
  const ownTicket = (await first("select public.support_create_ticket($1,null,null,'My order','Help',$2) as id", [customerA, randomUUID()])).id
  await query('update public.chat_conversations set ticket_id=$1 where id=$2', [ownTicket, firstChat.id])
  await denied(() => makeConversation(customerA, 'customer'), /duplicate key/)
  await query("update public.chat_conversations set status='closed',closed_at=now() where id=$1", [firstChat.id])
  const closed = await first('select revision from public.chat_conversations where id=$1', [firstChat.id])
  assert.equal(Number(closed.revision), 2)
  assert.ok((await makeConversation(customerA, 'customer')).id)
})

test('only reply-capable active staff can be assigned, and agent removal returns chat to waiting', async () => {
  const chat = await makeConversation(customerA, 'customer')
  await denied(() => query("update public.chat_conversations set status='active',assigned_admin_id=$1 where id=$2", [viewer, chat.id]), /assignee cannot reply/)
  await query('update public.admin_users set permissions=$1 where id=$2', [JSON.stringify({ 'support.reply': true }), viewer])
  await denied(() => query("update public.chat_conversations set status='active',assigned_admin_id=$1 where id=$2", [viewer, chat.id]), /assignee cannot reply/)
  await query("update public.chat_conversations set status='active',assigned_admin_id=$1 where id=$2", [staff, chat.id])
  assert.equal((await first('select status from public.chat_conversations where id=$1', [chat.id])).status, 'active')
  await query('delete from public.admin_users where id=$1', [staff])
  const released = await first('select status,assigned_admin_id from public.chat_conversations where id=$1', [chat.id])
  assert.equal(released.status, 'waiting')
  assert.equal(released.assigned_admin_id, null)
})

test('message and attachment constraints protect sender, visibility, retries and thread ownership', async () => {
  const chatA = await makeConversation(customerA, 'customer')
  const chatB = await makeConversation(customerB, 'customer')
  const key = randomUUID()
  const sent = await first(`insert into public.chat_messages(conversation_id,sender_id,sender_kind,sender_name,body,idempotency_key)
    values($1,$2,'customer','A','Hello',$3) returning id,sequence_number`, [chatA.id, customerA, key])
  await denied(() => query(`insert into public.chat_messages(conversation_id,sender_id,sender_kind,sender_name,body,idempotency_key)
    values($1,$2,'customer','A','Again',$3)`, [chatA.id, customerA, key]), /duplicate key/)
  await denied(() => query(`insert into public.chat_messages(conversation_id,sender_id,sender_kind,sender_name,body,idempotency_key)
    values($1,$2,'customer','B','Forged',$3)`, [chatA.id, customerB, randomUUID()]), /actor is invalid/)
  await denied(() => query(`insert into public.chat_messages(conversation_id,sender_id,sender_kind,sender_name,body,is_internal,idempotency_key)
    values($1,$2,'customer','A','Private',true,$3)`, [chatA.id, customerA, randomUUID()]), /check constraint|actor is invalid/)
  await denied(() => query(`insert into public.chat_attachments(conversation_id,message_id,original_name,storage_path,mime_type,size_bytes)
    values($1,$2,'file.pdf','wrong/file.pdf','application/pdf',100)`, [chatB.id, sent.id]), /foreign key/)
  await query("update public.chat_conversations set status='active',assigned_admin_id=$1 where id=$2", [staff, chatA.id])
  const note = await first(`insert into public.chat_messages(conversation_id,sender_id,sender_kind,sender_name,body,is_internal,idempotency_key)
    values($1,$2,'staff','Agent','Internal note',true,$3) returning id,sequence_number`, [chatA.id, staff, randomUUID()])
  assert.ok(Number(note.sequence_number) > Number(sent.sequence_number))
  await query("update public.chat_conversations set status='closed',closed_at=now() where id=$1", [chatA.id])
  await denied(() => query(`insert into public.chat_messages(conversation_id,sender_id,sender_kind,sender_name,body,idempotency_key)
    values($1,$2,'customer','A','After close',$3)`, [chatA.id, customerA, randomUUID()]), /cannot be saved/)
})

test('customer account deletion retains transcript and historical order link without account ownership', async () => {
  const order = randomUUID()
  await query(`insert into public.customer_orders(id,user_id,first_name,phone,street_address,city,governorate)
    values($1,$2,'A','123','Street','Cairo','Cairo')`, [order, customerA])
  const chat = await makeConversation(customerA, 'customer', order)
  const message = await first(`insert into public.chat_messages(conversation_id,sender_id,sender_kind,sender_name,body,idempotency_key)
    values($1,$2,'customer','A','Please help',$3) returning id`, [chat.id, customerA, randomUUID()])
  await query('delete from auth.users where id=$1', [customerA])
  const retained = await first('select customer_id,order_id,contact_email from public.chat_conversations where id=$1', [chat.id])
  assert.equal(retained.customer_id, null)
  assert.equal(retained.order_id, order)
  assert.equal((await first('select user_id from public.customer_orders where id=$1', [order])).user_id, null)
  assert.equal(retained.contact_email, 'visitor@example.test')
  assert.equal((await first('select sender_id,body from public.chat_messages where id=$1', [message.id])).sender_id, null)
  await query("update public.chat_conversations set status='closed',closed_at=now() where id=$1", [chat.id])
  assert.equal((await first('select status from public.chat_conversations where id=$1', [chat.id])).status, 'closed')
})

test('private Realtime topics authorize only the correct customer, guest, or support staff', async () => {
  const chatA = await makeConversation(customerA, 'customer')
  const chatGuest = await makeConversation(guestA, 'guest')
  const publicA = `chat:public:${chatA.id}`
  const staffA = `chat:staff:${chatA.id}`
  const publicGuest = `chat:public:${chatGuest.id}`
  for (const topic of ['chat:inbox', publicA, staffA, publicGuest]) {
    await query("insert into realtime.messages(topic,extension) values($1,'broadcast')", [topic])
  }
  const canRead = async (id, anonymous, topic) => {
    await setIdentity(id, anonymous)
    await query("select set_config('realtime.topic',$1,true)", [topic])
    await db.exec('set local role authenticated')
    const result = await first('select count(*)::int as count from realtime.messages')
    await db.exec('reset role')
    return result.count
  }
  assert.equal(await canRead(customerA, false, publicA), 1)
  assert.equal(await canRead(customerA, false, staffA), 0)
  assert.equal(await canRead(customerB, false, publicA), 0)
  assert.equal(await canRead(guestA, true, publicGuest), 1)
  assert.equal(await canRead(guestB, true, publicGuest), 0)
  assert.equal(await canRead(guestA, true, publicA), 0)
  await query('update public.chat_conversations set customer_id=$1,guest_auth_user_id=null where id=$2', [customerB, chatGuest.id])
  assert.equal(await canRead(guestA, true, publicGuest), 0)
  assert.equal(await canRead(customerB, false, publicGuest), 1)
  assert.equal(await canRead(staff, false, 'chat:inbox'), 1)
  assert.equal(await canRead(staff, false, staffA), 1)
  assert.equal(await canRead(viewer, false, 'chat:inbox'), 1)
  await query('update public.admin_users set is_active=false where id=$1', [viewer])
  assert.equal(await canRead(viewer, false, 'chat:inbox'), 0)
  assert.equal(await canRead(customerA, false, `chat:public:${randomUUID()}`), 0)
  assert.equal(await canRead(customerA, false, `${publicA}:suffix`), 0)
})
