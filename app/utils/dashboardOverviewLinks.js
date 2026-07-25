import { dashboardNavigationGroups } from '~/utils/dashboardNavigation'

export const buildDashboardOverviewLinks = (activeKey = 'summary', options = {}) => {
  const {
    canSeeAnalysis = true,
    canSeeOrders = true
  } = options

  const dashboardItems = dashboardNavigationGroups.find((group) => {
    return group.key === 'dashboard'
  })?.children || []

  return dashboardItems
    .filter((item) => {
      if (item.key === 'analysis') {
        return canSeeAnalysis
      }

      if (item.key === 'orders') {
        return canSeeOrders
      }

      return true
    })
    .map((item) => ({
      key: item.key,
      label: item.label,
      to: item.to,
      active: activeKey === item.key
    }))
}
