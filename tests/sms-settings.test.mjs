import test from 'node:test'
import assert from 'node:assert/strict'
import { decryptCredentialSecret } from '../server/utils/credentialSecrets.js'
import { smsDefaults, publicSmsSettings, validateSmsSettings, smsReadiness } from '../server/utils/sms/settings.js'
import { prepareSmsSend } from '../server/utils/sms/service.js'
import { hasAdminPermission, getDashboardRouteRequirement, normalizeAdminPermissions } from '../app/utils/adminPermissions.js'
globalThis.useRuntimeConfig = () => ({ credentialsEncryptionKey: 'sms-test-only-master-key-at-least-32-characters' })

test('SMS defaults off, Dashboard credentials encrypted, no plaintext read-back', () => {
  assert.equal(smsDefaults.is_enabled, false)
  const update = validateSmsSettings({ account_id: 'account-fixture', password: 'private-password-fixture', hash_secret: 'ab'.repeat(16) }, smsDefaults)
  for (const [field, value] of [['account_id', 'account-fixture'], ['password', 'private-password-fixture'], ['hash_secret', 'ab'.repeat(16)]]) {
    assert.match(update[field + '_encrypted'], /^v1\./); assert.equal(decryptCredentialSecret(update[field + '_encrypted'], 'Vodafone'), value)
    assert.ok(!JSON.stringify(publicSmsSettings({ ...smsDefaults, ...update })).includes(value))
  }
  assert.equal(publicSmsSettings({ ...smsDefaults, ...update }).account_id_configured, true)
  assert.equal(Object.keys(publicSmsSettings(update)).some(key => key.endsWith('_encrypted')), false)
})
test('blank secrets preserve saved values; replacement invalidates activation and enablement', () => {
  const current = { ...smsDefaults, ...validateSmsSettings({ password: 'first-value' }, smsDefaults), is_enabled: true, trusted_ip_confirmed: true, activation_confirmed: true, hash_protocol_confirmed: true }
  assert.deepEqual(validateSmsSettings({ password: '', account_id: '', hash_secret: '' }, current), {})
  const update = validateSmsSettings({ password: 'second-value', is_enabled: true }, current)
  assert.equal(update.is_enabled, false); assert.equal(update.hash_protocol_confirmed, false)
  assert.equal(decryptCredentialSecret(update.password_encrypted, 'Vodafone'), 'second-value')
})
test('readiness requires provisioned secrets, approved sender, trusted IP and hash clarification', () => {
  assert.equal(smsReadiness(smsDefaults).ready, false)
  assert.throws(() => validateSmsSettings({ is_enabled: true }, smsDefaults), /Complete SMS activation/)
  assert.throws(() => validateSmsSettings({ sender_names: ['APP'], default_sender: 'OTHER' }, smsDefaults))
  assert.throws(() => validateSmsSettings({ notification_path: '//evil.invalid' }, smsDefaults))
  assert.throws(() => validateSmsSettings({ batch_size: 1000 }, smsDefaults))
  assert.throws(() => validateSmsSettings({ api_mode: 'sandbox' }, smsDefaults))
})
test('disabled service blocks immediately; notification cannot accidentally carry a campaign', () => {
  assert.throws(() => prepareSmsSend(smsDefaults, {}, 'notification'), /disabled/)
  const configured = { ...smsDefaults, is_enabled: true, base_url: 'https://sms.example.invalid', account_id_encrypted: 'present', password_encrypted: 'present', hash_secret_encrypted: 'present', sender_names: ['APP'], default_sender: 'APP', expected_outbound_ip: '8.8.8.8', trusted_ip_confirmed: true, activation_confirmed: true, hash_protocol_confirmed: true }
  const input = { recipients: ['01012345678', '01112345678'], text: 'Fixture', idempotencyKey: 'fixture-key' }
  assert.throws(() => prepareSmsSend(configured, input, 'notification'), /one recipient/)
  assert.equal(prepareSmsSend(configured, input, 'campaign').length, 2)
  assert.throws(() => prepareSmsSend(configured, { ...input, recipients: ['01012345678', '+201012345678'] }, 'campaign'), /duplicate/)
})
test('new staff permissions default off, route/action rights separated and dependent permissions enforced', () => {
  const staff = { is_active: true, role: 'admin', permissions: { 'dashboard.view': true, 'settings.edit': true } }
  assert.equal(hasAdminPermission(staff, 'sms.settings.manage'), false)
  assert.equal(hasAdminPermission({ is_active: true, role: 'owner' }, 'sms.campaign.send'), true)
  assert.equal(normalizeAdminPermissions({ 'sms.settings.manage': true })['sms.settings.manage'], false)
  assert.deepEqual(getDashboardRouteRequirement({ path: '/dashboard/sms', query: { tab: 'history' } }), { permission: 'sms.history.view' })
})
test('traffic endpoint paths cannot be swapped or independently repointed', () => {
  for (const body of [
    { notification_path: smsDefaults.campaign_path, campaign_path: smsDefaults.notification_path },
    { campaign_path: '/custom/Notification' }, { notification_path: '/custom/submit' }
  ]) assert.throws(() => validateSmsSettings(body, smsDefaults), /Invalid SMS settings/)
  const current = { ...smsDefaults, is_enabled: true, trusted_ip_confirmed: true, activation_confirmed: true, hash_protocol_confirmed: true }
  const update = validateSmsSettings({ campaign_path: '/gateway/sms/submit', notification_path: '/gateway/sms/submit/Notification' }, current)
  assert.equal(update.is_enabled, false)
  assert.equal(update.activation_confirmed, false)
})
