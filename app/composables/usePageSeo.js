import { buildSeo, seoHead, privateSeoLabel } from '~/utils/seo'
import { aiDiscoveryLinks } from '~/utils/aiReadiness'

export function usePageSeo(options = () => ({})) {
  const route = useRoute()
  const { locale } = useI18n()
  const config = useRuntimeConfig()
  const { uiLabel } = useUiLocale()
  const { data: content } = useSiteContent()
  const seo = computed(() => buildSeo({
    settings: content.value?.settings || {}, siteUrl: config.public.siteUrl,
    path: route.path, locale: locale.value, privateTitle: uiLabel(privateSeoLabel(route.path)), ...toValue(options)
  }))
  useHead(() => {
    const head = seoHead(seo.value)
    return { ...head, link: [...head.link, ...aiDiscoveryLinks(seo.value)] }
  })
  return seo
}
