export const customerAcceptanceResolvedStatuses = [
  'completed',
  'delivered',
  'cancelled',
  'refunded'
]

export const customerAcceptanceAcceptedStatuses = [
  'completed',
  'delivered'
]

const resolvedStatusSet = new Set(customerAcceptanceResolvedStatuses)
const acceptedStatusSet = new Set(customerAcceptanceAcceptedStatuses)

export const calculateCustomerAcceptance = (orders = []) => {
  let acceptedOrders = 0
  let resolvedOrders = 0

  if (Array.isArray(orders)) {
    orders.forEach((order) => {
      const status = typeof order === 'string'
        ? order
        : order?.status

      if (!resolvedStatusSet.has(status)) {
        return
      }

      resolvedOrders += 1

      if (acceptedStatusSet.has(status)) {
        acceptedOrders += 1
      }
    })
  }

  if (!resolvedOrders) {
    return {
      key: 'new',
      label: 'New Customer',
      acceptanceRate: null,
      acceptedOrders: 0,
      resolvedOrders: 0
    }
  }

  const acceptanceRate = Math.round(((acceptedOrders / resolvedOrders) * 100) * 10) / 10

  if (acceptanceRate >= 80) {
    return {
      key: 'high',
      label: 'High Acceptance Rate',
      acceptanceRate,
      acceptedOrders,
      resolvedOrders
    }
  }

  if (acceptanceRate >= 50) {
    return {
      key: 'average',
      label: 'Average Acceptance Rate',
      acceptanceRate,
      acceptedOrders,
      resolvedOrders
    }
  }

  return {
    key: 'low',
    label: 'Low Acceptance Rate',
    acceptanceRate,
    acceptedOrders,
    resolvedOrders
  }
}

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
