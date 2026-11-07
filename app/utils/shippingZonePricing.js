// Governorate delivery pricing for a shipping company. The database computes the
// charged fee (private.checkout_zone_fee); this mirror only previews it in the Dashboard.
export const PRICING_ZONES = ['1', '2', '3', '4', '5', '6']
const amount = /^[0-9]{1,5}(\.[0-9]{1,2})?$/

export const emptyZonePricing = () => ({ version: '1', vat_percent: '14', round_to: '5', support: '0', zones: Object.fromEntries(PRICING_ZONES.map(zone => [zone, ''])), governorates: {} })

export const editableZonePricing = value => {
  const base = emptyZonePricing()
  if (!value || typeof value !== 'object') return base
  return { ...base, vat_percent: String(value.vat_percent ?? base.vat_percent), round_to: String(value.round_to ?? base.round_to), support: String(value.support ?? base.support),
    zones: { ...base.zones, ...Object.fromEntries(Object.entries(value.zones || {}).map(([zone, rate]) => [zone, String(rate)])) }, governorates: { ...(value.governorates || {}) } }
}

// Only zones that have a rate and governorates that are offered are saved.
export const savedZonePricing = (value, governorates) => {
  const zones = Object.fromEntries(Object.entries(value.zones).filter(([, rate]) => String(rate).trim() !== '').map(([zone, rate]) => [zone, String(rate).trim()]))
  const areas = Object.fromEntries(governorates.filter(area => zones[value.governorates[area]]).map(area => [area, value.governorates[area]]))
  return { version: '1', vat_percent: String(value.vat_percent).trim(), round_to: String(value.round_to).trim(), support: String(value.support).trim(), zones, governorates: areas }
}

export const zonePricingErrors = (value, governorates) => {
  const errors = []
  if (!/^[0-9]{1,2}(\.[0-9]{1,2})?$/.test(String(value.vat_percent).trim())) errors.push('vat')
  if (!/^[1-9][0-9]{0,2}$/.test(String(value.round_to).trim()) || Number(value.round_to) > 100) errors.push('round')
  if (!amount.test(String(value.support).trim())) errors.push('support')
  if (Object.values(value.zones).some(rate => String(rate).trim() !== '' && !amount.test(String(rate).trim()))) errors.push('rates')
  if (governorates.some(area => !String(value.zones[value.governorates[area]] ?? '').trim())) errors.push('zones')
  return errors
}

export const courierCost = (value, zone) => {
  const rate = Number(value.zones?.[zone])
  return Number.isFinite(rate) && String(value.zones?.[zone] ?? '').trim() !== '' ? rate * (1 + Number(value.vat_percent) / 100) : null
}

export const customerFee = (value, zone) => {
  const cost = courierCost(value, zone), step = Number(value.round_to), support = Number(value.support)
  if (cost === null || !(step > 0) || !Number.isFinite(support)) return null
  return Math.max(0, Math.ceil(Math.round(cost * 10000) / 10000 / step) * step - support)
}
