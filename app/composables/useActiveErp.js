export const useActiveErp = () => {
  const supabase=useSupabaseClient()
  return useAsyncData('active-erp',async () => {
    const {data}=await supabase.auth.getSession()
    if(!data.session?.access_token) throw new Error('Your session expired. Sign in again.')
    return $fetch('/api/admin-erp/state',{headers:{authorization:`Bearer ${data.session.access_token}`},timeout:10000})
  })
}
