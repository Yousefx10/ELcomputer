import { lookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'
import { request as httpsRequest } from 'node:https'

// Numeric CIDR checks also cover alternate IPv6 spellings. Conservatively exclude
// IANA special-purpose and transition ranges from merchant-configured destinations.
const blocked = new BlockList()
for (const [address, prefix] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]]) blocked.addSubnet(address, prefix, 'ipv4')
for (const [address, prefix] of [['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20]]) blocked.addSubnet(address, prefix, 'ipv6')
const globalV6 = new BlockList()
globalV6.addSubnet('2000::', 3, 'ipv6')
export const isPublicSmsAddress = raw => {
  if (typeof raw !== 'string') return false
  const address = raw.toLowerCase().replace(/^\[|\]$/g, '')
  const family = isIP(address)
  if (family === 4) return !blocked.check(address, 'ipv4')
  return family === 6 && globalV6.check(address, 'ipv6') && !blocked.check(address, 'ipv6')
}
export const validateSmsBaseUrl = value => {
  if (value === '') return ''
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || url.port) throw Error()
    const host = url.hostname.replace(/^\[|\]$/g, '')
    if (isIP(host) ? !isPublicSmsAddress(host) : !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(host)) throw Error()
    return url.origin
  } catch { throw new Error('Use a public HTTPS server without a port or path.') }
}

// Resolve once, check every DNS result, and pin the connection to a checked IP.
// No redirects, external entities, raw provider diagnostics, or TLS downgrade.
export const postSmsXml = async (url, xml, timeoutMs, beforeDispatch) => {
  let addresses
  let dnsTimer
  try {
    addresses = await Promise.race([
      lookup(url.hostname.replace(/^\[|\]$/g, ''), { all: true }),
      new Promise((_, reject) => { dnsTimer = setTimeout(() => reject(Error()), timeoutMs); dnsTimer.unref?.() })
    ])
    if (!addresses.length || addresses.some(item => !isPublicSmsAddress(item.address))) throw Error()
  } catch {
    const error = new Error('Provider connection preflight failed.')
    error.smsPreflight = true
    throw error
  } finally { clearTimeout(dnsTimer) }
  if (beforeDispatch) await beforeDispatch()
  return new Promise((resolve, reject) => {
    let settled = false, size = 0
    const chunks = []
    const fail = () => { if (!settled) { settled = true; clearTimeout(timer); reject(new Error('Uncertain provider result.')) } }
    const req = httpsRequest(url, {
      method: 'POST', minVersion: 'TLSv1.2', maxHeaderSize: 16384,
      headers: { 'Content-Type': 'application/xml; charset=UTF-8', Accept: 'application/xml', 'Content-Length': Buffer.byteLength(xml) },
      lookup: (_hostname, options, callback) => options.all ? callback(null, [addresses[0]]) : callback(null, addresses[0].address, addresses[0].family)
    }, res => {
      res.on('data', chunk => { size += chunk.length; if (size > 262144) { res.destroy(); req.destroy(); fail() } else chunks.push(chunk) })
      res.once('error', fail).once('aborted', fail)
      res.once('end', () => { if (!settled) { settled = true; clearTimeout(timer); resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }) } })
    })
    const timer = setTimeout(() => { req.destroy(); fail() }, timeoutMs)
    timer.unref?.()
    req.once('error', fail)
    req.end(xml)
  })
}
