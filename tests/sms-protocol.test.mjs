import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { vodafoneHash, buildVodafoneXml, parseVodafoneXml, escapeSmsXml, VODAFONE_NAMESPACE, vodafoneProvider } from '../server/utils/sms/vodafone.js'
import { normalizeVodafoneError, vodafoneErrors } from '../server/utils/sms/errors.js'
import { isPublicSmsAddress, validateSmsBaseUrl } from '../server/utils/sms/transport.js'
import { estimateSmsSegments, normalizeSmsPhone, renderSmsTemplate, smsTemplateVariables } from '../app/utils/sms.js'

// Supplied V5 public example values are test fixtures only, never configuration.
const secret = '0BAF4EACBFB84A1A87574DFEFC41525F'
const messages = [
  { sender: 'sender1', recipient: '201000000000', text: 'text1' },
  { sender: 'sender2', recipient: '201100000000', text: 'text2' },
  { sender: 'sender3', recipient: '201500000000', text: 'text3' }
]
const fixture = { accountId: '1', password: 'password', messages, externalTrxId: '2025-01-18 15:44:00' }
const response = (statuses, result = 'SUCCESS', code = null) => `<SubmitSMSResponse xmlns="${VODAFONE_NAMESPACE}">${statuses.map(status => `<SMSStatus>${status}</SMSStatus>`).join('')}<ResultStatus>${result}</ResultStatus>${code ? `<Description>${code}</Description>` : ''}</SubmitSMSResponse>`

// Vodafone support INC000081856720 confirms literal uppercase HEX string keys.
test('provider-confirmed literal key reproduces the one-message and multi-message PDF hashes', () => {
  assert.equal(vodafoneHash({ ...fixture, messages: messages.slice(0, 1) }, secret), '70A7BE2DBCAF15C1544E4CD9EC520FC91426C06C1EF0B87D68EFF8BB0A56268D')
  assert.equal(vodafoneHash(fixture, secret), '60A7042DE62B10D268C516A575301959011EBEF8C6DB4AC67AFB314BE86C7BCD')
  assert.notEqual(vodafoneHash({ ...fixture, messages: [...messages].reverse() }, secret), vodafoneHash(fixture, secret))
  const arabic = { accountId: '42', password: 'p', messages: [{ sender: 'Brand', recipient: '201000000000', text: 'مرحبا & = €' }] }
  const expected = createHmac('sha256', secret).update('AccountId=42&Password=p&SenderName=Brand&ReceiverMSISDN=201000000000&SMSText=مرحبا & = €', 'utf8').digest('hex').toUpperCase()
  assert.equal(vodafoneHash(arabic, secret), expected)
})
test('literal string bytes are used directly, never HEX-decoded, with exact field and SMSList order', () => {
  const input = 'AccountId=1&Password=password&SenderName=sender1&ReceiverMSISDN=201000000000&SMSText=text1&SenderName=sender2&ReceiverMSISDN=201100000000&SMSText=text2&SenderName=sender3&ReceiverMSISDN=201500000000&SMSText=text3&ExternalTrxId=2025-01-18 15:44:00'
  assert.equal(vodafoneHash(fixture, secret), createHmac('sha256', secret).update(input, 'utf8').digest('hex').toUpperCase())
  assert.notEqual(vodafoneHash(fixture, secret), createHmac('sha256', Buffer.from(secret, 'hex')).update(input, 'utf8').digest('hex').toUpperCase())
  assert.notEqual(vodafoneHash(fixture, secret), createHmac('sha256', secret).update(input.replace('AccountId=1&Password=password', 'Password=password&AccountId=1'), 'utf8').digest('hex').toUpperCase())
  const exampleSecret = 'A1B2C3D4E5F6'
  assert.equal(vodafoneHash(fixture, exampleSecret), createHmac('sha256', exampleSecret).update(input, 'utf8').digest('hex').toUpperCase())
})
test('ExternalTrxId omitted differs from present/empty, and invalid literal keys fail', () => {
  const { externalTrxId, ...without } = fixture
  const input = 'AccountId=1&Password=password&' + messages.map(m => `SenderName=${m.sender}&ReceiverMSISDN=${m.recipient}&SMSText=${m.text}`).join('&')
  assert.equal(vodafoneHash(without, secret), createHmac('sha256', secret).update(input, 'utf8').digest('hex').toUpperCase())
  assert.equal(vodafoneHash(without, secret), '2B26B16FB32F2F2EC78BB95525B9A122C5DD45DB73F21DFACC010159C5E2D736')
  assert.equal(vodafoneHash({ ...without, externalTrxId: '' }, secret), createHmac('sha256', secret).update(input + '&ExternalTrxId=', 'utf8').digest('hex').toUpperCase())
  assert.equal(vodafoneHash({ ...without, externalTrxId: '' }, secret), 'B4333E0ADC6F8FDDC0C2AC74086A59FAC23E8E4F6B683E96C84A3B99F815C8FB')
  assert.notEqual(vodafoneHash(without, secret), vodafoneHash({ ...without, externalTrxId: '' }, secret))
  for (const bad of [secret.toLowerCase(), 'A1B2g3', ' A1B2', 'A1B2 ', 'A1B2\n', '0xA1B2', 'A'.repeat(513), '', null, 123]) assert.throws(() => vodafoneHash(fixture, bad), /Invalid Secure Hash Secret/)
  for (const valid of ['A1B2C3D4E5F6', 'ABC', 'A'.repeat(512)]) assert.match(vodafoneHash(fixture, valid), /^[0-9A-F]{64}$/)
})
test('serializer uses exact namespace/order and escapes text after hashing, preserving carriage returns', () => {
  const request = { ...fixture, messages: [{ ...messages[0], text: '<node>" & \'\rمرحبا' }] }
  const xml = buildVodafoneXml(request, secret)
  assert.ok(xml.includes(VODAFONE_NAMESPACE)); assert.ok(xml.includes('&lt;node&gt;&quot; &amp; &apos;&#13;مرحبا'))
  assert.ok(xml.indexOf('<SecureHash>') < xml.indexOf('<SMSList>')); assert.ok(xml.indexOf('</SMSList>') < xml.indexOf('<ExternalTrxId>'))
  assert.ok(xml.includes(vodafoneHash(request, secret)))
  for (const bad of ['\x00', '\ud800', '\ufffe']) assert.throws(() => escapeSmsXml(bad))
})
test('bounded strict XML handles successful and mixed ordered submissions', () => {
  assert.deepEqual(parseVodafoneXml(response(['SUBMITTED', 'FAILED_TO_SUBMITTED', 'SUSPENDED']), 3).messages.map(m => [m.status, m.category]), [['submitted', null], ['failed', 'provider_rate'], ['failed', 'suspended']])
  assert.equal(parseVodafoneXml(response(['INVALID']), 1).messages[0].category, 'invalid_message')
  assert.equal(parseVodafoneXml(response([], 'INVALID_REQUEST', 9013), 1).category, 'trusted_ip')
  assert.equal(parseVodafoneXml(response([], 'GENERIC_ERROR', 9038), 1).error_code, 9038)
})
test('reject malformed XML, XXE, entity bombs, wrong namespace, count mismatch and raw errors', () => {
  for (const xml of ['<broken>', response(['SUBMITTED']).replace(VODAFONE_NAMESPACE, 'urn:fake'), response([], 'SUCCESS'), response(['NOT_A_STATUS']), response([], 'INVALID_REQUEST', 'private-secret'), '<!DOCTYPE a [<!ENTITY x SYSTEM "file:///etc/passwd">]>' + response(['SUBMITTED']), '<!DOCTYPE a [<!ENTITY x "hello">]>' + response(['SUBMITTED']), response(['SUBMITTED']).replace('</ResultStatus>', '</ResultStatus><ResultStatus>SUCCESS</ResultStatus>'), 'x'.repeat(262145)]) assert.throws(() => parseVodafoneXml(xml, 1), /Invalid provider XML/)
  const prefixed = `<v:SubmitSMSResponse xmlns:v="${VODAFONE_NAMESPACE}"><v:SMSStatus>SUBMITTED</v:SMSStatus><v:ResultStatus>SUCCESS</v:ResultStatus></v:SubmitSMSResponse>`
  assert.equal(parseVodafoneXml(prefixed, 1).messages[0].status, 'submitted')
})
test('all V5 error codes are centralized, including trusted IP, password, hash, number and sender', () => {
  assert.equal(Object.keys(vodafoneErrors).length, 34)
  for (const [code, category] of [[9013, 'trusted_ip'], [9014, 'password'], [9021, 'secure_hash'], [9023, 'invalid_msisdn'], [9034, 'sender']]) assert.equal(normalizeVodafoneError(code).category, category)
  assert.deepEqual(normalizeVodafoneError('secret'), { code: null, category: 'provider_error', description: 'Provider rejected the request.' })
})
test('provider routes Notification and Campaign separately through mocked XML POST', async () => {
  const paths = []
  const settings = { base_url: 'https://sms.example.invalid', notification_path: '/web2sms/sms/submit/Notification', campaign_path: '/web2sms/sms/submit', port: 8443, timeout_ms: 10000 }
  const transport = async (url, xml, timeout) => { paths.push(url.pathname); assert.equal(url.protocol, 'https:'); assert.equal(url.port, '8443'); assert.equal(timeout, 10000); assert.ok(xml.includes('<ReceiverMSISDN>201000000000</ReceiverMSISDN>')); return { status: 200, body: response(['SUBMITTED']) } }
  for (const traffic_type of ['notification', 'campaign']) await vodafoneProvider.submit(settings, { accountId: '1', password: 'password', hashSecret: secret }, { traffic_type, external_trx_id: 'fixture-uuid' }, [{ sender: 'sender1', recipient: '+201000000000', body: 'text1' }], transport)
  assert.deepEqual(paths, ['/web2sms/sms/submit/Notification', '/web2sms/sms/submit'])
})
test('provider rejects unknown traffic, bulk Notification and swapped paths before transport', async () => {
  const settings = { base_url: 'https://sms.example.invalid', notification_path: '/web2sms/sms/submit/Notification', campaign_path: '/web2sms/sms/submit' }
  const credentials = { accountId: '1', password: 'password', hashSecret: secret }
  const message = { sender: 'sender1', recipient: '+201000000000', body: 'text1' }
  let calls = 0
  const transport = async () => { calls++; throw Error('Transport must not run') }
  await assert.rejects(() => vodafoneProvider.submit(settings, credentials, { traffic_type: 'unknown' }, [message], transport), { smsNotSent: true })
  await assert.rejects(() => vodafoneProvider.submit(settings, credentials, { traffic_type: 'notification' }, [message, message], transport), { smsNotSent: true })
  await assert.rejects(() => vodafoneProvider.submit({ ...settings, campaign_path: settings.notification_path, notification_path: settings.campaign_path }, credentials, { traffic_type: 'campaign' }, [message], transport), { smsNotSent: true })
  assert.equal(calls, 0)
})
test('Egyptian 10/11/12/15 formats normalize without changing historical data', () => {
  for (const prefix of ['10', '11', '12', '15']) for (const country of ['0020', '+20', '20', '0', '']) assert.equal(normalizeSmsPhone(country + prefix + '12345678'), '+20' + prefix + '12345678')
  assert.equal(normalizeSmsPhone('010 1234-5678'), '+201012345678')
  assert.equal(normalizeSmsPhone('+966501234567', { allowInternational: true }), '+966501234567')
  assert.equal(normalizeSmsPhone('00966501234567', { allowInternational: true }), '+966501234567')
  for (const bad of ['01312345678', '010123', '010123456789', 'abc', '+201012345678x', '+20+1012345678', '966501234567', '+966501234567']) assert.throws(() => normalizeSmsPhone(bad))
  assert.throws(() => normalizeSmsPhone('01012345678', { defaultCountry: 'explicit' }))
})
test('GSM extensions, Arabic UTF-16 and multipart boundary estimates', () => {
  for (const [text, encoding, units, segments] of [['a'.repeat(160), 'gsm7', 160, 1], ['a'.repeat(161), 'gsm7', 161, 2], ['a'.repeat(307), 'gsm7', 307, 3], ['^'.repeat(80), 'gsm7', 160, 1], ['^'.repeat(81), 'gsm7', 162, 2], ['مرحبا'.repeat(14), 'utf16', 70, 1], ['ب'.repeat(71), 'utf16', 71, 2], ['ب'.repeat(135), 'utf16', 135, 3], ['😀'.repeat(36), 'utf16', 72, 2]]) assert.deepEqual([estimateSmsSegments(text).encoding, estimateSmsSegments(text).units, estimateSmsSegments(text).segments], [encoding, units, segments])
  assert.equal(estimateSmsSegments('€{}[]\\|~^\f').units, 20); assert.equal(estimateSmsSegments('').segments, 0)
  assert.equal(estimateSmsSegments('èéùìò').encoding, 'gsm7')
})
test('multipart estimates never split GSM escape pairs or Unicode surrogate pairs', () => {
  assert.equal(estimateSmsSegments('^'.repeat(153)).segments, 3)
  assert.equal(estimateSmsSegments('😀'.repeat(67)).segments, 3)
  assert.equal(estimateSmsSegments('a'.repeat(152) + '^' + 'a'.repeat(152)).segments, 3)
  assert.equal(estimateSmsSegments('ب'.repeat(66) + '😀' + 'ب'.repeat(66)).segments, 3)
})
test('template substitution treats code as text and fails on missing/unknown placeholders', () => {
  assert.deepEqual(smsTemplateVariables('Hi {{ customer_name }}, {{order_number}}'), ['customer_name', 'order_number'])
  assert.equal(renderSmsTemplate('Hi {{name}}', { name: '${process.exit()}' }), 'Hi ${process.exit()}')
  for (const variables of [{}, { name: 'n', unknown: 'v' }, { name: 3 }]) assert.throws(() => renderSmsTemplate('Hi {{name}}', variables))
  assert.throws(() => smsTemplateVariables('{{process.exit()}}'))
})
test('SSRF guards reject non-public IPs, credentials, ports, redirects paths and unsafe protocols', () => {
  for (const address of ['127.0.0.1', '10.1.2.3', '169.254.169.254', '192.168.1.1', '172.31.1.1', '::1', '::ffff:127.0.0.1', 'fc00::1', '2001:db8::1']) assert.equal(isPublicSmsAddress(address), false)
  for (const url of ['http://sms.example.invalid', 'https://localhost', 'https://127.0.0.1', 'https://[::1]', 'https://user:pass@sms.example.invalid', 'https://sms.example.invalid:8443', 'https://sms.example.invalid/path', 'https://sms.example.invalid?query=1']) assert.throws(() => validateSmsBaseUrl(url))
  assert.equal(validateSmsBaseUrl('https://sms.example.invalid'), 'https://sms.example.invalid')
})
test('SSRF guards compare IPv6 ranges numerically, including expanded and special-purpose addresses', () => {
  for (const address of ['2001:0db8:0:0:0:0:0:1', '2001:2::1', '2001::1', '2002:a00:1::1', '3fff::1', '3fff:fff:ffff::1', '192.88.99.1']) assert.equal(isPublicSmsAddress(address), false, address)
  for (const address of ['8.8.8.8', '192.0.3.1', '198.51.101.1', '2001:4860:4860::8888', '2606:4700:4700::1111']) assert.equal(isPublicSmsAddress(address), true, address)
})
