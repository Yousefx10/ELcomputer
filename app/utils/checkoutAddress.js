const text = value => String(value || '').trim()

export const checkoutAddressFromProfile = (profile, email = '') => {
  const names = text(profile?.full_name).split(/\s+/).filter(Boolean)
  return {
    first_name: names[0] || '', last_name: names.slice(1).join(' '),
    street_address: text(profile?.address_line_1), address_line_2: text(profile?.address_line_2),
    city: text(profile?.city), governorate: text(profile?.state),
    phone: text(profile?.phone), email: text(profile?.email || email)
  }
}

export const checkoutStreetAddress = address => [text(address?.street_address), text(address?.address_line_2)].filter(Boolean).join(', ')

// Retain separate profile lines. Older retained clients omit line 2; their
// checkout must not clear the saved value. New clients can explicitly clear it.
export const checkoutProfileAddress = address => ({
  address_line_1: text(address?.street_address),
  ...(Object.hasOwn(address || {}, 'address_line_2') ? { address_line_2: text(address.address_line_2) || null } : {})
})
