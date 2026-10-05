import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createServer } from 'node:http'
import { createApp, createError, getHeader, toNodeListener } from 'h3'
import { hasAdminPermission } from '../app/utils/adminPermissions.js'
import { createResetDatabase } from './helpers/resetDatabase.mjs'
import { smsDatabaseClient } from './helpers/smsDatabase.mjs'
import { decryptCredentialSecret } from '../server/utils/credentialSecrets.js'
import { smsHandler } from '../server/utils/sms/admin.js'
import { processSmsQueue } from '../server/utils/sms/service.js'
import { vodafoneProvider, VODAFONE_NAMESPACE } from '../server/utils/sms/vodafone.js'
globalThis.useRuntimeConfig = () => ({ credentialsEncryptionKey: 'sms-api-test-master-key-at-least-32-characters' })

test('actual SMS H3 routes with isolated SQL and mocked authenticated staff identities', async t => {
  const db = await createResetDatabase()
  const client = smsDatabaseClient(db)
  const ownerId = randomUUID(), viewerId = randomUUID(), senderId = randomUUID()
  const actors = {
    owner: { id: ownerId, role: 'owner', is_active: true, email: 'sms-owner@example.invalid' },
    viewer: { id: viewerId, role: 'admin', is_active: true, permissions: { 'sms.view': true, 'sms.settings.view': true, 'sms.history.view': true } },
    sender: { id: senderId, role: 'admin', is_active: true, permissions: { 'sms.view': true, 'sms.notification.send': true } }
  }
  globalThis.smsTestRequire = async (event, options) => {
    const token = getHeader(event, 'authorization')?.replace('Bearer ', '')
    const adminUser = actors[token]
    if (!adminUser) throw createError({ statusCode: 401, statusMessage: 'Invalid session.' })
    if (!hasAdminPermission(adminUser, options.permission)) throw createError({ statusCode: 403, statusMessage: 'You do not have permission for this action.' })
    return { adminUser, supabaseAdmin: client }
  }
  globalThis.defineEventHandler = handler => handler
  const app = createApp()
  app.use('/api/admin-sms/unavailable', smsHandler(async () => { throw Error('PRIVATE_CREDENTIAL_FIXTURE') }))
  for (const name of ['settings.get', 'settings.patch', 'capabilities.get', 'send.post', 'templates.get', 'templates.post', 'history.get']) {
    const file = resolve('server/api/admin-sms/' + name + '.js')
    let source = await readFile(file, 'utf8')
    source = source.replace(/from '([^']+)'/g, (all, specifier) => {
      if (specifier.endsWith('/adminRequest')) return "from 'data:text/javascript,export const requireAdminRequest=globalThis.smsTestRequire'"
      if (!specifier.startsWith('.')) return `from '${import.meta.resolve(specifier)}'`
      return `from '${pathToFileURL(resolve(dirname(file), specifier + (specifier.endsWith('.js') ? '' : '.js'))).href}'`
    })
    const handler = (await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))).default
    const [route, method] = name.split('.')
    app.use('/api/admin-sms/' + route, event => event.method.toLowerCase() === method ? handler(event) : undefined)
  }
  const server = createServer(toNodeListener(app))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const call = async (path, { actor = 'owner', method = 'GET', body, raw } = {}) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin-sms/${path}`, { method,
      headers: { authorization: actor ? 'Bearer ' + actor : '', 'content-type': 'application/json' }, body: raw ?? (body ? JSON.stringify(body) : undefined) })
    return { response, body: await response.json() }
  }
  try {
    for (const actor of Object.values(actors)) {
      await db.query('insert into auth.users(id,email) values($1,$2)', [actor.id, actor.email || actor.id + '@example.invalid'])
      await db.query('insert into public.admin_users(id,email,role) values($1,$2,$3)', [actor.id, actor.email || actor.id + '@example.invalid', actor.role])
    }
    await t.test('anonymous requests denied, disabled manual path blocked, no-cache responses', async () => {
      assert.equal((await call('settings', { actor: '' })).response.status, 401)
      const result = await call('settings')
      assert.equal(result.response.headers.get('cache-control'), 'private, no-store')
      assert.equal(result.body.settings.is_enabled, false)
      const blocked = await call('send', { method: 'POST', body: { trafficType: 'notification', recipients: ['01012345678'], text: 'Fixture', idempotencyKey: randomUUID() } })
      assert.equal(blocked.response.status, 503)
      assert.equal((await db.query('select count(*)::int n from public.sms_batches')).rows[0].n, 0)
    })
    await t.test('settings write uses encrypted replace-only secrets, revision guard and sanitized audit', async () => {
      const patch = { config_revision: 0, base_url: 'https://sms.example.invalid', sender_names: ['APP'], default_sender: 'APP', expected_outbound_ip: '8.8.8.8', account_id: 'api-account-fixture', password: 'api-password-fixture', hash_secret: 'cd'.repeat(16) }
      const result = await call('settings', { method: 'PATCH', body: patch })
      assert.equal(result.response.status, 200)
      assert.equal(result.body.settings.account_id_configured, true)
      for (const secret of [patch.account_id, patch.password, patch.hash_secret]) assert.ok(!JSON.stringify(result.body).includes(secret))
      const stored = (await db.query('select * from public.sms_provider_settings')).rows[0]
      assert.equal(decryptCredentialSecret(stored.account_id_encrypted, 'Vodafone'), patch.account_id)
      assert.equal((await call('settings', { method: 'PATCH', body: patch })).response.status, 409)
      assert.equal((await call('settings', { actor: 'viewer', method: 'PATCH', body: { config_revision: 1 } })).response.status, 403)
      const replaced = await call('settings', { method: 'PATCH', body: { config_revision: 1, password: 'replacement-fixture' } })
      assert.equal(replaced.response.status, 200)
      const audit = (await db.query("select metadata from public.admin_activity_logs where action_key='sms.settings.update' order by created_at desc limit 1")).rows[0].metadata
      assert.equal(audit.password_changed, true); assert.ok(!JSON.stringify(audit).includes('replacement-fixture'))
      const enabled = await call('settings', { method: 'PATCH', body: { config_revision: 2, trusted_ip_confirmed: true, activation_confirmed: true, hash_protocol_confirmed: true, is_enabled: true } })
      assert.equal(enabled.response.status, 200); assert.equal(enabled.body.settings.is_enabled, true)
    })
    await t.test('notification/campaign server permissions, confirmation and bulk limits enforced', async () => {
      const input = { trafficType: 'notification', recipients: ['01012345678'], text: 'Manual fixture', sender: 'APP', idempotencyKey: randomUUID() }
      assert.equal((await call('send', { actor: 'viewer', method: 'POST', body: input })).response.status, 403)
      assert.equal((await call('send', { actor: 'sender', method: 'POST', body: { ...input, trafficType: 'campaign', campaignConfirmed: true } })).response.status, 403)
      assert.equal((await call('send', { method: 'POST', body: { ...input, trafficType: 'campaign' } })).response.status, 400)
      assert.equal((await call('send', { method: 'POST', body: { ...input, recipients: ['01012345678', '01112345678'] } })).response.status, 400)
      const sent = await call('send', { actor: 'sender', method: 'POST', body: input })
      assert.equal(sent.response.status, 200); assert.equal(sent.body.status, 'queued')
      assert.equal((await call('send', { actor: 'sender', method: 'POST', body: input })).body.id, sent.body.id)
      const campaign = await call('send', { method: 'POST', body: { ...input, idempotencyKey: randomUUID(), trafficType: 'campaign', campaignConfirmed: true, recipients: ['01012345678', '01112345678'] } })
      assert.equal(campaign.response.status, 200)
      const duplicateCampaign = await call('send', { method: 'POST', body: { ...input, idempotencyKey: randomUUID(), trafficType: 'campaign', campaignConfirmed: true } })
      assert.equal(duplicateCampaign.response.status, 429)
    })
    await t.test('manual H3 Notification and Campaign both reach mocked Vodafone through the same queue', async () => {
      const paths = []
      const provider = { submit: (settings, credentials, batch, messages) => vodafoneProvider.submit(settings, credentials, batch, messages, async (url, xml) => {
        paths.push(url.pathname)
        assert.ok(xml.includes('<AccountId>api-account-fixture</AccountId>'))
        assert.ok(xml.includes('<ExternalTrxId>' + batch.external_trx_id + '</ExternalTrxId>'))
        return { status: 200, body: `<SubmitSMSResponse xmlns="${VODAFONE_NAMESPACE}">${messages.map(() => '<SMSStatus>SUBMITTED</SMSStatus>').join('')}<ResultStatus>SUCCESS</ResultStatus></SubmitSMSResponse>` }
      }) }
      for (let index = 0; index < 2; index++) {
        await db.query('update public.sms_provider_settings set next_request_at=null')
        const result = await processSmsQueue(client, { provider })
        assert.equal(result.processed[0].status, 'submitted')
      }
      assert.deepEqual(paths, ['/web2sms/sms/submit/Notification', '/web2sms/sms/submit'])
      assert.equal((await db.query("select count(*)::int n from public.sms_batches where trigger_source='dashboard_manual' and status='submitted'")).rows[0].n, 2)
    })
    await t.test('history masks phones and excludes bodies, secrets and credential ciphertext', async () => {
      const result = await call('history', { actor: 'viewer' })
      assert.equal(result.response.status, 200)
      const text = JSON.stringify(result.body)
      for (const sensitive of ['01012345678', '+201012345678', 'Manual fixture', 'api-account-fixture', 'replacement-fixture', 'account_id_encrypted']) assert.ok(!text.includes(sensitive))
      assert.ok(text.includes('••••••'))
      assert.equal((await call('history', { actor: 'sender' })).response.status, 403)
    })
    await t.test('template authoring safe variables, distinct permissions and bounded request body', async () => {
      const template = { code: 'manual_fixture', name: 'Fixture', category: 'manual', text_en: 'Hi {{name}}', text_ar: '', traffic_type: 'notification', sender: 'APP', is_enabled: false }
      assert.equal((await call('templates', { actor: 'sender', method: 'POST', body: template })).response.status, 403)
      const created = await call('templates', { method: 'POST', body: template })
      assert.equal(created.response.status, 200); assert.deepEqual(created.body.template.variables, ['name'])
      assert.equal((await call('templates', { method: 'POST', body: { ...template, text_en: '{{process.exit()}}' } })).response.status, 400)
      assert.equal((await call('settings', { method: 'PATCH', raw: 'x'.repeat(16385) })).response.status, 413)
      assert.equal((await call('settings', { method: 'PATCH', raw: '{' })).response.status, 400)
    })
    await t.test('unexpected server failures never echo private material and remain no-store', async () => {
      const result = await call('unavailable')
      assert.equal(result.response.status, 503)
      assert.equal(result.response.headers.get('cache-control'), 'private, no-store')
      assert.ok(!JSON.stringify(result.body).includes('PRIVATE_CREDENTIAL_FIXTURE'))
    })
    await t.test('missing singleton after full reset stays disabled and can be saved again', async () => {
      await db.query('delete from public.sms_batches')
      await db.query('delete from public.sms_provider_settings')
      const missing = await call('settings')
      assert.equal(missing.body.settings.is_enabled, false)
      assert.equal(missing.body.settings.account_id_configured, false)
      const recreated = await call('settings', { method: 'PATCH', body: { config_revision: 0, activation_notes: 'Recreated fixture' } })
      assert.equal(recreated.response.status, 200)
      assert.equal(recreated.body.settings.is_enabled, false)
      assert.equal((await db.query('select count(*)::int n from public.sms_provider_settings')).rows[0].n, 1)
    })
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await db.close() }
})
