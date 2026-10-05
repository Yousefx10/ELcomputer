import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFile } from 'node:fs/promises'

// Exercise the real transport with stubbed DNS/HTTPS built-ins. No sockets exist.
const source = (await readFile(new URL('../server/utils/sms/transport.js', import.meta.url), 'utf8'))
  .replace("from 'node:dns/promises'", "from 'data:text/javascript,export const lookup=(...a)=>globalThis.smsTransportLookup(...a)'")
  .replace("from 'node:https'", "from 'data:text/javascript,export const request=(...a)=>globalThis.smsTransportRequest(...a)'")
const { postSmsXml } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
const url = new URL('https://sms.example.invalid/web2sms/sms/submit')
const publicAddress = { address: '8.8.8.8', family: 4 }

test('SMS transport enforces destination pinning, cancellation and uncertain POST outcomes', async t => {
  let calls = 0, options, capturedXml, behavior
  globalThis.smsTransportRequest = (_url, config, callback) => {
    calls++; options = config
    const req = new EventEmitter(), res = new EventEmitter()
    req.destroy = () => req.emit('error', Error('PRIVATE_TRANSPORT_DIAGNOSTIC'))
    res.destroy = () => res.emit('aborted')
    req.end = xml => { capturedXml = xml; queueMicrotask(() => behavior(req, res, callback)) }
    return req
  }
  try {
    await t.test('mixed public/private DNS never reaches HTTP; preflight failures permit retry', async () => {
      for (const address of ['127.0.0.1', '169.254.169.254', '2002:a00:1::1', '2001:0db8::1']) {
        globalThis.smsTransportLookup = async () => [publicAddress, { address, family: address.includes(':') ? 6 : 4 }]
        await assert.rejects(() => postSmsXml(url, '<xml/>', 100), { smsPreflight: true })
      }
      globalThis.smsTransportLookup = async () => { throw Error('PRIVATE_DNS_DIAGNOSTIC') }
      await assert.rejects(() => postSmsXml(url, '<xml/>', 100), error => error.smsPreflight === true && !error.message.includes('PRIVATE'))
      assert.equal(calls, 0)
    })
    await t.test('fresh lease callback runs after DNS and before the first HTTP operation', async () => {
      const order = []
      globalThis.smsTransportLookup = async () => { order.push('dns'); return [publicAddress] }
      await assert.rejects(() => postSmsXml(url, '<xml/>', 100, async () => { order.push('lease'); throw Object.assign(Error('Cancelled'), { smsNotSent: true }) }), { smsNotSent: true })
      assert.deepEqual(order, ['dns', 'lease']); assert.equal(calls, 0)
    })
    await t.test('HTTP pins a checked address, retains TLS hostname and modern bounded options', async () => {
      globalThis.smsTransportLookup = async () => [publicAddress, { address: '1.1.1.1', family: 4 }]
      behavior = (_req, res, callback) => { res.statusCode = 200; callback(res); res.emit('data', Buffer.from('مرحبا')); res.emit('end') }
      const result = await postSmsXml(url, '<xml>مرحبا</xml>', 100)
      assert.deepEqual(result, { status: 200, body: 'مرحبا' })
      assert.equal(capturedXml, '<xml>مرحبا</xml>')
      assert.equal(options.method, 'POST'); assert.equal(options.minVersion, 'TLSv1.2'); assert.equal(options.maxHeaderSize, 16384)
      assert.equal(options.headers['Content-Length'], Buffer.byteLength(capturedXml))
      assert.equal(options.headers['Content-Type'], 'application/xml; charset=UTF-8')
      options.lookup(url.hostname, {}, (error, address, family) => { assert.equal(error, null); assert.equal(address, publicAddress.address); assert.equal(family, 4) })
      options.lookup(url.hostname, { all: true }, (error, addresses) => { assert.equal(error, null); assert.deepEqual(addresses, [publicAddress]) })
    })
    await t.test('oversize, aborted and disconnected responses are uncertain and sanitized', async () => {
      for (const scenario of ['oversize', 'aborted', 'disconnect']) {
        behavior = (req, res, callback) => {
          res.statusCode = 200; callback(res)
          if (scenario === 'oversize') res.emit('data', Buffer.alloc(262145))
          else if (scenario === 'aborted') res.emit('aborted')
          else req.emit('error', Error('PRIVATE_PROVIDER_DIAGNOSTIC'))
        }
        await assert.rejects(() => postSmsXml(url, '<xml/>', 100), error => error.message === 'Uncertain provider result.' && !error.smsPreflight)
      }
    })
    await t.test('HTTP timeout destroys the request and remains uncertain', async () => {
      const keepAlive = setTimeout(() => {}, 1000)
      try {
        behavior = () => {}
        await assert.rejects(() => postSmsXml(url, '<xml/>', 10), error => error.message === 'Uncertain provider result.' && !error.smsPreflight)
      } finally { clearTimeout(keepAlive) }
    })
    await t.test('redirect response is returned without following its target', async () => {
      const before = calls
      behavior = (_req, res, callback) => { res.statusCode = 302; res.headers = { location: 'http://127.0.0.1/' }; callback(res); res.emit('end') }
      assert.equal((await postSmsXml(url, '<xml/>', 100)).status, 302)
      assert.equal(calls, before + 1)
    })
  } finally { delete globalThis.smsTransportLookup; delete globalThis.smsTransportRequest }
})
