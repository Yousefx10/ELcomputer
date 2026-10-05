import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { request as httpsRequest } from 'node:https'

export const isPublicSmsAddress = raw => {
  const address = raw.toLowerCase().replace(/^\[|\]$/g, '')
  if (isIP(address) === 4) {
    const [a, b, c] = address.split('.').map(Number)
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a === 100 && b >= 64 && b <= 127 || a === 192 && b === 0 || a === 192 && b === 0 && c === 2 || a === 198 && [18, 19, 51].includes(b) || a === 203 && b === 0 && c === 113)
  }
  // Only global-unicast IPv6; reject IPv4-mapped, local, multicast and documentation.
  return isIP(address) === 6 && /^[23][0-9a-f]{3}:/.test(address) && !address.startsWith('2001:db8:')
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
