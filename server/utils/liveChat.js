import { createHash } from 'node:crypto'
import { createError, getHeader, getRouterParam } from 'h3'
import { requireAdminRequest } from './adminRequest'
import { getSupabaseAdminClient } from './supabaseAdmin'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const mobilePattern = /^\+?[0-9 ()-]{7,30}$/
export const chatPublicFields = 'id,reference_number,status,intake_mode,contact_name,contact_email,contact_mobile,order_id,ticket_id,revision,last_customer_message_seq,last_staff_message_seq,last_activity_at,created_at,updated_at,closed_at'
export const chatStaffFields = `${chatPublicFields},customer_id,guest_auth_user_id,assigned_admin_id`
const chatMessageFields = 'id,sequence_number,sender_kind,sender_name,body,is_internal,created_at'

export const chatUuid = (value, label = 'Conversation') => {
  if (typeof value !== 'string' || !uuidPattern.test(value)) {
    throw createError({ statusCode: 400, statusMessage: `${label} is invalid.` })
  }
  return value
}

export const chatRouteId = event => chatUuid(getRouterParam(event, 'id'))
export const chatActorHash = id => createHash('sha256').update(`chat:actor:${id}`).digest('hex')

export const chatContact = (name, email, mobile) => {
  const result = {
    name: String(name || '').trim(),
    email: String(email || '').trim().toLowerCase() || null,
    mobile: String(mobile || '').trim() || null
  }
  if (!result.name || result.name.length > 160) {
    throw createError({ statusCode: 400, statusMessage: 'Enter your name.' })
  }
  if (result.email && (result.email.length > 320 || !emailPattern.test(result.email))) {
    throw createError({ statusCode: 400, statusMessage: 'Enter a valid email.' })
  }
  if (result.mobile && !mobilePattern.test(result.mobile)) {
    throw createError({ statusCode: 400, statusMessage: 'Enter a valid mobile number.' })
  }
  if (!result.email && !result.mobile) {
    throw createError({ statusCode: 400, statusMessage: 'Enter an email or mobile number.' })
  }
  return result
}

export const chatError = (error, fallback = 'Could not complete the chat request.') => {
  if (['42P01', '42703', '42883', 'PGRST202', 'PGRST205'].includes(error?.code)) {
    throw createError({ statusCode: 503, statusMessage: 'Live chat is not installed yet.' })
  }
  const named = {
    CHAT_DISABLED: [409, 'Live chat is unavailable.'],
    CHAT_CLOSED: [409, 'This conversation is closed.'],
    CHAT_COOLDOWN: [429, 'Please wait before sending another message.'],
    CHAT_RATE_LIMIT: [429, 'Please wait before trying again.'],
    CHAT_DUPLICATE: [429, 'This message was just sent.'],
    CHAT_KEY_CONFLICT: [409, 'Submission key was used for another message.'],
    CHAT_STALE: [409, 'Conversation changed. Refresh and try again.'],
    CHAT_ALREADY_ASSIGNED: [409, 'Another agent claimed this conversation.'],
    CHAT_TARGET_UNAVAILABLE: [409, 'That agent is no longer available for chat.'],
    CHAT_TRANSITION_DENIED: [409, 'This conversation cannot be changed.'],
    CHAT_ORDER_DENIED: [403, 'This order cannot be linked to the conversation.'],
    CHAT_IDENTIFY_DENIED: [403, 'This guest conversation cannot be linked.'],
    CHAT_ACCOUNT_BUSY: [409, 'Your account already has an open chat. Close it first.']
  }[error?.message]
  if (named) throw createError({ statusCode: named[0], statusMessage: named[1] })
  if (error?.code === 'P0002') throw createError({ statusCode: 404, statusMessage: 'Conversation not found.' })
  if (error?.code === '42501') throw createError({ statusCode: 403, statusMessage: 'Chat access denied.' })
  if (['22023', '23503', '23514'].includes(error?.code)) {
    throw createError({ statusCode: 400, statusMessage: 'Chat details are invalid.' })
  }
  console.error('Live chat database error:', error)
  throw createError({ statusCode: 500, statusMessage: fallback })
}

// Stream with a hard cap; a missing or false Content-Length cannot bypass it.
export const readChatJson = async event => {
  const declared = Number(getHeader(event, 'content-length') || 0)
  if (declared > 16384) throw createError({ statusCode: 413, statusMessage: 'Chat request is too large.' })
  let size = 0
  const chunks = []
  for await (const chunk of event.node.req) {
    size += chunk.length
    if (size > 16384) throw createError({ statusCode: 413, statusMessage: 'Chat request is too large.' })
    chunks.push(chunk)
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid body')
    return body
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Send a valid JSON object.' })
  }
}

export const requireChatVisitor = async event => {
  const bearer = getHeader(event, 'authorization')
  if (!bearer?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, statusMessage: 'Missing authorization token.' })
  }
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase.auth.getUser(bearer.slice(7))
  if (error || !data?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid or expired session.' })
  }
  const user = data.user
  if (user.is_anonymous === true) return { supabase, id: user.id, kind: 'guest', profile: null }
  const result = await supabase.from('customer_profiles').select('id,full_name,email,phone,is_active')
    .eq('id', user.id).maybeSingle()
  if (result.error) chatError(result.error, 'Could not load customer account.')
  if (!result.data?.is_active) {
    throw createError({ statusCode: 403, statusMessage: 'A current customer account is required.' })
  }
  return { supabase, id: user.id, kind: 'customer', profile: result.data }
}

export const requireChatStaff = async (event, permission = 'support.view') => {
  const actor = await requireAdminRequest(event, { permission })
  if (actor.authUser.is_anonymous === true) {
    throw createError({ statusCode: 403, statusMessage: 'Staff account required.' })
  }
  return { supabase: actor.supabaseAdmin, id: actor.authUser.id,
    name: actor.adminUser.full_name || actor.adminUser.name || actor.authUser.email || 'Support agent',
    adminUser: actor.adminUser, kind: 'staff' }
}

export const loadChatConversation = async (actor, id, staff = false) => {
  let request = actor.supabase.from('chat_conversations')
    .select(staff ? chatStaffFields : chatPublicFields).eq('id', chatUuid(id))
  if (!staff) request = request.eq(actor.kind === 'guest' ? 'guest_auth_user_id' : 'customer_id', actor.id)
  const { data, error } = await request.maybeSingle()
  if (error) chatError(error, 'Could not load conversation.')
  if (!data) throw createError({ statusCode: 404, statusMessage: 'Conversation not found.' })
  return data
}

export const chatCursor = value => {
  if (value === undefined || value === null || value === '') return null
  const cursor = String(value)
  if (!/^[1-9][0-9]{0,17}$/.test(cursor)) {
    throw createError({ statusCode: 400, statusMessage: 'Message cursor is invalid.' })
  }
  return cursor
}

export const loadChatMessages = async (actor, conversationId, query = {}, staff = false) => {
  const before = chatCursor(query.before)
  const after = chatCursor(query.after)
  if (before && after) throw createError({ statusCode: 400, statusMessage: 'Choose one message cursor.' })
  let request = actor.supabase.from('chat_messages').select(chatMessageFields)
    .eq('conversation_id', conversationId).order('sequence_number', { ascending: Boolean(after) }).limit(51)
  if (!staff) request = request.eq('is_internal', false)
  if (before) request = request.lt('sequence_number', before)
  if (after) request = request.gt('sequence_number', after)
  const { data, error } = await request
  if (error) chatError(error, 'Could not load messages.')
  const hasMore = (data || []).length > 50
  const items = (data || []).slice(0, 50)
  if (!after) items.reverse()
  return { items, hasMore, before: items[0]?.sequence_number || null,
    after: items.at(-1)?.sequence_number || null }
}

export const loadChatUnreadSummary = async (actor, ids = []) => {
  if (!ids.length) return new Map()
  const { data, error } = await actor.supabase.rpc('chat_unread_summary', {
    p_actor_id: actor.id, p_actor_kind: actor.kind, p_conversation_ids: ids
  })
  if (error) chatError(error, 'Could not load unread chats.')
  return new Map((data || []).map(row => [row.conversation_id, {
    unreadCount: Number(row.unread_count || 0),
    lastReadSequence: Number(row.last_read_sequence || 0)
  }]))
}

export const chatUnreadItem = (item, summaries) => ({
  ...item, ...(summaries.get(item.id) || { unreadCount: 0, lastReadSequence: 0 })
})
