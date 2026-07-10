import { getDashboardRouteRequirement } from '~/utils/adminPermissions'

export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/dashboard') || to.path === '/dashboard/login') {
    return
  }

  const supabase = useSupabaseClient()
  const {
    adminUser,
    clearAdminAccess,
    hasPermission,
    loadAdminAccess
  } = useAdminAccess()

  const { data: sessionData } = await supabase.auth.getSession()

  if (!sessionData.session) {
    clearAdminAccess()
    return navigateTo('/dashboard/login')
  }

  await loadAdminAccess(true)

  if (!adminUser.value?.is_active) {
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

  const routeRequirement = getDashboardRouteRequirement(to.path)

  if (!routeRequirement) {
    return
  }

  if (routeRequirement.role === 'owner' && adminUser.value.role !== 'owner') {
    return navigateTo('/dashboard')
  }

  if (routeRequirement.permission && !hasPermission(routeRequirement.permission)) {
    return navigateTo('/dashboard')
  }
})
