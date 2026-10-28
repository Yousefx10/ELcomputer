import { createError } from 'h3'
import { egyptGovernorates } from '../../app/utils/egyptGovernorates.js'
import { hasDeliveryTestMarker } from '../../app/utils/checkoutAddress.js'

export const deliveryAddressFields = ['label', 'first_name', 'last_name', 'street_address', 'address_line_2', 'city', 'governorate', 'phone']
export const deliveryAddressProjection = ['id', ...deliveryAddressFields, 'revision', 'created_at', 'updated_at'].join(', ')
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const invalid = message => { throw createError({ statusCode: 400, statusMessage: message }) }
export const savedAddressId = id => {
  if (!uuid.test(id || '')) invalid('Invalid saved address.')
  return id
}
export const savedAddressRevision = revision => {
  if (!Number.isInteger(revision) || revision < 1 || revision > 2147483647) invalid('Reload the saved address before saving.')
  return revision
}
export const addressCommand = (body, keys) => {
  if (!body || Array.isArray(body) || typeof body !== 'object' || Object.keys(body).some(key => !keys.includes(key))) invalid('Invalid saved address.')
  return body
}
export const normalizeSavedAddress = value => {
  addressCommand(value, deliveryAddressFields)
  const address = {}
  for (const field of deliveryAddressFields) {
    if (value[field] != null && typeof value[field] !== 'string') invalid('Invalid saved address.')
    address[field] = (value[field] || '').trim()
    const limit = field === 'label' ? 60 : ['street_address', 'address_line_2'].includes(field) ? 200 : 100
    if (address[field].length > limit || /[\u0000-\u001f\u007f]/.test(address[field])) invalid('Check the saved address fields.')
  }
  if (!address.first_name) invalid('First name is required.')
  if (!address.street_address) invalid('Street address is required.')
  if (!address.city) invalid('City is required.')
  if (!egyptGovernorates.includes(address.governorate)) invalid('Choose a governorate.')
  if (!/^01[0-9]{9}$/.test(address.phone)) invalid('Phone number must start with 01 and contain 11 digits.')
  if (hasDeliveryTestMarker(address)) invalid('Enter a delivery address without test markers.')
  return address
}
export const throwSavedAddressError = error => {
  const code = error?.code
  if (['40001', '23505'].includes(code)) throw createError({ statusCode: 409, statusMessage: 'Saved address changed. Reload it before saving.' })
  if (code === 'P0002') throw createError({ statusCode: 404, statusMessage: 'Saved address unavailable.' })
  if (code === '54000') throw createError({ statusCode: 409, statusMessage: 'You can save up to 20 addresses.' })
  if (code === '42501') throw createError({ statusCode: 403, statusMessage: 'A current customer account is required.' })
  if (['22023', '23514', '23502'].includes(code)) invalid('Check the saved address fields.')
  // Never include database messages, failing rows, addresses or phone numbers.
  console.error('Saved address request failed', { code: String(code || 'unknown').slice(0, 12) })
  throw createError({ statusCode: 503, statusMessage: 'Could not load or save addresses. Please try again.' })
}
