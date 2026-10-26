// A recovery link is an email-ownership proof, not an ordinary signed-in session.
// Keep its hash in this component closure only. Page loads never redeem it.
export const createPasswordRecovery = ({ auth, href, replaceUrl }) => {
  const url = new URL(href)
  if (url.searchParams.get('mode') !== 'recovery') return null
  const fragment = new URLSearchParams(url.hash.slice(1))
  let tokenHash = fragment.get('token_hash') || ''
  let invalid = Boolean(url.searchParams.get('code') || url.searchParams.get('error')
    || url.searchParams.get('error_code') || url.searchParams.has('token_hash')
    || fragment.get('error') || fragment.get('error_code')
    || fragment.has('access_token') || fragment.has('refresh_token'))
  if (tokenHash && (fragment.get('type') !== 'recovery'
    || fragment.getAll('token_hash').length !== 1 || fragment.getAll('type').length !== 1
    || !/^[A-Za-z0-9_-]{32,256}$/.test(tokenHash))) invalid = true
  if (invalid) tokenHash = ''
  // Fragments stay out of HTTP requests and analytics; remove them from history
  // before rendering. Do not persist or include proof values in errors.
  url.hash = ''
  for (const key of ['code', 'token_hash', 'access_token', 'refresh_token', 'error', 'error_code', 'error_description']) url.searchParams.delete(key)
  replaceUrl(url.pathname + url.search)

  let verifiedUserId = ''
  const fail = () => { throw Object.assign(new Error('Recovery proof required.'), { code: 'recovery_proof_required' }) }
  const subscription = auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY' && !invalid && session?.user?.is_anonymous !== true) verifiedUserId = session?.user?.id || ''
    if (event === 'SIGNED_OUT') verifiedUserId = ''
  }).data.subscription

  return {
    invalid,
    async updatePassword(password) {
      if (invalid) fail()
      if (tokenHash) {
        const proof = tokenHash
        tokenHash = '' // At most one verification request; uncertain results stop.
        invalid = true
        const { data, error } = await auth.verifyOtp({ type: 'recovery', token_hash: proof })
        if (error) throw error
        if (!data?.user?.id || data.user.is_anonymous === true
          || data.session?.user?.id !== data.user.id) fail()
        verifiedUserId = data.user.id
        invalid = false
      }
      const { data, error } = await auth.getSession()
      const current = data?.session?.user
      if (error || !current?.id || current.is_anonymous === true) fail()
      if (!verifiedUserId) {
        // A legacy PKCE callback may finish before this component mounts. The
        // verified claims preserve that path without trusting an unrelated login.
        const result = await auth.getClaims()
        const claims = result.data?.claims
        if (result.error || claims?.sub !== current.id
          || !claims.amr?.some(entry => entry.method === 'recovery')) fail()
        verifiedUserId = current.id
      }
      if (verifiedUserId !== current.id) { verifiedUserId = ''; fail() }
      const result = await auth.updateUser({ password })
      if (result.error) throw result.error
      verifiedUserId = ''
    },
    dispose() { tokenHash = ''; verifiedUserId = ''; subscription.unsubscribe() }
  }
}
