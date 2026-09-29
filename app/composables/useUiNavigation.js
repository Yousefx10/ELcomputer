import { localizedPath } from '~/utils/appearance'

export const useUiNavigation = () => {
  const { locale } = useNuxtApp().$i18n
  const router = useRouter()
  const destination = value => localizedPath(value, locale.value)
  return {
    uiNavigateTo: (value, options) => navigateTo(destination(value), options),
    uiRouterPush: value => router.push(destination(value)),
    uiRouterReplace: value => router.replace(destination(value))
  }
}
