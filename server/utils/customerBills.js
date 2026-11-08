import { createHash, randomUUID } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createError, setHeader } from 'h3'
import { renderBillPdf } from './billPdf.js'
import { normalizeBillDesign } from '../../app/utils/billDesign.js'
import { saveShippingDocument, readShippingDocument } from './privateShippingDocuments.js'
import { createEmailService } from './email/service.js'

// Owner request 7 Nov 2026 (phase 3B): the website makes the customer bill PDF from the Daftra
// bill (number, date, totals, paid) and the website order (customer and lines). The PDF is kept
// on the VPS private documents disk; the database keeps its path and checksum.
const unavailable = message => createError({ statusCode: 503, statusMessage: message || 'The bill is unavailable. Try again later.' })
const rpc = async (db, name, args) => { const { data, error } = await db.rpc(name, args); if (error) throw unavailable(); return data }
const sha = value => createHash('sha256').update(value).digest('hex')
const amount = value => Math.round(Number(value || 0) * 100) / 100

const FONT_FILES = { regular: 'fonts/IBMPlexSansArabic-Regular.woff', bold: 'fonts/IBMPlexSansArabic-Bold.woff' }
let fontCache = null
export const loadBillFonts = async () => {
  if (fontCache) return fontCache
  const read = async name => {
    // Nitro bundles server/assets; tests and scripts read the source folder.
    if (typeof useStorage === 'function') { const raw = await useStorage('assets:server').getItemRaw(name).catch(() => null); if (raw) return Buffer.from(raw) }
    return readFile(resolve(process.cwd(), 'server/assets', name))
  }
  fontCache = { regular: await read(FONT_FILES.regular), bold: await read(FONT_FILES.bold) }
  return fontCache
}

// The bill logo: the design's own logo or the store logo, a PNG/JPEG from the public uploads.
export const loadBillLogo = async (design, settings) => {
  const url = design.logo_url || settings?.site_logo_light_url || settings?.site_logo_url || ''
  if (!design.show_logo || !/^\/uploads\/[A-Za-z0-9_./-]+\.(png|jpe?g)$/i.test(url)) return null
  try {
    // Loaded on demand: the uploads helper depends on app aliases that plain scripts cannot resolve.
    const { getAbsoluteUploadPathFromRelativePath, getRelativeUploadPathFromPublicPath, assertSafeUploadPath } = await import('./uploads.js')
    const path = getAbsoluteUploadPathFromRelativePath(getRelativeUploadPathFromPublicPath(url))
    await assertSafeUploadPath(path)
    if ((await stat(path)).size > 2 * 1024 * 1024) return null
    return await readFile(path)
  } catch { return null }
}

export const billLocale = (design, order) => design.language === 'customer' ? (order?.sms_locale === 'ar' ? 'ar' : 'en') : design.language

const EXTRA = { en: { delivery: 'Delivery', fee: 'Payment fee' }, ar: { delivery: 'التوصيل', fee: 'رسوم الدفع' } }
// Lines mirror the Daftra bill: products, then delivery and the payment fee.
export const buildBillData = ({ order, items, invoice, locale }) => {
  const words = EXTRA[locale === 'ar' ? 'ar' : 'en']
  const lines = [
    ...(items || []).map(item => ({ name: String(item.product_title || ''), detail: item.variant_name && !/^default$/i.test(item.variant_name) ? String(item.variant_name) : '',
      unitPrice: amount(item.unit_price), quantity: Number(item.quantity), total: amount(item.line_total ?? Number(item.unit_price) * Number(item.quantity)) })),
    ...(Number(order.shipping_fee_amount) > 0 ? [{ name: words.delivery, unitPrice: amount(order.shipping_fee_amount), quantity: 1, total: amount(order.shipping_fee_amount) }] : []),
    ...(Number(order.payment_fee_amount) > 0 ? [{ name: words.fee, unitPrice: amount(order.payment_fee_amount), quantity: 1, total: amount(order.payment_fee_amount) }] : [])
  ]
  const total = amount(invoice.summary_total), paid = amount(invoice.summary_paid)
  const unpaid = invoice.summary_unpaid == null ? amount(total - paid) : amount(invoice.summary_unpaid)
  return {
    locale: locale === 'ar' ? 'ar' : 'en', number: String(invoice.no || '').trim(), date: String(invoice.date || order.created_at).slice(0, 10), orderNumber: order.order_number,
    customer: { name: [order.first_name, order.last_name].filter(Boolean).join(' ').trim(), lines: [order.street_address, [order.city, order.governorate].filter(Boolean).join(', ')].filter(Boolean) },
    lines, subtotal: amount(lines.reduce((sum, line) => sum + line.total, 0)), discount: amount(order.discount_amount), total, paid, balance: Math.max(0, unpaid)
  }
}

// Creates or refreshes the order's bill PDF. A new file is written only when its content changes.
export async function ensureOrderBill(db, { order, items, invoice }, { render = renderBillPdf, save = saveShippingDocument } = {}) {
  if (!/^[0-9]{1,20}$/.test(String(invoice?.id || '')) || !/^[A-Za-z0-9/_-]{1,40}$/.test(String(invoice?.no || '').trim())) throw unavailable('The Daftra bill number is not usable.')
  const { data: settings, error } = await db.from('site_settings').select('bill_design,site_logo_url,site_logo_light_url').eq('key', 'default').maybeSingle()
  if (error) throw unavailable()
  const design = normalizeBillDesign(settings?.bill_design), locale = billLocale(design, order)
  const bill = buildBillData({ order, items, invoice, locale }), logo = await loadBillLogo(design, settings)
  const contentSha = sha(JSON.stringify({ design, bill, logo: logo ? sha(logo) : null }))
  const current = await rpc(db, 'order_bill_get', { p_order: order.id })
  if (current?.content_sha256 === contentSha) return { bill: current, created: false, changed: false }
  const pdf = await render({ bill, design, fonts: await loadBillFonts(), logo })
  const saved = await save(`vps-v1/bills/${order.id}/${randomUUID()}.pdf`, pdf)
  const row = await rpc(db, 'order_bill_save', { p_bill: { order_id: order.id, bill_number: bill.number, bill_date: bill.date, external_id: String(invoice.id), locale,
    file_path: saved.path, sha256: saved.sha256, size_bytes: saved.size_bytes, total_amount: bill.total, paid_amount: bill.paid, content_sha256: contentSha } })
  return { bill: row, created: !current, changed: true }
}

// Order screens show only the bill number and date; a read problem simply hides the bill button.
export const readBillSummary = async (db, orderId) => {
  try { const { data, error } = await db.rpc('order_bill_get', { p_order: orderId }); return !error && data ? { number: data.bill_number, date: data.bill_date } : null }
  catch { return null }
}
export const readOrderBillPdf = async bill => readShippingDocument({ path: bill.file_path, sha256: bill.sha256, size_bytes: bill.size_bytes })
export const sendCustomerBill = async (event, db, userId, orderId) => {
  for (const [k, v] of Object.entries({ 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' })) setHeader(event, k, v)
  const owned = await db.from('customer_orders').select('id').eq('id', orderId).eq('user_id', userId).maybeSingle()
  if (owned.error) throw unavailable()
  if (!owned.data) throw createError({ statusCode: 404, statusMessage: 'Order not found.' })
  const { data: bill, error } = await db.rpc('order_bill_get', { p_order: orderId })
  if (error) throw unavailable()
  if (!bill) throw createError({ statusCode: 404, statusMessage: 'The bill is not ready yet.' })
  const bytes = await readOrderBillPdf(bill)
  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Disposition', `attachment; filename="${billFileName(bill)}"`)
  return bytes
}
export const billFileName = bill => `Bill-${String(bill.bill_number).replace(/[^A-Za-z0-9_-]/g, '-')}.pdf`

const SKIPPED = { no_bill: 'The bill is not ready yet.', email_off: 'Order emails are off.', recipient_unverified: 'The customer email is not verified.',
  already_sent: 'The bill email was already sent.', too_soon: 'Wait two minutes before sending again.', daily_limit: 'This bill was sent five times today.' }
export const billEmailSkipMessage = reason => SKIPPED[reason] || 'The bill email could not be sent.'

// Queues the bill email. The worker attaches the current PDF when it sends the message.
export async function queueBillEmail(db, orderId, { actor = null } = {}, { email = createEmailService } = {}) {
  const kind = actor ? 'resend' : 'issued'
  const request = await rpc(db, 'order_bill_email_request', { p_order: orderId, p_actor: actor, p_kind: kind })
  if (request?.skipped) return { queued: false, skipped: request.skipped }
  const ar = request.locale === 'ar'
  const input = { recipient: request.recipient, locale: request.locale, body_format: 'html', business_reference: request.order_number, idempotency_key: request.id, priority: 4,
    subject: ar ? `فاتورة طلبك ${request.order_number}` : `Your bill for order ${request.order_number}`,
    body: ar ? `مرفق فاتورة طلبك.\n\nرقم الفاتورة: ${request.bill_number}` : `Your bill is attached.\n\nBill number: ${request.bill_number}` }
  const result = await email(db).sendTransactional(input, { billEmail: true })
  if (result?.id) await rpc(db, 'order_bill_email_mark', { p_id: request.id, p_message: result.id })
  return { queued: Boolean(result?.id) && result.state !== 'suppressed', state: result?.state || null }
}

// Email worker: the PDF for a bill message, or null when the message is not a bill.
export async function billEmailAttachment(db, messageId) {
  const bill = await rpc(db, 'order_bill_for_email', { p_message: messageId })
  if (!bill) throw unavailable()
  const bytes = await readOrderBillPdf(bill)
  return { name: billFileName(bill), content: bytes.toString('base64') }
}
