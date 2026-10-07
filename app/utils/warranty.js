// Structured catalog terms and immutable purchased terms share one vocabulary.
// This is an input bound, not a warranty-start or customer eligibility policy.
export const MAX_WARRANTY_MONTHS = 120
export const warrantyFields = ['warranty_status', 'warranty_duration_value', 'warranty_duration_unit']

export const defaultWarrantyConfig = () => ({
  warranty_status: 'unknown', warranty_duration_value: null, warranty_duration_unit: null
})

export const warrantyInputErrors = {
  invalidStatus: 'Choose a valid warranty option.',
  invalidDuration: 'Enter 1-120 whole months or 1-10 whole years.',
  invalidUnit: 'Choose months or years for warranty.',
  unexpectedDuration: 'Only included warranty can have a duration.'
}

const invalid = key => {
  const error = new Error(warrantyInputErrors[key])
  error.warrantyErrorKey = key
  throw error
}
const empty = value => value === null || value === undefined || value === ''

export const normalizeProductWarranty = (input = {}, { previous } = {}) => {
  // Older callers that omit the whole group must not erase existing terms.
  const values = warrantyFields.some(key => Object.hasOwn(input, key)) ? input : previous || defaultWarrantyConfig()
  const status = Object.hasOwn(values, 'warranty_status') ? values.warranty_status : 'unknown'
  if (!['unknown', 'none', 'included'].includes(status)) invalid('invalidStatus')
  const value = values.warranty_duration_value
  const unit = values.warranty_duration_unit
  if (status !== 'included') {
    if (!empty(value) || !empty(unit)) invalid('unexpectedDuration')
    return { warranty_status: status, warranty_duration_value: null, warranty_duration_unit: null }
  }
  if (!['months', 'years'].includes(unit)) invalid('invalidUnit')
  // Avoid coercing booleans, arrays, fractions, exponent notation or blank text.
  if (!(typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value)))) invalid('invalidDuration')
  const duration = Number(value)
  if (!Number.isSafeInteger(duration) || duration < 1 || duration * (unit === 'years' ? 12 : 1) > MAX_WARRANTY_MONTHS) invalid('invalidDuration')
  return { warranty_status: status, warranty_duration_value: duration, warranty_duration_unit: unit }
}

export const readWarrantyConfig = product => Object.fromEntries(warrantyFields.map(key => [key, product?.[key] ?? defaultWarrantyConfig()[key]]))

// Read order-item snapshots ONLY. Never fall back to a product/specification,
// infer a start from placement/payment/tracking, or equate unknown with none.
export const warrantyEntitlement = (item = {}) => {
  const unknown = { hasWarranty: null, duration: null, startBasis: null, startDate: null, expiryDate: null, status: 'unknown', information: 'unavailable' }
  if (!item.warranty_snapshot_at || !Number.isFinite(Date.parse(item.warranty_snapshot_at))) return unknown
  try {
    const terms = normalizeProductWarranty(item)
    if (terms.warranty_status === 'unknown') return unknown
    if (terms.warranty_status === 'none') return { ...unknown, hasWarranty: false, status: 'not_applicable', information: 'none' }
    // Duration remains this immutable foundation snapshot. The account API
    // supplies policy-derived dates separately from the purchased version.
    if (item.warranty_start_basis !== 'unresolved') return unknown
    return {
      ...unknown, hasWarranty: true, information: 'included', startBasis: 'unresolved',
      duration: { value: terms.warranty_duration_value, unit: terms.warranty_duration_unit }
    }
  } catch { return unknown }
}

export const warrantyDurationKey = duration => duration?.unit === 'years'
  ? (duration.value === 1 ? 'warranty.oneYear' : 'warranty.years')
  : (duration?.value === 1 ? 'warranty.oneMonth' : 'warranty.months')
