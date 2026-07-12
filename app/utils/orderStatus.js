export const customerOrderStatusOptions = [
  { value: 'pending_payment', label: 'Pending Payment' },
  { value: 'processing', label: 'Processing' },
  { value: 'being_shipped', label: 'Being Shipped' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'cancelled', label: 'Cancelled' }
]

export const customerOrderStatusLabelMap = {
  pending_payment: 'Pending Payment',
  processing: 'Processing',
  being_shipped: 'Being Shipped',
  out_for_delivery: 'Out for Delivery',
  on_hold: 'On Hold',
  completed: 'Completed',
  refunded: 'Refunded',
  cancelled: 'Cancelled',
  in_progress: 'In Progress',
  delivered: 'Delivered'
}

export const finalizedCustomerOrderStatuses = ['completed', 'delivered', 'cancelled', 'refunded']
export const completedOrderStatuses = ['completed', 'delivered']
export const activeCustomerOrderStatuses = [
  'pending_payment',
  'processing',
  'being_shipped',
  'out_for_delivery',
  'on_hold',
  'in_progress'
]
export const openOrderStatuses = [...activeCustomerOrderStatuses]

export const formatCustomerOrderStatus = (value) => {
  if (!value) {
    return 'Unknown'
  }

  return customerOrderStatusLabelMap[value]
    || String(value).replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

export const getCustomerOrderStatusClass = (value) => {
  if (value === 'completed' || value === 'delivered') {
    return 'bg-green-100 text-green-700'
  }

  if (value === 'pending_payment') {
    return 'bg-amber-100 text-amber-700'
  }

  if (value === 'processing' || value === 'in_progress') {
    return 'bg-blue-100 text-blue-700'
  }

  if (value === 'being_shipped' || value === 'out_for_delivery') {
    return 'bg-sky-100 text-sky-700'
  }

  if (value === 'on_hold') {
    return 'bg-yellow-100 text-yellow-700'
  }

  if (value === 'refunded') {
    return 'bg-purple-100 text-purple-700'
  }

  if (value === 'cancelled') {
    return 'bg-red-100 text-red-700'
  }

  return 'bg-gray-100 text-gray-600'
}
