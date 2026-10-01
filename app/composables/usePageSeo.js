import { buildSeo, seoHead, privateSeoLabel } from '~/utils/seo'
import { aiDiscoveryLinks } from '~/utils/aiReadiness'

export function usePageSeo(options = () => ({})) {
  const route = useRoute()
  const { locale } = useI18n()
  const config = useRuntimeConfig()
  const { uiLabel } = useUiLocale()
  const { data: content } = useSiteContent()
  const requestEvent = import.meta.server ? useRequestEvent() : null
  const seo = computed(() => buildSeo({
    settings: content.value?.settings || {}, siteUrl: config.public.siteUrl,
    path: route.path, locale: locale.value, privateTitle: uiLabel(privateSeoLabel(route.path)), ...toValue(options)
  }))
  useHead(() => {
    const head = seoHead(seo.value)
    const discovery = aiDiscoveryLinks(seo.value)
    if (requestEvent) requestEvent.context.publicAiLinks = discovery
    return { ...head, link: [...head.link, ...discovery] }
  })
  return seo
}
