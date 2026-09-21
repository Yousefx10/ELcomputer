import { chatError, chatPublicFields, chatUnreadItem, loadChatUnreadSummary, requireChatVisitor } from '../../../utils/liveChat'

export default defineEventHandler(async (event) => {
  const actor = await requireChatVisitor(event)
  const { data, error } = await actor.supabase.from('chat_conversations')
    .select(chatPublicFields)
    .eq(actor.kind === 'guest' ? 'guest_auth_user_id' : 'customer_id', actor.id)
    .order('created_at', { ascending: false }).limit(20)
  if (error) chatError(error, 'Could not load conversations.')
  const summaries = await loadChatUnreadSummary(actor, (data || []).map(item => item.id))
  return { items: (data || []).map(item => chatUnreadItem(item, summaries)) }
})
