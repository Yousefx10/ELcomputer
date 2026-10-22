import { brandUrl } from './brandPage.js'

export const productPageSections = ['highlights', 'overview', 'features', 'included', 'specifications', 'reviews', 'related']
export const productPageStyle = value => value === 'premium' ? 'premium' : 'classic'
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {}
const text = (value, limit) => typeof value === 'string' ? value.slice(0, limit) : ''

export function productPageEditorConfig(value) {
  const source = object(value), sections = object(source.sections)
  return {
    sections: Object.fromEntries(productPageSections.map(key => [key, sections[key] !== false])),
    policy_links: (Array.isArray(source.policy_links) ? source.policy_links : []).slice(0, 4).map((row, index) => {
      row = object(row)
      return { id: text(row.id, 80) || `policy-${index}`, label: text(row.label, 100), label_ar: text(row.label_ar, 100), url: text(row.url, 2048) }
    })
  }
}

export function normalizeProductPageConfig(value) {
  const config = productPageEditorConfig(value)
  return { ...config, policy_links: config.policy_links.map(row => ({ ...row, url: brandUrl(row.url) })).filter(row => row.url && (row.label.trim() || row.label_ar.trim())) }
}

export function productPageConfigError(value) {
  const rows = object(value).policy_links
  if (rows != null && (!Array.isArray(rows) || rows.length > 4)) return 'linksLimit'
  for (const row of rows || []) {
    if (!row || typeof row !== 'object' || typeof row.url !== 'string' || !brandUrl(row.url) || row.url.length > 2048) return 'invalidLink'
    if (![row.label, row.label_ar].some(label => typeof label === 'string' && label.trim())) return 'linkLabel'
    if ([row.label, row.label_ar].some(label => label != null && (typeof label !== 'string' || label.length > 100))) return 'linkLabel'
  }
  return ''
}

export function formatProductPagePrice(value, locale = 'en-US') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EGP', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value || 0))
}

// Presentation-only grouping. Authored values and their relative order survive.
// Classic keeps its original grouping; no catalog data is changed.
const fieldName = value => String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
const includedNames = new Set(['whatsincluded', 'boxcontents', 'packagecontents', 'inthebox', 'محتوياتالعبوة', 'محتوياتالصندوق'])
export function premiumSpecificationContent(rows = []) {
  const groups = [], byName = new Map(), included = []
  let model = ''
  for (const row of rows) {
    const label = String(row.definition?.name || row.label || '').trim(), value = String(row.value || '').trim()
    if (!label || !value) continue
    const name = String(row.definition?.group_name || '').trim()
    if (['model', 'modelnumber', 'الموديل', 'رقمالموديل'].includes(fieldName(label)) && !model) model = value
    const item = { ...row, displayLabel: label, value }
    if (includedNames.has(fieldName(label)) || includedNames.has(fieldName(name))) { included.push(item); continue }
    const key = fieldName(name)
    if (!byName.has(key)) { const group = { name, items: [] }; byName.set(key, group); groups.push(group) }
    byName.get(key).items.push(item)
  }
  return { groups, included, model }
}
