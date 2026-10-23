// Tariff documents are configuration. This module never quotes checkout prices.
export const TARIFF_FORMAT = 'shipping-tariff/v1'
export const tariffRounding = ['unverified', 'ceil_kg', 'pro_rata']
export const tariffVatScopes = ['unverified', 'freight_only', 'freight_and_fees']
export class TariffError extends Error {
  constructor(field) { super('Invalid tariff.'); this.field = field }
}
const invalid = field => { throw new TariffError(field) }
const object = (value, keys, field) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) invalid(field)
}
const text = (value, max, field) => {
  if (typeof value !== 'string' || value.length > max || /[\x00-\x1f\x7f<>]/.test(value)) invalid(field)
  return value.trim()
}
const bool = (value, field) => { if (typeof value !== 'boolean') invalid(field); return value }
const integer = (value, max, field, min = 1) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) invalid(field)
  return value
}
const decimal = (value, places, maximum, field) => {
  if (typeof value !== 'string' || !new RegExp(`^(0|[1-9]\\d{0,9})(\\.\\d{1,${places}})?$`).test(value)) invalid(field)
  const [whole, fraction = ''] = value.split('.')
  const units = BigInt(whole) * 10n ** BigInt(places) + BigInt(fraction.padEnd(places, '0'))
  if (units > maximum) invalid(field)
  return whole + '.' + fraction.padEnd(places, '0')
}
const money = (value, field) => decimal(value, 2, 999999999999n, field)
const percent = (value, field) => decimal(value, 2, 10000n, field)
const date = (value, field) => {
  if (value === null) return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) invalid(field)
  return value
}
const array = (value, max, field) => { if (!Array.isArray(value) || value.length > max) invalid(field); return value }
const oneOf = (value, values, field) => { if (!values.includes(value)) invalid(field); return value }
const keys = ['format', 'provider', 'currency', 'title', 'source_note', 'product_id', 'product_confirmed', 'validity_confirmed', 'effective_from', 'effective_until', 'base_weight_kg', 'volumetric_divisor', 'extra_weight_rounding', 'vat_percent', 'vat_scope', 'cod_percent', 'cod_basis', 'insurance_percent', 'insurance_enabled', 'failed_delivery_percent', 'failed_delivery_basis', 'invoice_days', 'annual_review_month_day', 'automatic_annual_increase', 'surcharges_confirmed', 'zones', 'surcharges', 'mappings']

export const emptyTariff = () => ({
  format: TARIFF_FORMAT, provider: 'pdc', currency: 'EGP', title: '', source_note: '',
  product_id: null, product_confirmed: false, validity_confirmed: false,
  effective_from: null, effective_until: null, base_weight_kg: '', volumetric_divisor: null,
  extra_weight_rounding: 'unverified', vat_percent: '', vat_scope: 'unverified',
  cod_percent: '', cod_basis: 'unverified', insurance_percent: '', insurance_enabled: false,
  failed_delivery_percent: '', failed_delivery_basis: 'unverified', invoice_days: 0, annual_review_month_day: null,
  automatic_annual_increase: false, surcharges_confirmed: false,
  zones: Array.from({ length: 6 }, (_, i) => ({ id: i + 1, label: '', base_price: '', additional_kg_price: '' })),
  surcharges: [], mappings: []
})

export const normalizeTariff = input => {
  object(input, keys, 'document')
  if (JSON.stringify(input).length > 1500000) invalid('document')
  const d = {
    format: oneOf(input.format, [TARIFF_FORMAT], 'format'), provider: oneOf(input.provider, ['pdc'], 'provider'),
    currency: oneOf(input.currency, ['EGP'], 'currency'), title: text(input.title, 120, 'title'),
    source_note: text(input.source_note, 2000, 'source_note'),
    product_id: input.product_id === null ? null : integer(input.product_id, 2147483647, 'product_id'),
    product_confirmed: bool(input.product_confirmed, 'product_confirmed'), validity_confirmed: bool(input.validity_confirmed, 'validity_confirmed'),
    effective_from: date(input.effective_from, 'effective_from'), effective_until: date(input.effective_until, 'effective_until'),
    base_weight_kg: decimal(input.base_weight_kg, 3, 99999999n, 'base_weight_kg'),
    volumetric_divisor: integer(input.volumetric_divisor, 1000000, 'volumetric_divisor'),
    extra_weight_rounding: oneOf(input.extra_weight_rounding, tariffRounding, 'extra_weight_rounding'),
    vat_percent: percent(input.vat_percent, 'vat_percent'), vat_scope: oneOf(input.vat_scope, tariffVatScopes, 'vat_scope'),
    cod_percent: percent(input.cod_percent, 'cod_percent'), insurance_percent: percent(input.insurance_percent, 'insurance_percent'),
    cod_basis: oneOf(input.cod_basis, ['unverified', 'collected_amount', 'declared_value'], 'cod_basis'),
    insurance_enabled: bool(input.insurance_enabled, 'insurance_enabled'), failed_delivery_percent: percent(input.failed_delivery_percent, 'failed_delivery_percent'),
    failed_delivery_basis: oneOf(input.failed_delivery_basis, ['unverified', 'freight_ex_vat', 'freight_inc_vat'], 'failed_delivery_basis'),
    invoice_days: integer(input.invoice_days, 365, 'invoice_days', 0),
    annual_review_month_day: input.annual_review_month_day === null ? null : text(input.annual_review_month_day, 5, 'annual_review_month_day'),
    automatic_annual_increase: oneOf(input.automatic_annual_increase, [false], 'automatic_annual_increase'),
    surcharges_confirmed: bool(input.surcharges_confirmed, 'surcharges_confirmed')
  }
  if (!d.title || d.base_weight_kg === '0.000' || d.effective_from && d.effective_until && d.effective_until < d.effective_from) invalid('document')
  if (d.annual_review_month_day !== null && (!/^\d{2}-\d{2}$/.test(d.annual_review_month_day) || date('2000-' + d.annual_review_month_day, 'annual_review_month_day') === null)) invalid('annual_review_month_day')
  d.zones = array(input.zones, 6, 'zones').map(z => {
    object(z, ['id', 'label', 'base_price', 'additional_kg_price'], 'zones')
    return { id: integer(z.id, 6, 'zone.id'), label: text(z.label, 120, 'zone.label'), base_price: money(z.base_price, 'zone.base_price'), additional_kg_price: money(z.additional_kg_price, 'zone.additional_kg_price') }
  }).sort((a, b) => a.id - b.id)
  if (d.zones.length !== 6 || new Set(d.zones.map(z => z.id)).size !== 6) invalid('zones')
  d.surcharges = array(input.surcharges, 50, 'surcharges').map(s => {
    object(s, ['id', 'label', 'kind', 'value', 'basis', 'zone_ids', 'vat_applicable'], 'surcharges')
    const kind = oneOf(s.kind, ['fixed', 'percent'], 'surcharge.kind')
    const ids = array(s.zone_ids, 6, 'surcharge.zone_ids').map(id => integer(id, 6, 'surcharge.zone_ids')).sort()
    if (new Set(ids).size !== ids.length) invalid('surcharge.zone_ids')
    const id = text(s.id, 60, 'surcharge.id'), label = text(s.label, 120, 'surcharge.label')
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || !label) invalid('surcharges')
    return { id, label, kind, value: kind === 'fixed' ? money(s.value, 'surcharge.value') : percent(s.value, 'surcharge.value'), basis: oneOf(s.basis, ['freight', 'declared_value', 'cod'], 'surcharge.basis'), zone_ids: ids, vat_applicable: bool(s.vat_applicable, 'surcharge.vat_applicable') }
  }).sort((a, b) => a.id.localeCompare(b.id, 'en'))
  if (new Set(d.surcharges.map(s => s.id)).size !== d.surcharges.length) invalid('surcharges')
  d.mappings = array(input.mappings, 5000, 'mappings').map(m => {
    object(m, ['provider_city_id', 'governorate', 'city', 'city_arabic', 'candidate_zone_ids', 'zone_id', 'review_state'], 'mappings')
    const candidates = array(m.candidate_zone_ids, 6, 'mapping.candidates').map(id => integer(id, 6, 'mapping.candidates')).sort()
    if (new Set(candidates).size !== candidates.length) invalid('mapping.candidates')
    return { provider_city_id: integer(m.provider_city_id, 2147483647, 'mapping.city_id'), governorate: text(m.governorate, 200, 'mapping.governorate'), city: text(m.city, 200, 'mapping.city'), city_arabic: m.city_arabic === null ? null : text(m.city_arabic, 200, 'mapping.city_arabic'), candidate_zone_ids: candidates, zone_id: m.zone_id === null ? null : integer(m.zone_id, 6, 'mapping.zone_id'), review_state: oneOf(m.review_state, ['unverified', 'confirmed', 'excluded'], 'mapping.review_state') }
  }).sort((a, b) => a.provider_city_id - b.provider_city_id)
  if (new Set(d.mappings.map(m => m.provider_city_id)).size !== d.mappings.length) invalid('mapping.duplicate_city_id')
  return d
}

export const tariffReadiness = (document, { aliases = [], cities = [], products = [] } = {}) => {
  const d = normalizeTariff(document), issues = []
  if (!d.product_id || !d.product_confirmed) issues.push('product_unverified')
  if (!products.some(p => p.id === d.product_id)) issues.push('product_not_cached')
  if (!d.validity_confirmed) issues.push('validity_unverified')
  if (!d.effective_from) issues.push('effective_date_missing')
  if (d.extra_weight_rounding === 'unverified') issues.push('weight_rounding_unverified')
  if (d.vat_scope === 'unverified') issues.push('vat_scope_unverified')
  if (d.cod_basis === 'unverified' || d.failed_delivery_basis === 'unverified') issues.push('fee_basis_unverified')
  if (!d.surcharges_confirmed) issues.push('surcharges_unverified')
  const counts = { confirmed: 0, unverified: 0, excluded: 0, unmatched: 0, uncached: 0 }
  for (const m of d.mappings) {
    counts[m.review_state]++
    if (m.review_state === 'excluded') continue
    if (m.zone_id === null) issues.push('zone_missing')
    const matches = aliases.filter(a => a.provider_city_id === m.provider_city_id && a.governorate === m.governorate && a.city === m.city && (a.city_arabic || null) === m.city_arabic)
    const folded = value => String(value || '').trim().toLowerCase()
    const destinations = aliases.filter(a => folded(a.governorate) === folded(m.governorate) && (folded(a.city) === folded(m.city) || m.city_arabic && folded(a.city_arabic) === folded(m.city_arabic)))
    if (matches.length !== 1 || destinations.length !== 1) counts.unmatched++
    if (!cities.some(c => c.id === m.provider_city_id)) counts.uncached++
  }
  if (!counts.confirmed) issues.push('no_confirmed_areas')
  if (counts.unverified) issues.push('mappings_unverified')
  if (counts.unmatched) issues.push('mappings_not_matched')
  if (counts.uncached) issues.push('cities_not_cached')
  return { can_verify: issues.length === 0, checkout_eligible: false, issues: [...new Set(issues)], counts }
}

// Preserve every omitted/cleared/null difference. Imports never merge fields.
export const tariffDiff = (before, after) => {
  const result = [], walk = (a, b, path) => {
    if (JSON.stringify(a) === JSON.stringify(b)) return
    if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[key], b[key], path ? path + '.' + key : key)
    } else result.push({ field: path, before: a ?? null, after: b ?? null })
  }
  walk(before, after, '')
  return result
}
