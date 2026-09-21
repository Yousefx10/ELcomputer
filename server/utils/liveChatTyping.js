import { chatActorHash, chatError } from './liveChat'

export const relayChatTyping = async (actor, conversationId, topic, kind) => {
  const { error } = await actor.supabase.rpc('chat_consume_limit', {
    p_scope: 'typing', p_subject_hash: chatActorHash(`${actor.id}:${conversationId}`),
    p_window_seconds: 10, p_max: 3
  })
  if (error) chatError(error, 'Could not send typing signal.')
  const channel = actor.supabase.channel(topic, { config: { private: true } })
  try {
    const result = await channel.httpSend('typing', { kind, conversationId, expiresAt: Date.now() + 6000 })
    return { sent: result.success === true }
  } finally {
    await actor.supabase.removeChannel(channel)
  }
}
