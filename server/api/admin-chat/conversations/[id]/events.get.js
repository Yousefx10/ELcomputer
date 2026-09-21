import { chatError, chatRouteId, loadChatConversation, requireChatStaff } from '../../../../utils/liveChat'

export default defineEventHandler(async (event) => {
  const actor = await requireChatStaff(event)
  const id = chatRouteId(event)
  await loadChatConversation(actor, id, true)
  const { data, error } = await actor.supabase.from('chat_events')
    .select('id,event_type,actor_id,actor_kind,created_at')
    .eq('conversation_id', id).order('created_at', { ascending: false }).limit(30)
  if (error) chatError(error, 'Could not load chat activity.')
  return { items: data || [] }
})
