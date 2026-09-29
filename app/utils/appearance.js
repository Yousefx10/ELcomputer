export const themeOptions = ['system', 'light', 'dark']
export const normalizeTheme = value => themeOptions.includes(value) ? value : 'system'
export const stripLocalePrefix = value => String(value || '/').replace(/^\/ar(?=\/|\?|#|$)/, '') || '/'
export const localizedPath = (value, locale = 'en') => {
  if (typeof value === 'object' && value !== null) {
    return value.path ? { ...value, path: localizedPath(value.path, locale) } : value
  }
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /^\/(?:api|uploads|_nuxt|images)(?:\/|$)/.test(value)) return value
  const path = stripLocalePrefix(value)
  return locale === 'ar' ? `/ar${path === '/' ? '' : path}` : path
}

export const resolveThemeLogos = settings => {
  const clean = value => {
    const url = String(value || '').trim()
    return /^(\/[^/]|https?:\/\/)/i.test(url) ? url : ''
  }
  const legacy = clean(settings?.site_logo_url) || '/images/dashboard-logo.png'
  const light = clean(settings?.site_logo_light_url) || legacy
  return { light, dark: clean(settings?.site_logo_dark_url) || light, fallback: legacy }
}
export const formatLocale = locale => locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US'
