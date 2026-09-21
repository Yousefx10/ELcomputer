import { getRequestIP } from 'h3'
import { chatError } from './liveChat'
import { chatNetworkContentHash, chatNetworkSubjectHash,
  isLocalChatProxyAddress } from './liveChatRateLimitIdentity'

export const enforceChatNetworkLimit = async (event, actor, action, body = null) => {
  const directAddress = getRequestIP(event)
  const trustForwarded = process.env.NUXT_TRUST_PROXY === 'true'
    || isLocalChatProxyAddress(directAddress)
  const address = getRequestIP(event, {
    xForwardedFor: trustForwarded
  })
  const secret = useRuntimeConfig().supabaseServiceRoleKey
  const networkHash = chatNetworkSubjectHash(address, actor.id, secret)
  const contentHash = body === null ? null : chatNetworkContentHash(networkHash, body, secret)
  const { error } = await actor.supabase.rpc('chat_consume_network_limits', {
    p_network_hash: networkHash,
    p_action: action,
    p_content_hash: contentHash
  })
  if (error) chatError(error, 'Could not validate this chat request.', event)
}
