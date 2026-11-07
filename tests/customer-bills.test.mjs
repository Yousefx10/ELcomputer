import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtemp, chmod, readFile, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bidiRuns, renderBillPdf, formatBillAmount } from '../server/utils/billPdf.js'
import { normalizeBillDesign, billDesignError, BILL_DESIGN_DEFAULTS } from '../app/utils/billDesign.js'
import { buildBillData, ensureOrderBill, queueBillEmail, loadBillFonts, billFileName } from '../server/utils/customerBills.js'
import { brevoProvider } from '../server/utils/email/brevo.js'

// Owner request 7 Nov 2026 (phase 3B): the website makes the customer bill PDF itself.
const order = (patch = {}) => ({ id: randomUUID(), order_number: 'ORD-1', created_at: '2026-11-07T10:00:00Z', sms_locale: 'ar', first_name: 'Owned', last_name: 'Buyer',
  street_address: 'Owned street 1', city: 'Nasr City', governorate: 'Cairo', shipping_fee_amount: 60, payment_fee_amount: 0, discount_amount: 0, total_amount: 1259, ...patch })
const items = [{ product_title: 'Keyboard K1', variant_name: 'Blue switch', unit_price: 1199, quantity: 1, line_total: 1199 }]
const invoice = (patch = {}) => ({ id: 42, no: '00163', date: '2026-11-07', summary_total: '1259.00', summary_paid: '0', summary_unpaid: '1259.00', ...patch })

test('Arabic lines read right to left with numbers kept whole', () => {
  assert.deepEqual(bidiRuns('فاتورة إلى:', true).map(t => t.text), [':', 'إلى', ' ', 'فاتورة'])
  assert.deepEqual(bidiRuns('-1,259.00 ج.م', true).map(t => t.text).join(''), 'م.ج -1,259.00')
  assert.deepEqual(bidiRuns('Bill to:', false).map(t => t.text).join(''), 'Bill to:')
  assert.equal(formatBillAmount(1259), '1,259.00')
})

test('the bill design keeps safe values and falls back to defaults', () => {
  assert.deepEqual(normalizeBillDesign(null), BILL_DESIGN_DEFAULTS)
  const d = normalizeBillDesign({ language: 'xx', header_color: 'red', logo_url: '//evil/x.png', seller_lines: 'a\nb\nc\nd\ne', title_ar: '  امر بيع ', show_logo: false })
  assert.equal(d.language, 'customer'); assert.equal(d.header_color, '#e5e7eb'); assert.equal(d.logo_url, ''); assert.equal(d.seller_lines, 'a\nb\nc\nd'); assert.equal(d.title_ar, 'امر بيع'); assert.equal(d.show_logo, false)
  assert.equal(billDesignError({ header_color: '#12345' }), 'color'); assert.equal(billDesignError({ logo_url: '/uploads/a/../b.png' }), 'logo')
  assert.equal(billDesignError({ seller_lines: '1\n2\n3\n4\n5' }), 'lines'); assert.equal(billDesignError({ logo_url: '/uploads/settings/logo.png', language: 'ar' }), null)
})

test('bill data mirrors the Daftra bill: products, delivery, totals and paid', () => {
  const bill = buildBillData({ order: order(), items, invoice: invoice({ summary_paid: '1259.00', summary_unpaid: '0' }), locale: 'ar' })
  assert.deepEqual(bill.lines.map(l => [l.name, l.detail || '', l.total]), [['Keyboard K1', 'Blue switch', 1199], ['التوصيل', '', 60]])
  assert.equal(bill.number, '00163'); assert.equal(bill.subtotal, 1259); assert.equal(bill.total, 1259); assert.equal(bill.paid, 1259); assert.equal(bill.balance, 0)
  assert.deepEqual(bill.customer, { name: 'Owned Buyer', lines: ['Owned street 1', 'Nasr City, Cairo'] })
  assert.equal(billFileName({ bill_number: 'INV/7' }), 'Bill-INV-7.pdf')
})

test('the PDF is a real document carrying the bill number, amounts and labels', async () => {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  for (const locale of ['en', 'ar']) {
    const pdf = await renderBillPdf({ bill: buildBillData({ order: order(), items, invoice: invoice(), locale }), design: { seller_name: 'OWNED WAREHOUSE', seller_lines: 'TAX NO : 0' }, fonts: await loadBillFonts() })
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-'); assert.ok(pdf.length < 150000, 'small enough to attach')
    const task = getDocument({ data: new Uint8Array(pdf), useSystemFonts: false, isEvalSupported: false }), doc = await task.promise
    const text = (await (await doc.getPage(1)).getTextContent()).items.map(i => i.str).join(' ')
    for (const expected of ['00163', '1,259.00', 'OWNED WAREHOUSE', 'Keyboard K1', locale === 'en' ? 'Balance due' : 'TAX NO']) assert.ok(text.includes(expected), `${locale}: ${expected}`)
    await task.destroy()
  }
})

test('a bill is written once per content; a payment change writes a new version', async () => {
  const saved = [], rows = new Map()
  const db = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { bill_design: { language: 'en' } }, error: null }) }) }) }),
    rpc: async (name, args) => name === 'order_bill_get' ? { data: rows.get(args.p_order) || null, error: null } : (rows.set(args.p_bill.order_id, args.p_bill), { data: args.p_bill, error: null }) }
  const save = async (key, bytes) => { saved.push(key); return { path: key, sha256: 'a'.repeat(64), size_bytes: bytes.length } }
  const o = order()
  const first = await ensureOrderBill(db, { order: o, items, invoice: invoice() }, { save })
  assert.equal(first.created, true); assert.match(saved[0], new RegExp(`^vps-v1/bills/${o.id}/[0-9a-f-]{36}\\.pdf$`))
  assert.equal((await ensureOrderBill(db, { order: o, items, invoice: invoice() }, { save })).changed, false); assert.equal(saved.length, 1)
  const paid = await ensureOrderBill(db, { order: o, items, invoice: invoice({ summary_paid: '1259.00', summary_unpaid: '0' }) }, { save })
  assert.equal(paid.changed, true); assert.equal(saved.length, 2); assert.equal(rows.get(o.id).paid_amount, 1259)
  await assert.rejects(() => ensureOrderBill(db, { order: o, items, invoice: invoice({ no: '' }) }, { save }), /bill number/)
})

test('the bill email is queued as a bill message and Brevo receives the PDF attachment', async () => {
  const calls = []
  const db = { rpc: async (name, args) => { calls.push([name, args]); return name === 'order_bill_email_request' ? { data: { id: '11111111-1111-4111-8111-111111111111', recipient: 'buyer@example.invalid', locale: 'en', order_number: 'ORD-1', bill_number: '00163' }, error: null } : { data: null, error: null } } }
  const sent = []
  const result = await queueBillEmail(db, 'order-1', {}, { email: () => ({ sendTransactional: async (input, options) => { sent.push([input, options]); return { id: '22222222-2222-4222-8222-222222222222', state: 'queued' } } }) })
  assert.equal(result.queued, true)
  assert.deepEqual(calls[0], ['order_bill_email_request', { p_order: 'order-1', p_actor: null, p_kind: 'issued' }])
  assert.equal(sent[0][1].billEmail, true); assert.equal(sent[0][0].idempotency_key, '11111111-1111-4111-8111-111111111111'); assert.match(sent[0][0].subject, /ORD-1/)
  assert.deepEqual(calls.at(-1), ['order_bill_email_mark', { p_id: '11111111-1111-4111-8111-111111111111', p_message: '22222222-2222-4222-8222-222222222222' }])
  let payload
  const outcome = await brevoProvider.submit({ config: { timeout_ms: 1000 } }, 'k'.repeat(40), { recipient: 'buyer@example.invalid', sender: 'store@example.invalid', sender_name: 'Store', subject: 'Bill',
    correlation: 'elc-x', classification: 'transactional', body_format: 'html', html_body: '<p>x</p>', attachments: [{ name: 'Bill-00163.pdf', content: 'JVBERi0x' }] }, async () => {}, async body => { payload = body; return { status: 201, body: JSON.stringify({ messageId: '<a@b.c>' }) } })
  assert.equal(outcome.state, 'accepted'); assert.deepEqual(payload.attachment, [{ name: 'Bill-00163.pdf', content: 'JVBERi0x' }])
})

test('native: bills are private, one bill email per order, staff resends are limited and the worker attaches the PDF', { timeout: 300000 }, async t => {
  const { emailNativeAvailable } = await import('./helpers/emailNativeDatabase.mjs')
  if (!emailNativeAvailable) return t.skip('native PostgreSQL is not configured')
  const { createEmailFixture, emailFixtureRuntime } = await import('./helpers/emailFixture.mjs')
  const { processEmailQueue } = await import('../server/utils/email/service.js')
  const f = await createEmailFixture(), q = (sql, args) => f.db.query(sql, args)
  // The private disk check refuses linked paths; macOS temp folders sit behind a link.
  const documents = await realpath(await mkdtemp(join(tmpdir(), 'bill-docs-'))); await chmod(documents, 0o700)
  Object.assign(emailFixtureRuntime, { shippingDocumentsDir: documents })
  try {
    await f.activate()
    // The website server calls these functions with the service role.
    await q("select set_config('request.jwt.claim.role','service_role',false)")
    await f.db.exec("begin;set local app.order_email_write='on';update public.order_email_settings set is_enabled=true,enabled_since=now();commit;")
    await f.db.exec("begin;select set_config('request.jwt.claim.role','service_role',true);insert into public.site_settings(key,erp_mode,daftra_connection_status,payment_cash_enabled) values('default','daftra','error',true) on conflict(key) do update set erp_mode='daftra',daftra_connection_status='error',payment_cash_enabled=true;commit;")
    await q("insert into public.customer_profiles(id,email,is_active) values($1,'buyer@email.example.invalid',true) on conflict(id) do update set is_active=true", [f.actors.customer])
    const id = randomUUID()
    await q(`insert into public.customer_orders(id,user_id,order_number,status,payment_method,email,first_name,last_name,phone,street_address,city,governorate,subtotal_amount,total_amount,shipping_fee_amount,sms_locale)
      values($1,$2,'ORD-BILL-1','processing','cash','buyer@email.example.invalid','Owned','Buyer','01000000000','Owned street','Nasr City','Cairo',1199,1259,60,'en')`, [id, f.actors.customer])
    const o = (await q('select * from public.customer_orders where id=$1', [id])).rows[0]
    assert.equal(o.erp_owner, 'daftra')

    await t.test('the PDF is stored on the private disk and only its path is in the database', async () => {
      const made = await ensureOrderBill(f.client, { order: o, items, invoice: invoice() })
      assert.equal(made.created, true)
      const row = (await q('select * from private.order_bills where order_id=$1', [id])).rows[0]
      assert.match(row.file_path, /^vps-v1\/bills\//); const bytes = await readFile(join(documents, row.file_path)); assert.equal(bytes.subarray(0, 5).toString(), '%PDF-')
      await assert.rejects(() => f.db.exec('begin;set local role authenticated;select * from private.order_bills;'), /permission denied/); await f.db.exec('rollback')
    })

    let firstMessage
    await t.test('the issued email is queued once; viewers cannot resend; owners can, two minutes apart', async () => {
      const first = await queueBillEmail(f.client, id); assert.equal(first.queued, true, JSON.stringify(first))
      firstMessage = (await q("select email_message_id from private.order_bill_emails where order_id=$1 and kind='issued'", [id])).rows[0].email_message_id
      assert.equal((await f.message(firstMessage)).category, 'orders:bill')
      assert.deepEqual(await queueBillEmail(f.client, id), { queued: false, skipped: 'already_sent' })
      await assert.rejects(() => queueBillEmail(f.client, id, { actor: f.actors.viewer }), /unavailable|permission/i)
      assert.deepEqual(await queueBillEmail(f.client, id, { actor: f.actors.owner }), { queued: false, skipped: 'too_soon' }, 'not right after the first email')
      await q("update private.order_bill_emails set created_at=now()-interval '5 minutes' where order_id=$1", [id])
      assert.equal((await queueBillEmail(f.client, id, { actor: f.actors.owner })).queued, true)
      assert.deepEqual(await queueBillEmail(f.client, id, { actor: f.actors.owner }), { queued: false, skipped: 'too_soon' })
      assert.equal((await q("select count(*)::int n from public.admin_activity_logs where action_key='orders.bill.resend'")).rows[0].n, 1)
    })

    await t.test('the worker attaches the current bill PDF; a missing file waits without sending', async () => {
      const seen = []
      const provider = { submit: async (_settings, _key, message, beforeDispatch) => { seen.push(message); await beforeDispatch(); return { state: 'accepted', provider_message_id: randomUUID() + '@brevo.example', http_status: 201 } } }
      await f.unthrottle(); await processEmailQueue(f.client, { provider, attach: async () => { throw new Error('missing') } })
      assert.equal(seen.length, 0, 'nothing is sent without the PDF')
      assert.equal((await f.message(firstMessage)).error_category, 'attachment_unavailable')
      await f.fixtureWrite('update public.email_messages set next_attempt_at=now() where id=$1', [firstMessage]); await f.unthrottle()
      await processEmailQueue(f.client, { provider })
      assert.equal(seen[0].attachments[0].name, 'Bill-00163.pdf'); assert.ok(seen[0].attachments[0].content.startsWith('JVBER'))
      assert.equal((await f.message(firstMessage)).state, 'accepted')
    })
  } finally { await f.db.close?.() }
})
