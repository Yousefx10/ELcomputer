export const mapCustomerProfileRecord = (record) => {
  if (!record) {
    return null
  }

  return {
    id: record.id,
    email: record.email || '',
    full_name: record.full_name || '',
    avatar_url: record.avatar_url || '',
    phone: record.phone || '',
    address_line_1: record.address_line_1 || '',
    address_line_2: record.address_line_2 || '',
    city: record.city || '',
    state: record.state || '',
    country: record.country || '',
    is_active: record.is_active ?? true,
    wallet_balance: Number(record.wallet_balance || 0),
    created_at: record.created_at || '',
    updated_at: record.updated_at || ''
  }
}
