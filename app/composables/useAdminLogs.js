export const useAdminLogs = () => {
  const supabase = useSupabaseClient()

  const getAdminAuthHeaders = async () => {
    const { data } = await supabase.auth.getSession()

    if (!data.session?.access_token) {
      throw new Error('Your session expired. Please log in again.')
    }

    return {
      authorization: `Bearer ${data.session.access_token}`
    }
  }

  const recordAdminLog = async ({ description, actionKey = '', metadata = {} } = {}) => {
    if (!String(description || '').trim()) {
      return
    }

    try {
      await $fetch('/api/admin-logs', {
        method: 'POST',
        headers: await getAdminAuthHeaders(),
        body: {
          description,
          actionKey,
          metadata
        }
      })
    } catch (error) {
      console.warn('Could not record admin log:', error?.data?.statusMessage || error?.message || error)
    }
  }

  const fetchAdminLogs = async (query = {}) => {
    return await $fetch('/api/admin-logs', {
      query,
      headers: await getAdminAuthHeaders()
    })
  }

  return {
    getAdminAuthHeaders,
    recordAdminLog,
    fetchAdminLogs
  }
}
