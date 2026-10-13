<script setup>
import { resolveThemeLogos } from '~/utils/appearance'
const props = defineProps({ settings: { type: Object, default: () => ({}) }, alt: { type: String, default: 'Store' } })
const logos = computed(() => resolveThemeLogos(props.settings))
const failed = ref(new Set())
const image = theme => [logos.value[theme],logos.value.light,logos.value.dark,logos.value.fallback].find(url => url && !failed.value.has(url)) || ''
const markFailed = event => {
  failed.value = new Set([...failed.value, event.target.getAttribute('src')])
}
</script>

<template>
  <span class="brand-logo">
    <template v-if="image('light') || image('dark')">
      <img v-if="image('light')" class="brand-logo-light" :class="{ 'brand-logo-default': image('light') === '/images/dashboard-logo.png' }" :src="image('light')" :alt="alt" @error="markFailed">
      <span v-else class="brand-logo-light">{{ alt }}</span>
      <img v-if="image('dark')" class="brand-logo-dark" :class="{ 'brand-logo-default': image('dark') === '/images/dashboard-logo.png' }" :src="image('dark')" :alt="alt" @error="markFailed">
      <span v-else class="brand-logo-dark">{{ alt }}</span>
    </template>
    <span v-else>{{ alt }}</span>
  </span>
</template>
