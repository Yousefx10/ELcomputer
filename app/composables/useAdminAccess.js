import {
  hasAdminPermission,
  normalizeAdminPermissions
} from '~/utils/adminPermissions'

export const useAdminAccess = () => {
  const supabase = useSupabaseClient()

  const adminUser = useState('admin-user', () => null)
  const adminAccessLoaded = useState('admin-access-loaded', () => false)
  const adminAccessPending = useState('admin-access-pending', () => false)
  const adminAccessError = useState('admin-access-error', () => '')

  const loadAdminAccess = async (force = false) => {
    if (adminAccessPending.value) {
      return await new Promise((resolve) => {
        const stopWatchingPending = watch(adminAccessPending, (isPending) => {
          if (!isPending) {
            stopWatchingPending()
            resolve(adminUser.value)
          }
        }, { immediate: true })
      })
    }

    if (adminAccessLoaded.value && !force) {
      return adminUser.value
    }

    adminAccessPending.value = true
    adminAccessError.value = ''

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        throw sessionError
      }

      if (!sessionData.session) {
        adminUser.value = null
        return null
      }

      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('id', sessionData.session.user.id)
        .maybeSingle()

      if (error) {
        throw error
      }

      adminUser.value = data
        ? {
            ...data,
            permissions: normalizeAdminPermissions(data.permissions)
          }
        : null

      return adminUser.value
    } catch (error) {
      adminAccessError.value = error.message || 'Could not load admin access.'
      adminUser.value = null
      return null
    } finally {
      adminAccessLoaded.value = true
      adminAccessPending.value = false
    }
  }

  const clearAdminAccess = () => {
    adminUser.value = null
    adminAccessLoaded.value = false
    adminAccessPending.value = false
    adminAccessError.value = ''
  }

  const isOwner = computed(() => adminUser.value?.role === 'owner')
  const isActiveAdmin = computed(() => Boolean(adminUser.value?.is_active))

  const hasPermission = (permissionKey) => {
    return hasAdminPermission(adminUser.value, permissionKey)
  }

  const hasAnyPermission = (permissionKeys = []) => {
    return permissionKeys.some((permissionKey) => hasPermission(permissionKey))
  }

  return {
    adminUser,
    adminAccessLoaded,
    adminAccessPending,
    adminAccessError,
    loadAdminAccess,
    clearAdminAccess,
    isOwner,
    isActiveAdmin,
    hasPermission,
    hasAnyPermission
  }
}
