import { createError, getQuery } from 'h3'
import { chatError, chatStaffFields, chatUnreadItem, chatUuid, loadChatUnreadSummary, requireChatStaff } from '../../../utils/liveChat'

export default defineEventHandler(async (event) => {
  const actor = await requireChatStaff(event)
  const query = getQuery(event)
  const view = String(query.view || (query.status ? 'all' : 'waiting')).trim()
  if (!['waiting', 'mine', 'active', 'unassigned', 'closed', 'offline', 'all'].includes(view)) {
    throw createError({ statusCode: 400, statusMessage: 'Inbox view is invalid.' })
  }
  const page = Number(query.page || 1)
  if (!Number.isInteger(page) || page < 1 || page > 100) {
    throw createError({ statusCode: 400, statusMessage: 'Page is invalid.' })
  }
  let request = actor.supabase.from('chat_conversations').select(chatStaffFields)
    .order('last_activity_at', { ascending: false }).order('id')
    .range((page - 1) * 50, page * 50)
  if (['waiting', 'active', 'closed'].includes(view)) request = request.eq('status', view)
  const status = String(query.status || '').trim()
  if (status) {
    if (!['waiting', 'active', 'closed'].includes(status)) throw createError({ statusCode: 400, statusMessage: 'Status is invalid.' })
    request = request.eq('status', status)
  }
  if (view === 'mine') request = request.eq('assigned_admin_id', actor.id).neq('status', 'closed')
  if (view === 'unassigned') request = request.is('assigned_admin_id', null).neq('status', 'closed')
  if (view === 'offline') request = request.eq('intake_mode', 'offline').neq('status', 'closed')

  const agent = String(query.agent || '').trim()
  if (agent) request = agent === 'unassigned'
    ? request.is('assigned_admin_id', null)
    : request.eq('assigned_admin_id', chatUuid(agent, 'Agent'))
  const kind = String(query.kind || '').trim()
  if (kind) {
    if (!['guest', 'customer'].includes(kind)) throw createError({ statusCode: 400, statusMessage: 'Customer type is invalid.' })
    request = request[kind === 'guest' ? 'not' : 'is']('customer_id', 'is', null)
  }
  const reference = String(query.reference || '').trim().replace(/^#/, '')
  if (reference) {
    if (!/^[1-9][0-9]{0,17}$/.test(reference)) throw createError({ statusCode: 400, statusMessage: 'Reference is invalid.' })
    request = request.eq('reference_number', reference)
  }
  const contact = String(query.contact || '').trim()
  if (contact) {
    if (contact.length > 100 || !/^[\p{L}\p{N}@+._ ()-]+$/u.test(contact)) {
      throw createError({ statusCode: 400, statusMessage: 'Contact search is invalid.' })
    }
    const field = contact.includes('@') ? 'contact_email'
      : /^[+0-9 ()-]+$/.test(contact) ? 'contact_mobile' : 'contact_name'
    request = request.ilike(field, `%${contact}%`)
  }
  const order = String(query.order || '').trim()
  if (order) request = request.eq('order_id', chatUuid(order, 'Order'))
  for (const key of ['from', 'to']) {
    const date = String(query[key] || '').trim()
    if (!date) continue
    const parsed = Date.parse(`${date}T00:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed)
      || new Date(parsed).toISOString().slice(0, 10) !== date) {
      throw createError({ statusCode: 400, statusMessage: 'Date is invalid.' })
    }
    request = key === 'from' ? request.gte('created_at', `${date}T00:00:00Z`)
      : request.lt('created_at', new Date(parsed + 86400000).toISOString())
  }
  const { data, error } = await request
  if (error) chatError(error, 'Could not load chat inbox.')
  const items = (data || []).slice(0, 50)
  const summaries = await loadChatUnreadSummary(actor, items.map(item => item.id))
  const waiting = await actor.supabase.from('chat_conversations')
    .select('id', { count: 'exact', head: true }).eq('status', 'waiting')
  if (waiting.error) chatError(waiting.error, 'Could not load waiting count.')
  return { items: items.map(item => chatUnreadItem(item, summaries)), page,
    hasMore: (data || []).length > 50, waitingCount: waiting.count || 0 }
})
