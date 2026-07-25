import { dashboardNavigationGroups } from '~/utils/dashboardNavigation'

export const commerceTabs = (
  dashboardNavigationGroups.find((group) => group.key === 'commerce')?.children
  || []
).map((item) => ({
  key: item.key,
  label: item.label,
  to: item.to
}))

export const serializedItemStatusOptions = [
  { value: 'in_stock', label: 'In Stock' },
  { value: 'sold', label: 'Sold' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'lost', label: 'Lost' }
]

export const formatSerializedItemStatus = (value) => {
  const normalizedValue = String(value || '').trim().toLowerCase()
  const matchingOption = serializedItemStatusOptions.find((option) => {
    return option.value === normalizedValue
  })

  if (matchingOption) {
    return matchingOption.label
  }

  if (!normalizedValue) {
    return 'Unknown'
  }

  return normalizedValue
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

export const getSerializedItemStatusClass = (value) => {
  const normalizedValue = String(value || '').trim().toLowerCase()

  if (normalizedValue === 'in_stock') {
    return 'bg-green-100 text-green-700'
  }

  if (normalizedValue === 'sold') {
    return 'bg-blue-100 text-blue-700'
  }

  if (normalizedValue === 'damaged') {
    return 'bg-amber-100 text-amber-800'
  }

  if (normalizedValue === 'lost') {
    return 'bg-red-100 text-red-700'
  }

  return 'bg-gray-100 text-gray-600'
}

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
  variant_id: '',
  quantity: '',
  unit_cost: ''
})

export const createEmptyTransferItem = () => ({
  product_id: '',
  quantity: 1
})
