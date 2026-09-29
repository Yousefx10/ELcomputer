import { stripLocalePrefix } from '~/utils/appearance'
export default defineNuxtRouteMiddleware(async (destination) => {
  const to = { ...destination, path: stripLocalePrefix(destination.path) }
  const { uiNavigateTo } = useUiNavigation()
  const supabase = useSupabaseClient()
  const { data: claimsData, error: authError } = await supabase.auth.getClaims()
  const customerId = claimsData?.claims?.sub

  if (authError || !customerId) {
    return uiNavigateTo({
      path: '/login',
      query: {
        redirect: to.fullPath
      }
    })
  }

  const { data: customerProfile, error: customerProfileError } = await supabase
    .from('customer_profiles')
    .select('is_active')
    .eq('id', customerId)
    .maybeSingle()

  if (customerProfileError) {
    return uiNavigateTo('/login')
  }

  if (claimsData.claims?.is_anonymous === true || !customerProfile) {
    if (import.meta.client) {
      await supabase.auth.signOut()
    }
    return uiNavigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }

  if ((customerProfile as { is_active?: boolean }).is_active === false) {
    if (import.meta.client) {
      await supabase.auth.signOut()
    }

    return uiNavigateTo({
      path: '/login',
      query: {
        error: 'account-disabled',
        redirect: to.fullPath
      }
    })
  }
})
