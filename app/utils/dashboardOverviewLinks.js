export const buildDashboardOverviewLinks = (activeKey = 'summary') => {
  return [
    {
      key: 'summary',
      label: 'Summary',
      to: '/dashboard',
      active: activeKey === 'summary'
    },
    {
      key: 'analysis',
      label: 'Analysis',
      to: '/dashboard?view=analysis',
      active: activeKey === 'analysis'
    },
    {
      key: 'orders',
      label: 'Orders',
      to: '/dashboard/orders',
      active: activeKey === 'orders'
    }
  ]
}
