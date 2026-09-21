import { after, afterEach, before, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createResetDatabase } from './helpers/resetDatabase.mjs'
import { normalizeChatSettings } from '../server/utils/liveChatSettingsValidation.js'

let db, editor, viewer, guestA, guestB
const query = (sql, args = []) => db.query(sql, args)
const first = async (sql, args = []) => (await query(sql, args)).rows[0]
const denied = async (action, pattern) => {
  await db.exec('savepoint expected_denial')
  await assert.rejects(action, pattern)
  await db.exec('rollback to savepoint expected_denial')
}
const settingsPayload = async (changes = {}) => {
  const row = await first('select * from public.chat_settings where singleton')
  return {
    is_enabled: row.is_enabled,
    availability_override: row.availability_override,
    business_timezone: row.business_timezone,
    weekly_hours: row.weekly_hours,
    welcome_message: row.welcome_message,
    offline_message: row.offline_message,
    guest_contact_rule: row.guest_contact_rule,
    customer_send_cooldown_seconds: row.customer_send_cooldown_seconds,
    max_message_length: row.max_message_length,
    attachments_enabled: row.attachments_enabled,
    allowed_attachment_mimes: row.allowed_attachment_mimes,
    max_attachment_bytes: row.max_attachment_bytes,
    max_attachments_per_message: row.max_attachments_per_message,
    transfers_enabled: row.transfers_enabled,
    reopen_enabled: row.reopen_enabled,
    offline_behavior: row.offline_behavior,
    ticket_conversion_enabled: row.ticket_conversion_enabled,
    ...changes
  }
}
const startGuest = async (guest, key = randomUUID(), messageKey = randomUUID()) => first(
  `select public.chat_start_with_message($1,true,'Guest',null,'+966500000000',null,
    $2,$3,'Please follow up',$4) as result`, [guest, key, 'b'.repeat(64), messageKey])

before(async () => { db = await createResetDatabase() })
after(async () => { await db?.close() })
beforeEach(async () => {
  editor = randomUUID(); viewer = randomUUID(); guestA = randomUUID(); guestB = randomUUID()
  await db.exec('begin')
  await query(`insert into auth.users(id,email,is_anonymous) values
    ($1,'settings-editor@example.test',false),($2,'settings-viewer@example.test',false),
    ($3,null,true),($4,null,true)`, [editor, viewer, guestA, guestB])
  await query(`insert into public.admin_users(id,email,full_name,role,permissions) values
    ($1,'settings-editor@example.test','Settings Editor','admin',$2),
    ($3,'settings-viewer@example.test','Settings Viewer','admin',$4)`, [
    editor, JSON.stringify({ 'settings.view': true, 'settings.edit': true, 'support.view': true, 'support.reply': true, 'support.manage': true }),
    viewer, JSON.stringify({ 'settings.view': true })
  ])
})
afterEach(async () => { await db.exec('rollback') })

test('server settings validation rejects overlapping hours and conflicting offline options', () => {
  const base = {
    is_enabled: true, availability_override: 'auto', business_timezone: 'Asia/Riyadh',
    weekly_hours: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] },
    welcome_message: 'Welcome', offline_message: 'Leave a message', guest_contact_rule: 'either',
    customer_send_cooldown_seconds: 4, max_message_length: 4000,
    attachments_enabled: true, allowed_attachment_mimes: ['application/pdf'],
    max_attachment_bytes: 1048576, max_attachments_per_message: 2,
    transfers_enabled: true, reopen_enabled: true, offline_behavior: 'conversation',
    ticket_conversion_enabled: true
  }
  assert.equal(normalizeChatSettings(base).business_timezone, 'Asia/Riyadh')
  assert.throws(() => normalizeChatSettings({ ...base,
    weekly_hours: { ...base.weekly_hours, 0: [['09:00', '12:00'], ['11:00', '13:00']] } }), /overlap/i)
  assert.throws(() => normalizeChatSettings({ ...base,
    offline_behavior: 'ticket', ticket_conversion_enabled: false }), /Enable ticket conversion/)
})

test('availability details honor hours, timezone, agents and manual overrides', async () => {
  await query(`update public.chat_settings set is_enabled=true,business_timezone='UTC',
    weekly_hours='{"0":[["09:00","18:00"]],"1":[],"2":[],"3":[],"4":[],"5":[],"6":[]}'::jsonb`)
  let details = (await first("select public.chat_availability_details('2026-09-20T10:00:00Z') as value")).value
  assert.equal(details.reason, 'no_agent')
  await query(`insert into public.chat_agent_availability(admin_id,declared_state,lease_expires_at)
    values($1,'online','2026-09-20T11:00:00Z')`, [editor])
  details = (await first("select public.chat_availability_details('2026-09-20T10:00:00Z') as value")).value
  assert.equal(details.available, true)
  assert.equal(details.reason, 'within_hours')
  details = (await first("select public.chat_availability_details('2026-09-20T20:00:00Z') as value")).value
  assert.equal(details.reason, 'no_agent')
  await query("update public.chat_agent_availability set lease_expires_at='2026-09-21T00:00:00Z' where admin_id=$1", [editor])
  details = (await first("select public.chat_availability_details('2026-09-20T20:00:00Z') as value")).value
  assert.equal(details.reason, 'outside_hours')
  await query("update public.chat_settings set availability_override='online'")
  details = (await first("select public.chat_availability_details('2026-09-20T20:00:00Z') as value")).value
  assert.equal(details.reason, 'forced_online')
  assert.equal(details.available, true)
  await query("update public.chat_settings set availability_override='offline'")
  details = (await first("select public.chat_availability_details('2026-09-20T10:00:00Z') as value")).value
  assert.equal(details.reason, 'forced_offline')
  assert.equal(details.available, false)
})

test('settings update is permissioned, stale-safe, validated and audited atomically', async () => {
  const before = await first('select updated_at from public.chat_settings where singleton')
  const payload = await settingsPayload({ is_enabled: true, business_timezone: 'Asia/Riyadh',
    welcome_message: 'Welcome to support', customer_send_cooldown_seconds: 5 })
  await query('select public.chat_update_settings($1,$2,$3)',
    [editor, before.updated_at, JSON.stringify(payload)])
  const saved = await first('select * from public.chat_settings where singleton')
  assert.equal(saved.is_enabled, true)
  assert.equal(saved.business_timezone, 'Asia/Riyadh')
  assert.equal(saved.updated_by, editor)
  const log = await first("select * from public.admin_activity_logs where action_key='chat.settings.updated'")
  assert.equal(log.admin_user_id, editor)
  assert.equal(log.author_name, 'Settings Editor')
  assert.ok(log.metadata.changed_fields.includes('is_enabled'))
  assert.equal(log.metadata.before.is_enabled, false)
  assert.equal(log.metadata.after.is_enabled, true)
  await denied(() => query('select public.chat_update_settings($1,$2,$3)',
    [editor, before.updated_at, JSON.stringify(payload)]), /CHAT_SETTINGS_STALE/)
  const current = await first('select updated_at from public.chat_settings where singleton')
  await denied(() => query('select public.chat_update_settings($1,$2,$3)',
    [viewer, current.updated_at, JSON.stringify(payload)]), /settings access denied/i)
  await denied(() => query('select public.chat_update_settings($1,$2,$3)',
    [editor, current.updated_at, JSON.stringify({ ...payload, unexpected: true })]), /payload is invalid/i)
  assert.equal((await first("select count(*)::int as count from public.admin_activity_logs where action_key='chat.settings.updated'")).count, 1)
})

test('offline intake either stays a conversation or creates one linked system ticket', async () => {
  await query("update public.chat_settings set is_enabled=true,availability_override='offline',customer_send_cooldown_seconds=0")
  const firstStart = await startGuest(guestA)
  const firstChat = await first('select intake_mode,ticket_id from public.chat_conversations where id=$1', [firstStart.result.conversationId])
  assert.equal(firstChat.intake_mode, 'offline')
  assert.equal(firstChat.ticket_id, null)

  await query("update public.chat_settings set offline_behavior='ticket'")
  const creationKey = randomUUID(), messageKey = randomUUID()
  const secondStart = await startGuest(guestB, creationKey, messageKey)
  assert.ok(secondStart.result.ticketId)
  const secondChat = await first('select intake_mode,ticket_id from public.chat_conversations where id=$1', [secondStart.result.conversationId])
  assert.equal(secondChat.intake_mode, 'offline')
  assert.equal(secondChat.ticket_id, secondStart.result.ticketId)
  const ticket = await first('select customer_id,customer_email,customer_mobile,subject from public.support_tickets where id=$1', [secondChat.ticket_id])
  assert.equal(ticket.customer_id, null)
  assert.equal(ticket.customer_email, null)
  assert.equal(ticket.customer_mobile, '+966500000000')
  assert.match(ticket.subject, /^Offline chat #/)
  assert.deepEqual((await query('select event_type,actor_type from public.support_ticket_events where ticket_id=$1 order by event_type', [secondChat.ticket_id])).rows,
    [{ event_type: 'created', actor_type: 'system' }, { event_type: 'source_chat', actor_type: 'system' }])
  assert.equal((await first("select actor_kind from public.chat_events where conversation_id=$1 and event_type='ticket_created'", [secondStart.result.conversationId])).actor_kind, 'system')
  const retry = await startGuest(guestB, creationKey, messageKey)
  assert.equal(retry.result.ticketId, secondStart.result.ticketId)
  assert.equal((await first('select count(*)::int as count from public.support_tickets where idempotency_key=$1', [secondStart.result.conversationId])).count, 1)
})

test('ticket and settings switches are enforced at the database boundary', async () => {
  await denied(() => query("update public.chat_settings set offline_behavior='ticket',ticket_conversion_enabled=false"), /offline_ticket_check/)
  await query('update public.chat_settings set ticket_conversion_enabled=false')
  const chat = await first(`insert into public.chat_conversations
    (guest_auth_user_id,contact_name,contact_mobile,creation_key,status,assigned_admin_id)
    values($1,'Guest','+966500000000',$2,'active',$3) returning id,revision`, [guestA, randomUUID(), editor])
  await denied(() => query("select public.chat_create_ticket($1,$2,'Disabled',$3)",
    [chat.id, editor, chat.revision]), /CHAT_TICKET_DISABLED/)
  const payload = await settingsPayload()
  await db.exec('set local role authenticated')
  await denied(() => query("select public.chat_availability_details(now())"), /permission denied/)
  await denied(() => query('select public.chat_update_settings($1,now(),$2)', [editor, JSON.stringify(payload)]), /permission denied/)
  await db.exec('reset role')
})
