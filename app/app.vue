<script setup>
import { normalizeTheme } from '~/utils/appearance'
import { isPrivateSeoPath, privateSeoLabel, seoTitle } from '~/utils/seo'
const { locale } = useI18n()
const { data: siteContent } = await useSiteContent()
const themeChoice = useCookie('elcomputer-theme-choice', { maxAge: 31536000, sameSite: 'lax', path: '/' })
const effectiveTheme = useCookie('elcomputer-color-mode', { maxAge: 31536000, sameSite: 'lax', path: '/' })
const colorMode = useColorMode()
if (import.meta.server) {
  effectiveTheme.value = normalizeTheme(themeChoice.value || siteContent.value?.settings?.site_theme_default)
  colorMode.preference = effectiveTheme.value
}
watch(
  () => normalizeTheme(themeChoice.value || siteContent.value?.settings?.site_theme_default),
  value => { effectiveTheme.value = value; colorMode.preference = value }
)
const seoRoute = useRoute()
const { uiLabel } = useUiLocale()
usePageSeo(() => ({ index: false }))
useHead(() => ({
  // Private titles stay generic, including order and ticket detail pages.
  titleTemplate: title => isPrivateSeoPath(seoRoute.path)
    ? seoTitle(uiLabel(privateSeoLabel(seoRoute.path)), siteContent.value?.settings?.site_name)
    : title,
  htmlAttrs: { lang: locale.value, dir: locale.value === 'ar' ? 'rtl' : 'ltr' }
}))
</script>

<template>
  <NuxtLayout><NuxtPage /></NuxtLayout>
</template>
