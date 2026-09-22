import { getRequestIP } from 'h3'
import { chatError } from './liveChat'
import { chatNetworkContentHash, chatNetworkSubjectHash,
  isLocalChatProxyAddress } from './liveChatRateLimitIdentity'

export const enforceChatNetworkLimit = async (event, actor, action, body = null, retry = {}) => {
  const directAddress = getRequestIP(event)
  const trustForwarded = process.env.NUXT_TRUST_PROXY === 'true'
    || isLocalChatProxyAddress(directAddress)
  const address = getRequestIP(event, {
    xForwardedFor: trustForwarded
  })
  const secret = useRuntimeConfig().supabaseServiceRoleKey
  const networkHash = chatNetworkSubjectHash(address, actor.id, secret)
  const contentHash = body === null ? null : chatNetworkContentHash(networkHash, body, secret)
  const retryAware = action === 'message' || action === 'conversation_message'
  const { error } = await actor.supabase.rpc(retryAware
    ? 'chat_consume_network_limits_unless_retry' : 'chat_consume_network_limits', retryAware ? {
      p_network_hash: networkHash, p_action: action, p_content_hash: contentHash,
      p_actor_id: actor.id, p_actor_kind: actor.kind,
      p_conversation_id: retry.conversationId || null,
      p_creation_key: retry.creationKey || null,
      p_message_key: retry.messageKey || null,
      p_body: body
    } : {
      p_network_hash: networkHash,
      p_action: action,
      p_content_hash: contentHash
    })
  if (error) chatError(error, 'Could not validate this chat request.', event)
}
