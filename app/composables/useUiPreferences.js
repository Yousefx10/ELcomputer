import { normalizeTheme } from '~/utils/appearance'

export const useUiPreferences = () => {
  const colorMode = useColorMode()
  const choice = useCookie('elcomputer-theme-choice', { maxAge: 31536000, sameSite: 'lax', path: '/' })
  const { data: content } = useSiteContent()
  const preference = computed(() => normalizeTheme(choice.value || content.value?.settings?.site_theme_default))
  const setTheme = value => {
    choice.value = normalizeTheme(value)
    colorMode.preference = choice.value
  }
  return { preference, setTheme }
}
