<script setup>
import { footerUrl, footerText, resolveModernFooter } from '~/utils/modernFooter.js'
const { data: content } = await useSiteContent()
const settings = computed(() => content.value?.settings || {})
const { locale } = useI18n()
const modern = computed(() => settings.value.footer_style === 'modern')
const support = computed(() => resolveModernFooter(settings.value, content.value?.footerLinks || []).support)
const supportUrl = computed(() => {
  const value = modern.value && support.value.enabled ? footerUrl(support.value.url, 'contact') : ''
  return value.replace(/^\/ar(?=\/|$)/, '').split(/[?#]/)[0].replace(/\/$/, '') === '/contact' ? '' : value
})
const email = computed(() => footerUrl(`mailto:${settings.value.footer_email || ''}`, 'contact'))
const phone = computed(() => footerUrl(`tel:${String(settings.value.footer_phone || '').replace(/[^+\d]/g, '')}`, 'contact'))
const address = computed(() => settings.value.footer_address && settings.value.footer_address !== 'address address' ? settings.value.footer_address : '')
const { uiLabel } = useUiLocale()
usePageSeo(() => ({ title: uiLabel('Contact us') }))
</script>
<template>
  <main class="store-container py-10 sm:py-14">
    <section class="mx-auto max-w-2xl rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7" aria-labelledby="contact-heading">
      <h1 id="contact-heading" class="text-2xl font-bold text-[var(--text-primary)]">{{ $t('common.contactUs') }}</h1>
      <div class="mt-5 space-y-3 text-[var(--text-secondary)]">
        <p v-if="supportUrl"><LayoutFooterLink :url="supportUrl" :label="footerText(support, 'label', locale) || $t('common.contactSupport')" /></p>
        <p v-if="supportUrl && footerText(support, 'hours', locale)">{{ footerText(support, 'hours', locale) }}</p>
        <p v-if="!modern && email"><a :href="email" class="break-all font-semibold text-blue-700">{{ settings.footer_email }}</a></p>
        <p v-if="!modern && phone"><a :href="phone" dir="ltr" class="inline-block font-semibold text-blue-700">{{ settings.footer_phone }}</a></p>
        <p v-if="!modern && address">{{ address }}</p>
      </div>
      <div class="mt-6 flex flex-wrap gap-3">
        <NuxtLinkLocale to="/account/support" class="inline-flex min-h-11 items-center rounded-lg bg-blue-700 px-4 font-semibold text-white">{{ $t('common.contactSupport') }}</NuxtLinkLocale>
        <NuxtLinkLocale to="/help" class="inline-flex min-h-11 items-center rounded-lg border border-[var(--border)] px-4 font-semibold text-[var(--text-primary)]">{{ $t('common.helpCenter') }}</NuxtLinkLocale>
      </div>
    </section>
  </main>
</template>
