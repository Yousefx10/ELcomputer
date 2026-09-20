import { createError, getQuery } from 'h3'
import { chatError, chatStaffFields, requireChatStaff } from '../../../utils/liveChat'

export default defineEventHandler(async (event) => {
  const actor = await requireChatStaff(event)
  const query = getQuery(event)
  const status = String(query.status || '').trim()
  if (status && !['waiting', 'active', 'closed'].includes(status)) {
    throw createError({ statusCode: 400, statusMessage: 'Status is invalid.' })
  }
  const page = Number(query.page || 1)
  if (!Number.isInteger(page) || page < 1 || page > 100) {
    throw createError({ statusCode: 400, statusMessage: 'Page is invalid.' })
  }
  let request = actor.supabase.from('chat_conversations').select(chatStaffFields)
    .order('last_activity_at', { ascending: false }).order('id')
    .range((page - 1) * 50, page * 50)
  if (status) request = request.eq('status', status)
  const { data, error } = await request
  if (error) chatError(error, 'Could not load chat inbox.')
  return { items: (data || []).slice(0, 50), page, hasMore: (data || []).length > 50 }
})
