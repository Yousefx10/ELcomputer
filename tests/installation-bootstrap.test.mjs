import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { createCleanBaselineLab, startCandidateRest } from './helpers/cleanBaselineLab.mjs'
import { storageNativeAvailable } from './helpers/storageNativeDatabase.mjs'
import { applyCandidate, adoptLaboratoryHistory, catalog, assertCatalogEquivalent, migrationInventory, hash } from '../scripts/lib/cleanBaseline.mjs'
import { bootstrapFirstOwner, ownerBinding, bootstrapMarker } from '../scripts/lib/installationBootstrap.mjs'
import { attachClaimCommunicationsFixture } from './helpers/claimCommunicationsFixture.mjs'
import { createClaimsFixture } from './helpers/claimsFixture.mjs'
import { systemResetScopes } from '../server/utils/systemResetScopes.js'
import { defaultSiteSettings, siteContentRows } from '../app/utils/siteContentDefaults.js'
import { buildSeo, seoHead, publicSiteUrl, robotsText } from '../app/utils/seo.js'
import { claimCommunicationUrl } from '../app/utils/claimCommunications.js'
import { claimCommunicationValues } from '../server/utils/afterSalesCommunications.js'
import { validatePdcSettings } from '../server/utils/pdcSettings.js'
import { privateInstallationCatalog } from '../scripts/lib/installationCertification.mjs'

export const migration71 = '20261012160000_quick_setup_installation_bootstrap.sql'
const migration = await readFile(new URL('../supabase/migrations/' + migration71, import.meta.url), 'utf8')
const followOn = new URL('../supabase/bootstrap/portability-v1/', import.meta.url)
const manifest = JSON.parse(await readFile(new URL('manifest.json',followOn),'utf8'))
test('follow-on provenance binds migration 71 and preserves the certified source-70 manifest',async()=>{
  assert.equal(manifest.migration.sha256,hash(migration))
  assert.equal(manifest.base_manifest_sha256,hash(await readFile(new URL('../supabase/bootstrap/clean-v1/manifest.json',import.meta.url))))
  assert.equal(manifest.artifacts['expected-private-schema.json'],hash(await readFile(new URL('expected-private-schema.json',followOn))))
})
const value = async (db, sql, args = []) => (await db.query(sql, args)).rows[0].result
const journal = db => value(db, 'select to_jsonb(j) result from private.installation_bootstrap j')
const targetFor = async db => ({ installation_id: (await journal(db)).installation_id, request_id: randomUUID(), target_digest: 'a'.repeat(64), project_ref: 'abcdefghijklmnopqrst', site_origin: 'https://fresh.example.invalid' })
const sql = (db, command, binding, ...args) => value(db, 'select private.installation_' + command + '($1::jsonb' + args.map((_, i) => ',$' + (i + 2)).join('') + ') result', [binding, ...args])
const password = 'fixture-only-owner-password-canary-123!'
const email = 'owner@fresh.example.invalid'
const authFixture = db => {
  let creates = 0, loseResponse = false, interrupted = false
  return {
    get creates() { return creates },
    set loseResponse(value) { loseResponse = value },
    set interrupted(value) { interrupted = value },
    async createUser(input) {
      creates++
      if (interrupted) throw Error(password)
      const id = randomUUID()
      await db.query('insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data,email_confirmed_at,created_at) values($1,$2,$3,$4,clock_timestamp(),clock_timestamp())', [id, input.email, input.app_metadata, input.user_metadata])
      if (loseResponse) throw Error(password)
      return { data: { user: { id } }, error: null }
    },
    async listUsers() {
      return { data: { users: (await db.query('select id,email,raw_app_meta_data app_metadata from auth.users order by id limit 2')).rows }, error: null }
    }
  }
}
const snapshot = async db => {
  const tables = (await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows
  const result = {}
  for (const { tablename } of tables) result[tablename] = hash(JSON.stringify((await db.query('select to_jsonb(t) row from public."' + tablename + '" t order by to_jsonb(t)::text')).rows))
  return result
}

test('empty and absent content remains neutral; configured content and origins remain authoritative', () => {
  for (const result of [undefined, { data: null }, { data: [] }, { error: { code: '42P01' } }]) assert.deepEqual(siteContentRows(result), [])
  const rows = [{ id: 'saved', text: 'Saved announcement' }]
  assert.equal(siteContentRows({ data: rows }), rows)
  assert.doesNotMatch(JSON.stringify(defaultSiteSettings), /elcomputer\.net|01505121684|placehold|Pretty Cool|Purchase your/)
  for (const key of ['payment_cash_enabled','payment_card_enabled','payment_bank_transfer_enabled','payment_instapay_enabled','payment_paypal_enabled','hero_enabled']) assert.equal(defaultSiteSettings[key], false)
  assert.equal(publicSiteUrl(), '')
  assert.equal(publicSiteUrl({ seo_site_url: 'https://configured.example' }, 'https://runtime.example'), 'https://configured.example')
  const seo = buildSeo({ settings: defaultSiteSettings })
  assert.equal(seo.robots, 'noindex,follow'); assert.equal(seo.canonical, ''); assert.deepEqual(seo.alternates, [])
  assert.equal(seoHead(seo).link.length, 0); assert.equal(robotsText(''), 'User-agent: *\nDisallow: /\n')
  const id = randomUUID()
  assert.throws(() => claimCommunicationUrl(id, 'en'))
  assert.equal(claimCommunicationUrl(id, 'ar', 'https://new-store.example'), 'https://new-store.example/ar/account/after-sales/' + id)
  const row = { claim_id: id, locale: 'ar', purpose: 'approved', payload: { claim_url: claimCommunicationUrl(id, 'ar', 'https://historical.example') } }
  assert.equal(claimCommunicationValues(row).claim_url, row.payload.claim_url)
  for (const link of ['https://user:pass@host.example/ar/account/after-sales/' + id, 'https://host.example/other', 'http://host.example/ar/account/after-sales/' + id]) assert.throws(() => claimCommunicationValues({ ...row, payload: { claim_url: link } }))
  const body = { company_id: '', product_id: '', is_enabled: false, auto_create_labels: false, reverse_enabled: false, allow_open_shipment: false, all_must_valid: true, default_weight_kg: 1, shipment_type_id: 1, label_template_id: 1 }
  const current = { api_mode: 'production', base_url: 'https://clientsapi.pdc-eg.com/api/ClientUsers/V6/', status_timezone: 'Africa/Cairo' }
  assert.equal(validatePdcSettings(body, current).company_id, null); assert.equal(validatePdcSettings(body, current).product_id, null)
  assert.throws(() => validatePdcSettings({ ...body, product_id: true }, current))
  for (const key of ['is_enabled','auto_create_labels','reverse_enabled']) assert.throws(() => validatePdcSettings({ ...body, [key]: true }, current))
})

test('migration 71 upgrades both owned native paths; operator bootstrap is isolated and permanently consumed', { skip: !storageNativeAvailable }, async t => {
  const lab = await createCleanBaselineLab(), db = lab.candidate
  let rest
  try {
    await t.test('an occupied private namespace aborts without changing existing data or permissions',async()=>{
      await lab.source.query('create schema private; create function private.unrelated_fixture() returns integer language sql as $$select 1$$;')
      const before=await catalog(lab.source),acl=(await lab.source.query("select proacl::text acl from pg_proc where oid='private.unrelated_fixture()'::regprocedure")).rows
      await assert.rejects(()=>lab.source.exec(migration),error=>error.code==='42P06')
      await lab.source.query('rollback')
      assert.deepEqual(await catalog(lab.source),before)
      assert.deepEqual((await lab.source.query("select proacl::text acl from pg_proc where oid='private.unrelated_fixture()'::regprocedure")).rows,acl)
      await lab.source.query('drop schema private cascade') // Owned fixture only.
    })
    await t.test('existing merchant records, permissions, gates, queued history and snapshots are unchanged', async () => {
      const f = await attachClaimCommunicationsFixture(await createClaimsFixture({ database: lab.source }))
      await lab.source.query("update public.site_settings set site_name='Existing merchant',footer_email='saved@merchant.example',seo_site_url='https://merchant.example' where key='default'")
      await f.enable(); await f.enableCommunications()
      await lab.source.query("update public.site_settings set seo_site_url='https://merchant.example' where key='default'")
      const item = await f.purchase(), claim = await f.create(f.body(item))
      await f.action(claim.id, 'review'); await f.action(claim.id, 'approve')
      const before = await snapshot(lab.source)
      const grants = (await lab.source.query("select c.relname,c.relacl::text from pg_class c where c.relnamespace='public'::regnamespace order by c.relname")).rows
      await lab.source.exec(migration)
      assert.deepEqual(await snapshot(lab.source), before)
      assert.deepEqual((await lab.source.query("select c.relname,c.relacl::text from pg_class c where c.relnamespace='public'::regnamespace order by c.relname")).rows, grants)
      assert.equal((await journal(lab.source)).phase, 'sealed_existing')
      assert.equal(await value(lab.source, 'select public.after_sales_notification_origin() result'), 'https://merchant.example')
      // Historical captured literal remains; new events take the saved origin.
      assert.ok((await f.intents(claim.id)).every(row => row.payload.claim_url.startsWith('https://new.elcomputer.net/')))
      const next = await f.create(f.body(await f.purchase())); await f.action(next.id, 'review'); await f.action(next.id, 'approve')
      assert.ok((await f.intents(next.id)).every(row => row.payload.claim_url.startsWith('https://merchant.example/ar/account/after-sales/')))
      await f.prepare('email',3); await f.prepare('email',3); await f.dispatch('email')
      assert.ok(f.calls.email.some(row => row.html_body.includes('https://merchant.example/')))
      await assert.rejects(async () => sql(lab.source, 'register', ownerBinding(await targetFor(lab.source), email)))
    })
    await t.test('clean-v1 is unchanged; exactly 70 adopted versions precede one normal migration 71 push', async () => {
      await applyCandidate(db); await adoptLaboratoryHistory(lab)
      const inventory = await migrationInventory()
      await lab.cli(['db','push','--yes'], [...inventory.map(row => row.filename), migration71])
      const before = await snapshot(db), receipt = await journal(db)
      await lab.cli(['db','push','--yes'], [...inventory.map(row => row.filename), migration71])
      assert.deepEqual(await snapshot(db), before); assert.deepEqual(await journal(db), receipt)
      assert.equal((await db.query('select count(*)::int n from supabase_migrations.schema_migrations')).rows[0].n, 71)
      assert.equal(receipt.phase, 'available')
      assertCatalogEquivalent(await catalog(db), await catalog(lab.source))
      assert.equal(hash(JSON.stringify(await catalog(db),null,2)+'\n'),manifest.expected_public_catalog_sha256)
      assert.deepEqual(await privateInstallationCatalog(db),JSON.parse(await readFile(new URL('expected-private-schema.json',followOn),'utf8')))
      for (const table of ['products','categories','brands','customer_profiles','customer_orders','admin_users','sms_batches','email_messages']) assert.equal((await db.query('select count(*)::int n from public.' + table)).rows[0].n, 0)
      const pdc = (await db.query('select * from public.shipping_provider_settings')).rows[0]
      assert.equal(pdc.company_id, null); assert.equal(pdc.product_id, null); assert.equal(pdc.is_enabled, false); assert.equal(pdc.access_token_encrypted, null)
      assert.ok((await db.query('select revision from public.quick_setup_revisions')).rows.every(row => row.revision === '0'))
      assert.equal(await value(db, 'select public.after_sales_notification_origin() result'), null)
      for(const origin of ['https://user:secret@host.example','https://host.example/path','https://host.example?x=1','https://host.example#fragment','http://host.example','https://host.example:bad','https://host.example:65536','https://a..example']) assert.equal(await value(db,'select public.installation_https_origin($1) result',[origin]),null)
      assert.equal(await value(db,'select public.installation_https_origin($1) result',['https://host.example:443']),'https://host.example')
      assert.equal(await value(db,'select public.installation_https_origin($1) result',['HTTPS://Host.Example/']),'https://host.example')
      assert.equal((await db.query("insert into public.site_settings(key) values('neutral-draft-test') returning payment_cash_enabled,footer_email,site_name")).rows[0].payment_cash_enabled,false)
      await db.query("delete from public.site_settings where key='neutral-draft-test'")
      await assert.rejects(() => db.query("update public.shipping_provider_settings set is_enabled=true where id='pdc'"), /merchant_required/)
      assert.equal((await db.query('select rolsuper from pg_roles where rolname=current_user')).rows[0].rolsuper, false)
    })
    await t.test('actual runtime/browser sessions, RLS, grants and PostgREST cannot bootstrap', async () => {
      rest = await startCandidateRest(lab)
      const target = await targetFor(db), binding = ownerBinding(target, email)
      for (const role of ['anon','authenticated','service_role']) {
        const runtime = await lab.connect('clean_candidate', role)
        await assert.rejects(() => runtime.query('select * from private.installation_bootstrap'), /permission denied/)
        await assert.rejects(() => sql(runtime, 'register', binding), /permission denied/)
        const denied = await rest.request('/rpc/installation_link_owner', { role, method: 'POST', body: { p_binding: binding, p_subject: randomUUID() } })
        assert.ok([404,401,403].includes(denied.status))
      }
      const functions = (await db.query("select oid,prosecdef,proconfig from pg_proc where pronamespace='private'::regnamespace")).rows
      for (const fn of functions) {
        assert.ok(fn.proconfig.includes('search_path=""'))
        for (const role of ['anon','authenticated','service_role']) assert.equal(await value(db, 'select has_function_privilege($1,$2,\'execute\') result', [role, fn.oid]), false)
      }
      assert.equal((await db.query("select relrowsecurity from pg_class where oid='private.installation_bootstrap'::regclass")).rows[0].relrowsecurity, true)
    })
    // Rollback only these acceptance fixtures; no hosted Auth/reset exists here.
    const fixture = async action => { await db.query('begin'); try { await action() } finally { await db.query('rollback') } }
    await t.test('interrupted Auth with no identity stays closed to blind retries', () => fixture(async () => {
      const target = await targetFor(db), auth = authFixture(db); auth.interrupted = true
      const run = () => bootstrapFirstOwner({ db, authAdmin: auth, target, email, password, confirmOwner: true })
      await assert.rejects(run, error => error.code === 'auth_unresolved' && !error.message.includes(password))
      auth.interrupted = false; await assert.rejects(run, error => error.code === 'auth_unresolved')
      assert.equal(auth.creates, 1); assert.equal((await journal(db)).phase, 'auth_started')
    }))
    await t.test('lost Auth response reconciles exact app metadata and never repeats create', () => fixture(async () => {
      const target = await targetFor(db), auth = authFixture(db); auth.loseResponse = true
      const result = await bootstrapFirstOwner({ db, authAdmin: auth, target, email, password, confirmOwner: true })
      assert.equal(result.phase, 'complete'); assert.equal(auth.creates, 1)
      assert.equal((await journal(db)).error_code, null)
      assert.doesNotMatch(JSON.stringify(result), new RegExp(password))
    }))
    await t.test('unrelated identities and duplicate marker subjects are never adopted/deleted', () => fixture(async () => {
      const target = await targetFor(db), binding = ownerBinding(target, email)
      await sql(db, 'register', binding); await sql(db, 'start_auth', binding, 1)
      await db.query('insert into auth.users(email,raw_user_meta_data,email_confirmed_at,created_at) values($1,$2,clock_timestamp(),clock_timestamp())', [email, { role: 'owner', elcomputer_bootstrap: bootstrapMarker(binding) }])
      const auth = authFixture(db)
      await assert.rejects(() => bootstrapFirstOwner({ db, authAdmin: auth, target, email, password, confirmOwner: true }), error => error.code === 'identity_conflict')
      assert.equal(auth.creates, 0); assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n, 1)
      await db.query('savepoint spoofed_metadata')
      await assert.rejects(async () => sql(db,'link_owner',binding,(await auth.listUsers()).data.users[0].id),/Unverifiable installation identity/)
      await db.query('rollback to savepoint spoofed_metadata')
      await db.query('update auth.users set raw_app_meta_data=$1', [{ elcomputer_bootstrap: bootstrapMarker(binding) }])
      await auth.createUser({ email: 'second@fresh.example.invalid', app_metadata: { elcomputer_bootstrap: bootstrapMarker(binding) }, user_metadata: {} })
      await db.query('savepoint duplicate_subject')
      await assert.rejects(async () => sql(db, 'link_owner', binding, (await auth.listUsers()).data.users[0].id), /identity conflict/)
      await db.query('rollback to savepoint duplicate_subject')
      assert.equal((await db.query('select count(*)::int n from public.admin_users')).rows[0].n, 0)
    }))
    await t.test('failed audit rolls back promotion, preserves Auth, and exact resume completes', () => fixture(async () => {
      const target = await targetFor(db), auth = authFixture(db)
      await db.query("create function private.fixture_audit_fail() returns trigger language plpgsql as $$begin raise exception 'fixture audit failure';end$$; create trigger fixture_audit_fail before insert on public.admin_activity_logs for each row execute function private.fixture_audit_fail()")
      // Use a second session only for orchestration outside this fixture's DDL
      // transaction? SQL errors abort transactions; savepoint adapter models RPC.
      const adapter = { query: async (query, args) => { await db.query('savepoint rpc_call'); try { const result = await db.query(query, args); await db.query('release savepoint rpc_call'); return result } catch (e) { await db.query('rollback to savepoint rpc_call'); throw e } } }
      await assert.rejects(() => bootstrapFirstOwner({ db: adapter, authAdmin: auth, target, email, password, confirmOwner: true }), error => error.code === 'promotion_failed')
      assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n, 1)
      assert.equal((await db.query('select count(*)::int n from public.admin_users')).rows[0].n, 0)
      assert.equal((await journal(db)).phase, 'auth_started')
      await db.query('drop trigger fixture_audit_fail on public.admin_activity_logs')
      assert.equal((await bootstrapFirstOwner({ db: adapter, authAdmin: auth, target, email, password, confirmOwner: true })).phase, 'complete')
      assert.equal(auth.creates, 1)
    }))
    await t.test('competing independent sessions create one owner, audit and sealed receipt', async () => {
      const target = await targetFor(db), other = await lab.connect('clean_candidate'), auth = authFixture(db)
      const binding = ownerBinding(target,email)
      await sql(db,'register',binding)
      const rival = await lab.connect('clean_candidate')
      await assert.rejects(() => sql(rival,'register',ownerBinding({...target,request_id:randomUUID()},email)), /binding conflict/)
      let lostAcknowledgements=0
      const lostResponseDb={query:async(query,args)=>{const result=await db.query(query,args);if(query.includes('installation_link_owner')&&lostAcknowledgements===0){lostAcknowledgements++;throw Error('fixture lost SQL acknowledgement')}return result}}
      let releaseAuth,startAuth
      const started=new Promise(resolve=>{startAuth=resolve}),released=new Promise(resolve=>{releaseAuth=resolve})
      const gatedAuth={...auth,createUser:async input=>{startAuth();await released;return auth.createUser(input)}}
      const first=bootstrapFirstOwner({db:lostResponseDb,authAdmin:gatedAuth,target,email,password,confirmOwner:true})
      await started
      const second=bootstrapFirstOwner({db:other,authAdmin:auth,target,email,password,confirmOwner:true})
      releaseAuth()
      const results=await Promise.allSettled([first,second])
      assert.ok(results.some(row => row.status === 'fulfilled'))
      assert.equal(auth.creates, 1)
      assert.equal(lostAcknowledgements,1)
      const receipt = await journal(db), owner = receipt.auth_subject
      assert.equal(receipt.phase, 'complete')
      assert.equal((await db.query('select count(*)::int n from public.admin_users')).rows[0].n, 1)
      assert.equal((await db.query("select count(*)::int n from public.admin_activity_logs where action_key='installation.owner.bootstrap'")).rows[0].n, 1)
      const profile = (await db.query('select is_internal from public.customer_profiles where id=$1', [owner])).rows[0]
      assert.equal(profile.is_internal, true)
      assert.ok(Object.values((await db.query('select permissions from public.admin_users where id=$1', [owner])).rows[0].permissions).every(value => value === true))
      assert.equal(await value(db, 'select public.after_sales_notification_origin() result'), target.site_origin)
      await assert.rejects(() => sql(db, 'register', ownerBinding({ ...target, request_id: randomUUID() }, email)), /binding conflict/)
      for (const scope of systemResetScopes) {
        await db.query('begin')
        try {
          const run = await value(db, 'select public.system_reset_begin($1,$2,$3) result', [owner, scope.key, randomUUID()])
          assert.equal(run.status, 'cleanup_pending')
          assert.deepEqual(await journal(db), receipt)
        } finally { await db.query('rollback') }
      }
      await db.query("update public.admin_users set role='admin',is_active=false where id=$1", [owner])
      assert.deepEqual(await sql(db, 'register', ownerBinding(target, email)), receipt)
      await assert.rejects(() => db.query('delete from private.installation_bootstrap'), /retained/)
      await assert.rejects(() => db.query('truncate private.installation_bootstrap'), /retained/)
      await db.query('delete from public.admin_users where id=$1', [owner])
      assert.deepEqual(await sql(db, 'link_owner', ownerBinding(target, email), owner), receipt)
      assert.equal((await db.query('select count(*)::int n from public.admin_users')).rows[0].n, 0)
      await db.query('delete from auth.users where id=$1',[owner])
      assert.deepEqual(await journal(db),receipt)
      assert.deepEqual(await sql(db,'link_owner',ownerBinding(target,email),owner),receipt)
    })
  } finally { await rest?.close(); await lab.close() }
})
