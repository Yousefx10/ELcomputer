import { chatError, requireChatStaff } from '../../utils/liveChat'

export default defineEventHandler(async (event) => {
  const actor = await requireChatStaff(event, 'support.reply')
  const { data, error } = await actor.supabase.from('chat_agent_availability')
    .select('declared_state,lease_expires_at').eq('admin_id', actor.id).maybeSingle()
  if (error) chatError(error, 'Could not load availability.')
  const current = data?.declared_state === 'online'
    && new Date(data.lease_expires_at).getTime() > Date.now()
  return { state: current ? 'online' : data?.declared_state === 'away' ? 'away' : 'offline',
    leaseExpiresAt: current ? data.lease_expires_at : null }
})
