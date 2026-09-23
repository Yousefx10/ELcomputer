import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const required = ['NUXT_PUBLIC_SUPABASE_URL', 'NUXT_PUBLIC_SUPABASE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY', 'LIVE_CHAT_STAGING_BASE_URL',
  'LIVE_CHAT_STAGING_PROJECT_REF', 'LIVE_CHAT_STAGING_CONFIRM']
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} is required`)
}

const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '')
const anonKey = process.env.NUXT_PUBLIC_SUPABASE_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const baseUrl = process.env.LIVE_CHAT_STAGING_BASE_URL.replace(/\/$/, '')
const stagingRef = process.env.LIVE_CHAT_STAGING_PROJECT_REF
if (process.env.LIVE_CHAT_STAGING_CONFIRM !== stagingRef
  || new URL(supabaseUrl).hostname !== `${stagingRef}.supabase.co`
  || !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(baseUrl)) {
  throw new Error('Staging confirmation, project URL, or local application URL does not match.')
}
if (stagingRef === 'zsqhuwgoasrexdnamlks') {
  throw new Error('The Live Chat staging runner cannot target the production-linked project.')
}
const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`
const password = `Phase14-${randomUUID()}-Aa1!`
const createdUsers = []
const channels = []

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
})

const check = (condition, message) => assert.ok(condition, message)
const uuid = () => randomUUID()
const log = message => console.log(`PASS ${message}`)

const api = async (path, { token, method = 'GET', body, form, headers = {} } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...headers
    },
    body: form || (body ? JSON.stringify(body) : undefined)
  })
  const type = response.headers.get('content-type') || ''
  let data
  if (type.includes('application/json')) data = await response.json()
  else data = Buffer.from(await response.arrayBuffer())
  return { status: response.status, data, headers: response.headers }
}

const expectStatus = async (status, path, options = {}) => {
  const result = await api(path, options)
  assert.equal(result.status, status,
    `${options.method || 'GET'} ${path}: expected ${status}, received ${result.status}: ${JSON.stringify(result.data)}`)
  return result
}

const userClient = () => createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false }
})

const createUser = async (label, metadata = {}) => {
  const email = `phase14-${label}-${runId}@example.test`
  const created = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: `Phase 14 ${label}`, ...metadata }
  })
  if (created.error) throw created.error
  createdUsers.push(created.data.user.id)
  const client = userClient()
  const signed = await client.auth.signInWithPassword({ email, password })
  if (signed.error) throw signed.error
  return { id: created.data.user.id, email, client,
    token: signed.data.session.access_token }
}

const createGuest = async () => {
  const client = userClient()
  const signed = await client.auth.signInAnonymously()
  if (signed.error) throw signed.error
  createdUsers.push(signed.data.user.id)
  return { id: signed.data.user.id, client, token: signed.data.session.access_token }
}

const setSettings = async (owner, changes) => {
  const current = await expectStatus(200, '/api/admin-chat/settings', { token: owner.token })
  const result = await expectStatus(200, '/api/admin-chat/settings', {
    token: owner.token, method: 'PUT', body: {
      expectedUpdatedAt: current.data.settings.updated_at,
      settings: { ...current.data.settings, ...changes }
    }
  })
  return result.data
}

const startConversation = (actor, details = {}) => expectStatus(200, '/api/chat/conversations', {
  token: actor.token, method: 'POST', body: {
    creationKey: uuid(), name: details.name || 'Phase 14 guest',
    email: details.email || `phase14-guest-${runId}@example.test`,
    mobile: details.mobile || null, orderId: details.orderId || null,
    ...(details.initialMessage ? { initialMessage: details.initialMessage, messageKey: uuid() } : {})
  }
})

const sendCustomer = (actor, conversationId, body, idempotencyKey = uuid()) =>
  api(`/api/chat/conversations/${conversationId}/messages`, {
    token: actor.token, method: 'POST', body: { body, idempotencyKey }
  })

const sendStaff = (actor, conversationId, body, isInternal = false, idempotencyKey = uuid()) =>
  api(`/api/admin-chat/conversations/${conversationId}/messages`, {
    token: actor.token, method: 'POST', body: { body, isInternal, idempotencyKey }
  })

const transition = (actor, conversationId, action, expectedRevision, targetId) =>
  api(`/api/admin-chat/conversations/${conversationId}/transition`, {
    token: actor.token, method: 'POST', body: { action, expectedRevision,
      ...(targetId ? { targetId } : {}) }
  })

const upload = (actor, conversationId, messageId, bytes, filename, mime, staff = false) => {
  const form = new FormData()
  form.append('messageId', messageId)
  form.append('attachmentId', uuid())
  form.append('file', new Blob([bytes], { type: mime }), filename)
  return api(`${staff ? '/api/admin-chat' : '/api/chat'}/conversations/${conversationId}/attachments`, {
    token: actor.token, method: 'POST', form
  })
}

const subscribe = async (actor, topic) => {
  actor.client.realtime.setAuth(actor.token)
  const events = []
  const channel = actor.client.channel(topic, { config: { private: true } })
    .on('broadcast', { event: 'changed' }, payload => events.push(payload.payload))
  channels.push(channel)
  const status = await new Promise(resolve => {
    const timer = setTimeout(() => resolve('TIMEOUT'), 12000)
    channel.subscribe(value => {
      if (['SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(value)) {
        clearTimeout(timer); resolve(value)
      }
    })
  })
  return { channel, events, status }
}

const subscribeRequired = async (actor, topic) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await subscribe(actor, topic)
    if (result.status === 'SUBSCRIBED') return result
    await result.channel.unsubscribe()
  }
  throw new Error(`Could not subscribe to required private topic: ${topic}`)
}

const waitFor = async (predicate, milliseconds = 10000) => {
  const end = Date.now() + milliseconds
  while (Date.now() < end) {
    if (predicate()) return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error('Timed out waiting for staging event')
}

let customerA, customerB, agentA, agentB, owner, outsider, guestA, guestB

try {
  const clearedLimits = await admin.from('chat_rate_limits').delete().neq('subject_hash', '')
  if (clearedLimits.error) throw clearedLimits.error
  const resetSettings = await admin.from('chat_settings')
    .update({ is_enabled: false, availability_override: 'offline',
      customer_send_cooldown_seconds: 4 })
    .eq('singleton', true)
  if (resetSettings.error) throw resetSettings.error
  const initialStatus = await expectStatus(200, '/api/chat/status')
  assert.equal(initialStatus.data.enabled, false)
  await expectStatus(401, '/api/chat/conversations')
  log('disabled-by-default and unauthenticated HTTP boundaries')

  ;[customerA, customerB, agentA, agentB, owner, outsider] = await Promise.all([
    createUser('customer-a'), createUser('customer-b'), createUser('agent-a'),
    createUser('agent-b'), createUser('admin'), createUser('outsider')
  ])
  ;[guestA, guestB] = await Promise.all([createGuest(), createGuest()])

  const supportPermissions = { 'support.view': true, 'support.reply': true, 'support.manage': true }
  const staffRows = [
    { id: agentA.id, email: agentA.email, full_name: 'Support Agent A', role: 'admin', permissions: supportPermissions },
    { id: agentB.id, email: agentB.email, full_name: 'Support Agent B', role: 'admin', permissions: supportPermissions },
    { id: owner.id, email: owner.email, full_name: 'Phase 14 Admin', role: 'owner', permissions: {} }
  ]
  const staffSeed = await admin.from('admin_users').upsert(staffRows)
  if (staffSeed.error) throw staffSeed.error

  const orderA = uuid(), orderB = uuid()
  const orders = await admin.from('customer_orders').insert([
    { id: orderA, user_id: customerA.id, order_number: `P14-A-${runId}`,
      first_name: 'Customer A', email: customerA.email, phone: '+966500000001',
      street_address: 'Staging Street', city: 'Riyadh', governorate: 'Riyadh' },
    { id: orderB, user_id: customerB.id, order_number: `P14-B-${runId}`,
      first_name: 'Customer B', email: customerB.email, phone: '+966500000002',
      street_address: 'Staging Street', city: 'Riyadh', governorate: 'Riyadh' }
  ])
  if (orders.error) throw orders.error
  log('Guest, Customer A/B, Support Agent A/B, Admin, and outsider identities')

  await setSettings(owner, {
    is_enabled: true, availability_override: 'online', business_timezone: 'Asia/Riyadh',
    weekly_hours: Object.fromEntries([...Array(7).keys()].map(day => [String(day), [['00:00', '23:59']]])),
    guest_contact_rule: 'either', customer_send_cooldown_seconds: 4,
    attachments_enabled: true, transfers_enabled: true, reopen_enabled: true,
    ticket_conversion_enabled: true, offline_behavior: 'conversation'
  })
  await Promise.all([agentA, agentB].map(actor => expectStatus(200, '/api/admin-chat/availability', {
    token: actor.token, method: 'POST', body: { state: 'online' }
  })))
  const online = await expectStatus(200, '/api/chat/status')
  assert.equal(online.data.available, true)
  assert.equal(online.data.cooldownSeconds, 4)
  log('admin settings, online availability, and four-second cooldown configuration')

  const guestBChat = (await startConversation(guestB, { initialMessage: 'Guest B private message' })).data.item
  const guestAChat = (await startConversation(guestA, { initialMessage: 'Guest A initial message' })).data.item
  await expectStatus(404, `/api/chat/conversations/${guestBChat.id}/messages`, { token: guestA.token })
  await expectStatus(403, '/api/chat/conversations', {
    token: guestA.token, method: 'POST', body: {
      creationKey: uuid(), name: 'Forged guest', email: 'guest@example.test', orderId: orderB
    }
  })
  const directGuestRead = await guestA.client.from('chat_conversations').select('id')
  check(Boolean(directGuestRead.error), 'browser role unexpectedly read chat_conversations directly')
  log('guest chat isolation, enumeration denial, order denial, and direct-table denial')

  await expectStatus(200, `/api/chat/conversations/${guestAChat.id}/identify`, {
    token: customerA.token, method: 'POST',
    headers: { 'x-chat-guest-authorization': `Bearer ${guestA.token}` },
    body: { expectedRevision: guestAChat.revision }
  })
  const linked = await expectStatus(200, '/api/chat/conversations', { token: customerA.token })
  assert.equal(linked.data.items[0].id, guestAChat.id)
  assert.equal((await expectStatus(200, '/api/chat/conversations', { token: guestA.token })).data.items.length, 0)
  await expectStatus(403, `/api/chat/conversations/${guestBChat.id}/identify`, {
    token: guestA.token, method: 'POST',
    headers: { 'x-chat-guest-authorization': `Bearer ${guestB.token}` },
    body: { expectedRevision: guestBChat.revision }
  })
  log('guest-to-account linking and guest-session detachment')

  const claims = await Promise.all([
    transition(agentA, guestAChat.id, 'claim', Number(guestAChat.revision) + 1),
    transition(agentB, guestAChat.id, 'claim', Number(guestAChat.revision) + 1)
  ])
  assert.deepEqual(claims.map(result => result.status).sort(), [200, 409])
  let assigned = claims.find(result => result.status === 200).data.item
  let currentAgent = assigned.assigned_admin_id === agentA.id ? agentA : agentB
  let otherAgent = currentAgent === agentA ? agentB : agentA
  await expectStatus(200, `/api/admin-chat/conversations/${guestAChat.id}/messages`, { token: otherAgent.token })
  const transferred = await transition(currentAgent, guestAChat.id, 'transfer', assigned.revision, otherAgent.id)
  assert.equal(transferred.status, 200)
  const staleAgentReply = await api(`/api/admin-chat/conversations/${guestAChat.id}/messages`, {
    token: currentAgent.token, method: 'POST', body: { body: 'Stale agent reply', isInternal: false, idempotencyKey: uuid() }
  })
  check([400, 403].includes(staleAgentReply.status), 'the transferred-from agent could still reply')
  assigned = transferred.data.item
  ;[currentAgent, otherAgent] = [otherAgent, currentAgent]
  log('single-winner claim and transfer while another agent has the chat open')

  const key = uuid()
  const retryBody = `One retry-safe customer message ${runId}`
  const duplicate = await Promise.all([
    sendCustomer(customerA, guestAChat.id, retryBody, key),
    sendCustomer(customerA, guestAChat.id, retryBody, key)
  ])
  assert.deepEqual(duplicate.map(result => result.status), [200, 200])
  assert.equal(duplicate[0].data.item.id, duplicate[1].data.item.id)
  const cooldown = await sendCustomer(customerA, guestAChat.id, 'Direct API cooldown bypass attempt')
  assert.equal(cooldown.status, 429)
  check(Number(cooldown.headers.get('retry-after')) >= 1, 'cooldown response omitted Retry-After')
  await setSettings(owner, { customer_send_cooldown_seconds: 0 })
  log('two-tab duplicate retry idempotency and direct four-second cooldown enforcement')

  const publicRealtime = await subscribeRequired(customerA, `chat:public:${guestAChat.id}`)
  const staffRealtime = await subscribeRequired(currentAgent, `chat:staff:${guestAChat.id}`)
  const outsiderRealtime = await subscribe(customerB, `chat:public:${guestAChat.id}`)
  check(outsiderRealtime.status !== 'SUBSCRIBED', 'Customer B subscribed to Customer A topic')

  const staffPublic = await sendStaff(currentAgent, guestAChat.id, 'Public agent response')
  assert.equal(staffPublic.status, 200)
  const internal = await sendStaff(currentAgent, guestAChat.id, 'Internal staging note', true)
  assert.equal(internal.status, 200)
  await waitFor(() => publicRealtime.events.some(event => event.messageId === staffPublic.data.item.id))
  await waitFor(() => staffRealtime.events.some(event => event.messageId === internal.data.item.id))
  check(!publicRealtime.events.some(event => event.messageId === internal.data.item.id),
    'internal note was broadcast to public topic')
  const customerMessages = await expectStatus(200,
    `/api/chat/conversations/${guestAChat.id}/messages`, { token: customerA.token })
  check(!customerMessages.data.items.some(item => item.is_internal || item.body === 'Internal staging note'),
    'customer transcript exposed an internal note')
  const customerList = await expectStatus(200, '/api/chat/conversations', { token: customerA.token })
  check(customerList.data.items[0].unreadCount >= 1, 'public staff reply did not set customer unread state')
  await expectStatus(200, `/api/chat/conversations/${guestAChat.id}/read`, {
    token: customerA.token, method: 'POST', body: { sequence: staffPublic.data.item.sequence_number }
  })
  log('private Realtime, reconnect-visible transcript, internal-note isolation, and unread/read state')

  assigned = (await expectStatus(200, `/api/chat/conversations/${guestAChat.id}`, {
    token: customerA.token
  })).data.item
  const wrongOrder = await expectStatus(403, `/api/chat/conversations/${guestAChat.id}/order`, {
    token: customerA.token, method: 'POST', body: { orderId: orderB, expectedRevision: assigned.revision }
  })
  assert.equal(wrongOrder.status, 403)
  const ownOrder = await expectStatus(200, `/api/chat/conversations/${guestAChat.id}/order`, {
    token: customerA.token, method: 'POST', body: { orderId: orderA, expectedRevision: assigned.revision }
  })
  assigned = ownOrder.data.item
  await expectStatus(404, `/api/chat/conversations/${guestAChat.id}/messages`, { token: customerB.token })
  log('owned-order linking and cross-account conversation denial')

  const attachmentMessage = await sendCustomer(customerA, guestAChat.id, 'Attachment follows')
  assert.equal(attachmentMessage.status, 200)
  const pdf = Buffer.from('%PDF-1.4\n% staging acceptance\n%%EOF\n')
  const uploaded = await upload(customerA, guestAChat.id, attachmentMessage.data.item.id,
    pdf, 'staging-proof.pdf', 'application/pdf')
  assert.equal(uploaded.status, 200, JSON.stringify(uploaded.data))
  const attachmentId = uploaded.data.item.id
  const downloaded = await expectStatus(200, `/api/chat/attachments/${attachmentId}`, { token: customerA.token })
  assert.deepEqual(downloaded.data, pdf)
  await expectStatus(404, `/api/chat/attachments/${attachmentId}`, { token: customerB.token })
  await expectStatus(401, `/api/chat/attachments/${attachmentId}`)
  const mismatch = await upload(customerA, guestAChat.id, attachmentMessage.data.item.id,
    Buffer.from('not a pdf'), 'bad.pdf', 'application/pdf')
  assert.equal(mismatch.status, 400)
  const publicStorage = await fetch(`${supabaseUrl}/storage/v1/object/public/chat-attachments/unknown`, {
    headers: { apikey: anonKey }
  })
  check(!publicStorage.ok, 'private attachment bucket allowed a public URL')

  const internalAttachment = await upload(currentAgent, guestAChat.id, internal.data.item.id,
    pdf, 'internal-proof.pdf', 'application/pdf', true)
  assert.equal(internalAttachment.status, 200, JSON.stringify(internalAttachment.data))
  await expectStatus(404, `/api/chat/attachments/${internalAttachment.data.item.id}`, { token: customerA.token })
  await expectStatus(200, `/api/admin-chat/attachments/${internalAttachment.data.item.id}`, { token: currentAgent.token })
  log('private public/internal attachment authorization and file validation')

  assigned = (await expectStatus(200, `/api/admin-chat/conversations/${guestAChat.id}`, {
    token: currentAgent.token
  })).data.item
  const ticket = await expectStatus(200, `/api/admin-chat/conversations/${guestAChat.id}/ticket`, {
    token: currentAgent.token, method: 'POST', body: {
      subject: 'Phase 14 linked ticket', expectedRevision: assigned.revision
    }
  })
  assert.equal(ticket.data.ticket.customer_id, customerA.id)
  assert.equal(ticket.data.ticket.order_id, orderA)
  const ticketRetry = await expectStatus(200, `/api/admin-chat/conversations/${guestAChat.id}/ticket`, {
    token: currentAgent.token, method: 'POST', body: {
      subject: 'Ignored retry subject', expectedRevision: 0
    }
  })
  assert.equal(ticketRetry.data.ticket.id, ticket.data.ticket.id)
  assigned = ticket.data.item
  log('chat-to-ticket relationship and idempotent conversion')

  const twoTabs = await Promise.all([
    expectStatus(200, `/api/chat/conversations/${guestAChat.id}/messages`, { token: customerA.token }),
    expectStatus(200, `/api/chat/conversations/${guestAChat.id}/messages`, { token: customerA.token })
  ])
  assert.deepEqual(twoTabs[0].data.items, twoTabs[1].data.items)
  const reconnect = await expectStatus(200,
    `/api/chat/conversations/${guestAChat.id}/messages?after=1`, { token: customerA.token })
  check(reconnect.data.items.length >= 1, 'reconnect reconciliation returned no permanent messages')
  log('two-tab state and network-reconnect transcript reconciliation')

  const closeRace = await Promise.all([
    sendCustomer(customerA, guestAChat.id, 'Message racing with close'),
    transition(currentAgent, guestAChat.id, 'close', assigned.revision)
  ])
  check([200, 409].includes(closeRace[0].status), 'unexpected customer close-race result')
  assert.equal(closeRace[1].status, 200, JSON.stringify(closeRace[1].data))
  const afterClose = await sendCustomer(customerA, guestAChat.id, 'Message after close')
  assert.equal(afterClose.status, 409)
  log('customer-send/agent-close race and intentional closed-chat denial')

  const emptyHours = Object.fromEntries([...Array(7).keys()].map(day => [String(day), []]))
  await setSettings(owner, { availability_override: 'auto', weekly_hours: emptyHours })
  assert.equal((await expectStatus(200, '/api/chat/status')).data.available, false)
  const offline = await startConversation(customerB, { initialMessage: 'Offline customer request' })
  assert.equal(offline.data.item.intake_mode, 'offline')
  const fullHours = Object.fromEntries([...Array(7).keys()].map(day => [String(day), [['00:00', '23:59']]]))
  await setSettings(owner, { availability_override: 'auto', weekly_hours: fullHours })
  await expectStatus(200, '/api/admin-chat/availability', {
    token: agentA.token, method: 'POST', body: { state: 'online' }
  })
  assert.equal((await expectStatus(200, '/api/chat/status')).data.available, true)
  const settingsAudit = await expectStatus(200, '/api/admin-chat/settings', { token: owner.token })
  check(settingsAudit.data.audit.length >= 3, 'settings audit did not record staging changes')
  log('offline intake, business hours, availability, and settings audit')

  const bChat = offline.data.item
  const bClaims = await Promise.all([
    transition(agentA, bChat.id, 'claim', bChat.revision),
    transition(agentB, bChat.id, 'claim', bChat.revision)
  ])
  assert.deepEqual(bClaims.map(result => result.status).sort(), [200, 409])
  const bAssigned = bClaims.find(result => result.status === 200).data.item
  const bAgent = bAssigned.assigned_admin_id === agentA.id ? agentA : agentB
  const bRace = await Promise.all([
    sendCustomer(customerB, bChat.id, 'Customer B racing close'),
    transition(bAgent, bChat.id, 'close', bAssigned.revision)
  ])
  check([200, 409].includes(bRace[0].status), 'unexpected second close-race result')
  assert.equal(bRace[1].status, 200)

  await expectStatus(403, '/api/admin-chat/conversations', { token: outsider.token })
  await expectStatus(403, `/api/admin-chat/conversations/${guestBChat.id}/transition`, {
    token: outsider.token, method: 'POST', body: {
      action: 'claim', expectedRevision: guestBChat.revision
    }
  })
  await expectStatus(403, `/api/admin-chat/conversations/${guestBChat.id}/context`, { token: outsider.token })
  const directCustomerRead = await customerA.client.from('chat_messages').select('id')
  check(Boolean(directCustomerRead.error), 'browser customer role read chat_messages directly')
  log('unauthorized staff and browser-role table/RPC boundaries')

  const finalSettings = await setSettings(owner, {
    is_enabled: false, availability_override: 'offline', customer_send_cooldown_seconds: 4
  })
  assert.equal(finalSettings.settings.is_enabled, false)

  const evidence = {
    runId,
    completedAt: new Date().toISOString(),
    stagingUrl: supabaseUrl,
    identities: {
      customerA: customerA.id, customerB: customerB.id,
      agentA: agentA.id, agentB: agentB.id, admin: owner.id,
      guestA: guestA.id, guestB: guestB.id, outsider: outsider.id
    },
    conversations: { linkedCustomerA: guestAChat.id, guestB: guestBChat.id, customerB: bChat.id },
    orderA, orderB, ticketId: ticket.data.ticket.id,
    attachmentId, checks: 17
  }
  await import('node:fs/promises').then(fs => fs.writeFile(
    '/tmp/elcomputer-phase14-acceptance-evidence.json', `${JSON.stringify(evidence, null, 2)}\n`,
    { mode: 0o600 }
  ))
  console.log(`STAGING ACCEPTANCE PASSED (${evidence.checks} groups)`)
} finally {
  await Promise.allSettled(channels.map(channel => channel.unsubscribe()))
  await admin.from('chat_settings').update({ is_enabled: false,
    availability_override: 'offline', customer_send_cooldown_seconds: 4 })
    .eq('singleton', true)
  for (const actor of [customerA, customerB, agentA, agentB, owner, outsider, guestA, guestB]) {
    actor?.client.realtime.disconnect()
  }
  admin.realtime.disconnect()
}
