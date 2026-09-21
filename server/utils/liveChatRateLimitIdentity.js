import { createHmac } from 'node:crypto'
import { isIP } from 'node:net'

const hmac = (secret, value) => {
  if (typeof secret !== 'string' || !secret) throw new TypeError('Chat rate-limit secret is unavailable.')
  return createHmac('sha256', secret).update(value).digest('hex')
}

const embeddedIpv4 = (value) => {
  const index = value.lastIndexOf(':')
  if (index < 0 || isIP(value.slice(index + 1)) !== 4) return value
  const bytes = value.slice(index + 1).split('.').map(Number)
  return `${value.slice(0, index)}:${((bytes[0] << 8) | bytes[1]).toString(16)}:${((bytes[2] << 8) | bytes[3]).toString(16)}`
}

const ipv6Prefix = (value) => {
  const address = embeddedIpv4(value)
  const halves = address.split('::')
  if (halves.length > 2) return null
  const left = halves[0] ? halves[0].split(':') : []
  const right = halves[1] ? halves[1].split(':') : []
  const missing = halves.length === 2 ? 8 - left.length - right.length : 0
  const parts = [...left, ...Array(missing).fill('0'), ...right]
  if (parts.length !== 8 || parts.some(part => !/^[0-9a-f]{1,4}$/i.test(part))) return null
  return `${parts.slice(0, 4).map(part => part.toLowerCase().padStart(4, '0')).join(':')}::/64`
}

export const normalizeChatNetworkAddress = (source) => {
  let value = String(source || '').trim().toLowerCase()
  if (value.startsWith('[') && value.endsWith(']')) value = value.slice(1, -1)
  value = value.split('%', 1)[0]
  if (value.startsWith('::ffff:') && isIP(value.slice(7)) === 4) value = value.slice(7)
  const version = isIP(value)
  if (version === 4) return value
  if (version === 6) return ipv6Prefix(value)
  return null
}

export const isLocalChatProxyAddress = (source) => {
  const value = String(source || '').trim().toLowerCase().replace(/^\[|\]$/g, '')
    .split('%', 1)[0]
  if (value === '::1') return true
  const ipv4 = value.startsWith('::ffff:') ? value.slice(7) : value
  return isIP(ipv4) === 4 && ipv4.split('.')[0] === '127'
}

export const chatNetworkSubjectHash = (address, fallbackActorId, secret) => {
  const normalized = normalizeChatNetworkAddress(address)
  const subject = normalized ? `network:${normalized}` : `actor-fallback:${fallbackActorId}`
  return hmac(secret, `chat:${subject}`)
}

export const chatNetworkContentHash = (networkHash, body, secret) => {
  const normalized = String(body || '').normalize('NFKC').trim().toLowerCase()
    .replace(/\s+/gu, ' ')
  if (normalized.length < 12) return null
  return hmac(secret, `chat:network-content:${networkHash}:${normalized}`)
}
