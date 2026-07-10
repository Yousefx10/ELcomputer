export default defineNuxtRouteMiddleware(async () => {
  const supabase = useSupabaseClient()
  const { data: sessionData } = await supabase.auth.getSession()

  if (!sessionData.session) {
    return navigateTo('/login')
  }
})
