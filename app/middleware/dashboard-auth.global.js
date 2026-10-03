import { getErpOwnershipRedirect } from '~/utils/erpState'
import { stripLocalePrefix } from '~/utils/appearance'
import { getDashboardRouteRequirement } from '~/utils/adminPermissions'

export default defineNuxtRouteMiddleware(async (destination) => {
  const to = { ...destination, path: stripLocalePrefix(destination.path) }
  const { uiNavigateTo } = useUiNavigation()
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
    return uiNavigateTo('/dashboard/login')
  }

  const routeRequirement = getDashboardRouteRequirement(to)

  const resolvedAdminUser = adminAccessLoaded.value
    ? adminUser.value
    : await loadAdminAccess()

  if (!resolvedAdminUser) {
    clearAdminAccess()
    return uiNavigateTo('/dashboard/login')
  }

  if (!resolvedAdminUser.is_active) {
    clearAdminAccess()

    if (import.meta.client) {
      await supabase.auth.signOut()
    }

    return uiNavigateTo({
      path: '/dashboard/login',
      query: {
        error: 'not-authorized'
      }
    })
  }

  const cachedErpState = useNuxtData('active-erp').data.value
  const { data: erpState, error: erpError, refresh: refreshErpState } = await useActiveErp()
  if (cachedErpState) await refreshErpState()
  const erpRedirect=getErpOwnershipRedirect(to,erpError.value ? null:erpState.value,hasPermission('dashboard.analysis'))
  if (erpRedirect) return uiNavigateTo(erpRedirect,{replace:true})

  if (!routeRequirement) {
    return
  }

  if (routeRequirement.role === 'owner' && resolvedAdminUser.role !== 'owner') {
    return uiNavigateTo('/dashboard')
  }

  if (routeRequirement.permission && !hasPermission(routeRequirement.permission)) {
    return uiNavigateTo('/dashboard')
  }

  if (routeRequirement.permissionsAny?.length && !hasAnyPermission(routeRequirement.permissionsAny)) {
    return uiNavigateTo('/dashboard')
  }
})
