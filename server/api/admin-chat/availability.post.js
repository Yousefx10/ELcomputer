import { createError } from 'h3'
import { chatError, readChatJson, requireChatStaff } from '../../utils/liveChat'

export default defineEventHandler(async (event) => {
  const actor = await requireChatStaff(event, 'support.reply')
  const body = await readChatJson(event)
  if (!['online', 'away', 'offline'].includes(body.state)) {
    throw createError({ statusCode: 400, statusMessage: 'Availability state is invalid.' })
  }
  const { data, error } = await actor.supabase.rpc('chat_set_agent_availability', {
    p_admin_id: actor.id, p_state: body.state
  })
  if (error) chatError(error, 'Could not update availability.')
  return { state: data?.[0]?.declared_state || body.state,
    leaseExpiresAt: data?.[0]?.lease_expires_at || null }
})
