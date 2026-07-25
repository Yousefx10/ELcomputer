import {
  buildDashboardNavigation,
  matchesDashboardNavigation
} from '~/utils/dashboardNavigation'

export const useDashboardNavigation = () => {
  const route = useRoute()
  const {
    hasAnyPermission,
    hasPermission
  } = useAdminAccess()

  const navigationGroups = computed(() => {
    return buildDashboardNavigation({
      hasAnyPermission,
      hasPermission
    })
  })

  const activeGroup = computed(() => {
    return navigationGroups.value.find((group) => {
      return matchesDashboardNavigation(route, group.match)
    }) || null
  })

  const activeItem = computed(() => {
    const group = activeGroup.value

    if (!group) {
      return null
    }

    return group.children.find((item) => {
      return matchesDashboardNavigation(route, item.match)
    }) || group.children[0] || group
  })

  const secondaryItems = computed(() => {
    return (activeGroup.value?.children || []).map((item) => ({
      ...item,
      active: activeItem.value?.key === item.key
    }))
  })

  const documentTitle = computed(() => {
    if (route.path.startsWith('/dashboard/products/edit/')) {
      return 'Dashboard - Edit Product'
    }

    return activeItem.value?.documentTitle
      || activeGroup.value?.documentTitle
      || 'Dashboard'
  })

  return {
    activeGroup,
    activeItem,
    documentTitle,
    navigationGroups,
    secondaryItems
  }
}
