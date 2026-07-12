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
