import { activeCustomerOrderStatuses, customerOrderStatusOptions, finalizedCustomerOrderStatuses } from '~/utils/orderStatus'

export const allowedAdminOrderStatuses = [
  ...customerOrderStatusOptions.map((option) => option.value),
  'in_progress',
  'delivered'
]

export const normalizeAdminOrderRecord = (record) => {
  if (!record) {
    return null
  }

  return {
    ...record,
    subtotal_amount: Number(record.subtotal_amount || 0),
    discount_amount: Number(record.discount_amount || 0),
    total_amount: Number(record.total_amount || 0)
  }
}

export const normalizeAdminOrderItemRecord = (record) => {
  if (!record) {
    return null
  }

  return {
    ...record,
    unit_price: Number(record.unit_price || 0),
    line_total: Number(record.line_total || 0)
  }
}

export const normalizeOrderSearchTerm = (value = '') => {
  return String(value || '')
    .trim()
    .replace(/[%_,]/g, ' ')
    .replace(/\s+/g, ' ')
}

export const buildDateRangeFilter = ({ from, to }) => {
  const result = {}

  if (from) {
    const fromDate = new Date(`${from}T00:00:00`)

    if (!Number.isNaN(fromDate.getTime())) {
      result.from = fromDate.toISOString()
    }
  }

  if (to) {
    const toDate = new Date(`${to}T23:59:59.999`)

    if (!Number.isNaN(toDate.getTime())) {
      result.to = toDate.toISOString()
    }
  }

  return result
}

export const getOrderStatsDateBoundaries = () => {
  const now = new Date()
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)

  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(now.getDate() - 6)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(now.getDate() - 29)
  thirtyDaysAgo.setHours(0, 0, 0, 0)

  return {
    startOfToday: startOfToday.toISOString(),
    sevenDaysAgo: sevenDaysAgo.toISOString(),
    thirtyDaysAgo: thirtyDaysAgo.toISOString()
  }
}

export const completedOrderStatuses = ['completed', 'delivered']
export const openOrderStatuses = activeCustomerOrderStatuses.filter((status) => !finalizedCustomerOrderStatuses.includes(status))
