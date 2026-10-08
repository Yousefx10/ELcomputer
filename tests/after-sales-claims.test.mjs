import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createOrderSmsFixture } from './helpers/orderSmsFixture.mjs'
import { createClaimsFixture } from './helpers/claimsFixture.mjs'
import { validateClaimForm, validateClaimAction, claimQuery } from '../server/utils/afterSalesClaimValidation.js'
const CLAIM_EVIDENCE_POLICY = { enabled: true, allowedMimes: ['image/jpeg','image/png','image/webp','application/pdf'], maxBytes: 5242880 }
import { validateChatAttachmentFile } from '../server/utils/chatAttachmentValidation.js'

test('claim inputs reject browser decisions, forged facts, malformed quantities and unsafe files', () => {
  const valid = { item_id: randomUUID(), claim_type: 'return', quantity: 2, description: 'Issue', reason_key: 'changed_mind', serials: [], attachment_ids: [], idempotency_key: randomUUID(), locale: 'en' }
  assert.equal(validateClaimForm(valid).description, 'Issue')
  for (const patch of [{ status: 'approved' }, { policy_version_id: randomUUID() }, { eligibility: true }, { evidence: true }, { serial_verified: true }, { quantity: '1' }, { quantity: 0 }, { quantity: 1.1 }, { quantity: 100 }, { opened: 'false' }, { packaging: [] }, { locale: 'unknown' }, { description: '' }, { reason_key: 'free text' }, { serials: ['serial'] }, { attachment_ids: [randomUUID(), 'bad'] }]) assert.throws(() => validateClaimForm({ ...valid, ...patch }), e => e.statusCode === 400)
  assert.throws(() => validateClaimAction({ action: 'approve', revision: 1, text: 'Forged' }))
  assert.throws(() => validateClaimAction({ action: 'note', revision: 1, text: 'Note', resolution: 'refund' }, true))
  assert.throws(() => claimQuery({ page: '1.5' }))
  assert.throws(() => claimQuery({ status: 'random' }))
  const png = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])
  assert.equal(validateChatAttachmentFile({ data: png, type: 'image/png', filename: '../../photo.png' }, CLAIM_EVIDENCE_POLICY).originalName, '.._.._photo.png')
  for (const file of [{ data: png, type: 'image/png', filename: 'run.exe' }, { data: Buffer.from('script'), type: 'image/png', filename: 'fake.png' }, { data: png, type: 'video/mp4', filename: 'movie.mp4' }, { data: Buffer.alloc(5242881), type: 'application/pdf', filename: 'large.pdf' }]) assert.throws(() => validateChatAttachmentFile(file, CLAIM_EVIDENCE_POLICY))
})

test('the 64th migration preserves existing business records, purchase archives and canonical function bodies', async () => {
  const name = '20261008120000_after_sales_claims_core.sql', f = await createOrderSmsFixture({ stopBefore: name })
  try {
    await f.checkout()
    const tables = ['products','product_variants','customer_profiles','admin_users','customer_orders','customer_order_items','after_sales_policies','after_sales_return_reasons','after_sales_policy_versions','shipping_provider_settings','shipping_order_jobs','sms_provider_settings','sms_order_event_settings','sms_order_events','sms_batches','payment_attempts']
    const snapshot = async () => Object.fromEntries(await Promise.all(tables.map(async table => [table,(await f.db.query('select to_jsonb(t) row from public.' + table + ' t order by to_jsonb(t)::text')).rows])))
    const before = await snapshot(), functions = (await f.db.query("select proname,pg_get_function_identity_arguments(oid) args,prosrc from pg_proc where pronamespace='public'::regnamespace and proname not in ('default_admin_permissions','system_reset_plan') order by oid")).rows
    await f.db.exec(await readFile(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8'))
    assert.deepEqual(await snapshot(), before)
    for (const fn of functions) assert.equal((await f.db.query('select prosrc from pg_proc where pronamespace=$1::regnamespace and proname=$2 and pg_get_function_identity_arguments(oid)=$3', ['public',fn.proname,fn.args])).rows[0].prosrc, fn.prosrc, fn.proname)
    assert.equal(Number((await f.db.query('select count(*) n from public.after_sales_claims')).rows[0].n), 0)
    assert.equal((await f.db.query("select public.after_sales_claim_items($1) result", [f.customer])).rows[0].result.items[0].return.can_start, false)
    assert.ok(Object.keys((await f.db.query('select public.default_admin_permissions() result')).rows[0].result).filter(key => key.startsWith('claims.')).length === 7)
  } finally { await f.db.close() }
})

test('Claims Core executes against actual disposable SQL: admission, ownership, workflow, evidence and privacy', async t => {
  const f = await createClaimsFixture(), q = (sql, args = []) => f.db.query(sql, args)
  const count = async table => Number((await q('select count(*) n from public.' + table)).rows[0].n)
  try {
    await t.test('draft purchased policies deny claims and do not create records or fabricate entitlement', async () => {
      const item = await f.purchase()
      await assert.rejects(() => f.create(f.body(item)), e => e.code === '23514')
      const context = await f.rpc('after_sales_claim_context', { p_customer: f.customer, p_item: item.id, p_type: 'return' })
      assert.equal(context.can_start, false)
      assert.equal(await count('after_sales_claims'), 0)
      const bucket = (await q("select * from storage.buckets where id='after-sales-evidence'")).rows[0]
      assert.equal(bucket.public, false); assert.equal(Number(bucket.file_size_limit), 5242880)
    })
    await f.enable()
    await t.test('Return and Warranty stay independent; reason availability, expiry and pending sources are enforced', async () => {
      const item = await f.purchase()
      await assert.rejects(() => f.create(f.body(item, 'return', { reason_key: 'invented' })))
      const returns = await f.create(f.body(item)); assert.match(returns.reference, /^AS-R-[A-F0-9]{16}$/)
      await assert.rejects(() => f.create(f.body(item, 'warranty')), e => e.code === '23514') // One physical unit already active.
      await f.customerAction(returns.id, 'cancel')
      const warranty = await f.create(f.body(item, 'warranty')); assert.match(warranty.reference, /^AS-W-[A-F0-9]{16}$/)
      await f.customerAction(warranty.id, 'cancel')
      await q("update public.customer_orders set created_at=clock_timestamp()-interval '2 years' where id=$1", [item.order_id])
      await assert.rejects(() => f.create(f.body(item, 'warranty')), e => e.code === '23514')
      await f.enable({ warranty: { warranty_start_basis: 'delivery_date' } })
      const pending = await f.purchase()
      await assert.rejects(() => f.create(f.body(pending, 'warranty')), e => e.code === '23514')
      await f.enable()
    })
    await t.test('owned orders only; immutable purchased rules survive later catalog/policy edits', async () => {
      const item = await f.purchase(), input = f.body(item), claim = await f.create(input)
      const other = randomUUID(); await q("insert into auth.users(id,email) values($1,'claims-other@example.invalid')", [other])
      await assert.rejects(() => f.rpc('after_sales_claim_context', { p_customer: other, p_item: item.id, p_type: 'return' }), e => e.code === 'P0002')
      await assert.rejects(() => f.detail(claim.id, false, other), e => e.code === 'P0002')
      await f.save({ return_enabled: false }, 'returns')
      const second = await f.purchase(); await assert.rejects(() => f.create(f.body(second)), e => e.code === '23514')
      assert.equal((await f.detail(claim.id, true)).claim.policy_version_id, item.after_sales_policy_version_id)
      assert.deepEqual(await f.create(input), claim)
      await assert.rejects(() => f.create({ ...input, description: 'Changed retry' }), e => e.code === '40001')
      await f.enable()
    })
    await t.test('actual category/product overrides and disabled purchased reason keys govern admission', async () => {
      const category = randomUUID()
      await q("insert into public.categories(id,name,slug) values($1,'Claim override fixture',($1::uuid)::text)", [category])
      await q('update public.products set category_id=$1 where id=$2', [category,f.product])
      await f.rpc('after_sales_save_policy', { p_admin_id: f.owner, p_scope_key: 'category:' + category, p_section: 'overrides', p_revision: 0, p_values: { return_enabled: false } })
      const denied = await f.purchase(); await assert.rejects(() => f.create(f.body(denied)), e => e.code === '23514')
      await f.rpc('after_sales_save_policy', { p_admin_id: f.owner, p_scope_key: 'product:' + f.product, p_section: 'overrides', p_revision: 0, p_values: { return_enabled: true } })
      const allowed = await f.purchase(); assert.ok((await f.create(f.body(allowed))).id)
      const reason = (await q("select * from public.after_sales_return_reasons where key='changed_mind'")).rows[0]
      const { updated_at, ...input } = reason
      await f.rpc('after_sales_save_reason', { p_admin_id: f.owner, p_reason: { ...input, is_enabled: false } })
      const disabled = await f.purchase(); await assert.rejects(() => f.create(f.body(disabled)), e => e.code === '23514')
      await f.rpc('after_sales_save_reason', { p_admin_id: f.owner, p_reason: { ...input, revision: input.revision + 1, is_enabled: true } })
      await q('update public.products set category_id=null where id=$1', [f.product])
      await f.rpc('after_sales_save_policy', { p_admin_id: f.owner, p_scope_key: 'product:' + f.product, p_section: 'overrides', p_revision: 1, p_values: { return_enabled: null } })
    })
    await t.test('database-backed active duplicate and combined quantity protections; terminal capacity rules', async () => {
      const item = await f.purchase(3), first = await f.create(f.body(item, 'return', { quantity: 2 }))
      await assert.rejects(() => f.create(f.body(item)), e => e.code === '23514')
      await assert.rejects(() => f.create(f.body(item, 'warranty', { quantity: 2 })), e => e.code === '23514')
      const second = await f.create(f.body(item, 'warranty'))
      await f.customerAction(first.id, 'cancel'); await f.customerAction(second.id, 'cancel')
      const replacement = await f.create(f.body(item, 'warranty', { quantity: 3 }))
      for (const action of ['review','approve','receive','inspect']) await f.action(replacement.id, action)
      await f.action(replacement.id, 'select_resolution', { text: 'Recorded repair decision', resolution: 'repair' }); await f.action(replacement.id, 'resolve')
      const later = await f.create(f.body(item, 'warranty', { quantity: 3 })); await f.customerAction(later.id, 'cancel')
      const returned = await f.create(f.body(item, 'return', { quantity: 2 }))
      for (const action of ['review','approve','receive','inspect']) await f.action(returned.id, action)
      await f.action(returned.id, 'select_resolution', { text: 'Recorded refund decision only', resolution: 'refund' }); await f.action(returned.id, 'resolve')
      await assert.rejects(() => f.create(f.body(item, 'return', { quantity: 2 })), e => e.code === '23514')
      assert.ok((await f.create(f.body(item))).id)
    })
    await t.test('required evidence is real ready owned evidence; replacement/removal stops at submission', async () => {
      await f.enable({ returns: { return_evidence: 'required' } })
      const item = await f.purchase(); await assert.rejects(() => f.create(f.body(item)), e => e.code === '23514')
      const uploading = await f.evidence(item, 'return', null, false)
      await assert.rejects(() => f.create(f.body(item, 'return', { attachment_ids: [uploading] })))
      await f.rpc('after_sales_claim_finish_evidence', { p_customer: f.customer, p_id: uploading, p_remove: true })
      const ready = await f.evidence(item)
      const preview = await f.rpc('after_sales_claim_preview', { p_customer: f.customer, p_item: item.id, p_type: 'return', p_input: f.body(item, 'return', { attachment_ids: [ready] }) })
      assert.equal(preview.can_submit, true)
      const claim = await f.create(f.body(item, 'return', { attachment_ids: [ready] }))
      assert.equal((await f.detail(claim.id)).attachments.length, 1)
      await assert.rejects(() => f.rpc('after_sales_claim_finish_evidence', { p_customer: f.customer, p_id: ready, p_remove: true }), e => e.code === 'P0002')
      await assert.rejects(() => q('delete from public.after_sales_claim_evidence where id=$1', [ready]), e => e.code === '42501')
      await f.enable({ returns: { return_evidence: 'disabled' } }); const disabled = await f.purchase()
      await assert.rejects(() => f.evidence(disabled), e => e.code === '23514')
      await f.enable()
    })
    await t.test('customer serials remain unverified; policy-required serial needs audited staff verification', async () => {
      const optionalItem = await f.purchase(), optionalClaim = await f.create(f.body(optionalItem, 'warranty'))
      assert.equal((await f.detail(optionalClaim.id, true)).claim.eligibility_snapshot.serial_source, 'not_provided')
      await f.enable({ warranty: { warranty_serial: 'required' } }); const item = await f.purchase()
      await assert.rejects(() => f.create(f.body(item, 'warranty')))
      const claim = await f.create(f.body(item, 'warranty', { serials: ['CUSTOMER-SERIAL-UNVERIFIED'] }))
      assert.equal((await f.detail(claim.id)).claim.serial_verification, 'unverified')
      assert.equal((await f.detail(claim.id, true)).claim.admission, 'serial_review')
      await f.action(claim.id, 'review'); await assert.rejects(() => f.action(claim.id, 'approve'), e => e.code === '23514')
      await f.action(claim.id, 'verify_serial', { text: 'Staff checked supplied serial during review' })
      await f.action(claim.id, 'approve'); assert.equal((await f.detail(claim.id)).claim.serial_verification, 'verified')
      assert.equal(await count('commerce_serialized_units'), 0)
      await f.enable()
    })
    await t.test('manual opened-item review is explicit; packaging and no-warranty rules remain separate', async () => {
      await f.enable({ returns: { return_opened: 'manual', return_packaging: 'required' } }); const item = await f.purchase()
      await assert.rejects(() => f.create(f.body(item, 'return', { packaging: false })), e => e.code === '23514')
      const claim = await f.create(f.body(item, 'return', { opened: true })); const detail = await f.detail(claim.id, true)
      assert.equal(detail.claim.admission, 'manual_review'); assert.equal(detail.claim.eligibility_snapshot.eligibility.status, 'unknown')
      assert.deepEqual(detail.claim.declarations, { opened: true, packaging: true })
      await f.action(claim.id, 'review'); await f.action(claim.id, 'approve', { text: 'Approved the policy-permitted opened-item review' })
      await f.enable({ returns: { return_opened: 'not_allowed' } }); const sealed = await f.purchase()
      await assert.rejects(() => f.create(f.body(sealed, 'return', { opened: true })), e => e.code === '23514')
      await q("update public.products set warranty_status='none',warranty_duration_value=null,warranty_duration_unit=null where id=$1", [f.product]); const noWarranty = await f.purchase()
      await assert.rejects(() => f.create(f.body(noWarranty, 'warranty')), e => e.code === '23514'); assert.ok((await f.create(f.body(noWarranty))).id)
      await f.enable()
    })
    await t.test('information requests append evidence and responses; internal notes never enter customer projections', async () => {
      const item = await f.purchase(), claim = await f.create(f.body(item))
      await f.action(claim.id, 'review'); await f.action(claim.id, 'note', { text: 'PRIVATE-NOTE-MUST-NOT-LEAK' })
      await f.action(claim.id, 'request_information', { text: 'Please provide a clear photo', require_evidence: true })
      await assert.rejects(() => f.action(claim.id, 'review'), e => e.code === '23514')
      await assert.rejects(() => f.customerAction(claim.id, 'respond'))
      const file = await f.evidence(item, 'return', claim.id)
      await f.customerAction(claim.id, 'respond', { text: 'Additional details with photo', attachment_ids: [file] })
      const customer = await f.detail(claim.id), staff = await f.detail(claim.id, true)
      assert.equal(customer.claim.status, 'under_review'); assert.equal(customer.information[0].response, 'Additional details with photo')
      assert.ok(!JSON.stringify(customer).includes('PRIVATE-NOTE-MUST-NOT-LEAK')); assert.ok(JSON.stringify(staff).includes('PRIVATE-NOTE-MUST-NOT-LEAK'))
      assert.ok(!JSON.stringify(customer).includes('storage_path')); assert.ok(!JSON.stringify(customer).includes('eligibility_snapshot'))
      await assert.rejects(() => q('update public.after_sales_claim_events set body=$1 where claim_id=$2', ['tampered', claim.id]), e => e.code === '42501')
      await assert.rejects(() => f.customerAction(claim.id, 'respond'), e => e.code === '23514')
    })
    await t.test('invalid transitions and purchased resolution restrictions fail; decisions never execute finance/logistics', async () => {
      await f.enable({ warranty: { warranty_resolutions: ['repair'] } }); const item = await f.purchase(), claim = await f.create(f.body(item, 'warranty'))
      await assert.rejects(() => f.action(claim.id, 'approve'), e => e.code === '23514')
      await f.action(claim.id, 'review'); await f.action(claim.id, 'approve'); await f.action(claim.id, 'receive'); await f.action(claim.id, 'inspect')
      await assert.rejects(() => f.action(claim.id, 'select_resolution', { text: 'Not allowed', resolution: 'refund' }), e => e.code === '23514')
      await f.action(claim.id, 'select_resolution', { text: 'Repair decision recorded', resolution: 'repair' }); await f.action(claim.id, 'resolve')
      await assert.rejects(() => f.action(claim.id, 'cancel'), e => e.code === '23514')
      const order = await f.order(item.order_id); assert.notEqual(order.payment_status, 'refunded')
      for (const table of ['shipping_order_jobs','sms_batches','sms_messages','payment_transactions','commerce_order_returns']) assert.equal(await count(table), 0, table)
      assert.ok((await q("select count(*) n from public.admin_activity_logs where action_key like 'claims.%'")).rows[0].n > 0)
    })
    await t.test('granular RBAC, browser grants/RLS, stale writes and reset dependencies are enforced', async () => {
      const viewer = randomUUID(); await q("insert into auth.users(id,email) values($1,'claim-viewer@example.invalid')", [viewer])
      await q("insert into public.admin_users(id,email,role,permissions) values($1,'claim-viewer@example.invalid','admin','{\"claims.view\":true}')", [viewer])
      const claim = (await q('select id from public.after_sales_claims limit 1')).rows[0]
      assert.ok((await f.detail(claim.id, true, viewer)).claim)
      await assert.rejects(() => f.action(claim.id, 'note', { text: 'Not authorized' }, viewer), e => e.code === '42501')
      const tableRows = (await q("select relname,relrowsecurity,has_table_privilege('anon',oid,'SELECT') anon,has_table_privilege('authenticated',oid,'SELECT') customer from pg_class where relname like 'after_sales_claim%' and relkind='r'")).rows
      assert.equal(tableRows.length, 4); assert.ok(tableRows.every(row => row.relrowsecurity && !row.anon && !row.customer))
      const functions = (await q("select proname,has_function_privilege('anon',oid,'EXECUTE') anon,has_function_privilege('authenticated',oid,'EXECUTE') customer from pg_proc where pronamespace='public'::regnamespace and proname like 'after_sales_claim_%'")).rows
      assert.ok(functions.length > 10 && functions.every(row => !row.anon && !row.customer))
      await q("select set_config('request.jwt.claim.role','authenticated',false)")
      await assert.rejects(() => f.detail(claim.id), e => e.code === '42501')
      await q("select set_config('request.jwt.claim.role','service_role',false)")
      const plan = await f.rpc('system_reset_plan', { p_owner: f.owner, p_scope: 'orders' }); assert.ok(plan.blockers.some(row => row.table === 'after_sales_claims'))
      assert.ok((await f.rpc('system_reset_plan', { p_owner: f.owner, p_scope: 'full' })).blockers.length)
    })
    await t.test('audit failure rolls back staff status, revision and timeline atomically', async () => {
      const item = await f.purchase(), claim = await f.create(f.body(item, 'warranty')), before = await f.detail(claim.id, true)
      await f.db.exec("create function public.claim_audit_fixture_failure() returns trigger language plpgsql as $$begin if new.action_key like 'claims.%' then raise exception 'fixture audit outage'; end if;return new;end$$;create trigger claim_audit_fixture_failure before insert on public.admin_activity_logs for each row execute function public.claim_audit_fixture_failure()")
      await assert.rejects(() => f.action(claim.id, 'review'))
      assert.deepEqual(await f.detail(claim.id, true), before)
      await f.db.exec('drop trigger claim_audit_fixture_failure on public.admin_activity_logs;drop function public.claim_audit_fixture_failure()')
    })
    await t.test('restrictive Storage boundary denies Claims files even alongside broad permissive browser rules', async () => {
      await f.db.exec("create policy claim_storage_fixture_permissive on storage.objects for all to anon using(true) with check(true);grant usage on schema storage to anon;grant select,insert on storage.objects to anon;insert into storage.objects(bucket_id,name) values('after-sales-evidence','private-claim-fixture'),('media-fixture','public-media-fixture')")
      try {
        await f.db.exec('set role anon')
        assert.deepEqual((await q('select name from storage.objects')).rows, [{ name: 'public-media-fixture' }])
        await assert.rejects(() => q("insert into storage.objects(bucket_id,name) values('after-sales-evidence','forged-claim-file')"), e => e.code === '42501')
        await q("insert into storage.objects(bucket_id,name) values('media-fixture','unrelated-rule-preserved')")
      } finally { await f.db.exec('reset role;drop policy claim_storage_fixture_permissive on storage.objects;revoke select,insert on storage.objects from anon;revoke usage on schema storage from anon') }
    })
  } finally { await f.db.close() }
})
