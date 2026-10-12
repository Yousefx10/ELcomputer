<script setup>
import { resolveThemeLogos } from '~/utils/appearance'
const props = defineProps({ settings: { type: Object, default: () => ({}) }, alt: { type: String, default: 'Store' } })
const configured = computed(() => [props.settings.site_logo_url, props.settings.site_logo_light_url, props.settings.site_logo_dark_url].some(value => typeof value === 'string' && /^(\/[^/]|https?:\/\/)/i.test(value)))
const branded = computed(() => configured.value)
const logos = computed(() => resolveThemeLogos(props.settings))
const failed = ref(new Set())
const image = theme => failed.value.has(logos.value[theme]) ? (failed.value.has(logos.value.light) ? '/images/dashboard-logo.png' : logos.value.light) : logos.value[theme]
const markFailed = (event, url) => {
  if (event.target.getAttribute('src') === '/images/dashboard-logo.png') return
  failed.value = new Set([...failed.value, url, event.target.getAttribute('src')])
}
</script>

<template>
  <span class="brand-logo">
    <span v-if="!branded">{{ alt }}</span>
    <template v-else>
    <img class="brand-logo-light" :class="{ 'brand-logo-default': image('light') === '/images/dashboard-logo.png' }" :src="image('light')" :alt="alt" @error="markFailed($event, logos.light)">
    <img class="brand-logo-dark" :class="{ 'brand-logo-default': image('dark') === '/images/dashboard-logo.png' }" :src="image('dark')" :alt="alt" @error="markFailed($event, logos.dark)">
    </template>
  </span>
</template>
