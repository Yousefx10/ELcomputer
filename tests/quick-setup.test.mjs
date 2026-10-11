import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build } from 'esbuild'
import { buildQuickSetupStatus } from '../server/utils/quickSetup.js'
import { createSetupFixture, SETUP_CANARY } from './helpers/setupFixture.mjs'
import { getDashboardRouteRequirement } from '../app/utils/adminPermissions.js'
import { buildDashboardNavigation } from '../app/utils/dashboardNavigation.js'
import { setupSections, setupLinks } from '../app/utils/quickSetup.js'

const now = Date.parse('2026-10-11T18:00:00Z')
const make = () => {
  const runtime = { credentialsEncryptionKey: SETUP_CANARY, shippingCredentialsEncryptionKey: SETUP_CANARY,
    supabaseServiceRoleKey: SETUP_CANARY, paymobEnabled: false, paymobMode: 'test',
    public: { supabaseUrl: 'https://fixture.example.invalid', supabase: { key: 'public-key' }, siteUrl: 'https://store.example.invalid' } }
  globalThis.useRuntimeConfig = () => runtime
  return { runtime, data: {
    site: { site_name: 'Fixture', site_logo_url: '/uploads/logo.png', footer_email: 'store@example.invalid', footer_address: 'Address', payment_cash_enabled: true },
    erp: { settings: { erp_mode: 'built_in', daftra_connection_status: 'disconnected', daftra_last_checked_at: null }, credentials: { configured: false, credentialsSaved: false, revision: 0 } },
    sms: { is_enabled: false, base_url: '', sender_names: [], config_revision: 0 },
    email: { api_key_encrypted: null, config: { is_enabled: false, approved_senders: [] } },
    pdc: { is_enabled: false, auto_create_labels: false, reverse_enabled: false }, couriers: [{ is_active: true }],
    policies: [{ warranty_enabled: false, return_enabled: false }], events: [], communications: [], chat: { is_enabled: false }, catalog: true
  } }
}
const run = fixture => buildQuickSetupStatus(fixture.data, fixture.runtime, { now, encryptionReady: true, shippingEncryptionReady: true })
const entry = (status, id) => status.items.find(item => item.id === id)

test('unused integrations stay optional and progress remains separate from acceptance', () => {
  const s = run(make())
  for (const id of ['daftra', 'vodafone', 'brevo', 'paymob', 'paypal', 'express_payments', 'policies', 'automation', 'live_chat', 'oauth']) assert.equal(entry(s, id).required, false, id)
  assert.deepEqual(s.progress, { complete: 6, total: 7, percent: 86 })
  assert.deepEqual(s.readiness.blockers, ['authentication'])
  assert.equal(s.readiness.operationalReady, false)
  assert.equal(s.readiness.operationalAcceptance, 'not_verified')
})

test('missing essential configuration and inaccessible modules fail closed', () => {
  const f = make(); f.data.site = null; f.data.email = null; f.data.events = null; f.runtime.public.siteUrl = 'http://localhost:3000'
  const s = run(f)
  for (const id of ['application', 'branding', 'contact', 'payment_methods', 'infrastructure', 'brevo', 'automation']) assert.ok(s.readiness.blockers.includes(id), id)
  assert.equal(entry(s, 'brevo').configuration, 'not_verified')
  assert.ok(s.progress.percent < 86)
})

test('saved credentials neither verify connections nor enable disabled providers', () => {
  const f = make(); f.data.sms.account_id_encrypted = SETUP_CANARY; f.data.email.api_key_encrypted = SETUP_CANARY
  f.data.erp.credentials = { configured: true, credentialsSaved: true, revision: 3 }
  const s = run(f)
  for (const id of ['daftra', 'vodafone', 'brevo']) { assert.equal(entry(s, id).connection, 'not_verified'); assert.equal(entry(s, id).enabled, false) }
  assert.equal(entry(s, 'brevo').credentialsSaved, true)
  assert.equal(entry(s, 'brevo').configuration, 'incomplete')
  assert.ok(!JSON.stringify(s).includes(SETUP_CANARY))
})

test('Daftra evidence requires matching credentials, fresh time and successful saved test', () => {
  const f = make(); f.data.erp.credentials = { configured: true, credentialsSaved: true, revision: 3 }
  Object.assign(f.data.erp.settings, { daftra_connection_status: 'connected', daftra_last_checked_at: new Date(now - 1000).toISOString(), daftra_tested_revision: 3 })
  assert.equal(entry(run(f), 'daftra').connection, 'verified')
  assert.equal(entry(run(f), 'daftra').enabled, false)
  f.data.erp.settings.daftra_tested_revision = 2; assert.equal(entry(run(f), 'daftra').connection, 'stale')
  f.data.erp.settings.daftra_tested_revision = 3; f.data.erp.settings.daftra_connection_status = 'error'; assert.equal(entry(run(f), 'daftra').connection, 'failed')
  for (const value of [new Date(now - 86400001).toISOString(), new Date(now + 1000).toISOString()]) { f.data.erp.settings.daftra_last_checked_at = value; assert.equal(entry(run(f), 'daftra').connection, 'stale') }
  f.data.erp.settings.daftra_last_checked_at = SETUP_CANARY; assert.equal(entry(run(f), 'daftra').lastCheckedAt, null)
})

test('active Daftra ownership does not fall back when the connection fails', () => {
  const f = make(); f.data.erp.settings.erp_mode = 'daftra'
  const s = run(f), d = entry(s, 'daftra')
  assert.equal(d.enabled, true); assert.equal(d.required, true); assert.equal(d.configuration, 'incomplete')
  assert.ok(d.notes.includes('daftra_active')); assert.ok(s.readiness.blockers.includes('daftra'))
})

test('complete SMS and Email configuration remains unverified and requires workers when selected', () => {
  const f = make()
  Object.assign(f.data.sms, { account_id_encrypted: SETUP_CANARY, password_encrypted: SETUP_CANARY, hash_secret_encrypted: SETUP_CANARY,
    base_url: 'https://sms.example.invalid', default_sender: 'Store', sender_names: ['Store'], notification_path: '/web2sms/sms/submit/Notification', campaign_path: '/web2sms/sms/submit', expected_outbound_ip: '203.0.113.4', trusted_ip_confirmed: true, activation_confirmed: true, hash_protocol_confirmed: true })
  Object.assign(f.data.email, { api_key_encrypted: SETUP_CANARY, config: { approved_senders: [{ email: 'store@example.invalid', verified: true }], transactional_sender: 'store@example.invalid', account_approved: true, activation_confirmed: true, is_enabled: false } })
  for (const id of ['vodafone', 'brevo']) { assert.equal(entry(run(f), id).configuration, 'complete'); assert.equal(entry(run(f), id).connection, 'not_verified') }
  f.data.sms.is_enabled = true; f.data.email.config.is_enabled = true
  for (const id of ['vodafone', 'brevo']) assert.equal(entry(run(f), id).configuration, 'incomplete')
  f.runtime.smsWorkerSecret = SETUP_CANARY; f.runtime.emailWorkerSecret = SETUP_CANARY
  for (const id of ['vodafone', 'brevo']) assert.equal(entry(run(f), id).configuration, 'complete')
  f.data.sms.base_url = 'https://127.0.0.1'; assert.equal(entry(run(f), 'vodafone').configuration, 'incomplete')
})

test('selected notification consumers require their provider even when disabled', () => {
  const f = make(); f.data.events = [{ is_enabled: true, template_en_id: null, template_ar_id: null }]
  f.data.communications = [{ is_enabled: true, email_enabled: true, email_template_en: null, email_template_ar: null }]
  const s = run(f)
  for (const id of ['vodafone', 'brevo', 'automation']) assert.ok(s.readiness.blockers.includes(id), id)
})

test('enabled Email callbacks or marketing controls cannot be treated as an unused provider', () => {
  for (const key of ['webhook_enabled', 'marketing_enabled']) {
    const f = make(); f.data.email.config[key] = true
    const s = run(f)
    assert.equal(entry(s, 'brevo').required, true)
    assert.equal(entry(s, 'brevo').enabled, false)
    assert.ok(s.readiness.blockers.includes('brevo'))
  }
})

test('Paymob reports test capability without presenting live payment support', () => {
  const f = make(); Object.assign(f.runtime, { paymobSecretKey: 'egy_sk_test_' + SETUP_CANARY, paymobPublicKey: 'egy_pk_test_fixture', paymobHmacSecret: SETUP_CANARY, paymobCardIntegrationId: 12, paymobCardIntegrationMode: 'test' })
  f.data.site.payment_card_enabled = true
  assert.equal(entry(run(f), 'paymob').configuration, 'complete'); assert.equal(entry(run(f), 'paymob').enabled, false)
  assert.equal(entry(run(f), 'paymob').required, false)
  f.runtime.paymobEnabled = true
  assert.equal(entry(run(f), 'paymob').required, true); assert.ok(run(f).readiness.blockers.includes('payment_methods'))
  f.runtime.paymobMode = 'live'; assert.equal(entry(run(f), 'paymob').configuration, 'unsupported')
  f.data.site.payment_cash_enabled = false; assert.equal(entry(run(f), 'payment_methods').configuration, 'incomplete')
})

test('PayPal, wallets and incomplete transfer proof support never imply working gateways', () => {
  const f = make(); f.data.site.payment_paypal_enabled = true; f.data.site.payment_bank_transfer_enabled = true; f.data.site.payment_bank_transfer_instructions = 'Transfer instructions'
  const s = run(f)
  assert.equal(entry(s, 'paypal').configuration, 'unsupported'); assert.ok(s.readiness.blockers.includes('paypal'))
  assert.equal(entry(s, 'express_payments').configuration, 'unsupported')
  assert.ok(s.readiness.blockers.includes('payment_methods'))
  assert.ok(entry(s, 'payment_methods').notes.includes('transfer_proof_unavailable'))
})

test('PDC configuration uses existing validation and keeps read-only status unverified', () => {
  const f = make(); Object.assign(f.data.pdc, { is_enabled: true, access_token_encrypted: SETUP_CANARY, webhook_secret_encrypted: SETUP_CANARY,
    api_mode: 'production', base_url: 'https://clientsapi.pdc-eg.com/api/ClientUsers/V6/', status_timezone: 'Africa/Cairo', company_id: '123', product_id: 40,
    origin_city_id: 1, origin_address: 'Address', origin_phone: '01012345678', origin_contact_name: 'Store', default_weight_kg: 1, shipment_type_id: 1,
    label_template_id: 1, allow_open_shipment: false, all_must_valid: true })
  assert.equal(entry(run(f), 'shipping').configuration, 'incomplete')
  f.runtime.shippingLiveRequestsEnabled = true
  assert.equal(entry(run(f), 'shipping').configuration, 'complete'); assert.equal(entry(run(f), 'shipping').connection, 'not_verified')
  f.data.pdc.base_url = 'https://attacker.example.invalid'; assert.equal(entry(run(f), 'shipping').configuration, 'incomplete')
})

test('owner-only navigation, route requirements and existing editor destinations', async () => {
  assert.deepEqual(getDashboardRouteRequirement('/dashboard/setup'), { role: 'owner' })
  assert.ok(!buildDashboardNavigation({ isOwner: false }).some(group => group.key === 'setup'))
  for (const externalErpActive of [false, true]) assert.equal(buildDashboardNavigation({ isOwner: true }, { externalErpActive }).find(group => group.key === 'setup').to, '/dashboard/setup')
  const ids = setupSections.flatMap(s => s.items)
  assert.deepEqual(ids.sort(), run(make()).items.map(i => i.id).sort())
  for (const links of Object.values(setupLinks)) for (const link of links) {
    assert.ok(link.to.startsWith('/dashboard/'))
    assert.ok(!/reset|send|sync/.test(link.to))
    const destination = new URL(link.to, 'https://fixture.invalid')
    if (destination.pathname === '/dashboard/commerce') assert.equal(destination.searchParams.get('tab'), 'shipping')
    else assert.ok(getDashboardRouteRequirement({ path: destination.pathname, query: Object.fromEntries(destination.searchParams) }))
  }
  const en = JSON.parse(await readFile('i18n/locales/en.json', 'utf8')).quickSetup, ar = JSON.parse(await readFile('i18n/locales/ar.json', 'utf8')).quickSetup
  const flatten = o => Object.entries(o).flatMap(([k, v]) => typeof v === 'object' ? flatten(v).map(x => k + '.' + x) : [k])
  assert.deepEqual(flatten(en).sort(), flatten(ar).sort())
  for (const s of run(make()).items) { assert.ok(en.items[s.id]); for (const c of s.checks) assert.ok(en.checks[c.id]); for (const note of s.notes) assert.ok(en.notes[note]) }
})

test('actual Dashboard middleware denies setup access even with full admin permissions', async () => {
  const output = await build({ entryPoints: [resolve('app/middleware/dashboard-auth.global.js')], bundle: true, write: false, format: 'esm', platform: 'node', alias: { '~': resolve('app') } })
  globalThis.defineNuxtRouteMiddleware = fn => fn
  const middleware = (await import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'))).default
  let actor = null, signouts = 0
  globalThis.useUiNavigation = () => ({ uiNavigateTo: route => route })
  globalThis.useSupabaseClient = () => ({ auth: { signOut: () => { signouts++ } } })
  globalThis.useAdminAccess = () => ({ adminUser: { value: actor }, adminAccessLoaded: { value: true }, clearAdminAccess: () => {}, hasPermission: () => true, hasAnyPermission: () => true, loadAdminAccess: async () => actor })
  globalThis.useNuxtData = () => ({ data: { value: null } })
  globalThis.useActiveErp = async () => ({ data: { value: { mode: 'built_in' } }, error: { value: null }, refresh: () => {} })
  for (const path of ['/dashboard/setup', '/ar/dashboard/setup']) {
    actor = null; assert.equal(await middleware({ path }), '/dashboard/login')
    actor = { role: 'admin', is_active: true }; assert.equal(await middleware({ path }), '/dashboard')
    actor = { role: 'owner', is_active: false }; assert.equal((await middleware({ path })).path, '/dashboard/login')
    actor = { role: 'owner', is_active: true }; assert.equal(await middleware({ path }), undefined)
  }
  assert.equal(signouts, 0, 'SSR guard does not perform client signout')
})

test('actual setup HTTP authorization, redaction, read-only SQL and zero provider calls', async t => {
  const f = await createSetupFixture(), { url, close } = await f.start(), httpFetch = globalThis.fetch
  const call = async actor => {
    const response = await httpFetch(url + '/api/admin-setup/status?diagnostic=' + SETUP_CANARY, { headers: actor ? { authorization: 'Bearer ' + actor } : {} })
    const text = await response.text()
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
    assert.ok(!text.includes(SETUP_CANARY)); assert.doesNotMatch(text, /_encrypted|api_key|supabaseServiceRoleKey|author_email|account_url/)
    return { status: response.status, data: JSON.parse(text) }
  }
  try {
    const before = await f.snapshot(); f.queries.length = 0
    globalThis.fetch = async () => { throw Error('Passive setup cannot call an external provider.') }
    await t.test('anonymous, customer, inactive, expired and every non-owner role denied', async () => {
      for (const actor of [null, 'customer', 'inactive', 'invalid', 'viewer', 'manager', 'sender', 'templates', 'history', 'preferences']) assert.ok([401, 403].includes((await call(actor)).status), String(actor))
      assert.ok(f.queries.every(sql => /from public.admin_users/.test(sql)), 'Denied requests do not read integration settings')
    })
    await t.test('owner reads real fixture configuration without changing any public table', async () => {
      f.queries.length = 0
      const result = await call('owner'); assert.equal(result.status, 200); assert.equal(result.data.readiness.operationalReady, false)
      assert.equal(entry(result.data, 'vodafone').enabled, false)
      assert.ok(f.queries.length >= 10); assert.ok(f.queries.every(sql => /^\s*select\b/i.test(sql)))
      assert.ok(f.queries.every(sql => !/public\.[a-z_]+\(/i.test(sql)), 'No RPC invocation')
      assert.deepEqual(await f.snapshot(), before)
    })
    await t.test('partial schema failures produce fixed status without raw database errors', async () => {
      await f.db.exec('alter table public.email_provider_settings rename to unavailable_email_provider_settings')
      const result = await call('owner'); assert.equal(result.status, 200); assert.equal(entry(result.data, 'brevo').configuration, 'not_verified')
      assert.ok(result.data.readiness.blockers.includes('brevo'))
    })
    await t.test('revoked owner is denied on the next request', async () => {
      await f.db.query('update public.admin_users set is_active=false where id=$1', [f.actors.owner])
      assert.equal((await call('owner')).status, 403)
    })
  } finally { globalThis.fetch = httpFetch; await close() }
})
