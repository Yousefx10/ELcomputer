export const buildDashboardOverviewLinks = (activeKey = 'summary', options = {}) => {
  const {
    canSeeAnalysis = true,
    canSeeOrders = true
  } = options

  const links = [
    {
      key: 'summary',
      label: 'Summary',
      to: '/dashboard',
      active: activeKey === 'summary'
    }
  ]

  if (canSeeAnalysis) {
    links.push({
      key: 'analysis',
      label: 'Analysis',
      to: '/dashboard?view=analysis',
      active: activeKey === 'analysis'
    })
  }

  if (canSeeOrders) {
    links.push({
      key: 'orders',
      label: 'Orders',
      to: '/dashboard/orders',
      active: activeKey === 'orders'
    })
  }

  return links
}
