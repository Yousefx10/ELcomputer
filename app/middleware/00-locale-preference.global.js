import { localizedPath } from '~/utils/appearance'

export default defineNuxtRouteMiddleware(to => {
  const choice = useCookie('elcomputer-locale', { maxAge: 31536000, sameSite: 'lax', path: '/' })
  // Explicit Arabic URLs are always usable. No browser-language detection.
  if (!/^\/ar(?:\/|$)/.test(to.path) && choice.value === 'ar') {
    return navigateTo(localizedPath(to.fullPath, 'ar'), { replace: true })
  }
})
