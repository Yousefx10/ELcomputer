<script setup>
import { productContact } from '~/utils/productFinishing'
const user = useSupabaseUser()
const { data: siteContent } = await useSiteContent()
const contact = computed(() => productContact(siteContent.value?.settings))
const signedIn = computed(() => !!(user.value?.sub || user.value?.id) && user.value?.is_anonymous !== true)
</script>

<template>
  <details class="pdp-help">
    <summary><Icon name="lucide:circle-help" size="18" aria-hidden="true" /><span>{{ $t('productFinishing.needHelp') }}<small>{{ $t('productFinishing.productSupport') }}</small></span><Icon name="lucide:chevron-down" size="15" aria-hidden="true" /></summary>
    <nav :aria-label="$t('productFinishing.productSupport')">
      <NuxtLinkLocale to="/help">{{ $t('productFinishing.helpCenter') }}<Icon name="lucide:arrow-up-right" size="14" aria-hidden="true" /></NuxtLinkLocale>
      <NuxtLinkLocale v-if="signedIn" to="/account/support">{{ $t('productFinishing.supportTicket') }}<Icon name="lucide:arrow-up-right" size="14" aria-hidden="true" /></NuxtLinkLocale>
      <a v-if="contact.email" :href="`mailto:${contact.email}`">{{ $t('productFinishing.emailSupport') }}<bdi>{{ contact.email }}</bdi></a>
      <a v-if="contact.phone" :href="`tel:${contact.phone.replace(/[^+\d]/g, '')}`">{{ $t('productFinishing.callSupport') }}<bdi dir="ltr">{{ contact.phone }}</bdi></a>
    </nav>
  </details>
</template>
