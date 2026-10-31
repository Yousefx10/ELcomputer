// Existing storefront query rules, shared with read-only legacy URL validation.
export const catalogPageSize = 12
export const normalizeSearchTerm = (value = '') => String(value).trim().replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ')
export const normalizePositiveNumber = (value, fallback = 0) => Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : fallback
export const getMinimumPriceGap = bounds => Number(bounds.max) <= Number(bounds.min) ? 0 : Number.isInteger(bounds.min) && Number.isInteger(bounds.max) ? 1 : 0.01
export function normalizePriceRange(min, max, bounds) {
  const gap = getMinimumPriceGap(bounds)
  const minimum = Math.max(bounds.min, Math.min(normalizePositiveNumber(min, bounds.min), Math.max(bounds.min, bounds.max - gap)))
  return { minPrice: minimum, maxPrice: Math.min(bounds.max, Math.max(normalizePositiveNumber(max, bounds.max), minimum + gap)) }
}
export function catalogPage(value) {
  if (value == null) return 1
  return typeof value === 'string' && /^[1-9]\d{0,5}$/.test(value) ? Number(value) : null
}
export const catalogPageExists = (page, count) => Number.isInteger(page) && page > 0 && page <= Math.max(1, Math.ceil(count / catalogPageSize))
