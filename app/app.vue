<script setup>
import { normalizeTheme } from '~/utils/appearance'
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
const localeHead = useLocaleHead({ seo: false })
useHead(() => ({
  htmlAttrs: { ...localeHead.value.htmlAttrs, lang: locale.value, dir: locale.value === 'ar' ? 'rtl' : 'ltr' }
}))
</script>

<template>
  <NuxtLayout><NuxtPage /></NuxtLayout>
</template>
