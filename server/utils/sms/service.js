import { createHash } from 'node:crypto'
import { createError } from 'h3'
import { estimateSmsSegments, normalizeSmsPhone, renderSmsTemplate } from '../../../app/utils/sms.js'
import { getSmsSettings, smsReadiness, smsCredentials } from './settings.js'
import { escapeSmsXml, vodafoneProvider } from './vodafone.js'

const fail = (statusCode, statusMessage) => { throw createError({ statusCode, statusMessage }) }
const check = result => { if (result.error) fail(503, 'SMS storage is unavailable.'); return result.data }
export const prepareSmsSend = (settings, input, trafficType) => {
  if (!settings.is_enabled) fail(503, 'SMS provider is disabled.')
  if (!smsReadiness(settings).ready) fail(503, 'SMS provider is not ready.')
  if (!input || !Array.isArray(input.recipients) || input.recipients.length < 1 || input.recipients.length > settings.batch_size) fail(400, 'Invalid SMS recipient list.')
  if (trafficType === 'notification' && input.recipients.length !== 1) fail(400, 'Notification requires one recipient.')
  if (typeof input.idempotencyKey !== 'string' || !/^[a-zA-Z0-9:_-]{1,180}$/.test(input.idempotencyKey)) fail(400, 'An SMS idempotency key is required.')
  if (typeof input.text !== 'string' || !input.text.trim() || input.text.length > 4000) fail(400, 'Invalid SMS text.')
  if (!Number.isInteger(input.priority ?? 10) || (input.priority ?? 10) < 0 || (input.priority ?? 10) > 100) fail(400, 'Invalid SMS priority.')
  if (input.expiresAt && (!Number.isFinite(Date.parse(input.expiresAt)) || Date.parse(input.expiresAt) <= Date.now())) fail(400, 'SMS expiry is in the past.')
  const sender = input.sender || settings.default_sender
  if (!settings.sender_names.includes(sender)) fail(400, 'Choose an approved sender.')
  let recipients
  try {
    escapeSmsXml(input.text)
    recipients = input.recipients.map(recipient => normalizeSmsPhone(recipient, { defaultCountry: settings.default_country, allowInternational: settings.allow_international }))
  } catch { fail(400, 'Invalid SMS text or phone number.') }
  if (new Set(recipients).size !== recipients.length) fail(400, 'Remove duplicate recipients.')
  const estimate = estimateSmsSegments(input.text)
  return recipients.map(recipient => ({ recipient, sender, body: input.text, encoding: estimate.encoding, units: estimate.units, segments: estimate.segments }))
}

// Future server features choose the traffic path explicitly and provide their own
// authorization/abuse controls. No feature integration is installed by this task.
export const createSmsService = db => {
  const enqueue = async (trafficType, input) => {
    const settings = await getSmsSettings(db)
    let templateId = null
    if (input.templateCode) {
      const template = check(await db.from('sms_templates').select('*').eq('code', input.templateCode).maybeSingle())
      if (!template?.is_enabled || template.traffic_type !== trafficType || !['en', 'ar'].includes(input.locale)) fail(400, 'SMS template is unavailable for this traffic.')
      const text = template[input.locale === 'ar' ? 'text_ar' : 'text_en']
      if (!text) fail(400, 'Template translation is missing.')
      try { input = { ...input, text: renderSmsTemplate(text, input.variables), sender: input.sender || template.sender || settings.default_sender } } catch { fail(400, 'Invalid SMS template variables.') }
      templateId = template.id
    }
    const messages = prepareSmsSend(settings, input, trafficType)
    const triggerSource = input.triggerSource || 'internal'
    if (typeof triggerSource !== 'string' || !/^[a-zA-Z0-9:_-]{1,80}$/.test(triggerSource)) fail(400, 'Invalid SMS source.')
    const fingerprint = createHash('sha256').update(JSON.stringify({ trafficType, templateId, messages, actor: input.triggeredBy || null, triggerSource, priority: input.priority ?? 10, expiresAt: input.expiresAt || null })).digest('hex')
    const { data, error } = await db.rpc('sms_enqueue', {
      p_batch: { idempotency_key: input.idempotencyKey, fingerprint, traffic_type: trafficType, template_id: templateId,
        triggered_by: input.triggeredBy || null, trigger_source: triggerSource, priority: input.priority ?? 10, expires_at: input.expiresAt || null }, p_messages: messages
    })
    if (error) {
      if (/idempotency conflict/.test(error.message)) fail(409, 'SMS request key was already used for different content.')
      if (/rate limit/.test(error.message)) fail(429, 'SMS rate limit reached.')
      if (/provider disabled/.test(error.message)) fail(503, 'SMS provider is disabled.')
      fail(503, 'SMS could not be queued.')
    }
    return data
  }
  return { sendNotification: input => enqueue('notification', input), sendCampaign: input => enqueue('campaign', input) }
}

export const processSmsQueue = async (db, { limit = 1, provider = vodafoneProvider } = {}) => {
  const processed = []
  const count = Math.min(3, Math.max(1, Number(limit) || 1))
  for (let index = 0; index < count; index++) {
    const job = check(await db.rpc('sms_claim'))
    if (!job?.id) break
    let settings, credentials, messages
    try {
      settings = await getSmsSettings(db)
      messages = check(await db.from('sms_messages').select('*').eq('batch_id', job.id).order('position'))
      if (!settings.is_enabled || !smsReadiness(settings).ready || messages.some(message => !settings.sender_names.includes(message.sender))) throw Error()
      credentials = smsCredentials(settings)
    } catch {
      check(await db.rpc('sms_finish', { p_id: job.id, p_token: job.lease_token, p_result: { status: 'failed', category: 'configuration' } }))
      processed.push({ id: job.id, status: 'failed' }); continue
    }
    const begun = check(await db.rpc('sms_begin_dispatch', { p_id: job.id, p_token: job.lease_token, p_revision: settings.config_revision }))
    if (!begun) continue
    let result
    try {
      result = await provider.submit(settings, credentials, job, messages, undefined, async () => {
        const latest = await getSmsSettings(db)
        if (!latest.is_enabled || latest.config_revision !== settings.config_revision || job.expires_at && Date.parse(job.expires_at) <= Date.now()) {
          const error = new Error('SMS dispatch cancelled.')
          error.smsNotSent = true
          throw error
        }
      })
      const submitted = result.messages.filter(message => message.status === 'submitted').length
      result = { ...result, status: submitted === messages.length ? 'submitted' : submitted ? 'partial' : 'failed' }
    } catch (error) {
      // Only a known preflight failure proves POST was never dispatched.
      result = error.smsNotSent === true ? { status: 'failed', category: 'configuration' } : { status: error.smsPreflight === true ? 'preflight_failed' : 'uncertain', category: error.smsPreflight === true ? 'connection_preflight' : 'provider_result_unknown' }
    }
    check(await db.rpc('sms_finish', { p_id: job.id, p_token: job.lease_token, p_result: result }))
    processed.push({ id: job.id, status: result.status })
  }
  return { processed }
}
