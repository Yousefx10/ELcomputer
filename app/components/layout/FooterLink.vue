<template>
  <span class="store-footer-link">
    <NuxtLinkLocale v-if="safeUrl.startsWith('/')" :to="safeUrl">{{ label }}</NuxtLinkLocale>
    <a v-else-if="safeUrl" :href="safeUrl" :target="external ? '_blank' : undefined" :rel="external ? 'noopener noreferrer' : undefined">{{ label }}</a>
    <span v-else>{{ label }}</span>
    <span v-if="badge" class="store-footer-modern-badge">{{ badge }}</span>
  </span>
</template>

<script setup>
import { footerUrl } from '~/utils/modernFooter'
const props = defineProps({ url: { type: String, default: '' }, label: { type: String, default: '' }, badge: { type: String, default: '' } })
const safeUrl = computed(() => footerUrl(props.url, /^(tel:|mailto:)/.test(props.url) ? 'contact' : 'link'))
const external = computed(() => /^https?:/.test(safeUrl.value))
</script>
