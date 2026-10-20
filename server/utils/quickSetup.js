import { getDaftraConfigSummary } from './daftra.js'
import { getErpSettings } from './erpOwnership.js'
import { resolveErpState } from '../../app/utils/erpState.js'
import { getSmsSettings, smsReadiness } from './sms/settings.js'
import { validateSmsBaseUrl } from './sms/transport.js'
import { getEmailSettings, emailReadiness } from './email/settings.js'
import { getPdcSettings } from './pdcShipping.js'
import { validatePdcSettings } from './pdcSettings.js'
import { getPaymobConfig } from './payments/paymob.js'
import { isCredentialEncryptionReady } from './credentialSecrets.js'
import { isShippingEncryptionReady } from './shippingSecrets.js'

const on = value => value === true || value === 'true'
const present = value => typeof value === 'string' && value.trim().length > 0
const positive = value => Number.isSafeInteger(Number(value)) && Number(value) > 0
const check = (id, complete, managedBy = 'dashboard') => ({ id, state: complete === null ? 'not_verified' : complete ? 'complete' : 'incomplete', managedBy })
const item = (id, required, checks = [], extra = {}) => ({
  id, required, configuration: checks.some(c => c.state === 'incomplete') ? 'incomplete'
    : checks.some(c => c.state === 'not_verified') || !checks.length ? 'not_verified' : 'complete',
  credentialsSaved: null, connection: 'not_applicable', enabled: null,
  operationalAcceptance: 'not_verified', checks, notes: [], ...extra
})
const unavailable = (id, required = false) => item(id, required, [check('settings_available', null)], { notes: ['settings_unavailable'] })
const httpsOrigin = value => {
  try {
    const u = new URL(value)
    return u.protocol === 'https:' && !u.username && !u.password && u.pathname === '/' && !u.search && !u.hash
  } catch { return false }
}
const safeDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null
  const time = Date.parse(value)
  return Number.isFinite(time) ? new Date(time).toISOString() : null
}

const readRow = async (db, table, columns, key, value) => {
  const { data, error } = await db.from(table).select(columns).eq(key, value).maybeSingle().abortSignal(AbortSignal.timeout(4000))
  if (error || !data) throw Error('Setup configuration unavailable.')
  return data
}
const readRows = async (db, table, columns) => {
  const { data, error } = await db.from(table).select(columns).limit(101).abortSignal(AbortSignal.timeout(4000))
  if (error || !Array.isArray(data) || data.length > 100) throw Error('Setup configuration unavailable.')
  return data
}

// SELECTs and existing configuration helpers only. No RPCs, writes, provider
// requests, Auth settings requests, worker invocations or credential decryption.
export const readQuickSetupStatus = async (db, runtime, now = Date.now(), selections = {}) => {
  const reads = {
    site: () => readRow(db, 'site_settings', 'site_name,site_logo_url,footer_email,footer_phone,footer_address,payment_cash_enabled,payment_card_enabled,payment_bank_transfer_enabled,payment_instapay_enabled,payment_paypal_enabled,payment_bank_transfer_instructions,payment_instapay_instructions,auth_facebook_enabled', 'key', 'default'),
    erp: async () => ({ settings: await getErpSettings(db), credentials: await getDaftraConfigSummary(db) }),
    sms: async () => { const s = await getSmsSettings(db); if (s._missing) throw Error(); return s },
    email: () => getEmailSettings(db),
    pdc: () => getPdcSettings(db),
    couriers: () => readRows(db, 'commerce_shipping_companies', 'is_active,provider,checkout_enabled,checkout_governorates,client_shipping_price'),
    policies: () => readRows(db, 'after_sales_policies', 'warranty_enabled,return_enabled,warranty_configured,return_configured'),
    events: () => readRows(db, 'sms_order_event_settings', 'is_enabled,template_en_id,template_ar_id'),
    communications: () => readRows(db, 'after_sales_communication_settings', 'is_enabled,sms_enabled,email_enabled,sms_template_en,sms_template_ar,email_template_en,email_template_ar'),
    chat: () => readRow(db, 'chat_settings', 'is_enabled', 'singleton', true),
    catalog: async () => { const { error } = await db.from('storefront_products').select('id').limit(1).abortSignal(AbortSignal.timeout(4000)); if (error) throw Error() }
  }
  const keys = Object.keys(reads)
  const results = await Promise.allSettled(keys.map(key => reads[key]()))
  const data = Object.fromEntries(keys.map((key, index) => [key, results[index].status === 'fulfilled' ? results[index].value : null]))
  const available = key => results[keys.indexOf(key)].status === 'fulfilled'
  return buildQuickSetupStatus(data, runtime, { now, available, selections, encryptionReady: isCredentialEncryptionReady(), shippingEncryptionReady: isShippingEncryptionReady() })
}

// All responses are constructed explicitly. Never spread database/runtime data.
export const buildQuickSetupStatus = (data, runtime, { now = Date.now(), available = key => data[key] !== null && data[key] !== undefined, selections = {}, encryptionReady = false, shippingEncryptionReady = false } = {}) => {
  const items = []
  const site = data.site
  const smsEvents = available('events') ? data.events.filter(s => s.is_enabled === true) : []
  const communications = available('communications') ? data.communications.filter(s => s.is_enabled === true) : []
  const smsSelected = smsEvents.length > 0 || communications.some(s => s.sms_enabled === true)
  const emailSelected = communications.some(s => s.email_enabled === true)
  const paymobEnabled = on(runtime.paymobEnabled)
  const cardSelected = paymobEnabled && site?.payment_card_enabled === true
  let liveCardConfigured = false
  try { liveCardConfigured = getPaymobConfig(runtime).mode === 'live' } catch { /* Configuration only; never a provider request. */ }

  items.push(item('application', true, [
    check('database_access', available('site') && available('erp') && available('catalog'), 'operator'),
    check('saved_store_settings', !!site),
    check('supabase_runtime', present(runtime.public?.supabaseUrl) && present(runtime.public?.supabase?.key) && present(runtime.supabaseServiceRoleKey), 'operator')
  ], { notes: ['migration_history_unverified'] }))
  items.push(item('infrastructure', true, [check('https_origin', httpsOrigin(runtime.public?.siteUrl), 'operator')], { notes: ['operator_infrastructure', 'backup_unverified'] }))
  items.push(site ? item('branding', true, [check('store_name', present(site.site_name)), check('store_logo', present(site.site_logo_url))]) : unavailable('branding', true))
  items.push(site ? item('contact', true, [check('contact_method', present(site.footer_email) || present(site.footer_phone)), check('store_address', present(site.footer_address))]) : unavailable('contact', true))

  if (available('policies')) {
    const selected = data.policies.filter(p => p.warranty_enabled === true || p.return_enabled === true)
    items.push(item('policies', selected.length > 0, [check('policy_configuration', selected.every(p => (!p.warranty_enabled || p.warranty_configured) && (!p.return_enabled || p.return_configured)))], {
      enabled: selected.length > 0, notes: [selected.length ? 'policy_acceptance' : 'policies_optional']
    }))
  } else items.push(unavailable('policies', true))

  if (site) {
    // Configuration readiness is distinct from merchant transaction acceptance.
    const cash = site.payment_cash_enabled === true
    const transfer = site.payment_bank_transfer_enabled === true || site.payment_instapay_enabled === true
    items.push(item('payment_methods', true, [check('usable_payment_method', cash || cardSelected && liveCardConfigured),
      ...(site.payment_bank_transfer_enabled ? [check('bank_instructions', present(site.payment_bank_transfer_instructions))] : []),
      ...(site.payment_instapay_enabled ? [check('instapay_instructions', present(site.payment_instapay_instructions))] : []),
      ...(transfer ? [check('transfer_proof_support', false)] : []),
      ...(cardSelected ? [check('live_card_support', liveCardConfigured, 'operator')] : [])
    ], { notes: [...(cash ? ['cash_acceptance'] : cardSelected && liveCardConfigured ? ['paymob_acceptance'] : ['no_live_payment_path']), ...(transfer ? ['transfer_proof_unavailable'] : []),
      ...(site.payment_card_enabled && !paymobEnabled ? ['card_gateway_disabled'] : [])] }))
  } else items.push(unavailable('payment_methods', true))

  const paymobCredentials = ['paymobSecretKey', 'paymobPublicKey', 'paymobHmacSecret'].every(key => present(runtime[key]))
  let paymobConfigured = false
  try { getPaymobConfig({ ...runtime, paymobEnabled: true, paymobLiveRequestsEnabled: true }); paymobConfigured = true } catch { /* Safe fixed status only. */ }
  items.push(item('paymob', cardSelected || selections.paymob === true, [check('payment_credentials', paymobCredentials, 'operator'), check('paymob_test_configuration', paymobConfigured, 'operator'),
    ...(runtime.paymobMode === 'live' ? [check('paymob_live_gate', on(runtime.paymobLiveRequestsEnabled), 'operator')] : []),
    ...(selections.paymob === true ? [check('selected_card_enabled', cardSelected, 'operator')] : [])], {
    credentialsSaved: paymobCredentials, connection: 'not_verified', enabled: paymobEnabled,
    configuration: paymobConfigured && (runtime.paymobMode !== 'live' || on(runtime.paymobLiveRequestsEnabled)) && (selections.paymob !== true || cardSelected) ? 'complete' : 'incomplete',
    notes: ['operator_paymob', 'paymob_acceptance', ...(runtime.paymobMode !== 'live' ? ['paymob_test_only'] : [])]
  }))
  items.push(item('paypal', site?.payment_paypal_enabled === true || selections.paypal === true, [], { configuration: 'unsupported', enabled: site ? site.payment_paypal_enabled === true : null, notes: ['paypal_unavailable'] }))
  items.push(item('express_payments', false, [], { configuration: 'unsupported', enabled: false, notes: ['express_unavailable'] }))

  if (available('pdc') && available('couriers')) {
    const s = data.pdc, selected = s.is_enabled === true || s.auto_create_labels === true || s.reverse_enabled === true || selections.pdc === true
    let destination = false
    try { validatePdcSettings({ ...s, access_token: '', webhook_secret: '' }, s); destination = true } catch { /* No decryption or raw diagnostics. */ }
    const checks = selected ? [check('pdc_credentials', present(s.access_token_encrypted)), check('shipping_encryption', shippingEncryptionReady, 'operator'),
      check('pdc_account', /^\d{1,40}$/.test(s.company_id || '') && positive(s.product_id)), check('pdc_destination', destination),
      check('pdc_webhook', present(s.webhook_secret_encrypted)),
      check('pickup_details', positive(s.origin_city_id) && present(s.origin_address) && present(s.origin_phone) && present(s.origin_contact_name)),
      check('pdc_enabled', s.is_enabled === true), check('pdc_outbound_gate', runtime.shippingLiveRequestsEnabled === true, 'operator'),
      check('private_shipping_storage', present(runtime.shippingDocumentsDir), 'operator'),
      check('pdc_lookups', Array.isArray(s.cities_cache) && s.cities_cache.length > 0 && Array.isArray(s.products_cache) && s.products_cache.length > 0),
      check('pdc_courier_selected', data.couriers.some(c => c.is_active && c.provider === 'pdc' && c.checkout_enabled && c.checkout_governorates?.length > 0)),
      ...(s.auto_create_labels || s.reverse_enabled ? [check('shipping_worker', present(runtime.shippingWorkerSecret) && runtime.shippingWorkerSecret.trim().length >= 32, 'operator')] : [])
    ] : [check('manual_courier', data.couriers.some(c => c.is_active === true))]
    items.push(item('shipping', true, checks, { credentialsSaved: present(s.access_token_encrypted), connection: 'not_verified', enabled: s.is_enabled === true,
      notes: selected ? ['pdc_acceptance', 'worker_schedule_unverified'] : ['manual_shipping', 'pdc_optional'] }))
  } else items.push(unavailable('shipping', true))

  if (available('erp')) {
    const { settings: s, credentials: c } = data.erp, state = resolveErpState(s, c), selected = state.mode === 'daftra'
    const checkedAt = safeDate(s.daftra_last_checked_at)
    const elapsed = checkedAt ? now - Date.parse(checkedAt) : Infinity
    const sameRevision = Number.isSafeInteger(Number(c.revision)) && Number(c.revision) === Number(s.daftra_tested_revision) && s.daftra_tested_revision !== null
    let connection = !checkedAt ? 'not_verified' : !sameRevision || elapsed < 0 || elapsed > 86400000 ? 'stale'
      : state.connectionHealth === 'connected' ? 'verified' : state.connectionHealth === 'failed' ? 'failed' : 'not_verified'
    // Runtime fallback tests use revision zero; they cannot bind credential edits.
    if (c.source === 'environment' && connection === 'verified') connection = 'not_verified'
    items.push(item('daftra', selected || selections.daftra === true, selected || selections.daftra === true ? [check('erp_credentials', c.credentialsSaved === true), check('erp_configuration', c.configured === true),
      check('erp_connection', connection === 'verified'), check('erp_worker', present(runtime.erpWorkerSecret) && runtime.erpWorkerSecret.trim().length >= 32, 'operator'),
      ...(selections.daftra === true ? [check('selected_erp_enabled', selected)] : [])]
      : [check('erp_configuration', c.configured === true)], { credentialsSaved: c.credentialsSaved === true, connection, enabled: selected,
      connectionRevisionBound: c.source === 'database' && Number(c.revision) > 0,
      lastCheckedAt: checkedAt, notes: [selected ? 'daftra_active' : 'built_in_active', 'erp_ownership_separate', ...(c.source === 'environment' && checkedAt ? ['runtime_connection_unbound'] : []), ...(selected ? ['worker_schedule_unverified'] : [])] }))
  } else items.push(unavailable('daftra', true))

  if (available('sms')) {
    const s = data.sms, required = s.is_enabled === true || smsSelected || selections.vodafone === true
    let destination = false
    try { destination = !!validateSmsBaseUrl(s.base_url) } catch { /* No DNS requests. */ }
    items.push(item('vodafone', required, [check('sms_configuration', smsReadiness(s).ready && destination),
      ...(required ? [check('sms_enabled', s.is_enabled === true), check('sms_worker', present(runtime.smsWorkerSecret) && runtime.smsWorkerSecret.trim().length >= 32, 'operator')] : [])
    ], { credentialsSaved: ['account_id_encrypted', 'password_encrypted', 'hash_secret_encrypted'].every(key => present(s[key])), connection: 'not_verified', enabled: s.is_enabled === true,
      notes: ['sms_external_approval', ...(required ? ['worker_schedule_unverified'] : ['provider_optional'])] }))
  } else items.push(unavailable('vodafone', true))

  if (available('email')) {
    const s = data.email, required = s.config.is_enabled === true || emailSelected || s.config.webhook_enabled === true || s.config.marketing_enabled === true || selections.brevo === true
    items.push(item('brevo', required, [check('email_configuration', emailReadiness(s).ready),
      ...(required ? [check('email_enabled', s.config.is_enabled === true), check('email_worker', present(runtime.emailWorkerSecret) && runtime.emailWorkerSecret.trim().length >= 32, 'operator')] : []),
      ...(s.config.webhook_enabled ? [check('email_webhook', present(s.webhook_token_encrypted) && encryptionReady)] : [])
    ], { credentialsSaved: present(s.api_key_encrypted), connection: 'not_verified', enabled: s.config.is_enabled === true,
      notes: ['email_external_approval', 'auth_email_separate', ...(required ? ['worker_schedule_unverified'] : ['provider_optional'])] }))
  } else items.push(unavailable('brevo', true))

  if (available('events') && available('communications')) {
    const bindings = smsEvents.every(s => s.template_en_id && s.template_ar_id) && communications.every(s =>
      (!s.sms_enabled || s.sms_template_en && s.sms_template_ar) && (!s.email_enabled || s.email_template_en && s.email_template_ar))
    items.push(item('automation', smsSelected || emailSelected, [check('notification_bindings', bindings)], {
      enabled: smsSelected || emailSelected, notes: ['template_acceptance', 'worker_schedule_unverified']
    }))
  } else items.push(unavailable('automation', true))

  items.push(item('authentication', true, [check('owner_session', true), check('auth_redirects', null, 'operator'), check('auth_email_delivery', null, 'operator'), check('storage_acceptance', null, 'operator')], { notes: ['auth_operator', 'storage_unverified'] }))
  items.push(item('oauth', site?.auth_facebook_enabled === true || selections.oauth === true, [check('oauth_providers', null, 'operator')], {
    enabled: null, connection: 'not_verified', notes: ['oauth_operator', 'google_facebook_only', 'oauth_selection_unknown']
  }))
  items.push(available('chat') ? item('live_chat', data.chat.is_enabled === true || selections.live_chat === true, [check('chat_configuration', selections.live_chat === true ? data.chat.is_enabled === true : true),
    ...(data.chat.is_enabled || selections.live_chat === true ? [check('anonymous_auth_realtime', null, 'operator')] : [])], { enabled: data.chat.is_enabled === true, connection: 'not_verified', notes: ['chat_acceptance'] }) : unavailable('live_chat', true))

  const required = items.filter(i => i.required), complete = required.filter(i => i.configuration === 'complete').length
  return {
    version: 1, checkedAt: new Date(now).toISOString(), items,
    progress: { complete, total: required.length, percent: Math.round(complete * 100 / required.length) },
    readiness: { configuration: complete === required.length ? 'complete' : 'incomplete', blockers: required.filter(i => i.configuration !== 'complete').map(i => i.id),
      operationalAcceptance: 'not_verified', operationalReady: false },
    selection: 'saved_configuration',
    configuredSelections: { pdc: available('pdc') ? data.pdc.is_enabled === true || data.pdc.auto_create_labels === true || data.pdc.reverse_enabled === true : null,
      daftra: available('erp') ? resolveErpState(data.erp.settings, data.erp.credentials).mode === 'daftra' : null,
      vodafone: available('sms') && available('events') && available('communications') ? data.sms.is_enabled === true || smsSelected : null,
      brevo: available('email') && available('communications') ? data.email.config.is_enabled === true || emailSelected || data.email.config.webhook_enabled === true || data.email.config.marketing_enabled === true : null,
      paymob: site ? cardSelected : null, paypal: site ? site.payment_paypal_enabled === true : null,
      oauth: site ? site.auth_facebook_enabled === true : null, live_chat: available('chat') ? data.chat.is_enabled === true : null }
  }
}
