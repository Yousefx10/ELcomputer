import { chatError, chatPublicFields, requireChatVisitor } from '../../../utils/liveChat'

export default defineEventHandler(async (event) => {
  const actor = await requireChatVisitor(event)
  const { data, error } = await actor.supabase.from('chat_conversations')
    .select(chatPublicFields)
    .eq(actor.kind === 'guest' ? 'guest_auth_user_id' : 'customer_id', actor.id)
    .order('created_at', { ascending: false }).limit(20)
  if (error) chatError(error, 'Could not load conversations.')
  return { items: data || [] }
})
