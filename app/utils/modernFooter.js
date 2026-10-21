import { paymentMethodDefinitions, getAvailablePaymentMethods } from './paymentMethods.js'

// Public presentation only. Checkout and provider settings remain authoritative.
const text = (value, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const pair = (source, key, fallback = '', arabic = '') => ({ [key]: text(source?.[key] ?? fallback), [`${key}_ar`]: text(source?.[`${key}_ar`] ?? arabic) })
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {}
const enabled = (value, fallback = true) => typeof value === 'boolean' ? value : fallback
export const footerText = (source, key, locale) => text(locale === 'ar' ? source?.[`${key}_ar`] || source?.[key] : source?.[key] || source?.[`${key}_ar`])
export const footerUrl = (value, kind = 'link') => {
  const url = text(value, 2048)
  if (!url || /[\s\\<>"'`\x00-\x1f\x7f]|%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(url)) return ''
  if (kind === 'contact' && /^(?:tel:\+?[\d().-]+|mailto:[^@:/?#]+@[^@:/?#]+\.[^@:/?#]+)$/.test(url)) return url
  if (kind !== 'external' && /^\/(?!\/)/.test(url)) return url
  try {
    const parsed = new URL(url)
    return ['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password && parsed.hostname ? url : ''
  } catch { return '' }
}
export const footerMethods = paymentMethodDefinitions.map(method => method.value)
export const footerSocialIcons = { facebook: 'lucide:facebook', instagram: 'lucide:instagram', x: 'lucide:twitter', youtube: 'lucide:youtube', linkedin: 'lucide:linkedin', whatsapp: 'lucide:message-circle', other: 'lucide:link' }
const rows = (value, limit, normalize) => (Array.isArray(value) ? value.slice(0, limit) : []).map((row, index) => normalize(object(row), index))
const link = (row, index) => ({ id: text(row.id, 80) || `link-${index}`, enabled: enabled(row.enabled ?? row.is_enabled), ...pair(row, 'label'), url: text(row.url, 2048), ...pair(row, 'badge') })

export function normalizeModernFooter(value) {
  const v = object(value), brand = object(v.brand), n = object(v.newsletter), s = object(v.support), a = object(v.apps), p = object(v.payments), b = object(v.bottom)
  return {
    version: 1,
    brand: { enabled: enabled(brand.enabled), logo_url: text(brand.logo_url, 2048), logo_dark_url: text(brand.logo_dark_url, 2048), ...pair(brand, 'description'), social_enabled: enabled(brand.social_enabled), ...pair(brand, 'social_heading', 'Follow us', 'تابعنا'), socials: rows(brand.socials, 12, (row, i) => ({ id: text(row.id, 80) || `social-${i}`, platform: Object.hasOwn(footerSocialIcons, row.platform) ? row.platform : 'other', label: text(row.label, 80), url: text(row.url, 2048), enabled: enabled(row.enabled) })) },
    columns: [0, 1].map(i => { const c = object(v.columns?.[i]); return { enabled: enabled(c.enabled), ...pair(c, 'title'), links: rows(c.links, 30, link) } }),
    newsletter: { state: n.state === 'disabled' ? 'disabled' : 'hidden', ...pair(n, 'title', 'Newsletter', 'النشرة البريدية'), ...pair(n, 'description'), ...pair(n, 'placeholder', 'Email address', 'البريد الإلكتروني'), ...pair(n, 'button', 'Subscribe', 'اشتراك') },
    support: { enabled: enabled(s.enabled), ...pair(s, 'hours'), ...pair(s, 'label'), url: text(s.url, 2048) },
    apps: { enabled: enabled(a.enabled, false), ...pair(a, 'title'), ...pair(a, 'description'), items: rows(a.items, 2, (row, i) => ({ id: text(row.id, 80) || `app-${i}`, platform: row.platform === 'google' ? 'google' : 'apple', enabled: enabled(row.enabled), url: text(row.url, 2048), image_url: text(row.image_url, 2048) })) },
    payments: { enabled: enabled(p.enabled, false), ...pair(p, 'title', 'Payment methods', 'طرق الدفع'), items: rows(p.items, 12, (row, i) => ({ id: text(row.id, 80) || `payment-${i}`, method: footerMethods.includes(row.method) ? row.method : 'card', label: text(row.label, 80), image_url: text(row.image_url, 2048), enabled: enabled(row.enabled) })) },
    bottom: { enabled: enabled(b.enabled), ...pair(b, 'copyright'), show_year: enabled(b.show_year, false), links: rows(b.links, 20, link) }
  }
}

export function resolveModernFooter(settings = {}, links = []) {
  if (settings.footer_modern_config != null) return normalizeModernFooter(settings.footer_modern_config)
  const groups = [...new Set(links.map(item => item.section_title || ''))]
  const columns = [groups.slice(0, 1), groups.slice(1)].map(titles => ({ title: titles.join(' · '), links: links.filter(item => titles.includes(item.section_title || '')) }))
  const config = normalizeModernFooter({
    brand: { description: settings.footer_modern_card_text || '' }, columns,
    support: { label: settings.footer_phone || settings.footer_email || '', url: settings.footer_phone ? `tel:${String(settings.footer_phone).replace(/[^+\d]/g, '')}` : settings.footer_email ? `mailto:${settings.footer_email}` : '' },
    bottom: { copyright: settings.footer_modern_bottom_center_text || settings.copyright_text || '' }
  })
  config.brand.social_heading_ar = 'تابعنا'
  config.newsletter.title_ar = 'النشرة البريدية'; config.newsletter.placeholder_ar = 'البريد الإلكتروني'; config.newsletter.button_ar = 'اشتراك'
  config.payments.title_ar = 'طرق الدفع'
  return config
}

export function validateModernFooter(value) {
  const v = normalizeModernFooter(value)
  if (new TextEncoder().encode(JSON.stringify(v)).length > 60000) return 'size'
  const validLinks = links => links.every(row => (!row.url || footerUrl(row.url)) && (!row.enabled || (row.url && (row.label || row.label_ar))))
  if (!v.columns.every(c => validLinks(c.links)) || !validLinks(v.bottom.links)) return 'links'
  if (v.brand.socials.some(row => (row.url && !footerUrl(row.url, 'external')) || (row.enabled && (!row.url || !row.label)))) return 'socials'
  if (v.support.url && !footerUrl(v.support.url, 'contact')) return 'contact'
  if (v.apps.items.some(row => (row.url && !footerUrl(row.url, 'external')) || (row.enabled && (!row.url || !row.image_url)))) return 'apps'
  if (v.payments.items.some(row => row.enabled && (!row.label || !row.image_url))) return 'payments'
  const images = [v.brand.logo_url, v.brand.logo_dark_url, ...v.apps.items.map(row => row.image_url), ...v.payments.items.map(row => row.image_url)]
  if (images.some(url => url && !footerUrl(url))) return 'images'
  return ''
}

export const visibleFooterPayments = (config, settings) => {
  const available = new Set(getAvailablePaymentMethods(settings).map(method => method.value))
  return config.payments.enabled ? config.payments.items.filter(row => row.enabled && row.label && footerUrl(row.image_url) && available.has(row.method)) : []
}
