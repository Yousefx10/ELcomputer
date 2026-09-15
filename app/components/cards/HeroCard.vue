<template>
  <section v-if="heroEnabled" class="store-hero" aria-label="Store highlights" aria-roledescription="carousel" @mouseenter="hoverPaused = true" @mouseleave="hoverPaused = false" @focusin="focusPaused = true" @focusout="onFocusOut">
    <component :is="currentBannerComponent" v-if="currentBanner" v-bind="currentBannerAttributes" class="store-hero-image-link">
      <img class="store-hero-image" :alt="currentBanner.alt_text || 'Explore the latest at ' + siteName" :src="currentBannerImageUrl" fetchpriority="high" />
    </component>
    <div v-else class="store-hero-fallback">
      <img class="store-hero-scene" src="/images/storefront/setup-hero.png" alt="" fetchpriority="high" width="1536" height="1024" />
      <div class="store-hero-copy">
        <p class="store-eyebrow">For work and play</p>
        <h1>Keyboards<br /><span>and mice.</span></h1>
        <p>Headsets, cables and other desk accessories.</p>
        <NuxtLink to="/search" class="store-button">Shop now <Icon name="lucide:arrow-right" size="16" /></NuxtLink>
      </div>
    </div>
    <div v-if="heroBanners.length > 1" class="store-hero-controls">
      <button type="button" aria-label="Previous banner" @click="moveBanner(-1)"><Icon name="lucide:chevron-left" size="17" /></button>
      <span>{{ currentBannerIndex + 1 }} / {{ heroBanners.length }}</span>
      <button type="button" :aria-label="paused ? 'Play banners' : 'Pause banners'" :aria-pressed="paused" @click="paused = !paused"><Icon :name="paused ? 'lucide:play' : 'lucide:pause'" size="14" /></button>
      <button type="button" aria-label="Next banner" @click="moveBanner(1)"><Icon name="lucide:chevron-right" size="17" /></button>
    </div>
  </section>
</template>

<script setup>
import { getConfiguredStoreImageUrl, getStoreLinkUrl, isExternalStoreLink } from '~/utils/storefront'
const { data: siteContent } = await useSiteContent()
const currentBannerIndex = ref(0)
const paused = ref(false)
const hoverPaused = ref(false)
const focusPaused = ref(false)
let heroInterval = null
let motionPreference = null
const siteName = computed(() => siteContent.value?.settings?.site_name || 'ELcomputer')
const heroEnabled = computed(() => siteContent.value?.settings?.hero_enabled ?? true)
const heroBanners = computed(() => heroEnabled.value
  ? (siteContent.value?.heroBanners || []).filter((banner) => getConfiguredStoreImageUrl(banner.image_url) && banner.id !== 'default-hero-banner')
  : [])
const rotationSeconds = computed(() => Math.max(1, Number(siteContent.value?.settings?.hero_rotation_seconds || 5)))
const currentBanner = computed(() => heroBanners.value[currentBannerIndex.value] || null)
const currentBannerImageUrl = computed(() => getConfiguredStoreImageUrl(currentBanner.value?.image_url))
const currentBannerLinkUrl = computed(() => getStoreLinkUrl(currentBanner.value?.link_url))
const currentBannerExternal = computed(() => isExternalStoreLink(currentBannerLinkUrl.value))
const nuxtLink = resolveComponent('NuxtLink')
const currentBannerComponent = computed(() => {
  if (!currentBannerLinkUrl.value) return 'div'
  return currentBannerExternal.value ? 'a' : nuxtLink
})
const currentBannerAttributes = computed(() => {
  if (!currentBannerLinkUrl.value) return {}
  if (currentBannerExternal.value) {
    return { href: currentBannerLinkUrl.value, target: '_blank', rel: 'noopener noreferrer' }
  }
  return { to: currentBannerLinkUrl.value }
})
const moveBanner = (direction) => {
  currentBannerIndex.value = (currentBannerIndex.value + direction + heroBanners.value.length) % heroBanners.value.length
}
const onFocusOut = (event) => {
  if (!event.currentTarget.contains(event.relatedTarget)) focusPaused.value = false
}
const restartHeroInterval = () => {
  clearInterval(heroInterval)
  if (!import.meta.client || heroBanners.value.length <= 1) return
  heroInterval = setInterval(() => {
    if (!paused.value && !hoverPaused.value && !focusPaused.value && !document.hidden) moveBanner(1)
  }, rotationSeconds.value * 1000)
}
const onMotionChange = (event) => { paused.value = event.matches }
watch([heroBanners, rotationSeconds], () => {
  currentBannerIndex.value = 0
  restartHeroInterval()
})
onMounted(() => {
  motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
  paused.value = motionPreference.matches
  motionPreference.addEventListener('change', onMotionChange)
  restartHeroInterval()
})
onBeforeUnmount(() => {
  clearInterval(heroInterval)
  motionPreference?.removeEventListener('change', onMotionChange)
})
</script>
