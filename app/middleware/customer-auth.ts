export default defineNuxtRouteMiddleware(async (to) => {
  const supabase = useSupabaseClient()
  const { data: sessionData } = await supabase.auth.getSession()

  if (!sessionData.session) {
    return navigateTo({
      path: '/login',
      query: {
        redirect: to.fullPath
      }
    })
  }

  const { data: customerProfile, error: customerProfileError } = await supabase
    .from('customer_profiles')
    .select('is_active')
    .eq('id', sessionData.session.user.id)
    .maybeSingle()

  if (customerProfileError) {
    return navigateTo('/login')
  }

  if (customerProfile && customerProfile.is_active === false) {
    if (import.meta.client) {
      await supabase.auth.signOut()
    }

    return navigateTo({
      path: '/login',
      query: {
        error: 'account-disabled',
        redirect: to.fullPath
      }
    })
  }
})
