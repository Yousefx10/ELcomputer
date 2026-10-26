// Operator helper, not an application route or signup policy. After approval,
// paste the function and reviewed inputs into the production login tab's console.
// It uses that tab's existing client/cookies; never supply a service-role key.
export async function requestControlledConfirmation(target, browser = globalThis.window) {
  if (target?.send_approved !== true) throw new Error('One confirmation email needs approval.')
  if (!/^[A-Z0-9-]+$/.test(target.test_id || '')) throw new Error('A test ID is required.')
  if (!/^[a-f0-9-]{36}$/i.test(target.identity_id || '')) throw new Error('Verify the new unconfirmed identity first.')
  if (!['en', 'ar'].includes(target.locale)) throw new Error('Choose EN or AR.')
  if (typeof target.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target.email)) throw new Error('An exact test mailbox is required.')

  const origin = new URL(target.origin)
  if (origin.protocol !== 'https:' || origin.origin !== target.origin || browser?.location.origin !== target.origin) {
    throw new Error('Open the reviewed production origin.')
  }
  const path = target.locale === 'ar' ? '/ar/login' : '/login'
  if (browser.location.pathname !== path) throw new Error('Open the selected login page.')
  const sdk = browser.document.querySelector('#__nuxt')?.__vue_app__?.$nuxt?.$supabase?.client
  if (!sdk?.auth?.resend) throw new Error('The application client is unavailable; stop.')

  const marker = `auth-confirm-once:${target.test_id}:${target.identity_id}`
  const storage = browser.sessionStorage
  if (storage.getItem(marker)) throw new Error('This request was already attempted; stop.')
  // Reserve before awaiting to reject a double invocation in the same tab.
  storage.setItem(marker, 'reserved')
  const { data, error } = await sdk.auth.getSession()
  if (error || data.session) {
    storage.setItem(marker, 'stopped')
    throw new Error('Use a signed-out browser profile; stop.')
  }

  const redirect = new URL(path, origin).href
  storage.setItem(marker, 'attempted')
  try {
    const { error } = await sdk.auth.resend({
      type: 'signup', email: target.email,
      options: { emailRedirectTo: redirect }
    })
    storage.setItem(marker, error ? 'rejected' : 'accepted')
    return { test_id: target.test_id, status: error ? 'REJECTED_STOP' : 'REQUEST_ACCEPTED_DELIVERY_UNVERIFIED', redirect_url: redirect }
  } catch {
    storage.setItem(marker, 'unknown')
    throw new Error('Outcome unknown; do not retry.')
  }
}
