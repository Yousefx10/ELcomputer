<template>
  <section v-if="heroEnabled && currentBanner" class="store-hero" :class="{ 'store-hero-has-mobile': mobileCopy && !authoredCopy && !presentation.mobile_image_url, 'store-hero-authored': authoredCopy }" :aria-label="$t('common.storeHighlights')" :aria-roledescription="heroBanners.length > 1 ? 'carousel' : undefined" @mouseenter="hoverPaused = true" @mouseleave="hoverPaused = false" @focusin="focusPaused = true" @focusout="onFocusOut" @touchstart.passive="touchStart = $event.changedTouches[0]?.clientX" @touchend.passive="onTouchEnd">
    <component :is="currentBannerComponent" v-if="currentBanner" v-bind="currentBannerAttributes" class="store-hero-image-link">
      <picture class="store-hero-picture">
        <source v-if="mobileImage" media="(max-width: 767px)" :srcset="mobileImage">
        <img class="store-hero-image" :alt="currentBanner.alt_text || $t('common.exploreTheLatestAt') + ' ' + siteName" :src="currentBannerImageUrl" :style="imageStyle" width="1440" height="720" fetchpriority="high" decoding="async" />
      </picture>
      <div v-if="authoredCopy" class="store-hero-authored-copy"><p v-if="title" class="store-hero-authored-title">{{ title }}</p><p v-if="body">{{ body }}</p><span v-if="cta && currentBannerLinkUrl" class="store-button">{{ cta }}</span></div>
      <div v-else-if="mobileCopy && !mobileImage" class="store-hero-mobile">
        <div class="store-hero-mobile-art" aria-hidden="true" :style="{ backgroundImage: `url(${JSON.stringify(currentBannerImageUrl)})`, backgroundPosition: `${mobileCopy.artSide} ${mobileCopy.artVerticalPercent}%`, backgroundSize: `${10000 / mobileCopy.artWidthPercent}% auto` }" />
        <div class="store-hero-mobile-copy"><p class="store-hero-mobile-title">{{ mobileCopy.title }}</p><p>{{ mobileCopy.body }}</p></div>
      </div>
    </component>
    <div v-if="heroBanners.length > 1" class="store-hero-controls">
      <button type="button" :aria-label="$t('common.previousBanner')" @click="moveBanner(-1)"><Icon name="lucide:chevron-left" size="17" class="directional-icon" /></button>
      <span>{{ currentBannerIndex + 1 }} / {{ heroBanners.length }}</span>
      <button type="button" :aria-label="paused ? $t('common.playBanners') : $t('common.pauseBanners')" :aria-pressed="paused" @click="paused = !paused"><Icon :name="paused ? 'lucide:play' : 'lucide:pause'" size="14" /></button>
      <button type="button" :aria-label="$t('common.nextBanner')" @click="moveBanner(1)"><Icon name="lucide:chevron-right" size="17" class="directional-icon" /></button>
    </div>
  </section>
</template>

<script setup>
import { getConfiguredStoreImageUrl, getStoreLinkUrl, isExternalStoreLink } from '~/utils/storefront'
import { mobileHeroPresentation } from '~/utils/storePresentation'
import { selectedHeroBanners, normalizeHeroPresentation } from '~/utils/heroLayout'
const { locale } = useI18n()
const { data: siteContent } = await useSiteContent()
const currentBannerIndex = ref(0)
const paused = ref(false)
const hoverPaused = ref(false)
const focusPaused = ref(false)
let heroInterval = null
let motionPreference = null
const touchStart = ref(null)
const siteName = computed(() => siteContent.value?.settings?.site_name || 'Store')
const heroEnabled = computed(() => (siteContent.value?.settings?.hero_enabled ?? false) && (siteContent.value?.heroBanners || []).some(banner => getConfiguredStoreImageUrl(banner.image_url) && banner.id !== 'default-hero-banner'))
const heroBanners = computed(() => heroEnabled.value ? selectedHeroBanners(siteContent.value) : [])
const rotationSeconds = computed(() => Math.max(1, Number(siteContent.value?.settings?.hero_rotation_seconds || 5)))
const currentBanner = computed(() => heroBanners.value[currentBannerIndex.value] || null)
const mobileCopy = computed(() => mobileHeroPresentation(currentBanner.value, locale.value))
const presentation = computed(() => normalizeHeroPresentation(currentBanner.value?.presentation))
const mobileImage = computed(() => getConfiguredStoreImageUrl(presentation.value.mobile_image_url))
const title = computed(() => presentation.value[`title_${locale.value === 'ar' ? 'ar' : 'en'}`])
const body = computed(() => presentation.value[`body_${locale.value === 'ar' ? 'ar' : 'en'}`])
const cta = computed(() => presentation.value[`cta_${locale.value === 'ar' ? 'ar' : 'en'}`])
const authoredCopy = computed(() => !!(title.value || body.value || cta.value))
const imageStyle = computed(() => ({ objectFit: presentation.value.fit, '--hero-position': `${presentation.value.focal_x}% ${presentation.value.focal_y}%`, '--hero-mobile-position': `${presentation.value.mobile_focal_x}% ${presentation.value.mobile_focal_y}%` }))
const currentBannerImageUrl = computed(() => getConfiguredStoreImageUrl(currentBanner.value?.image_url))
const currentBannerLinkUrl = computed(() => getStoreLinkUrl(currentBanner.value?.link_url))
const currentBannerExternal = computed(() => isExternalStoreLink(currentBannerLinkUrl.value))
const nuxtLink = resolveComponent('NuxtLinkLocale')
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
  if (heroBanners.value.length < 2) return
  currentBannerIndex.value = (currentBannerIndex.value + direction + heroBanners.value.length) % heroBanners.value.length
}
const onTouchEnd = event => {
  if (touchStart.value == null) return
  const distance = event.changedTouches[0]?.clientX - touchStart.value
  if (Math.abs(distance) > 50) moveBanner((distance < 0 ? 1 : -1) * (locale.value === 'ar' ? -1 : 1))
  touchStart.value = null
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
