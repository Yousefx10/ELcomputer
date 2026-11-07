// Dashboard → Settings → Bill design (owner request 7 Nov 2026). Shared by the editor and the
// server renderer. Every field is optional; unknown or invalid values fall back to defaults.
export const BILL_DESIGN_DEFAULTS = Object.freeze({
  language: 'customer', title_en: 'Sales invoice', title_ar: 'فاتورة بيع',
  seller_name: '', seller_lines: '', footer_en: '', footer_ar: '',
  show_logo: true, logo_url: '', header_color: '#e5e7eb', show_payments: true, show_order_number: true
})
const LANGUAGES = ['customer', 'ar', 'en']
const LOGO = /^\/uploads\/[A-Za-z0-9_./-]{1,300}\.(png|jpe?g)$/i
const text = (value, max) => typeof value === 'string' ? value.replace(/[\x00-\x09\x0b-\x1f\x7f]/g, '').trim().slice(0, max) : ''
const lines = (value, count, max) => text(value, count * (max + 1)).split('\n').map(line => line.trim().slice(0, max)).filter(Boolean).slice(0, count).join('\n')

export const billDesignError = value => {
  if (value == null) return null
  if (typeof value !== 'object' || Array.isArray(value)) return 'invalid'
  if (value.language != null && !LANGUAGES.includes(value.language)) return 'language'
  if (value.header_color && !/^#[0-9a-fA-F]{6}$/.test(value.header_color)) return 'color'
  if (value.logo_url && (!LOGO.test(value.logo_url) || value.logo_url.includes('..') || value.logo_url.includes('//'))) return 'logo'
  if (typeof value.seller_lines === 'string' && value.seller_lines.split('\n').filter(line => line.trim()).length > 4) return 'lines'
  return null
}

export const normalizeBillDesign = value => {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const d = BILL_DESIGN_DEFAULTS
  return {
    language: LANGUAGES.includes(source.language) ? source.language : d.language,
    title_en: text(source.title_en, 40) || d.title_en, title_ar: text(source.title_ar, 40) || d.title_ar,
    seller_name: text(source.seller_name, 80), seller_lines: lines(source.seller_lines, 4, 80),
    footer_en: text(source.footer_en, 200), footer_ar: text(source.footer_ar, 200),
    show_logo: source.show_logo !== false,
    logo_url: typeof source.logo_url === 'string' && LOGO.test(source.logo_url) && !source.logo_url.includes('..') && !source.logo_url.includes('//') ? source.logo_url : '',
    header_color: typeof source.header_color === 'string' && /^#[0-9a-fA-F]{6}$/.test(source.header_color) ? source.header_color.toLowerCase() : d.header_color,
    show_payments: source.show_payments !== false, show_order_number: source.show_order_number !== false
  }
}
