import { createHmac } from 'node:crypto'
import sax from 'sax'
import { normalizeVodafoneError } from './errors.js'
import { postSmsXml, validateSmsBaseUrl } from './transport.js'

export const VODAFONE_NAMESPACE = 'http://www.edafa.com/web2sms/sms/model/'
export const validVodafonePaths = ({ notification_path, campaign_path }) =>
  [notification_path, campaign_path].every(path => typeof path === 'string' && /^\/[a-zA-Z0-9/_-]{1,199}$/.test(path) && !path.includes('//'))
  && campaign_path.endsWith('/sms/submit') && notification_path === campaign_path + '/Notification'
export const vodafoneHash = ({ accountId, password, messages, externalTrxId }, secret) => {
  if (typeof secret !== 'string' || !/^(?:[a-fA-F0-9]{2}){16,256}$/.test(secret)) throw new Error('Invalid Secure Hash Secret.')
  const fields = [`AccountId=${accountId}`, `Password=${password}`]
  for (const message of messages) fields.push(`SenderName=${message.sender}`, `ReceiverMSISDN=${message.recipient}`, `SMSText=${message.text}`)
  if (externalTrxId !== undefined) fields.push(`ExternalTrxId=${externalTrxId}`)
  return createHmac('sha256', Buffer.from(secret, 'hex')).update(fields.join('&'), 'utf8').digest('hex').toUpperCase()
}
export const escapeSmsXml = value => {
  const text = String(value)
  // XML 1.0 valid characters only, including valid supplementary Unicode.
  for (const character of text) {
    const cp = character.codePointAt(0)
    if (!(cp === 9 || cp === 10 || cp === 13 || cp >= 32 && cp <= 0xd7ff || cp >= 0xe000 && cp <= 0xfffd || cp >= 0x10000 && cp <= 0x10ffff)) throw new Error('Invalid XML character.')
  }
  return text.replace(/[&<>"'\r]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;', '\r': '&#13;' })[character])
}
export const buildVodafoneXml = (request, secret) => {
  const tag = (name, value) => `<${name}>${escapeSmsXml(value)}</${name}>`
  return '<?xml version="1.0" encoding="UTF-8"?>' + `<SubmitSMSRequest xmlns="${VODAFONE_NAMESPACE}">`
    + tag('AccountId', request.accountId) + tag('Password', request.password) + tag('SecureHash', vodafoneHash(request, secret))
    + request.messages.map(message => '<SMSList>' + tag('SenderName', message.sender) + tag('ReceiverMSISDN', message.recipient) + tag('SMSText', message.text) + '</SMSList>').join('')
    + (request.externalTrxId !== undefined ? tag('ExternalTrxId', request.externalTrxId) : '') + '</SubmitSMSRequest>'
}

export const parseVodafoneXml = (xml, count) => {
  const invalid = () => { throw new Error('Invalid provider XML.') }
  if (typeof xml !== 'string' || Buffer.byteLength(xml) > 262144 || /<!\s*(?:DOCTYPE|ENTITY)/i.test(xml)) invalid()
  const parser = sax.parser(true, { xmlns: true, strictEntities: true })
  const stack = [], statuses = [], values = {}
  let rootSeen = false, current = ''
  parser.onerror = invalid
  parser.ondoctype = invalid
  parser.onopentag = node => {
    stack.push(node.local)
    if (stack.length === 1) {
      if (rootSeen || node.local !== 'SubmitSMSResponse' || node.uri !== VODAFONE_NAMESPACE) invalid()
      rootSeen = true
    } else {
      if (stack.length !== 2 || node.uri !== VODAFONE_NAMESPACE || !['SMSStatus', 'ResultStatus', 'Description'].includes(node.local)) invalid()
      current = ''
    }
  }
  parser.ontext = text => { if (stack.length === 2) current += text; else if (text.trim()) invalid() }
  parser.oncdata = parser.ontext
  parser.onclosetag = () => {
    if (stack.length === 2) {
      const name = stack[1], value = current.trim()
      if (name === 'SMSStatus') statuses.push(value)
      else { if (values[name] !== undefined) invalid(); values[name] = value }
    }
    stack.pop()
  }
  try { parser.write(xml).close() } catch { invalid() }
  if (!rootSeen || stack.length || !['SUCCESS', 'INVALID_REQUEST', 'GENERIC_ERROR', 'INTERNAL_SERVER_ERROR', 'INACCESSIBLE_INTERFACE', 'FAIL', 'NO_DATA_FOUND'].includes(values.ResultStatus)) invalid()
  if (statuses.some(status => !['SUBMITTED', 'FAILED_TO_SUBMITTED', 'SUSPENDED', 'INVALID'].includes(status))) invalid()
  if (values.ResultStatus === 'SUCCESS' && statuses.length !== count || statuses.length && statuses.length !== count) invalid()
  if (values.Description !== undefined && !/^\d{4}$/.test(values.Description)) invalid()
  const error = normalizeVodafoneError(values.Description)
  return { result_status: values.ResultStatus, error_code: error.code, category: values.ResultStatus === 'SUCCESS' ? null : error.category,
    messages: Array.from({ length: count }, (_, index) => {
      const provider_status = statuses[index] || null
      // Explicit per-message acceptance remains accepted even in a mixed response.
      const status = provider_status === 'SUBMITTED' ? 'submitted' : 'failed'
      return { status, provider_status, error_code: error.code, category: status === 'submitted' ? null : provider_status === 'SUSPENDED' ? 'suspended' : provider_status === 'FAILED_TO_SUBMITTED' ? 'provider_rate' : provider_status === 'INVALID' ? 'invalid_message' : error.category }
    }) }
}

export const vodafoneProvider = {
  async submit(settings, credentials, batch, messages, transport = postSmsXml, beforeDispatch) {
    if (!['notification', 'campaign'].includes(batch.traffic_type) || !validVodafonePaths(settings) || !messages.length || batch.traffic_type === 'notification' && messages.length !== 1) {
      throw Object.assign(new Error('Invalid SMS dispatch configuration.'), { smsNotSent: true })
    }
    validateSmsBaseUrl(settings.base_url)
    const request = { accountId: credentials.accountId, password: credentials.password, externalTrxId: batch.external_trx_id,
      messages: messages.map(message => ({ sender: message.sender, recipient: message.recipient.slice(1), text: message.body })) }
    const xml = buildVodafoneXml(request, credentials.hashSecret)
    const url = new URL(batch.traffic_type === 'notification' ? settings.notification_path : settings.campaign_path, settings.base_url)
    if (settings.port) url.port = String(settings.port)
    const response = await transport(url, xml, settings.timeout_ms, beforeDispatch)
    if (response.status !== 200) throw new Error('Uncertain provider HTTP result.')
    return parseVodafoneXml(response.body, messages.length)
  }
}
