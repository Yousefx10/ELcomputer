import { validOptionValues, optionDimensionKeys } from './productOptions.js'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const object = value => !!value && typeof value === 'object' && !Array.isArray(value)
const text = (value, optional = false) => typeof value === 'string' && value.length <= 120 && (optional || value.trim().length > 0) && value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value)
export function validProductFamily(family) {
  if (family === null) return true
  if (!object(family) || Object.keys(family).some(k => !['id', 'axes', 'members'].includes(k)) || !uuid.test(family.id || '')) return false
  if (!Array.isArray(family.axes) || family.axes.length < 1 || family.axes.length > 6 || !Array.isArray(family.members) || family.members.length < 2 || family.members.length > 32) return false
  const keys = family.axes.map(axis => axis?.key)
  if (new Set(keys).size !== keys.length || family.axes.some(axis => !object(axis) || Object.keys(axis).some(k => !['key', 'label', 'label_ar'].includes(k)) || !optionDimensionKeys.includes(axis.key) || !text(axis.label) || !text(axis.label_ar, true))) return false
  const combinations = [], ids = []
  for (const row of family.members) {
    if (!object(row) || Object.keys(row).some(k => !['product_id', 'values', 'values_ar', 'color_hex'].includes(k)) || !uuid.test(row.product_id || '') || !validOptionValues(row.values) || Object.keys(row.values).length !== keys.length || keys.some(k => !row.values[k])) return false
    if (!object(row.values_ar) || Object.entries(row.values_ar).some(([k, v]) => !keys.includes(k) || !text(v, true))) return false
    if (row.color_hex != null && !/^#[0-9a-fA-F]{6}$/.test(row.color_hex)) return false
    ids.push(row.product_id); combinations.push(JSON.stringify(keys.map(k => row.values[k].toLowerCase())))
  }
  return new Set(ids).size === ids.length && new Set(combinations).size === combinations.length
}

// Links are complete, real product combinations. Never synthesize a Cartesian SKU.
export function familyChoices(family, currentId, key) {
  if (!family || !Array.isArray(family.members) || !family.axes?.some(axis => axis.key === key)) return []
  const current = family.members.find(row => row.product_id === currentId)
  if (!current) return []
  return family.members.filter(row => family.axes.every(axis => axis.key === key || row.values[axis.key] === current.values[axis.key]))
}
export const familyValue = (row, key, locale) => locale === 'ar' ? row.values_ar?.[key] || row.values[key] : row.values[key]
export const familyMemberLabel = (family, row, locale) => family.axes.map(axis => familyValue(row, axis.key, locale)).join(' · ')
// A named-color preview follows the explicit label; it is not a measured finish.
const namedColors = new Set(['black', 'white', 'gray', 'grey', 'blue', 'beige', 'red', 'green', 'pink', 'silver', 'lightgray', 'lightgrey', 'skyblue', 'navy'])
export function familySwatch(row) {
  if (/^#[0-9a-f]{6}$/i.test(row.color_hex || '')) return row.color_hex
  const name = String(row.values?.color || '').toLowerCase().replaceAll(' ', '')
  return namedColors.has(name) ? name : ''
}

// How a linked choice is shown. Photos help with colors, models and editions;
// switches show their stem color; sizes and capacities read best as text.
const photoAxes = new Set(['color', 'model', 'version'])
export const familyChoiceStyle = key => photoAxes.has(key) ? 'photo' : key === 'switch' ? 'switch' : 'text'

// Common color words in labels, e.g. "Red switch", "Blue/Black" or "أحمر".
// Unknown names return '' and the label stays text. An authored hex wins.
const colorWords = {
  red: '#dc2626', blue: '#2563eb', brown: '#8b5a2b', black: '#18181b', yellow: '#facc15', white: '#f8fafc',
  silver: '#c0c7d1', green: '#16a34a', pink: '#f472b6', purple: '#9333ea', violet: '#8b5cf6', orange: '#f97316',
  gray: '#9ca3af', grey: '#9ca3af', clear: '#e2e8f0', transparent: '#e2e8f0', crystal: '#dbeafe', ivory: '#f4eedc',
  gold: '#d4a017', golden: '#d4a017', cream: '#f1e6cc', jade: '#10a37f', banana: '#fde047', milk: '#f5f5f0',
  navy: '#1e3a8a', cyan: '#06b6d4', teal: '#0d9488', mint: '#86efac', lavender: '#c4b5fd', rose: '#fb7185',
  beige: '#d9c8a5', tan: '#c8a27a', khaki: '#bfae7c', olive: '#6b7f3a', lime: '#84cc16', sky: '#38bdf8',
  graphite: '#3f3f46', titanium: '#8a8d91', bronze: '#a86b32', copper: '#b8733a', champagne: '#e8d3a8',
  'أحمر': '#dc2626', 'حمراء': '#dc2626', 'أزرق': '#2563eb', 'زرقاء': '#2563eb', 'بني': '#8b5a2b', 'أسود': '#18181b',
  'سوداء': '#18181b', 'أصفر': '#facc15', 'صفراء': '#facc15', 'أبيض': '#f8fafc', 'بيضاء': '#f8fafc', 'فضي': '#c0c7d1',
  'أخضر': '#16a34a', 'خضراء': '#16a34a', 'وردي': '#f472b6', 'بنفسجي': '#9333ea', 'برتقالي': '#f97316', 'رمادي': '#9ca3af',
  'ذهبي': '#d4a017', 'شفاف': '#e2e8f0', 'كحلي': '#1e3a8a', 'بيج': '#d9c8a5'
}
export function labelColor(label) {
  for (const word of String(label || '').toLowerCase().split(/[^\p{L}]+/u)) if (colorWords[word]) return colorWords[word]
  return ''
}
export function familyChoiceColor(row, key) {
  if (/^#[0-9a-f]{6}$/i.test(row?.color_hex || '')) return row.color_hex
  return labelColor(row?.values?.[key]) || labelColor(row?.values_ar?.[key])
}
// A light color needs a visible edge on light surfaces.
export const lightColor = hex => {
  const value = /^#([0-9a-f]{6})$/i.exec(hex || '')?.[1]
  if (!value) return false
  const [r, g, b] = [0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 200
}
