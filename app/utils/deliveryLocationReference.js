import reference from './egyptDeliveryLocations.js'

// Reviewed offline names only. These codes are application identities.
export const deliveryLocationReference = reference
export const locationSearchKey = value => String(value || '').normalize('NFKC')
  .replace(/[\u064B-\u065F\u0670\u0640]/g, '').trim().toLocaleLowerCase()
const matches = (value, names) => names.some(name => locationSearchKey(name) === locationSearchKey(value))
export const findDeliveryLocation = (governorate, city) => {
  const parents = reference.governorates.filter(row => matches(governorate, [row.checkout_name, row.name_en, row.name_ar, ...row.aliases]))
  if (parents.length !== 1 || !String(city || '').trim()) return null
  const parent = parents[0]
  const cities = reference.cities.filter(row => row.governorate_id === parent.id && matches(city, [row.name_en, row.name_ar].filter(Boolean)))
  return cities.length === 1 ? { governorate: parent, city: cities[0] } : null
}
