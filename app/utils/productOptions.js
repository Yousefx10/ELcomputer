const forbidden = new Set(['__proto__', 'prototype', 'constructor'])
const control = /[\u0000-\u001f\u007f]/
export const optionDimensionKeys = ['color', 'model', 'switch', 'capacity', 'size', 'version']

// Authored purchase attributes only. Specification text never creates a SKU.
export function validOptionValues(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const entries = Object.entries(value)
  return entries.length <= 8 && entries.every(([key, item]) =>
    key.length > 0 && key.length <= 60 && key === key.trim() && !forbidden.has(key.toLowerCase()) && !control.test(key)
    && typeof item === 'string' && item.length > 0 && item.length <= 120 && item === item.trim() && !control.test(item))
}

export function configuredVariantDimensions(variants = []) {
  if (!variants.length || variants.some(row => !validOptionValues(row.option_values))) return []
  const keys = Object.keys(variants[0].option_values).sort()
  if (!keys.length || variants.some(row => JSON.stringify(Object.keys(row.option_values).sort()) !== JSON.stringify(keys))) return []
  keys.sort((a, b) => {
    const rank = key => optionDimensionKeys.includes(key) ? optionDimensionKeys.indexOf(key) : optionDimensionKeys.length
    return rank(a) - rank(b) || a.localeCompare(b)
  })
  return keys.map(key => ({ key, values: [...new Set(variants.map(row => row.option_values[key]))] }))
}

export function resolveVariantCombination(variants, dimensions, selection) {
  if (!dimensions.length || dimensions.some(({ key }) => !selection[key])) return null
  const matches = variants.filter(row => row.is_active !== false
    && dimensions.every(({ key }) => row.option_values?.[key] === selection[key]))
  return matches.length === 1 ? matches[0] : null
}

export const variantIsAvailable = (variant, { allowBackorder = false, preorder = false, stockIndependent = false } = {}) =>
  variant?.is_active !== false && (allowBackorder || preorder || stockIndependent || Number(variant?.stock_quantity) > 0)

export function optionChoiceAvailable(variants, selection, key, value, policy) {
  return variants.some(row => row.option_values?.[key] === value && variantIsAvailable(row, policy)
    && Object.entries(selection).every(([other, selected]) => other === key || !selected || row.option_values?.[other] === selected))
}

export function variantSalePrice(product, variant) {
  const override = variant?.sale_price
  const price = override === null || override === undefined || override === '' ? product?.price : override
  return Number.isFinite(Number(price)) && Number(price) >= 0 ? Number(price) : Number(product?.price || 0)
}

export function productOptionPriceRange(product, variants = []) {
  const prices = variants.filter(row => row.is_active !== false).map(row => variantSalePrice(product, row))
  if (!prices.length) prices.push(variantSalePrice(product, null))
  return { minimum: Math.min(...prices), maximum: Math.max(...prices) }
}

export function variantOptionSummary(options) {
  return validOptionValues(options) ? Object.values(options).join(' · ') : ''
}
