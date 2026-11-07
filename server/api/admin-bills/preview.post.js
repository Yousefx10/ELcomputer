import { createError, readBody, setHeader } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { renderBillPdf } from '../../utils/billPdf'
import { billDesignError, normalizeBillDesign } from '../../../app/utils/billDesign'
import { loadBillFonts, loadBillLogo } from '../../utils/customerBills'

// Settings → Bill design → Preview: the current (unsaved) design on a clearly marked sample bill.
export default defineEventHandler(async event => {
  for (const [k, v] of Object.entries({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' })) setHeader(event, k, v)
  const { supabaseAdmin } = await requireAdminRequest(event, { permission: 'settings.view' })
  const body = await readBody(event)
  if (billDesignError(body?.design)) throw createError({ statusCode: 400, statusMessage: 'Check the bill design fields.' })
  const design = normalizeBillDesign(body.design), locale = body?.locale === 'ar' ? 'ar' : 'en', ar = locale === 'ar'
  const { data: settings } = await supabaseAdmin.from('site_settings').select('site_logo_url,site_logo_light_url').eq('key', 'default').maybeSingle()
  const bill = { locale, number: 'SAMPLE', date: new Date().toISOString().slice(0, 10), orderNumber: 'ORD-SAMPLE',
    customer: { name: ar ? 'اسم العميل' : 'Customer name', lines: [ar ? 'عنوان العميل' : 'Customer address', ar ? 'المدينة، المحافظة' : 'City, Governorate'] },
    lines: [{ name: ar ? 'منتج تجريبي' : 'Sample product', unitPrice: 100, quantity: 2, total: 200 }, { name: ar ? 'التوصيل' : 'Delivery', unitPrice: 50, quantity: 1, total: 50 }],
    subtotal: 250, discount: 0, total: 250, paid: 250, balance: 0 }
  const pdf = await renderBillPdf({ bill, design, fonts: await loadBillFonts(), logo: await loadBillLogo(design, settings) })
  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Disposition', 'inline; filename="Bill-preview.pdf"')
  return pdf
})
