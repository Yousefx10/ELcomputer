import { createError } from 'h3'
import { encryptCredentialSecret, decryptCredentialSecret, isCredentialEncryptionReady } from '../credentialSecrets.js'
import { validateSmsBaseUrl } from './transport.js'
import { validVodafonePaths } from './vodafone.js'

export const smsDefaults = Object.freeze({ id: 'vodafone', is_enabled: false, api_mode: 'production', base_url: '', port: null,
  notification_path: '/web2sms/sms/submit/Notification', campaign_path: '/web2sms/sms/submit', sender_names: [], default_sender: '',
  expected_outbound_ip: '', trusted_ip_confirmed: false, activation_confirmed: false, hash_protocol_confirmed: false, activation_notes: '',
  timeout_ms: 10000, preflight_retry_limit: 2, batch_size: 50, request_interval_ms: 1000, default_country: 'EG', allow_international: false, config_revision: 0 })
export const getSmsSettings = async db => {
  const { data, error } = await db.from('sms_provider_settings').select('*').eq('id', 'vodafone').maybeSingle()
  if (error) throw createError({ statusCode: 503, statusMessage: 'SMS settings are unavailable.' })
  return data || { ...smsDefaults, _missing: true }
}
export const smsReadiness = settings => {
  const missing = []
  for (const field of ['base_url', 'account_id_encrypted', 'password_encrypted', 'hash_secret_encrypted', 'default_sender', 'expected_outbound_ip']) if (!settings[field]) missing.push(field.replace('_encrypted', ''))
  if (!settings.sender_names?.includes(settings.default_sender)) missing.push('approved_sender')
  if (!validVodafonePaths(settings)) missing.push('endpoint_paths')
  for (const field of ['trusted_ip_confirmed', 'activation_confirmed', 'hash_protocol_confirmed']) if (!settings[field]) missing.push(field)
  if (!isCredentialEncryptionReady()) missing.push('encryption')
  return { ready: !missing.length, missing }
}
export const publicSmsSettings = settings => ({
  ...Object.fromEntries(Object.keys(smsDefaults).map(key => [key, settings[key] ?? smsDefaults[key]])),
  account_id_configured: Boolean(settings.account_id_encrypted), password_configured: Boolean(settings.password_encrypted),
  hash_secret_configured: Boolean(settings.hash_secret_encrypted), encryption_ready: isCredentialEncryptionReady(),
  readiness: smsReadiness(settings), updated_at: settings.updated_at || null
})
export const smsCredentials = settings => ({ accountId: decryptCredentialSecret(settings.account_id_encrypted, 'Vodafone'),
  password: decryptCredentialSecret(settings.password_encrypted, 'Vodafone'), hashSecret: decryptCredentialSecret(settings.hash_secret_encrypted, 'Vodafone') })
export const validateSmsSettings = (body, current) => {
  const fail = () => { throw createError({ statusCode: 400, statusMessage: 'Invalid SMS settings.' }) }
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail()
  const update = {}
  const strings = { base_url: 300, notification_path: 200, campaign_path: 200, default_sender: 50, expected_outbound_ip: 100, activation_notes: 1000 }
  for (const [key, max] of Object.entries(strings)) if (body[key] !== undefined) {
    if (typeof body[key] !== 'string' || body[key].length > max || /[\x00-\x1f\x7f]/.test(body[key])) fail()
    update[key] = body[key].trim()
  }
  for (const key of ['is_enabled', 'trusted_ip_confirmed', 'activation_confirmed', 'hash_protocol_confirmed', 'allow_international']) if (body[key] !== undefined) {
    if (typeof body[key] !== 'boolean') fail()
    update[key] = body[key]
  }
  if (body.api_mode !== undefined && body.api_mode !== 'production' || body.default_country !== undefined && !['EG', 'explicit'].includes(body.default_country)) fail()
  for (const key of ['api_mode', 'default_country']) if (body[key] !== undefined) update[key] = body[key]
  for (const [key, min, max] of [['timeout_ms', 1000, 30000], ['preflight_retry_limit', 0, 3], ['batch_size', 1, 200], ['request_interval_ms', 500, 60000]]) if (body[key] !== undefined) {
    if (!Number.isInteger(body[key]) || body[key] < min || body[key] > max) fail()
    update[key] = body[key]
  }
  if (body.port !== undefined) { if (body.port !== null && (!Number.isInteger(body.port) || body.port < 1 || body.port > 65535)) fail(); update.port = body.port }
  if (body.sender_names !== undefined) {
    if (!Array.isArray(body.sender_names) || body.sender_names.length > 20 || body.sender_names.some(sender => typeof sender !== 'string' || !/^[a-zA-Z0-9 ]{1,50}$/.test(sender) || sender !== sender.trim())) fail()
    update.sender_names = [...new Set(body.sender_names)]
  }
  for (const [input, column] of [['account_id', 'account_id_encrypted'], ['password', 'password_encrypted'], ['hash_secret', 'hash_secret_encrypted']]) if (body[input]) {
    const value = body[input]
    if (typeof value !== 'string' || value.length > 1024 || value !== value.trim() || /[\x00-\x1f\x7f]/.test(value) || input === 'hash_secret' && !/^(?:[a-fA-F0-9]{2}){16,256}$/.test(value)) fail()
    update[column] = encryptCredentialSecret(value, 'Vodafone')
  }
  const merged = { ...current, ...update }
  try { merged.base_url = validateSmsBaseUrl(merged.base_url); if (update.base_url !== undefined) update.base_url = merged.base_url } catch { fail() }
  if (!validVodafonePaths(merged) || merged.default_sender && !merged.sender_names.includes(merged.default_sender)) fail()
  // A changed account, destination or credentials requires fresh external confirmations.
  if (['base_url', 'port', 'notification_path', 'campaign_path', 'account_id_encrypted', 'password_encrypted', 'hash_secret_encrypted'].some(key => update[key] !== undefined && update[key] !== current[key])) {
    Object.assign(update, { is_enabled: false, trusted_ip_confirmed: false, activation_confirmed: false, hash_protocol_confirmed: false })
  }
  if (update.expected_outbound_ip !== undefined && update.expected_outbound_ip !== current.expected_outbound_ip) Object.assign(update, { is_enabled: false, trusted_ip_confirmed: false })
  if (update.is_enabled === true && !smsReadiness({ ...current, ...update }).ready) throw createError({ statusCode: 409, statusMessage: 'Complete SMS activation checks before enabling.' })
  return update
}
