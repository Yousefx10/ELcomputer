import { isDaftraErp } from '~/utils/erpState'
import {
  buildDashboardNavigation,
  getDashboardQueryValue,
  matchesDashboardNavigation,
  resolveDashboardActiveItem
} from '~/utils/dashboardNavigation'
import { dashboardSettingsSections } from '~/utils/dashboardSettings'

export const useDashboardNavigation = () => {
  const { uiLabel } = useUiLocale()
  const route = useUiRoute()
  const { data: erpState } = useNuxtData('active-erp')
  const {
    isOwner,
    hasAnyPermission,
    hasPermission
  } = useAdminAccess()

  const navigationGroups = computed(() => {
    const settings = erpState.value || {}
    const externalErpActive = !erpState.value || isDaftraErp(settings)

    return buildDashboardNavigation({
      isOwner: isOwner.value,
      hasAnyPermission,
      hasPermission
    }, {
      externalErpActive
    })
  })

  const activeGroup = computed(() => {
    return navigationGroups.value.find((group) => {
      return matchesDashboardNavigation(route, group.match)
    }) || null
  })

  const activeItem = computed(() => {
    return resolveDashboardActiveItem(route, activeGroup.value)
  })

  const secondaryItems = computed(() => {
    return (activeGroup.value?.children || []).map((item) => ({
      ...item,
      active: activeItem.value?.key === item.key
    }))
  })

  const pageTitle = computed(() => {
    if (route.path.startsWith('/dashboard/products/edit/')) {
      return 'Edit product'
    }

    if (route.path === '/dashboard/settings') {
      const requestedSection = getDashboardQueryValue(route, 'tab')
      const settingsSection = dashboardSettingsSections.find(({ key }) => key === requestedSection)

      if (settingsSection) {
        return settingsSection.label
      }
    }

    return activeItem.value?.detailedLabel
      || activeItem.value?.label
      || activeGroup.value?.detailedLabel
      || activeGroup.value?.label
      || 'Dashboard'
  })

  const groupTitle = computed(() => {
    const label = activeGroup.value?.detailedLabel || activeGroup.value?.label || ''

    return label && label !== pageTitle.value ? label : ''
  })

  const documentTitle = computed(() => {
    return pageTitle.value === 'Dashboard'
      ? uiLabel('Dashboard')
      : `${uiLabel('Dashboard')} - ${uiLabel(pageTitle.value)}`
  })

  return {
    activeGroup,
    activeItem,
    documentTitle,
    groupTitle,
    navigationGroups,
    pageTitle,
    secondaryItems
  }
}
