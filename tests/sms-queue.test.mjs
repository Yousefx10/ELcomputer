import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createResetDatabase } from './helpers/resetDatabase.mjs'
import { smsDatabaseClient } from './helpers/smsDatabase.mjs'
import { createSmsService, processSmsQueue } from '../server/utils/sms/service.js'
import { validateSmsSettings, smsDefaults } from '../server/utils/sms/settings.js'
import { vodafoneProvider, VODAFONE_NAMESPACE } from '../server/utils/sms/vodafone.js'
globalThis.useRuntimeConfig = () => ({ credentialsEncryptionKey: 'sms-queue-test-master-key-at-least-32-chars' })
const migration = '20261005160000_vodafone_sms_foundation.sql'

test('real isolated SMS migration, service, ledger, submission and conservative recovery', async t => {
  const db = await createResetDatabase({ stopBefore: migration })
  const client = smsDatabaseClient(db)
  try {
    const original = (await db.query("select * from public.shipping_provider_settings where id='pdc'")).rows
    await db.exec(await readFile(new URL('../supabase/migrations/' + migration, import.meta.url), 'utf8'))
    const sms = createSmsService(client)
    const input = changes => ({ recipients: ['01012345678'], text: 'Fixture', idempotencyKey: randomUUID(), triggerSource: 'queue_test', ...changes })
    await t.test('migration preserves shipping, defaults off, private tables/RPCs and no browser access', async () => {
      assert.deepEqual((await db.query("select * from public.shipping_provider_settings where id='pdc'")).rows, original)
      assert.equal((await db.query("select is_enabled from public.sms_provider_settings")).rows[0].is_enabled, false)
      await assert.rejects(() => sms.sendNotification(input()), /disabled/)
      await assert.rejects(() => db.query("update public.sms_provider_settings set notification_path='/web2sms/sms/submit',campaign_path='/web2sms/sms/submit/Notification'"), /check constraint/)
      for (const role of ['anon', 'authenticated']) {
        await db.exec('set role ' + role)
        for (const table of ['sms_provider_settings', 'sms_templates', 'sms_batches', 'sms_messages', 'sms_attempts']) {
          await assert.rejects(() => db.query('select * from public.' + table), /permission denied/)
          await assert.rejects(() => db.query('insert into public.' + table + ' default values'), /permission denied/)
        }
        await assert.rejects(() => db.query('select public.sms_claim()'), /permission denied/)
        await assert.rejects(() => db.query('select public.sms_check_dispatch($1,$2,0)', [randomUUID(), randomUUID()]), /permission denied/)
        await db.exec('reset role')
      }
    })
    const secrets = validateSmsSettings({ account_id: 'fixture-account', password: 'fixture-password', hash_secret: 'AB'.repeat(16) }, smsDefaults)
    await client.from('sms_provider_settings').update({ ...secrets, base_url: 'https://sms.example.invalid', sender_names: ['APP'], default_sender: 'APP', expected_outbound_ip: '8.8.8.8', trusted_ip_confirmed: true, activation_confirmed: true, hash_protocol_confirmed: true, is_enabled: true }).eq('id', 'vodafone')
    const ready = async () => db.query("update public.sms_provider_settings set next_request_at=null")
    const batch = async id => (await db.query('select * from public.sms_batches where id=$1', [id])).rows[0]
    const xmlCalls = []
    const mockedProvider = { submit: (s, c, b, m, _transport, beforeDispatch) => vodafoneProvider.submit(s, c, b, m, async (url, xml, _timeout, beforePost) => {
      await beforePost()
      xmlCalls.push({ path: url.pathname, xml })
      return { status: 200, body: `<SubmitSMSResponse xmlns="${VODAFONE_NAMESPACE}">${m.map(() => '<SMSStatus>SUBMITTED</SMSStatus>').join('')}<ResultStatus>SUCCESS</ResultStatus></SubmitSMSResponse>` }
    }, beforeDispatch) }
    await t.test('content-bound idempotency persists one logical batch and unique transaction IDs', async () => {
      const request = input()
      const first = await sms.sendNotification(request), second = await sms.sendNotification(request)
      assert.equal(first.id, second.id); assert.equal(second.reused, true)
      await assert.rejects(() => sms.sendNotification({ ...request, text: 'Different' }), /already used/)
      const other = await sms.sendNotification(input())
      assert.notEqual(first.external_trx_id, other.external_trx_id)
      assert.match(first.external_trx_id, /^ELC-[0-9a-f-]{36}$/)
    })
    await t.test('mocked worker POST persists per-message acceptance and separates Campaign endpoint', async () => {
      // Remove only isolated queued fixtures created in the previous test.
      await db.query('delete from public.sms_batches')
      const notification = await sms.sendNotification(input())
      await processSmsQueue(client, { provider: mockedProvider })
      assert.equal((await batch(notification.id)).status, 'submitted')
      const campaign = await sms.sendCampaign(input({ recipients: ['01012345678', '01112345678'] }))
      await ready(); await processSmsQueue(client, { provider: mockedProvider })
      assert.equal((await batch(campaign.id)).status, 'submitted')
      assert.deepEqual(xmlCalls.map(call => call.path), ['/web2sms/sms/submit/Notification', '/web2sms/sms/submit'])
      assert.equal((await db.query('select count(*)::int n from public.sms_attempts')).rows[0].n, 2)
      assert.equal((await db.query("select count(*)::int n from public.sms_messages where status='submitted'")).rows[0].n, 3)
    })
    await t.test('ambiguous POST failures become uncertain with no automatic resend or new ID', async () => {
      const queued = await sms.sendNotification(input())
      let calls = 0
      const provider = { submit: async () => { calls++; throw Error('SENSITIVE_PROVIDER_TEXT') } }
      await ready(); await processSmsQueue(client, { provider })
      assert.equal((await batch(queued.id)).status, 'uncertain')
      await ready(); await processSmsQueue(client, { provider })
      assert.equal(calls, 1); assert.equal((await batch(queued.id)).external_trx_id, queued.external_trx_id)
      assert.ok(!JSON.stringify(await batch(queued.id)).includes('SENSITIVE_PROVIDER_TEXT'))
    })
    await t.test('only preflight failures retry, bounded attempts reuse the same ExternalTrxId', async () => {
      const queued = await sms.sendNotification(input())
      const ids = []
      const provider = { submit: async (_s, _c, b) => { ids.push(b.external_trx_id); const error = Error(); error.smsPreflight = true; throw error } }
      for (let i = 0; i < 3; i++) { await ready(); await db.query('update public.sms_batches set available_at=now() where id=$1', [queued.id]); await processSmsQueue(client, { provider }) }
      assert.equal((await batch(queued.id)).status, 'failed'); assert.equal(ids.length, 3); assert.equal(new Set(ids).size, 1)
    })
    await t.test('leases prevent another claim; stale dispatch becomes uncertain', async () => {
      const queued = await sms.sendNotification(input())
      await ready()
      const claim = (await client.rpc('sms_claim')).data
      assert.equal(claim.id, queued.id)
      await ready(); assert.equal((await client.rpc('sms_claim')).data?.id ?? null, null)
      await db.query("update public.sms_batches set locked_at=now()-interval '3 minutes' where id=$1", [queued.id])
      await ready(); await client.rpc('sms_claim')
      assert.equal((await batch(queued.id)).status, 'uncertain')
    })
    await t.test('a worker resumed after stale-lease recovery cannot POST', async () => {
      const queued = await sms.sendNotification(input())
      let calls = 0
      const provider = { submit: async (_settings, _credentials, job, _messages, _transport, beforeDispatch) => {
        await db.query("update public.sms_batches set locked_at=now()-interval '3 minutes' where id=$1", [job.id])
        await ready(); await client.rpc('sms_claim')
        await beforeDispatch()
        calls++
        return { messages: [{ status: 'submitted' }] }
      } }
      await ready()
      const result = await processSmsQueue(client, { provider })
      assert.equal(calls, 0)
      assert.equal(result.processed[0].status, 'uncertain')
      assert.equal((await batch(queued.id)).status, 'uncertain')
      assert.equal((await db.query('select status from public.sms_attempts where batch_id=$1', [queued.id])).rows[0].status, 'uncertain')
    })
    await t.test('a dispatch cannot begin twice with the same lease', async () => {
      const queued = await sms.sendNotification(input())
      await ready(); const claim = (await client.rpc('sms_claim')).data
      const args = { p_id: queued.id, p_token: claim.lease_token, p_revision: 0 }
      assert.equal((await client.rpc('sms_begin_dispatch', args)).data, true)
      assert.match((await client.rpc('sms_begin_dispatch', args)).error.message, /lease lost/)
      assert.equal((await db.query('select count(*)::int n from public.sms_attempts where batch_id=$1', [queued.id])).rows[0].n, 1)
      await client.rpc('sms_finish', { p_id: queued.id, p_token: claim.lease_token, p_result: { status: 'uncertain' } })
    })
    await t.test('disablement, revision changes, expiry and unrecovered stale leases cancel before POST', async () => {
      for (const mutation of [
        "update public.sms_provider_settings set is_enabled=false",
        "update public.sms_provider_settings set config_revision=config_revision+1",
        "update public.sms_batches set expires_at=now()-interval '1 second' where status='processing'",
        "update public.sms_batches set locked_at=now()-interval '3 minutes' where status='processing'"
      ]) {
        const queued = await sms.sendNotification(input())
        let calls = 0
        const provider = { submit: async (_s, _c, _b, _m, _transport, beforeDispatch) => {
          await db.query(mutation); await beforeDispatch(); calls++
          return { messages: [{ status: 'submitted' }] }
        } }
        await ready(); await processSmsQueue(client, { provider })
        assert.equal(calls, 0)
        assert.equal((await batch(queued.id)).status, 'failed')
        await db.query('update public.sms_provider_settings set is_enabled=true,config_revision=0')
      }
    })
    await t.test('expiry, priority, pacing, late disable and config revision are checked atomically', async () => {
      const low = await sms.sendNotification(input({ priority: 1 })), high = await sms.sendNotification(input({ priority: 90 }))
      await ready(); const claimed = (await client.rpc('sms_claim')).data
      assert.equal(claimed.id, high.id)
      await client.from('sms_provider_settings').update({ is_enabled: false }).eq('id', 'vodafone')
      assert.equal((await client.rpc('sms_begin_dispatch', { p_id: high.id, p_token: claimed.lease_token, p_revision: 0 })).data, false)
      assert.equal((await batch(high.id)).status, 'queued')
      await ready(); assert.equal((await client.rpc('sms_claim')).data?.id ?? null, null)
      await client.from('sms_provider_settings').update({ is_enabled: true }).eq('id', 'vodafone')
      await db.query("update public.sms_batches set expires_at=now()-interval '1 minute' where id=$1", [high.id])
      await ready(); const other = (await client.rpc('sms_claim')).data
      assert.equal(other.id, low.id); assert.equal((await batch(high.id)).failure_category, 'expired')
      await db.query('update public.sms_provider_settings set config_revision=1')
      assert.equal((await client.rpc('sms_begin_dispatch', { p_id: low.id, p_token: other.lease_token, p_revision: 0 })).data, false)
      await db.query('delete from public.sms_batches where status=\'queued\'')
    })
    await t.test('template traffic and variables validated before enqueue; no event integrations', async () => {
      await db.query("insert into public.sms_templates(code,name,text_en,text_ar,traffic_type,is_enabled) values('manual_fixture','Fixture','Hi {{name}}','أهلًا {{name}}','notification',true)")
      const queued = await sms.sendNotification(input({ templateCode: 'manual_fixture', locale: 'en', variables: { name: 'Buyer' } }))
      assert.equal((await db.query('select body from public.sms_messages where batch_id=$1', [queued.id])).rows[0].body, 'Hi Buyer')
      await assert.rejects(() => sms.sendCampaign(input({ templateCode: 'manual_fixture', locale: 'en', variables: { name: 'Buyer' } })), /template is unavailable/)
      await assert.rejects(() => sms.sendNotification(input({ templateCode: 'manual_fixture', locale: 'en', variables: {} })), /variables/)
    })
    await t.test('full reset refuses an active SMS lease before destructive changes', async () => {
      const owner = randomUUID()
      await db.query("insert into auth.users(id,email) values($1,'sms-reset-owner@example.invalid')", [owner])
      await db.query("insert into public.admin_users(id,email,role) values($1,'sms-reset-owner@example.invalid','owner')", [owner])
      await db.query("select set_config('request.jwt.claim.role','service_role',false)")
      await ready(); const claim = (await client.rpc('sms_claim')).data
      assert.ok(claim.id)
      await assert.rejects(() => db.query("select public.system_reset_begin($1,'full',$2)", [owner, randomUUID()]), /Wait for the SMS worker/)
      assert.equal((await batch(claim.id)).status, 'processing')
      assert.equal((await db.query('select count(*)::int n from public.system_reset_runs')).rows[0].n, 0)
    })
  } finally { await db.close() }
})
