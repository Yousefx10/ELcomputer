export const authPageLayouts = ['split', 'centered', 'reversed']
export const authImagePositions = ['left', 'center', 'right']

export const normalizeAuthLayout = value => authPageLayouts.includes(value) ? value : 'split'
export const normalizeAuthImagePosition = value => authImagePositions.includes(value) ? value : 'center'

export const safeCustomerReturnPath = (value, fallback = '/account') => {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]|%2f|%5c|%0[0-9a-f]|%1[0-9a-f]|%7f/i.test(value)) return fallback
  try {
    const url = new URL(value, 'https://elcomputer.invalid')
    if (url.origin !== 'https://elcomputer.invalid') return fallback
    if (/^\/(?:ar\/)?(?:login|dashboard|api|auth)(?:\/|$)/i.test(url.pathname)) return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}

export const authErrorKey = (error, mode = 'login') => {
  const code = String(error?.code || '').toLowerCase()
  const message = String(error?.message || '').toLowerCase()
  if (code === 'invalid_credentials' || /invalid login credentials|invalid email or password/.test(message)) return 'authPage.invalidCredentials'
  if (code === 'email_not_confirmed' || /email not confirmed/.test(message)) return 'authPage.emailNotConfirmed'
  if (code === 'user_already_exists' || /already registered|already exists/.test(message)) return 'authPage.emailExists'
  if (code === 'weak_password' || /password should be|password.*weak|password.*short/.test(message)) return 'authPage.weakPassword'
  if (code === 'validation_failed' || /invalid email/.test(message)) return 'authPage.invalidEmail'
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || /rate limit/.test(message)) return 'authPage.rateLimited'
  if (code === 'provider_disabled' || /provider.*not enabled|unsupported provider/.test(message)) return 'authPage.providerUnavailable'
  return mode === 'oauth' ? 'authPage.oauthFailed' : 'authPage.requestFailed'
}
