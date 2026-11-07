import { normalizeBillDesign } from '../../app/utils/billDesign.js'

// Customer bill PDF (owner request 7 Nov 2026). The layout follows the owner's reference bill:
// logo, seller details and title; a double rule; Bill to and bill details; the items table;
// totals with paid and balance. Arabic bills mirror the layout right-to-left.
const LABELS = {
  en: { billTo: 'Bill to:', number: 'Bill number', date: 'Bill date', order: 'Order', item: 'Item', unitPrice: 'Unit price', quantity: 'Qty',
    lineTotal: 'Total', subtotal: 'Subtotal', discount: 'Discount', total: 'Total', paid: 'Paid', balance: 'Balance due', currency: 'EGP' },
  ar: { billTo: 'فاتورة إلى:', number: 'رقم الفاتورة', date: 'تاريخ الفاتورة', order: 'رقم الطلب', item: 'البند', unitPrice: 'سعر الوحدة', quantity: 'الكمية',
    lineTotal: 'المجموع', subtotal: 'المجموع', discount: 'الخصم', total: 'الإجمالي', paid: 'مدفوع', balance: 'الرصيد المستحق', currency: 'ج.م' }
}
export const billLabels = locale => LABELS[locale === 'ar' ? 'ar' : 'en']

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/
const LATIN = /[A-Za-z0-9À-ɏ]/
// Minimal bidi for display lines: text splits into Arabic words, Latin/number words and single
// neutral characters. Neutrals join a run when both neighbours agree, otherwise follow the
// paragraph direction. Tokens come back in visual (left-to-right) order; each Arabic word is
// shaped by fontkit on its own. Mirrored brackets swap inside right-to-left runs.
const MIRROR = { '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<' }
export const bidiRuns = (value, rtl) => {
  const tokens = []
  for (const c of String(value ?? '')) {
    const type = ARABIC.test(c) && !/[،؛؟٪-٬۔]/.test(c) ? 'R' : LATIN.test(c) ? 'L' : 'N'
    const last = tokens.at(-1)
    if (last && type !== 'N' && last.type === type) last.text += c; else tokens.push({ type, text: c })
  }
  // Number punctuation stays inside a number (1,259.00 or 07/11/2026).
  for (let i = 1; i < tokens.length - 1; i++) if (tokens[i].type === 'N' && /^[.,/:-]$/.test(tokens[i].text) && /\d$/.test(tokens[i - 1].text) && /^\d/.test(tokens[i + 1].text)) {
    tokens.splice(i - 1, 3, { type: 'L', text: tokens[i - 1].text + tokens[i].text + tokens[i + 1].text }); i--
  }
  // A sign directly before a number belongs to it (-1,259.00).
  for (let i = 0; i < tokens.length - 1; i++) if (tokens[i].type === 'N' && /^[-+\u2212]$/.test(tokens[i].text) && /^\d/.test(tokens[i + 1].text) && (i === 0 || tokens[i - 1].text === ' ')) {
    tokens.splice(i, 2, { type: 'L', text: tokens[i].text + tokens[i + 1].text })
  }
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== 'N') continue
    let j = i; while (j < tokens.length && tokens[j].type === 'N') j++
    const before = i > 0 ? tokens[i - 1].type : null, after = j < tokens.length ? tokens[j].type : null
    const resolved = before && before === after ? before : rtl ? 'R' : 'L'
    for (let k = i; k < j; k++) tokens[k] = { ...tokens[k], type: resolved, neutral: true }
    i = j - 1
  }
  const runs = []
  for (const t of tokens) { const last = runs.at(-1); if (last && last.type === t.type) last.tokens.push(t); else runs.push({ type: t.type, tokens: [t] }) }
  if (rtl) runs.reverse()
  return runs.flatMap(run => run.type === 'R' ? run.tokens.slice().reverse().map(t => ({ type: 'R', text: t.neutral && MIRROR[t.text] ? MIRROR[t.text] : t.text })) : run.tokens.map(t => ({ type: 'L', text: t.text })))
}
export const isRtlText = value => { const s = String(value ?? ''); const a = s.search(ARABIC), l = s.search(LATIN); return a >= 0 && (l < 0 || a < l) }
export const formatBillAmount = value => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.round(Number(value || 0) * 100) / 100)
export const formatBillDate = value => { const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : '' }

export async function renderBillPdf({ bill, design: rawDesign, fonts, logo = null }) {
  // Loaded on first use, so order pages that only read a bill never load the PDF library.
  const { default: PDFDocument } = await import('pdfkit')
  const design = normalizeBillDesign(rawDesign), ar = bill.locale === 'ar', L = billLabels(bill.locale)
  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true, font: fonts.regular, info: { Title: `${ar ? design.title_ar : design.title_en} ${bill.number}`, Producer: 'Storefront' } })
  doc.registerFont('R', fonts.regular); doc.registerFont('B', fonts.bold)
  const chunks = []; doc.on('data', c => chunks.push(c))
  const done = new Promise((resolve, reject) => { doc.on('end', resolve); doc.on('error', reject) })
  const W = doc.page.width, H = doc.page.height, M = 40, CW = W - 2 * M
  // Logical boxes run from the start side; Arabic mirrors them.
  const X = (x, w) => ar ? W - M - x - w : M + x
  const width = (s, font, size) => { doc.font(font).fontSize(size); return bidiRuns(s, isRtlText(s)).reduce((sum, r) => sum + doc.widthOfString(r.text), 0) }
  const line = (s, x, y, w, { font = 'R', size = 10, align = 'start', color = '#111827' } = {}) => {
    const str = String(s ?? ''); if (!str) return
    const rtlText = ar ? !/^[\d\s.,:/+-]+$/.test(str) || isRtlText(str) : isRtlText(str)
    // start/end follow the bill direction; right/left are physical (numbers sit right, as in the reference).
    const total = width(str, font, size), right = align === 'right' || (align === 'end' && !ar) || (align === 'start' && ar)
    let cx = align === 'center' ? x + (w - total) / 2 : right ? x + w - total : x
    doc.font(font).fontSize(size).fillColor(color)
    for (const run of bidiRuns(str, rtlText)) { doc.text(run.text, cx, y, { lineBreak: false }); cx += doc.widthOfString(run.text) }
  }
  const wrap = (s, w, font, size) => {
    const words = String(s ?? '').split(/\s+/).filter(Boolean), out = []; let cur = ''
    for (const word of words) { const next = cur ? cur + ' ' + word : word; if (cur && width(next, font, size) > w) { out.push(cur); cur = word } else cur = next }
    if (cur) out.push(cur); return out.length ? out : ['']
  }
  const money = v => `${formatBillAmount(v)} ${L.currency}`

  // Header: logo, seller details, title.
  let y = M, headerBottom = M + 34
  if (design.show_logo && logo) {
    try { doc.image(logo, X(0, 150), y, { fit: [150, 60], align: ar ? 'right' : 'left', valign: 'top' }); headerBottom = Math.max(headerBottom, y + 60) } catch { /* An unreadable logo is left out. */ }
  }
  const sellerX = design.show_logo && logo ? 175 : 0
  const seller = [design.seller_name, ...design.seller_lines.split('\n')].filter(Boolean)
  // Seller lines follow their own script, as in the reference (Latin lines sit left).
  seller.forEach((text, i) => line(text, X(sellerX, 220), y + 4 + i * 18, 220, { size: 10, align: isRtlText(text) ? 'right' : 'left' }))
  headerBottom = Math.max(headerBottom, y + 4 + seller.length * 18)
  line(ar ? design.title_ar : design.title_en, X(CW - 150, 150), y, 150, { font: 'B', size: 22, align: 'end' })
  y = headerBottom + 18
  doc.lineWidth(1.2).strokeColor('#111827').moveTo(M, y).lineTo(W - M, y).stroke()
  doc.lineWidth(0.6).moveTo(M, y + 3).lineTo(W - M, y + 3).stroke(); y += 24

  // Bill to and bill details.
  const to = [bill.customer?.name, ...(bill.customer?.lines || [])].filter(Boolean)
  line(L.billTo, X(0, 70), y, 70, { font: 'B', size: 11 })
  let ty = y
  for (const text of to) for (const part of wrap(text, 230, 'R', 10)) { line(part, X(78, 230), ty, 230, { size: 10 }); ty += 15 }
  const details = [[L.number, bill.number], [L.date, formatBillDate(bill.date)], ...(design.show_order_number && bill.orderNumber ? [[L.order, bill.orderNumber]] : [])]
  details.forEach(([label, value], i) => { line(label, X(CW - 210, 100), y + i * 16, 100, { font: 'B', size: 10 }); line(value, X(CW - 105, 105), y + i * 16, 105, { size: 10, align: 'end' }) })
  y = Math.max(ty, y + details.length * 16) + 22

  // Items table.
  const cols = [{ key: 'item', w: CW - 245 }, { key: 'unitPrice', w: 85 }, { key: 'quantity', w: 60 }, { key: 'lineTotal', w: 100 }]
  let offset = 0; for (const c of cols) { c.x = offset; offset += c.w }
  const headerRow = () => {
    doc.rect(M, y, CW, 24).fillColor(design.header_color).fill()
    for (const c of cols) line(L[c.key], X(c.x + 6, c.w - 12), y + 6, c.w - 12, { font: 'B', size: 10, align: c.key === 'item' ? 'start' : 'right' })
    doc.lineWidth(0.6).strokeColor('#6b7280').rect(M, y, CW, 24).stroke(); y += 24
  }
  headerRow()
  for (const item of bill.lines || []) {
    const name = wrap(item.name, cols[0].w - 12, 'R', 10), detail = item.detail ? wrap(item.detail, cols[0].w - 12, 'R', 8.5) : []
    const h = Math.max(26, 8 + name.length * 14 + detail.length * 12 + 6)
    if (y + h > H - 210) { doc.addPage(); y = M; headerRow() }
    let iy = y + 7
    for (const part of name) { line(part, X(cols[0].x + 6, cols[0].w - 12), iy, cols[0].w - 12, { size: 10 }); iy += 14 }
    for (const part of detail) { line(part, X(cols[0].x + 6, cols[0].w - 12), iy, cols[0].w - 12, { size: 8.5, color: '#4b5563' }); iy += 12 }
    line(formatBillAmount(item.unitPrice), X(cols[1].x + 6, cols[1].w - 12), y + 7, cols[1].w - 12, { size: 10, align: 'right' })
    line(String(item.quantity), X(cols[2].x + 6, cols[2].w - 12), y + 7, cols[2].w - 12, { size: 10, align: 'right' })
    line(formatBillAmount(item.total), X(cols[3].x + 6, cols[3].w - 12), y + 7, cols[3].w - 12, { size: 10, align: 'right' })
    doc.lineWidth(0.6).strokeColor('#6b7280').rect(M, y, CW, h).stroke()
    for (const c of cols.slice(1)) { const vx = ar ? W - M - c.x : M + c.x; doc.moveTo(vx, y).lineTo(vx, y + h).stroke() }
    y += h
  }

  // Totals at the end side, as in the reference bill.
  const rows = [[L.subtotal, bill.subtotal], ...(Number(bill.discount) > 0 ? [[L.discount, -Number(bill.discount)]] : []), [L.total, bill.total, true],
    ...(design.show_payments ? [[L.paid, -Number(bill.paid || 0)], [L.balance, bill.balance]] : [])]
  if (y + rows.length * 26 + 40 > H - 90) { doc.addPage(); y = M }
  y += 6
  const tw = 250, tx = CW - tw
  for (const [label, value, strong] of rows) {
    if (strong) doc.rect(X(tx, tw), y, tw, 26).fillColor(design.header_color).fill()
    line(label, X(tx + 8, 120), y + 7, 120, { font: 'B', size: strong ? 11 : 10 })
    line(money(value), X(tx + 130, tw - 138), y + 7, tw - 138, { font: strong ? 'B' : 'R', size: strong ? 11 : 10, align: 'end' })
    doc.lineWidth(0.6).strokeColor('#111827').moveTo(X(tx, tw), y + 26).lineTo(X(tx, tw) + tw, y + 26).stroke(); y += 26
  }

  const footer = ar ? design.footer_ar : design.footer_en
  const range = doc.bufferedPageRange()
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i)
    if (footer && i === range.count - 1) wrap(footer, CW, 'R', 9).forEach((part, n) => line(part, M, H - 78 + n * 13, CW, { size: 9, align: 'center', color: '#374151' }))
    line(`${i + 1}/${range.count}`, M, H - 46, CW, { size: 10, align: 'center' })
  }
  doc.end(); await done
  return Buffer.concat(chunks)
}
