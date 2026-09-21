import { createError, getQuery } from 'h3'
import { chatError, chatRouteId, chatUuid, loadChatConversation, requireChatStaff } from '../../../../utils/liveChat'

const readCursor = value => {
  if (!value) return null
  if (typeof value !== 'string' || value.length > 300 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw createError({ statusCode: 400, statusMessage: 'Activity cursor is invalid.' })
  }
  try {
    const [createdAt, id] = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    if (typeof createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(createdAt)
      || Number.isNaN(Date.parse(createdAt))) {
      throw new Error('Invalid timestamp')
    }
    return { createdAt, id: chatUuid(id, 'Activity cursor') }
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Activity cursor is invalid.' })
  }
}

export default defineEventHandler(async (event) => {
  const actor = await requireChatStaff(event)
  const id = chatRouteId(event)
  await loadChatConversation(actor, id, true)
  const cursor = readCursor(getQuery(event).before)
  let request = actor.supabase.from('chat_events')
    .select('id,event_type,actor_kind,actor_name,old_assignee_name,new_assignee_name,old_value,new_value,created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(31)
  if (cursor) request = request.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`)
  const { data, error } = await request
  if (error) chatError(error, 'Could not load chat activity.')
  const rows = (data || []).slice(0, 30)
  const items = rows.map(row => ({
    id: row.id,
    event_type: row.event_type,
    actor_kind: row.actor_kind,
    actor_name: row.actor_name,
    old_assignee_name: row.old_assignee_name,
    new_assignee_name: row.new_assignee_name,
    old_status: row.old_value?.status || null,
    new_status: row.new_value?.status || null,
    old_order_id: row.event_type.startsWith('order_') ? row.old_value?.order_id || null : null,
    new_order_id: row.event_type.startsWith('order_') ? row.new_value?.order_id || null : null,
    ticket_id: row.event_type === 'ticket_created' ? row.new_value?.ticket_id || null : null,
    ticket_reference: row.event_type === 'ticket_created' ? row.new_value?.ticket_reference || null : null,
    created_at: row.created_at
  }))
  const last = rows.at(-1)
  return { items, hasMore: (data || []).length > 30,
    before: last ? Buffer.from(JSON.stringify([last.created_at, last.id])).toString('base64url') : null }
})
