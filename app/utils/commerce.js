export const commerceTabs = [
  {
    key: 'procurement',
    label: 'Procurement',
    to: '/dashboard/commerce'
  },
  {
    key: 'sales',
    label: 'Sales',
    to: '/dashboard/commerce?tab=sales'
  },
  {
    key: 'shipping',
    label: 'Shipping',
    to: '/dashboard/commerce?tab=shipping'
  },
  {
    key: 'warehouses',
    label: 'Warehouses',
    to: '/dashboard/commerce?tab=warehouses'
  },
  {
    key: 'returns',
    label: 'Returns',
    to: '/dashboard/commerce?tab=returns'
  }
]

export const formatCommerceCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 2
  }).format(Number(value || 0))
}

export const formatCommerceDate = (value) => {
  if (!value) {
    return 'Recently'
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

export const buildCommerceReference = (prefix = 'REF') => {
  const now = new Date()
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ]

  return `${String(prefix || 'REF').trim().toUpperCase()}-${parts.join('')}`
}

export const createEmptyProcurementItem = () => ({
  product_id: '',
  quantity: 1,
  unit_cost: ''
})

export const createEmptyTransferItem = () => ({
  product_id: '',
  quantity: 1
})
