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
