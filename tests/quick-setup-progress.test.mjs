import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createResetDatabase } from './helpers/resetDatabase.mjs'
import { createSetupFixture, SETUP_CANARY } from './helpers/setupFixture.mjs'
import { readQuickSetupProgress, mutateQuickSetup, validateSetupMutation } from '../server/utils/quickSetupProgress.js'
import { setupItemIds, setupOptionalIntegrations, setupAcceptanceDomains, setupVerificationDomains } from '../app/utils/quickSetup.js'
import { resetRetainedSetupTables, systemResetScopes } from '../server/utils/systemResetScopes.js'

const item = (s, id) => s.items.find(i => i.id === id)
const ack = (s, key) => s.setup.acknowledgements.find(a => a.key === key)
const status = f => readQuickSetupProgress(f.client, f.runtime)
const change = async (f, input) => {
  const s = await status(f)
  await mutateQuickSetup(f.client, f.runtime, f.actors.owner, { revision: s.setup.revision, ...input })
  return status(f)
}
const capture = async (f, key) => { const s = await status(f); return change(f, { action: 'capture', key, basisToken: item(s, key).evidence.basisToken }) }
const acknowledge = async (f, key, acknowledged = true) => { const s = await status(f); return change(f, { action: 'acknowledge', key, acknowledged, basisToken: ack(s, key).basisToken }) }
const relevant = snapshot => Object.fromEntries(Object.entries(snapshot).filter(([k]) => !k.startsWith('quick_setup_') && k !== 'admin_activity_logs'))

test('additive 69-to-70 upgrade preserves every existing row and dormant control', async () => {
 const database = await createResetDatabase({ stopBefore: '20261012120000_quick_setup_progress.sql' })
 const f = await createSetupFixture({ database })
 try {
  const before = await f.snapshot()
  assert.equal((await status(f)).setup.available, false)
  await database.exec(await readFile(new URL('../supabase/migrations/20261012120000_quick_setup_progress.sql', import.meta.url), 'utf8'))
  const after = await f.snapshot()
  assert.deepEqual(Object.fromEntries(Object.entries(after).filter(([k]) => !k.startsWith('quick_setup_'))), before)
  assert.equal((await status(f)).setup.available, true)
  assert.equal((await status(f)).setup.revision, 0)
 } finally { await database.close() }
})

test('persistent installation selections, acknowledgements and history preserve configuration and provider OFF states', async () => {
 const f = await createSetupFixture()
 try {
  const before = await f.snapshot(), initial = await status(f)
  assert.equal(initial.setup.available, true); assert.equal(initial.setup.revision, 0)
  assert.equal(initial.setup.history.length, 0)
  let s = await change(f, { action: 'selection', key: 'vodafone', selected: true })
  assert.equal(s.setup.revision, 1); assert.equal(item(s, 'vodafone').required, true); assert.equal(item(s, 'vodafone').enabled, false)
  assert.equal(item(s, 'vodafone').configuration, 'incomplete')
  assert.equal((await status(f)).setup.installationId, initial.setup.installationId)
  s = await acknowledge(f, 'auth')
  assert.equal(ack(s, 'auth').state, 'acknowledged'); assert.equal(s.setup.ownerReviewProgress.complete, 1)
  assert.equal(s.readiness.operationalReady, false); assert.equal(item(s, 'authentication').configuration, 'not_verified')
  assert.equal(s.setup.history[0].source, 'owner_report'); assert.equal(s.setup.history[0].outcome, 'acknowledged')
  s = await acknowledge(f, 'auth', false); assert.equal(ack(s, 'auth').state, 'revoked')
  s = await capture(f, 'vodafone'); assert.equal(item(s, 'vodafone').evidence.state, 'unverified')
  assert.equal(item(s, 'vodafone').evidence.source, 'configuration_snapshot')
  assert.deepEqual(relevant(await f.snapshot()), relevant(before))
  assert.equal((await f.db.query("select count(*)::int n from public.admin_activity_logs where action_key like 'settings.quick_setup.%'")).rows[0].n, 4)
  assert.doesNotMatch(JSON.stringify(s), /_encrypted|actor_id|api_key|account_url|basis_revisions/)
  assert.ok(!JSON.stringify(s).includes(SETUP_CANARY))
 } finally { await f.db.close() }
})

test('owner exclusion cannot hide an integration used by current settings', async () => {
 const f = await createSetupFixture()
 try {
  await f.db.query("update public.sms_provider_settings set is_enabled=true,base_url='https://sms.example.invalid',account_id_encrypted='fixture-encrypted',password_encrypted='fixture-encrypted',hash_secret_encrypted='fixture-encrypted',default_sender='Store',sender_names=array['Store'],expected_outbound_ip='203.0.113.4',trusted_ip_confirmed=true,activation_confirmed=true,hash_protocol_confirmed=true where id='vodafone'")
  f.runtime.smsWorkerSecret = ''
  const s = await change(f, { action: 'selection', key: 'vodafone', selected: false })
  assert.equal(s.setup.selections.find(x => x.key === 'vodafone').inUse, true)
  assert.equal(item(s, 'vodafone').required, true); assert.ok(s.readiness.blockers.includes('vodafone'))
 } finally { await f.db.close() }
})

test('all eight optional choices persist without provider activation, including unsupported selections', async () => {
 const f = await createSetupFixture()
 try {
  for (const key of setupOptionalIntegrations) {
   const s = await change(f, { action: 'selection', key, selected: true })
   assert.equal(s.setup.selections.find(x => x.key === key).selected, true)
   assert.equal(item(s, key === 'pdc' ? 'shipping' : key).required, true)
  }
  const s = await status(f); assert.equal(item(s, 'paypal').configuration, 'unsupported')
  for (const id of ['shipping','daftra','vodafone','brevo','paymob']) assert.equal(item(s, id).enabled, false)
  assert.equal(s.readiness.operationalReady, false)
 } finally { await f.db.close() }
})

test('configuration ABA, runtime changes, key rotation and owner choices invalidate relevant evidence', async () => {
 const f = await createSetupFixture()
 try {
  let s = await capture(f, 'branding'), generation = item(s, 'branding').evidence.configurationRevision
  await f.db.query("update public.site_settings set site_name='Changed' where key='default'")
  await f.db.query("update public.site_settings set site_name='Fixture Store' where key='default'")
  s = await status(f); assert.equal(item(s, 'branding').evidence.state, 'stale'); assert.equal(item(s, 'branding').evidence.configurationRevision, generation + 2)
  s = await acknowledge(f, 'workers'); assert.equal(ack(s, 'workers').state, 'acknowledged')
  f.runtime.smsWorkerSecret += '-rotation'; s = await status(f); assert.equal(ack(s, 'workers').state, 'stale')
  s = await acknowledge(f, 'auth'); await change(f, { action: 'selection', key: 'oauth', selected: true }); s = await status(f); assert.equal(ack(s, 'auth').state, 'stale')
  s = await acknowledge(f, 'backup'); f.runtime.supabaseServiceRoleKey += '-rotation'; s = await status(f); assert.equal(ack(s, 'backup').state, 'stale')
 } finally { await f.db.close() }
})

test('unrelated timestamps and content changes do not invalidate independent provider evidence', async () => {
 const f = await createSetupFixture()
 try {
  let s = await capture(f, 'vodafone'), token = item(s, 'vodafone').evidence.basisToken
  await f.db.query("update public.sms_provider_settings set updated_at=now() where id='vodafone'")
  await f.db.query("update public.site_settings set site_name='Changed branding' where key='default'")
  s = await status(f); assert.equal(item(s, 'vodafone').evidence.basisToken, token); assert.equal(item(s, 'vodafone').evidence.state, 'unverified')
 } finally { await f.db.close() }
})

test('choice ABA, payment options and notification edits invalidate only dependent confirmations', async () => {
 const f = await createSetupFixture()
 try {
  let s = await capture(f, 'shipping'), original = item(s, 'shipping').evidence.basisToken
  await acknowledge(f, 'backup')
  await change(f, { action: 'selection', key: 'pdc', selected: true })
  s = await change(f, { action: 'selection', key: 'pdc', selected: false })
  assert.equal(item(s, 'shipping').evidence.state, 'stale')
  assert.notEqual(item(s, 'shipping').evidence.basisToken, original)
  assert.equal(ack(s, 'backup').state, 'acknowledged')
  await capture(f, 'paymob')
  await f.db.query("update public.site_settings set payment_card_enabled=true where key='default'")
  assert.equal(item(await status(f), 'paymob').evidence.state, 'stale')
  await capture(f, 'paymob'); f.runtime.paymobIntegrationIds = '{"mobile_wallet":{"id":3,"mode":"test","enabled":false}}'
  assert.equal(item(await status(f), 'paymob').evidence.state, 'stale')
  await capture(f, 'vodafone'); await capture(f, 'brevo')
  await f.db.query("update public.sms_templates set name=name||' Reviewed' where code='order_confirmed'")
  s = await status(f)
  assert.equal(item(s, 'vodafone').evidence.state, 'stale')
  assert.equal(item(s, 'brevo').evidence.state, 'stale')
 } finally { await f.db.close() }
})

test('database dependency sets match application rules and reject fabricated verification', async () => {
 const f = await createSetupFixture()
 try {
  for (const [action, registry] of [['capture', setupVerificationDomains], ['acknowledge', setupAcceptanceDomains]])
   for (const [key, domains] of Object.entries(registry)) assert.deepEqual((await f.db.query('select public.quick_setup_domains($1,$2) domains', [action, key])).rows[0].domains, domains)
  const generations = (await f.db.query('select revisions from public.quick_setup_snapshot')).rows[0].revisions
  const base = { action: 'capture', key: 'vodafone', revision: 0, basis_token: 'a'.repeat(64), revisions: { vodafone: generations.vodafone, automation: generations.automation }, source: 'configuration_snapshot', outcome: 'unverified' }
  for (const forged of [{ ...base, revisions: { vodafone: generations.vodafone } }, { ...base, outcome: 'verified' }, { ...base, source: 'existing_check', outcome: 'verified' }, { ...base, key: 'daftra', revisions: { daftra: generations.daftra }, source: 'existing_check', outcome: 'verified' }])
   await assert.rejects(() => f.db.query('select public.quick_setup_mutate($1,$2)', [f.actors.owner, forged]), e => ['22023','40001'].includes(e.code))
  assert.equal((await status(f)).setup.revision, 0)
 } finally { await f.db.close() }
})

test('status retries changed snapshots and fails closed on continuing configuration races', async () => {
 const f = await createSetupFixture()
 try {
  const query = f.db.query.bind(f.db)
  let snapshots = 0, changes = 1
  f.db.query = async (sql, values) => {
   const result = await query(sql, values)
   if (/from public.quick_setup_snapshot/.test(sql)) {
    snapshots++
    if (changes > 0) { changes--; await query("update public.site_settings set site_name=site_name||' Changed' where key='default'") }
   }
   return result
  }
  let s = await status(f)
  assert.equal(s.setup.available, true); assert.equal(snapshots, 4)
  snapshots = 0; changes = 4
  await assert.rejects(() => status(f), e => e.statusCode === 503)
  assert.equal(snapshots, 4)
  f.db.query = query
  s = await status(f); assert.equal(s.setup.history.length, 0)
 } finally { await f.db.close() }
})

test('existing fresh Daftra test is the only supported verified connection source; stale, failed and missing remain truthful', async () => {
 const f = await createSetupFixture()
 try {
  f.runtime.daftraAccountUrl = 'https://fixture.daftra.com'
  await f.db.query("update public.site_settings set daftra_connection_status='connected',daftra_last_checked_at=now(),daftra_tested_revision=0 where key='default'")
  let s = await capture(f, 'daftra'); assert.equal(item(s, 'daftra').evidence.state, 'unverified')
  assert.equal(item(s, 'daftra').connection, 'not_verified'); assert.ok(item(s, 'daftra').notes.includes('runtime_connection_unbound'))
  await f.db.query("insert into public.erp_provider_settings(id,account_url,api_key_encrypted) values('daftra','https://fixture.daftra.com','fixture-encrypted')")
  await f.db.query("update public.site_settings set daftra_connection_status='connected',daftra_last_checked_at=clock_timestamp(),daftra_tested_revision=1 where key='default'")
  s = await capture(f, 'daftra'); assert.equal(item(s, 'daftra').evidence.state, 'verified'); assert.equal(item(s, 'daftra').enabled, false)
  f.runtime.credentialsEncryptionKey += '-rotated'
  assert.equal(item(await status(f), 'daftra').evidence.state, 'stale')
  await f.db.exec('alter table public.site_settings rename to unavailable_site_settings')
  s = await capture(f, 'daftra'); assert.equal(item(s, 'daftra').evidence.state, 'unavailable')
  await f.db.exec('alter table public.unavailable_site_settings rename to site_settings')
  for (let i = 0; i < 2; i++) { s = await capture(f, 'daftra'); assert.equal(item(s, 'daftra').evidence.state, 'stale') }
  await f.db.query("update public.site_settings set daftra_last_checked_at=clock_timestamp() where key='default'")
  s = await capture(f, 'daftra'); assert.equal(item(s, 'daftra').evidence.state, 'verified')
  await f.db.query("update public.site_settings set daftra_connection_status='error',daftra_last_checked_at=now() where key='default'")
  s = await status(f); assert.equal(item(s, 'daftra').evidence.state, 'stale')
  s = await capture(f, 'daftra'); assert.equal(item(s, 'daftra').evidence.state, 'failed')
  await f.db.query("update public.site_settings set daftra_last_checked_at=now()-interval '2 days' where key='default'")
  s = await capture(f, 'daftra'); assert.equal(item(s, 'daftra').evidence.state, 'stale')
  s = await capture(f, 'paypal'); assert.equal(item(s, 'paypal').evidence.state, 'unavailable')
  await f.db.exec('alter table public.email_provider_settings rename to fixture_email_unavailable')
  s = await capture(f, 'brevo'); assert.equal(item(s, 'brevo').evidence.state, 'unavailable')
 } finally { await f.db.close() }
})

test('expired acknowledgements become stale without writes and unavailable persistence preserves Phase 1 reads', async () => {
 const f = await createSetupFixture()
 try {
  await acknowledge(f, 'auth')
  const before = await f.snapshot(), future = await readQuickSetupProgress(f.client, f.runtime, Date.now() + 8 * 86400000)
  assert.equal(ack(future, 'auth').state, 'stale'); assert.deepEqual(await f.snapshot(), before)
  await f.db.exec('alter view public.quick_setup_snapshot rename to unavailable_snapshot')
  const s = await status(f); assert.equal(s.setup.available, false); assert.ok(s.items.length === setupItemIds.length)
  await assert.rejects(() => mutateQuickSetup(f.client, f.runtime, f.actors.owner, { action: 'selection', key: 'brevo', revision: 1, selected: true }), error => error.statusCode === 503)
 } finally { await f.db.close() }
})

test('safe concurrent revisions reject lost updates, forged evidence and post-read configuration changes', async () => {
 const f = await createSetupFixture()
 try {
  const s = await status(f), input = { action: 'selection', key: 'brevo', selected: true, revision: s.setup.revision }
  const results = await Promise.allSettled([mutateQuickSetup(f.client, f.runtime, f.actors.owner, input), mutateQuickSetup(f.client, f.runtime, f.actors.owner, input)])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal(results.find(r => r.status === 'rejected').reason.statusCode, 409)
  const current = await status(f), binding = item(current, 'branding').evidence.basisToken
  await f.db.query("update public.site_settings set site_name='Race' where key='default'")
  await assert.rejects(() => mutateQuickSetup(f.client, f.runtime, f.actors.owner, { action: 'capture', key: 'branding', revision: current.setup.revision, basisToken: binding }), e => e.statusCode === 409)
  assert.throws(() => validateSetupMutation({ action: 'capture', key: 'brevo', revision: 1, basisToken: binding, outcome: 'verified' }))
  for (const body of [{ action:'toString',key:'auth',revision:1 }, { action:'__proto__',key:'auth',revision:1 }, { action:'selection', key:'__proto__', selected:true, revision:1 }, { action:'acknowledge', key:'auth', acknowledged:true, revision:1, basisToken:'secret' }, { action:'selection', key:'brevo', selected:'true', revision:1 }, { action:'selection', key:'brevo', selected:true, revision:1, credentials:SETUP_CANARY }]) assert.throws(() => validateSetupMutation(body),e=>e.statusCode===400)
 } finally { await f.db.close() }
})

test('database permissions and immutable audit enforce server-only active-owner commands', async () => {
 const f = await createSetupFixture()
 try {
  const command = { action:'selection', key:'brevo', selected:true, revision:0 }
  for (const role of ['anon','authenticated','service_role']) {
   await f.db.exec('set role '+role)
   for (const table of resetRetainedSetupTables) {
    if (role !== 'service_role') await assert.rejects(() => f.db.query('select * from public.'+table), /permission denied/)
    await assert.rejects(() => f.db.query('delete from public.'+table), /permission denied/)
   }
   if (role !== 'service_role') await assert.rejects(() => f.db.query('select public.quick_setup_mutate($1,$2)',[f.actors.owner,command]), /permission denied/)
   await f.db.exec('reset role')
  }
  await assert.rejects(() => f.db.query('select public.quick_setup_mutate($1,$2)',[f.actors.viewer,command]), /Active owner/)
  await f.db.exec('grant select on public.quick_setup_state to authenticated;create policy fixture_broad on public.quick_setup_state for select to authenticated using(true);set role authenticated')
  assert.equal((await f.db.query('select * from public.quick_setup_state')).rows.length, 0); await f.db.exec('reset role')
  await change(f, command)
  await assert.rejects(() => f.db.query('update public.quick_setup_events set outcome=outcome'), /Setup writes/)
  await f.db.query("select set_config('app.quick_setup_write','on',false)")
  await assert.rejects(() => f.db.query('delete from public.quick_setup_events'), /append-only/)
 } finally { await f.db.close() }
})

test('every reset manifest retains setup tables; isolated SQL scopes preserve history and invalidate confirmations', async () => {
 const f = await createSetupFixture()
 try {
  await acknowledge(f,'backup');await change(f,{action:'selection',key:'vodafone',selected:true})
  const initial=await status(f), events=(await f.db.query('select count(*)::int n from public.quick_setup_events')).rows[0].n
  for(const scope of systemResetScopes){const result=await f.db.query('select public.system_reset_tables($1) tables',[scope.key]);assert.deepEqual(result.rows[0].tables,scope.tables);assert.ok(resetRetainedSetupTables.every(t=>!result.rows[0].tables.includes(t)))}
  for(const scope of systemResetScopes.map(s=>s.key)){
   await f.db.exec('begin')
   try{
    const plan=(await f.db.query('select public.system_reset_plan($1,$2) value',[f.actors.owner,scope])).rows[0].value;assert.ok(!plan.blockers.length)
    await f.db.query('select public.system_reset_begin($1,$2,gen_random_uuid())',[f.actors.owner,scope])
    const s=await status(f);assert.equal(s.setup.installationId,initial.setup.installationId);assert.equal(s.setup.selections.find(x=>x.key==='vodafone').selected,true);assert.equal(ack(s,'backup').state,'stale')
    assert.equal((await f.db.query('select count(*)::int n from public.quick_setup_events')).rows[0].n,events)
   }finally{await f.db.exec('rollback')}
  }
 } finally { await f.db.close() }
})

test('owner update throttling rejects excess writes without losing committed history', async () => {
 const f = await createSetupFixture()
 try {
  for (let revision=0; revision<30; revision++) await mutateQuickSetup(f.client, f.runtime, f.actors.owner, { action:'selection', key:'brevo', selected:revision%2===0, revision })
  await assert.rejects(() => mutateQuickSetup(f.client, f.runtime, f.actors.owner, { action:'selection', key:'brevo', selected:true, revision:30 }), e=>e.statusCode===429)
  const s=await status(f); assert.equal(s.setup.revision,30); assert.equal(s.setup.history.length,30)
  assert.equal((await f.db.query("select count(*)::int n from public.admin_activity_logs where action_key='settings.quick_setup.selection'")).rows[0].n,30)
 } finally { await f.db.close() }
})

test('actual H3 mutation authorization, redaction, conflict handling and passive refresh boundaries', async () => {
 const f=await createSetupFixture(),{url,close}=await f.start(),httpFetch=globalThis.fetch
 const call=async(actor,body=null)=>{const response=await httpFetch(url+(body?'/api/admin-setup/state':'/api/admin-setup/status'),{method:body?'PATCH':'GET',headers:{...(actor?{authorization:'Bearer '+actor}:{}),'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const text=await response.text();assert.ok(!text.includes(SETUP_CANARY));assert.doesNotMatch(text,/_encrypted|actor_id|api_key|account_url|basis_revisions/);assert.equal(response.headers.get('cache-control'),'private, no-store');return{code:response.status,data:JSON.parse(text)}}
 try{
  globalThis.fetch=async()=>{throw Error('No provider network is allowed')}
  const input={action:'selection',key:'brevo',selected:true,revision:0}
  f.queries.length=0
  for(const actor of [null,'customer','viewer','manager','inactive','invalid'])assert.ok([401,403].includes((await call(actor,input)).code))
  assert.ok(f.queries.every(q=>/from public.admin_users/.test(q)))
  assert.equal((await call('owner',input)).code,200);assert.equal((await call('owner',input)).code,409)
  assert.equal((await call('owner',{...input,revision:1,secret:SETUP_CANARY})).code,400)
  const before=await f.snapshot();f.queries.length=0
  for(let i=0;i<3;i++){const result=await call('owner');assert.equal(result.code,200);assert.equal(result.data.setup.revision,1)}
  assert.ok(f.queries.every(q=>/^\s*select\b/i.test(q)&&!/public\.[a-z_]+\(/i.test(q)));assert.deepEqual(await f.snapshot(),before)
  await f.db.query('update public.admin_users set is_active=false where id=$1',[f.actors.owner]);assert.equal((await call('owner',{...input,revision:1})).code,403)
 }finally{globalThis.fetch=httpFetch;await close()}
})
