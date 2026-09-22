import { after, afterEach, before, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { createResetDatabase } from './helpers/resetDatabase.mjs'
import { chatNetworkContentHash, chatNetworkSubjectHash,
  isLocalChatProxyAddress, normalizeChatNetworkAddress } from '../server/utils/liveChatRateLimitIdentity.js'

let db, customer
const hash = value => createHash('sha256').update(`chat:actor:${value}`).digest('hex')
const query = (sql, args = []) => db.query(sql, args)
const first = async (sql, args = []) => (await query(sql, args)).rows[0]
const denied = async (action, pattern) => {
  await db.exec('savepoint expected_limit')
  let failure
  try { await action() } catch (error) { failure = error }
  await db.exec('rollback to savepoint expected_limit')
  assert.ok(failure)
  assert.match(failure.message, pattern)
  return failure
}
const networkLimit = (network, action, content = null) => first(
  'select public.chat_consume_network_limits($1,$2,$3)', [network, action, content])
const retryAwareNetworkLimit = ({ network, action, body, conversation = null,
  creationKey = null, messageKey, content = null }) => first(
  `select public.chat_consume_network_limits_unless_retry(
    $1,$2,$3,$4,'customer',$5,$6,$7,$8) as consumed`,
  [network, action, content, customer, conversation, creationKey, messageKey, body])
const createConversation = async () => (await first(
  'select public.chat_create_or_resume($1,false,$2,$3,null,null,$4,$5) as id',
  [customer, 'Customer', 'customer@example.test', randomUUID(), hash(customer)])).id
const send = (conversation, body, key = randomUUID()) => first(
  'select public.chat_send_message($1,$2,$3,$4,$5,$6,$7,false) as id',
  [conversation, customer, 'customer', 'Customer', body, key, hash(customer)])

before(async () => { db = await createResetDatabase() })
after(async () => { await db?.close() })
beforeEach(async () => {
  customer = randomUUID()
  await db.exec('begin')
  await query('insert into auth.users(id,email,is_anonymous) values($1,$2,false)',
    [customer, 'customer@example.test'])
  await query('update public.chat_settings set is_enabled=true,customer_send_cooldown_seconds=0')
})
afterEach(async () => { await db.exec('rollback') })

test('network identities group IPv6 prefixes without retaining raw addresses or text', () => {
  assert.equal(normalizeChatNetworkAddress('::ffff:192.0.2.4'), '192.0.2.4')
  assert.equal(normalizeChatNetworkAddress('2001:db8:abcd:12::1'), '2001:0db8:abcd:0012::/64')
  assert.equal(isLocalChatProxyAddress('127.0.0.1'), true)
  assert.equal(isLocalChatProxyAddress('::1'), true)
  assert.equal(isLocalChatProxyAddress('192.0.2.4'), false)
  const firstNetwork = chatNetworkSubjectHash('2001:db8:abcd:12::1', customer, 'test-secret')
  const samePrefix = chatNetworkSubjectHash('2001:db8:abcd:12:ffff::9', customer, 'test-secret')
  const otherPrefix = chatNetworkSubjectHash('2001:db8:abcd:13::1', customer, 'test-secret')
  assert.equal(firstNetwork, samePrefix)
  assert.notEqual(firstNetwork, otherPrefix)
  assert.match(firstNetwork, /^[0-9a-f]{64}$/)
  assert.equal(chatNetworkContentHash(firstNetwork, 'Repeated   MESSAGE text', 'test-secret'),
    chatNetworkContentHash(firstNetwork, ' repeated message TEXT ', 'test-secret'))
  assert.equal(chatNetworkContentHash(firstNetwork, 'short', 'test-secret'), null)
})

test('rotating guest sessions share durable conversation limits by network hash', async () => {
  const network = hash('network-a')
  for (let attempt = 0; attempt < 20; attempt++) await networkLimit(network, 'conversation')
  const failure = await denied(() => networkLimit(network, 'conversation'), /CHAT_RATE_LIMIT/)
  assert.match(String(failure.hint), /^[1-9][0-9]*$/)
  await networkLimit(hash('network-b'), 'conversation')
  assert.equal(Number((await first(`select attempts from public.chat_rate_limits
    where scope='network_conversation' and subject_hash=$1`, [network])).attempts), 20)
})

test('network message, repeated-content, attachment and typing budgets are independent', async () => {
  const network = hash('shared-network')
  const content = hash('network-and-normalized-content')
  for (let attempt = 0; attempt < 5; attempt++) await networkLimit(network, 'message', content)
  await denied(() => networkLimit(network, 'message', content), /CHAT_RATE_LIMIT/)
  await networkLimit(network, 'message', hash('different-content'))
  for (let attempt = 0; attempt < 30; attempt++) await networkLimit(network, 'attachment')
  await denied(() => networkLimit(network, 'attachment'), /CHAT_RATE_LIMIT/)
  for (let attempt = 0; attempt < 30; attempt++) await networkLimit(network, 'typing')
  await denied(() => networkLimit(network, 'typing'), /CHAT_RATE_LIMIT/)
})

test('actor duplicate detection normalizes spacing and case across ten minutes', async () => {
  const conversation = await createConversation()
  await send(conversation, 'Repeated message text')
  const immediate = await denied(() => send(conversation, ' repeated   MESSAGE text '), /CHAT_DUPLICATE/)
  assert.match(String(immediate.hint), /^[1-9][0-9]*$/)
  await query("update public.chat_messages set created_at=now()-interval '9 minutes' where sender_id=$1", [customer])
  await send(conversation, ' repeated   MESSAGE text ')
  await query("update public.chat_messages set created_at=now()-interval '6 minutes' where sender_id=$1", [customer])
  await send(conversation, 'REPEATED MESSAGE TEXT')
  await query("update public.chat_messages set created_at=now()-interval '3 minutes' where sender_id=$1", [customer])
  await denied(() => send(conversation, 'Repeated message text'), /CHAT_DUPLICATE/)
  assert.equal((await first('select count(*)::int as count from public.chat_messages where sender_id=$1',
    [customer])).count, 3)
})

test('an exact committed HTTP retry does not consume network budgets', async () => {
  const network = hash('retry-network')
  const conversation = await createConversation()
  const messageKey = randomUUID()
  await send(conversation, 'Committed response', messageKey)
  await db.exec('set local role service_role')
  const retried = await retryAwareNetworkLimit({ network, action: 'message',
    body: ' Committed response ', conversation, messageKey, content: hash('content') })
  assert.equal(retried.consumed, false)
  assert.equal((await first("select count(*)::int as count from public.chat_rate_limits where scope like 'network_%'")).count, 0)
  const newSubmission = await retryAwareNetworkLimit({ network, action: 'message',
    body: 'New response', conversation, messageKey: randomUUID(), content: hash('new-content') })
  await db.exec('reset role')
  assert.equal(newSubmission.consumed, true)
  assert.equal((await first("select count(*)::int as count from public.chat_rate_limits where scope like 'network_%'")).count, 3)
})

test('an exact atomic conversation retry does not consume network budgets', async () => {
  const network = hash('start-retry-network')
  const creationKey = randomUUID()
  const messageKey = randomUUID()
  const started = (await first(`select public.chat_start_with_message(
    $1,false,'Customer','customer@example.test',null,null,$2,$3,$4,$5) as result`,
  [customer, creationKey, hash(customer), 'Initial request', messageKey])).result
  await db.exec('set local role service_role')
  const retried = await retryAwareNetworkLimit({ network, action: 'conversation_message',
    body: 'Initial request', creationKey, messageKey, content: hash('start-content') })
  await db.exec('reset role')
  assert.ok(started.conversationId)
  assert.equal(retried.consumed, false)
  assert.equal((await first("select count(*)::int as count from public.chat_rate_limits where scope like 'network_%'")).count, 0)
})

test('browser roles cannot execute the network limiter', async () => {
  const signatures = [
    'public.chat_consume_network_limits(text,text,text)',
    'public.chat_consume_network_limits_unless_retry(text,text,text,uuid,text,uuid,uuid,uuid,text)'
  ]
  for (const signature of signatures) {
    for (const role of ['anon','authenticated']) {
      assert.equal((await first("select has_function_privilege($1,$2,'EXECUTE') as allowed",
        [role, signature])).allowed, false)
    }
  }
  await db.exec('set local role authenticated')
  await denied(() => networkLimit(hash('browser'), 'message'), /permission denied/)
  await db.exec('reset role')
})
