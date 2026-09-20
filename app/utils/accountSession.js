export const resolveAccountUser = async (supabase, currentUser, timeoutMs = 10000) => {
  // @nuxtjs/supabase exposes verified JWT claims (sub), not a Supabase User (id).
  if (currentUser?.sub || currentUser?.id) {
    return { ...currentUser, id: currentUser.id || currentUser.sub }
  }

  // Route middleware may authenticate before useSupabaseUser is populated.
  let timer
  try {
    const { data, error } = await Promise.race([
      supabase.auth.getUser(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Account user lookup timed out')), timeoutMs)
      })
    ])
    if (error) throw error
    return data?.user || null
  } finally {
    clearTimeout(timer)
  }
}
