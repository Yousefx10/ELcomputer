import { getDashboardRouteRequirement } from '~/utils/adminPermissions'

export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/dashboard') || to.path === '/dashboard/login') {
    return
  }

  const supabase = useSupabaseClient()
  const {
    adminUser,
    adminAccessLoaded,
    clearAdminAccess,
    hasAnyPermission,
    hasPermission,
    loadAdminAccess
  } = useAdminAccess()

  if (adminAccessLoaded.value && !adminUser.value) {
    clearAdminAccess()
    return navigateTo('/dashboard/login')
  }

  const routeRequirement = getDashboardRouteRequirement(to)

  const resolvedAdminUser = adminAccessLoaded.value
    ? adminUser.value
    : await loadAdminAccess()

  if (!resolvedAdminUser) {
    clearAdminAccess()
    return navigateTo('/dashboard/login')
  }

  if (!resolvedAdminUser.is_active) {
    clearAdminAccess()

    if (import.meta.client) {
      await supabase.auth.signOut()
    }

    return navigateTo({
      path: '/dashboard/login',
      query: {
        error: 'not-authorized'
      }
    })
  }

  const { data: siteContent } = await useSiteContent()
  const settings = siteContent.value?.settings || {}
  const externalErpActive = settings.erp_mode === 'daftra'
    && settings.daftra_connection_status === 'connected'

  if (externalErpActive) {
    const queryValue = (key) => String(
      Array.isArray(to.query?.[key]) ? to.query[key][0] : to.query?.[key] || ''
    ).trim().toLowerCase()

    if (to.path === '/dashboard/treasury') {
      return navigateTo('/dashboard/erp', { replace: true })
    }

    if (
      to.path === '/dashboard/commerce'
      && ['', 'procurement', 'sales', 'warehouses'].includes(queryValue('tab'))
    ) {
      return navigateTo('/dashboard/commerce?tab=returns', { replace: true })
    }

    if (to.path === '/dashboard/hr' && ['', 'employees'].includes(queryValue('tab'))) {
      return navigateTo('/dashboard/hr?tab=users', { replace: true })
    }

    if (to.path === '/dashboard' && queryValue('view') === 'stock') {
      return navigateTo('/dashboard/erp?tab=inventory', { replace: true })
    }
  }

  if (!routeRequirement) {
    return
  }

  if (routeRequirement.role === 'owner' && resolvedAdminUser.role !== 'owner') {
    return navigateTo('/dashboard')
  }

  if (routeRequirement.permission && !hasPermission(routeRequirement.permission)) {
    return navigateTo('/dashboard')
  }

  if (routeRequirement.permissionsAny?.length && !hasAnyPermission(routeRequirement.permissionsAny)) {
    return navigateTo('/dashboard')
  }
})
